//! Duplicate file finder.
//!
//! Recursively walks a directory and groups byte-identical regular files
//! into a 3-stage pipeline so the work per file scales with how much of
//! a candidate group an entry can survive:
//!
//! 1. **Size bucket** - files of unique size are immediately discarded.
//! 2. **Partial hash** - the first 8 KiB of each remaining file is
//!    hashed. Files whose head hash is unique are discarded.
//! 3. **Full hash** - the entire file is hashed; survivors with matching
//!    full hashes are reported as a duplicate group.
//!
//! Hashing uses SHA-256 (default) or BLAKE3 (faster, optional).
//!
//! Progress events are streamed to the frontend via the
//! `duplicate-scan-progress` Tauri event channel so the UI can render a
//! progress bar and the current file path.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use blake3::Hasher as Blake3Hasher;
use globset::{Glob, GlobSet, GlobSetBuilder};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::Emitter;
use walkdir::WalkDir;

/// Bytes hashed from the head of a file during the partial-hash phase.
const PARTIAL_HASH_BYTES: usize = 8 * 1024;

/// Buffer size for streaming full-content hashing.
const HASH_CHUNK: usize = 64 * 1024;

/// Maximum number of files a single scan will inspect. Scans abort with
/// an error past this threshold so a runaway folder never wedges the UI.
const MAX_FILES_SCANNED: u64 = 1_000_000;

/// Emit a scanning-phase progress event every N candidate files.
const SCAN_PROGRESS_INTERVAL: u64 = 200;

/// Emit a partial-hash progress event every N files.
const PARTIAL_PROGRESS_INTERVAL: u64 = 50;

/// Emit a full-hash progress event every N files.
const FULL_PROGRESS_INTERVAL: u64 = 20;

/// `(path, optional modified timestamp in Unix milliseconds)` candidate
/// during the bucketing / hashing phases.
type Candidate = (PathBuf, Option<i64>);

/// Size-bucket entry: file size plus the candidates that share that size.
type SizeBucket = (u64, Vec<Candidate>);

/// Partial-hash bucket entry: `(size, partial-hash)` key plus the
/// candidates that share that key.
type PartialBucket = ((u64, String), Vec<Candidate>);

/// Scan request issued by the frontend.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRequest {
    /// Absolute path of the directory to scan recursively.
    pub root: String,
    /// Include globs - empty list matches everything.
    pub include_globs: Vec<String>,
    /// Exclude globs - matched files are skipped. Glob can match against
    /// either the filename or any full path component, so passing
    /// `node_modules` skips that directory tree.
    pub exclude_globs: Vec<String>,
    /// Skip files smaller than this many bytes.
    pub min_size: u64,
    /// Skip files larger than this many bytes.
    pub max_size: u64,
    /// `"sha256"` or `"blake3"`.
    pub algorithm: String,
}

/// One file entry within a duplicate group.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateEntry {
    /// Absolute path on disk.
    pub path: String,
    /// Modification time as Unix milliseconds (when available).
    pub modified_ms: Option<i64>,
}

/// A group of duplicate files sharing the same content hash.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    /// Hex-encoded content hash (algorithm depends on the request).
    pub hash: String,
    /// File size in bytes - identical across every entry.
    pub size_bytes: u64,
    /// Group members, sorted so the shortest-path entry comes first
    /// (treated as the "original" by the UI).
    pub paths: Vec<DuplicateEntry>,
}

/// Final result returned by `duplicate_scan`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    /// All duplicate groups discovered during the scan.
    pub groups: Vec<DuplicateGroup>,
    /// Total number of regular files inspected (post-filter).
    pub total_files: u64,
    /// Number of bytes that would be freed by deleting every duplicate
    /// except the first entry in each group.
    pub total_wasted_bytes: u64,
    /// Wall-clock time in milliseconds.
    pub elapsed_ms: u128,
}

/// Progress event payload streamed during a scan.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    /// `"scanning"`, `"hashing-partial"`, `"hashing-full"`, or `"done"`.
    pub phase: String,
    /// Currently processed path (or empty string when not file-specific).
    pub current: String,
    /// Number of items completed within the current phase.
    pub done: u64,
    /// Total items for the current phase (0 when unknown).
    pub total: u64,
}

fn system_time_to_unix_ms(time: SystemTime) -> Option<i64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|d| i64::try_from(d.as_millis()).ok())
}

fn build_globset(patterns: &[String]) -> Result<GlobSet, String> {
    let mut builder = GlobSetBuilder::new();
    for pat in patterns {
        let trimmed = pat.trim();
        if trimmed.is_empty() {
            continue;
        }
        let glob = Glob::new(trimmed).map_err(|e| format!("Invalid glob `{trimmed}`: {e}"))?;
        builder.add(glob);
    }
    builder
        .build()
        .map_err(|e| format!("Failed to build glob set: {e}"))
}

/// Decide whether a candidate path should be considered. A file passes
/// the filter when either the include set is empty OR any include
/// pattern matches the file name / a path component, AND no exclude
/// pattern matches the file name / a path component.
fn passes_filter(path: &Path, includes: &GlobSet, excludes: &GlobSet) -> bool {
    let file_name = path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();

    let components: Vec<String> = path
        .components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect();

    let matches_any =
        |set: &GlobSet| set.is_match(&file_name) || components.iter().any(|c| set.is_match(c));

    if !excludes.is_empty() && matches_any(excludes) {
        return false;
    }

    if includes.is_empty() {
        return true;
    }
    matches_any(includes)
}

/// Hash the first [`PARTIAL_HASH_BYTES`] bytes of a file with the
/// selected algorithm.
fn partial_hash(path: &Path, algorithm: &str) -> Result<String, String> {
    let file = File::open(path).map_err(|e| format!("Open `{}` failed: {e}", path.display()))?;
    let mut reader = BufReader::new(file);
    let mut buf = vec![0u8; PARTIAL_HASH_BYTES];
    let mut read_total = 0usize;
    while read_total < PARTIAL_HASH_BYTES {
        let n = reader
            .read(&mut buf[read_total..])
            .map_err(|e| format!("Read `{}` failed: {e}", path.display()))?;
        if n == 0 {
            break;
        }
        read_total += n;
    }
    buf.truncate(read_total);
    Ok(hash_bytes(&buf, algorithm))
}

fn hash_bytes(bytes: &[u8], algorithm: &str) -> String {
    if algorithm == "blake3" {
        return blake3::hash(bytes).to_hex().to_string();
    }
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

/// Stream-hash the full file contents.
fn full_hash(path: &Path, algorithm: &str) -> Result<String, String> {
    let file = File::open(path).map_err(|e| format!("Open `{}` failed: {e}", path.display()))?;
    let mut reader = BufReader::new(file);
    let mut buf = vec![0u8; HASH_CHUNK];

    if algorithm == "blake3" {
        let mut hasher = Blake3Hasher::new();
        loop {
            let n = reader
                .read(&mut buf)
                .map_err(|e| format!("Read `{}` failed: {e}", path.display()))?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
        }
        return Ok(hasher.finalize().to_hex().to_string());
    }

    let mut hasher = Sha256::new();
    loop {
        let n = reader
            .read(&mut buf)
            .map_err(|e| format!("Read `{}` failed: {e}", path.display()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Sort group entries so the shortest path comes first. Ties are broken
/// alphabetically so the order is stable across runs.
fn sort_group(entries: &mut [DuplicateEntry]) {
    entries.sort_by(|a, b| {
        a.path
            .len()
            .cmp(&b.path.len())
            .then_with(|| a.path.cmp(&b.path))
    });
}

fn emit_progress(app: &tauri::AppHandle, payload: &ScanProgress) {
    // Best-effort: never abort the scan because the UI channel dropped.
    let _ = app.emit("duplicate-scan-progress", payload.clone());
}

/// Phase 1: walk `root` and bucket candidates by size. Returns the
/// surviving size buckets (groups of 2+ files of the same size) plus the
/// total number of files inspected post-filter.
fn collect_size_buckets(
    app: &tauri::AppHandle,
    root: &Path,
    root_label: &str,
    includes: &GlobSet,
    excludes: &GlobSet,
    min_size: u64,
    max_size: u64,
) -> Result<(Vec<SizeBucket>, u64), String> {
    let mut by_size: HashMap<u64, Vec<Candidate>> = HashMap::new();
    let mut scanned: u64 = 0;
    let mut total_files: u64 = 0;

    emit_progress(
        app,
        &ScanProgress {
            phase: "scanning".to_string(),
            current: root_label.to_string(),
            done: 0,
            total: 0,
        },
    );

    for entry in WalkDir::new(root).follow_links(false) {
        let Ok(entry) = entry else { continue };

        let path = entry.path();
        if entry.file_type().is_dir() {
            continue;
        }
        if !entry.file_type().is_file() {
            continue;
        }
        if !passes_filter(path, includes, excludes) {
            continue;
        }

        scanned += 1;
        if scanned > MAX_FILES_SCANNED {
            return Err(format!(
                "Aborting scan: exceeded {MAX_FILES_SCANNED} files. Narrow the include / exclude filters."
            ));
        }

        let Ok(meta) = entry.metadata() else { continue };
        let size = meta.len();
        if size < min_size || size > max_size {
            continue;
        }

        total_files += 1;
        let modified_ms = meta.modified().ok().and_then(system_time_to_unix_ms);
        by_size
            .entry(size)
            .or_default()
            .push((path.to_path_buf(), modified_ms));

        if total_files.is_multiple_of(SCAN_PROGRESS_INTERVAL) {
            emit_progress(
                app,
                &ScanProgress {
                    phase: "scanning".to_string(),
                    current: path.display().to_string(),
                    done: total_files,
                    total: 0,
                },
            );
        }
    }

    let buckets: Vec<SizeBucket> = by_size
        .into_iter()
        .filter(|(_, files)| files.len() > 1)
        .collect();

    Ok((buckets, total_files))
}

/// Phase 2: partial-hash every survivor of phase 1 and bucket by
/// `(size, partial-hash)`.
fn collect_partial_buckets(
    app: &tauri::AppHandle,
    candidates: Vec<SizeBucket>,
    algorithm: &str,
) -> Vec<PartialBucket> {
    let mut partial: HashMap<(u64, String), Vec<Candidate>> = HashMap::new();
    let partial_total: u64 = candidates.iter().map(|(_, v)| v.len() as u64).sum();
    let mut partial_done: u64 = 0;

    for (size, files) in candidates {
        for (path, modified_ms) in files {
            partial_done += 1;
            if partial_done.is_multiple_of(PARTIAL_PROGRESS_INTERVAL)
                || partial_done == partial_total
            {
                emit_progress(
                    app,
                    &ScanProgress {
                        phase: "hashing-partial".to_string(),
                        current: path.display().to_string(),
                        done: partial_done,
                        total: partial_total,
                    },
                );
            }
            if let Ok(h) = partial_hash(&path, algorithm) {
                partial
                    .entry((size, h))
                    .or_default()
                    .push((path, modified_ms));
            }
        }
    }

    partial
        .into_iter()
        .filter(|(_, files)| files.len() > 1)
        .collect()
}

/// Phase 3: full-hash every survivor of phase 2 and bucket by
/// `(size, full-hash)`. Buckets whose file size fits within
/// [`PARTIAL_HASH_BYTES`] are accepted as-is because the partial hash
/// already covers the entire content.
fn collect_full_buckets(
    app: &tauri::AppHandle,
    candidates: Vec<PartialBucket>,
    algorithm: &str,
) -> HashMap<(u64, String), Vec<DuplicateEntry>> {
    let mut groups_map: HashMap<(u64, String), Vec<DuplicateEntry>> = HashMap::new();
    let full_total: u64 = candidates.iter().map(|(_, v)| v.len() as u64).sum();
    let mut full_done: u64 = 0;

    for ((size, partial_hash_hex), files) in candidates {
        if size <= PARTIAL_HASH_BYTES as u64 {
            let entries: Vec<DuplicateEntry> = files
                .into_iter()
                .map(|(p, modified_ms)| DuplicateEntry {
                    path: p.display().to_string(),
                    modified_ms,
                })
                .collect();
            full_done += entries.len() as u64;
            groups_map.insert((size, partial_hash_hex), entries);
            continue;
        }

        for (path, modified_ms) in files {
            full_done += 1;
            if full_done.is_multiple_of(FULL_PROGRESS_INTERVAL) || full_done == full_total {
                emit_progress(
                    app,
                    &ScanProgress {
                        phase: "hashing-full".to_string(),
                        current: path.display().to_string(),
                        done: full_done,
                        total: full_total,
                    },
                );
            }
            let Ok(h) = full_hash(&path, algorithm) else {
                continue;
            };
            groups_map
                .entry((size, h))
                .or_default()
                .push(DuplicateEntry {
                    path: path.display().to_string(),
                    modified_ms,
                });
        }
    }

    groups_map
}

/// Scan `req.root` for duplicate files.
///
/// # Errors
///
/// Returns a stringified error when the root path cannot be read,
/// globs fail to compile, or the file count exceeds
/// [`MAX_FILES_SCANNED`].
#[tauri::command]
pub fn duplicate_scan(app: tauri::AppHandle, req: ScanRequest) -> Result<ScanResult, String> {
    let started = Instant::now();

    let root = PathBuf::from(&req.root);
    let root_meta =
        fs::metadata(&root).map_err(|e| format!("Cannot read `{}`: {e}", root.display()))?;
    if !root_meta.is_dir() {
        return Err(format!("Not a directory: {}", root.display()));
    }

    let includes = build_globset(&req.include_globs)?;
    let excludes = build_globset(&req.exclude_globs)?;
    let algorithm = if req.algorithm == "blake3" {
        "blake3"
    } else {
        "sha256"
    };

    let (size_buckets, total_files) = collect_size_buckets(
        &app,
        &root,
        &req.root,
        &includes,
        &excludes,
        req.min_size,
        req.max_size,
    )?;

    let partial_buckets = collect_partial_buckets(&app, size_buckets, algorithm);
    let groups_map = collect_full_buckets(&app, partial_buckets, algorithm);

    let mut groups: Vec<DuplicateGroup> = groups_map
        .into_iter()
        .filter(|(_, entries)| entries.len() > 1)
        .map(|((size_bytes, hash), mut entries)| {
            sort_group(&mut entries);
            DuplicateGroup {
                hash,
                size_bytes,
                paths: entries,
            }
        })
        .collect();

    // Largest wasted size first.
    groups.sort_by(|a, b| {
        let wasted_a = a.size_bytes * (a.paths.len() as u64 - 1);
        let wasted_b = b.size_bytes * (b.paths.len() as u64 - 1);
        wasted_b.cmp(&wasted_a)
    });

    let total_wasted_bytes: u64 = groups
        .iter()
        .map(|g| g.size_bytes * (g.paths.len() as u64 - 1))
        .sum();

    emit_progress(
        &app,
        &ScanProgress {
            phase: "done".to_string(),
            current: String::new(),
            done: total_files,
            total: total_files,
        },
    );

    Ok(ScanResult {
        groups,
        total_files,
        total_wasted_bytes,
        elapsed_ms: started.elapsed().as_millis(),
    })
}

/// Delete the given files. Returns the total number of bytes freed.
///
/// # Errors
///
/// Returns a stringified error listing every path that could not be
/// removed; the operation continues past per-file failures so successful
/// deletes are not lost.
#[tauri::command]
pub fn duplicate_delete(paths: Vec<String>) -> Result<u64, String> {
    let mut freed: u64 = 0;
    let mut errors: Vec<String> = Vec::new();
    for p in paths {
        let path = PathBuf::from(&p);
        let size = fs::metadata(&path).map_or(0, |m| m.len());
        match fs::remove_file(&path) {
            Ok(()) => freed = freed.saturating_add(size),
            Err(e) => errors.push(format!("{p}: {e}")),
        }
    }
    if errors.is_empty() {
        Ok(freed)
    } else {
        Err(errors.join("; "))
    }
}

/// Replace `source` with a link to `target`. Both paths must already
/// exist; `source` is removed and a new link with the same name is
/// created pointing at `target`. The link kind depends on the OS:
///
/// - Unix: symbolic link via [`std::os::unix::fs::symlink`].
/// - Windows: hard link via [`std::fs::hard_link`]. Hard links cannot
///   span volumes; cross-volume attempts return an error from the OS.
///
/// Symbolic and hard links both reclaim duplicate disk space, but their
/// semantics differ: a symlink mirrors a path (broken if the target
/// moves); a hardlink shares the inode (broken only if every reference
/// is removed). The frontend surfaces this distinction in the action
/// label and About copy.
///
/// # Errors
///
/// Returns a stringified error when the source cannot be removed or the
/// link cannot be created (including the Windows cross-volume case).
#[tauri::command]
pub fn duplicate_replace_with_link(source: String, target: String) -> Result<(), String> {
    let source_path = PathBuf::from(&source);
    let target_path = PathBuf::from(&target);

    if !target_path.exists() {
        return Err(format!("Target does not exist: {target}"));
    }

    fs::remove_file(&source_path).map_err(|e| format!("Remove `{source}` failed: {e}"))?;

    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&target_path, &source_path)
            .map_err(|e| format!("Symlink failed: {e}"))?;
        Ok(())
    }
    #[cfg(windows)]
    {
        std::fs::hard_link(&target_path, &source_path).map_err(|e| {
            format!(
                "Hard link failed: {e} (hard links cannot span volumes; source and target must \
                 reside on the same drive)"
            )
        })?;
        Ok(())
    }
    #[cfg(not(any(unix, windows)))]
    {
        Err("Link replacement is not supported on this platform".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sort_group_prefers_shortest_path() {
        let mut entries = vec![
            DuplicateEntry {
                path: "/a/longer/path".to_string(),
                modified_ms: None,
            },
            DuplicateEntry {
                path: "/a/b".to_string(),
                modified_ms: None,
            },
            DuplicateEntry {
                path: "/a/c".to_string(),
                modified_ms: None,
            },
        ];
        sort_group(&mut entries);
        assert_eq!(entries[0].path, "/a/b");
        assert_eq!(entries[1].path, "/a/c");
        assert_eq!(entries[2].path, "/a/longer/path");
    }

    #[test]
    fn hash_bytes_sha256_matches_known_vector() {
        // SHA-256("") == e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
        let h = hash_bytes(&[], "sha256");
        assert_eq!(
            h,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn hash_bytes_blake3_matches_known_vector() {
        // BLAKE3 of empty string.
        let h = hash_bytes(&[], "blake3");
        assert_eq!(
            h,
            "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262"
        );
    }

    #[test]
    fn build_globset_accepts_simple_patterns() {
        let set = build_globset(&["*.txt".to_string(), "*.log".to_string()]).unwrap();
        assert!(set.is_match("hello.txt"));
        assert!(set.is_match("server.log"));
        assert!(!set.is_match("ignored.bin"));
    }

    #[test]
    fn build_globset_skips_empty_patterns() {
        let set = build_globset(&[String::new(), "  ".to_string()]).unwrap();
        assert_eq!(set.len(), 0);
    }

    #[test]
    fn passes_filter_respects_excludes() {
        let includes = build_globset(&[]).unwrap();
        let excludes = build_globset(&["node_modules".to_string()]).unwrap();
        let p = Path::new("/repo/node_modules/foo/bar.js");
        assert!(!passes_filter(p, &includes, &excludes));
    }

    #[test]
    fn passes_filter_respects_includes() {
        let includes = build_globset(&["*.png".to_string()]).unwrap();
        let excludes = build_globset(&[]).unwrap();
        assert!(passes_filter(
            Path::new("/x/y/icon.png"),
            &includes,
            &excludes
        ));
        assert!(!passes_filter(
            Path::new("/x/y/data.json"),
            &includes,
            &excludes
        ));
    }
}
