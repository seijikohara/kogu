//! Archive Inspector / Extractor commands.
//!
//! Provides four Tauri commands the frontend archive tool consumes:
//!
//! - `archive_open` - parse an archive on disk and return its full
//!   entry listing without extracting any file content.
//! - `archive_read_entry` - read a single entry's bytes (capped) for
//!   inline previews (text, image, hex).
//! - `archive_extract` - extract a selection (or the whole archive) to
//!   a destination folder, respecting a conflict policy.
//! - `archive_extract_entry` - extract a single entry to a chosen
//!   file path (used by the per-row "Extract this file" action).
//!
//! Supported formats are autodetected by magic bytes:
//!
//! - `.zip`   (PK\x03\x04)
//! - `.tar`   (ustar magic at offset 257, or by `.tar` extension)
//! - `.tar.gz`/`.tgz` (1F 8B gzip header)
//! - `.tar.bz2`/`.tbz2` (42 5A 68 bzip2 header)
//! - `.tar.xz`/`.txz` (FD 37 7A 58 5A 00 xz header)
//! - `.7z` (37 7A BC AF 27 1C) - format identification only; listing /
//!   extraction are deferred to a follow-up to keep the dependency
//!   footprint bounded.
//!
//! Path safety: every entry path is validated against the destination
//! root to prevent "zip slip" style escapes via `..` components or
//! absolute paths.

use std::fs::{self, File};
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

use bzip2::read::BzDecoder;
use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use tokio_util::sync::CancellationToken;
use xz2::read::XzDecoder;

/// Cap on bytes returned by `archive_read_entry`. The frontend uses
/// this for inline previews only, so a few hundred kilobytes is plenty.
const MAX_PREVIEW_BYTES: u64 = 256 * 1024;

/// Single archive entry as serialised to the frontend.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntry {
    /// Path relative to the archive root, normalised to forward slashes.
    pub path: String,
    /// `true` for directory records (entries that end in `/`).
    pub is_dir: bool,
    /// Uncompressed size in bytes. `0` for directory entries.
    pub size_bytes: u64,
    /// Compressed size in bytes. For tar variants this equals
    /// `size_bytes` since tar itself does not compress per-entry.
    pub compressed_size: u64,
    /// Last-modified time as Unix milliseconds (when available).
    pub modified_ms: Option<i64>,
    /// CRC-32 checksum (zip only).
    pub crc32: Option<u32>,
}

/// Archive summary returned by `archive_open`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveInfo {
    /// Absolute path the archive was read from.
    pub path: String,
    /// One of `"zip" | "tar" | "tar.gz" | "tar.bz2" | "tar.xz" | "7z"`.
    pub format: String,
    /// Full list of entries.
    pub entries: Vec<ArchiveEntry>,
    /// `entries.len()` mirrored as a scalar so the JS side does not
    /// need to recompute it for the status bar.
    pub total_entries: u64,
    /// Sum of every entry's uncompressed size.
    pub total_uncompressed: u64,
    /// Sum of every entry's compressed size.
    pub total_compressed: u64,
}

/// Request payload for the batch extract command.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractRequest {
    /// Source archive path.
    pub archive_path: String,
    /// Entries to extract. When empty every entry is extracted.
    pub entries: Vec<String>,
    /// Destination directory (created on demand).
    pub destination_dir: String,
    /// `"skip"`, `"overwrite"`, or `"rename"`.
    pub conflict: String,
}

/// Convert a `zip::DateTime` (which exposes year/month/day/hour/min/sec
/// accessors but not a direct `SystemTime` conversion) into Unix
/// milliseconds. Returns `None` when the components do not form a valid
/// calendar date.
fn zip_datetime_to_unix_ms(dt: zip::DateTime) -> Option<i64> {
    // Days from the Unix epoch to the start of the given year using
    // Howard Hinnant's "days_from_civil" algorithm.
    let y = i64::from(dt.year());
    let m = i64::from(dt.month());
    let d = i64::from(dt.day());
    if !(1970..=9999).contains(&y) || !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    let (yy, mm) = if m <= 2 { (y - 1, m + 12) } else { (y, m) };
    let era = yy.div_euclid(400);
    let yoe = yy - era * 400;
    let doy = (153 * (mm - 3) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    let hour = i64::from(dt.hour());
    let minute = i64::from(dt.minute());
    let second = i64::from(dt.second());
    let secs = days * 86_400 + hour * 3600 + minute * 60 + second;
    secs.checked_mul(1000)
}

/// Detect the archive format from the first few magic bytes. Falls back
/// to filename extension when the header does not match a known format
/// (covers raw `.tar` files which have no global magic at offset 0).
fn detect_format(path: &Path) -> Result<&'static str, String> {
    let mut file = File::open(path).map_err(|e| format!("Failed to open archive: {e}"))?;
    let mut head = [0u8; 6];
    let read = file
        .read(&mut head)
        .map_err(|e| format!("Failed to read archive head: {e}"))?;

    if read >= 4 && head[0..4] == [0x50, 0x4B, 0x03, 0x04] {
        return Ok("zip");
    }
    if read >= 2 && head[0..2] == [0x1F, 0x8B] {
        return Ok("tar.gz");
    }
    if read >= 3 && head[0..3] == [0x42, 0x5A, 0x68] {
        return Ok("tar.bz2");
    }
    if read >= 6 && head[0..6] == [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00] {
        return Ok("tar.xz");
    }
    if read >= 6 && head[0..6] == [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C] {
        return Ok("7z");
    }

    // Plain tar archives carry their magic at offset 257.
    let mut ustar = [0u8; 8];
    file.seek(SeekFrom::Start(257))
        .map_err(|e| format!("Failed to seek to tar magic: {e}"))?;
    let tar_read = file
        .read(&mut ustar)
        .map_err(|e| format!("Failed to read tar magic: {e}"))?;
    if tar_read >= 5 && &ustar[0..5] == b"ustar" {
        return Ok("tar");
    }

    // Last resort: filename extension.
    let has_tar_extension = path
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("tar"));
    if has_tar_extension {
        return Ok("tar");
    }
    Err(format!("Unrecognised archive format: {}", path.display()))
}

fn list_zip(path: &Path) -> Result<Vec<ArchiveEntry>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open zip: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to parse zip: {e}"))?;

    let entries: Result<Vec<ArchiveEntry>, String> = (0..archive.len())
        .map(|i| {
            let entry = archive
                .by_index(i)
                .map_err(|e| format!("Failed to read zip entry: {e}"))?;
            let path = entry.name().replace('\\', "/");
            let is_dir = entry.is_dir();
            let modified_ms = entry.last_modified().and_then(zip_datetime_to_unix_ms);
            Ok(ArchiveEntry {
                path,
                is_dir,
                size_bytes: entry.size(),
                compressed_size: entry.compressed_size(),
                modified_ms,
                crc32: Some(entry.crc32()),
            })
        })
        .collect();
    entries
}

fn list_tar_stream<R: Read>(reader: R) -> Result<Vec<ArchiveEntry>, String> {
    let mut archive = tar::Archive::new(reader);
    archive
        .entries()
        .map_err(|e| format!("Failed to read tar entries: {e}"))?
        .map(|entry_result| {
            let entry = entry_result.map_err(|e| format!("Failed to iterate tar entry: {e}"))?;
            let header = entry.header();
            let raw_path = entry
                .path()
                .map_err(|e| format!("Failed to read entry path: {e}"))?
                .to_string_lossy()
                .replace('\\', "/");
            let is_dir = header.entry_type().is_dir();
            let size = entry.size();
            let mtime = header
                .mtime()
                .ok()
                .and_then(|secs| i64::try_from(secs).ok().and_then(|s| s.checked_mul(1000)));
            Ok(ArchiveEntry {
                path: raw_path,
                is_dir,
                size_bytes: size,
                compressed_size: size,
                modified_ms: mtime,
                crc32: None,
            })
        })
        .collect()
}

fn list_tar(path: &Path) -> Result<Vec<ArchiveEntry>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open tar: {e}"))?;
    list_tar_stream(file)
}

fn list_tar_gz(path: &Path) -> Result<Vec<ArchiveEntry>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open tar.gz: {e}"))?;
    list_tar_stream(GzDecoder::new(file))
}

fn list_tar_bz2(path: &Path) -> Result<Vec<ArchiveEntry>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open tar.bz2: {e}"))?;
    list_tar_stream(BzDecoder::new(file))
}

fn list_tar_xz(path: &Path) -> Result<Vec<ArchiveEntry>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open tar.xz: {e}"))?;
    list_tar_stream(XzDecoder::new(file))
}

fn list_entries(format: &str, path: &Path) -> Result<Vec<ArchiveEntry>, String> {
    match format {
        "zip" => list_zip(path),
        "tar" => list_tar(path),
        "tar.gz" => list_tar_gz(path),
        "tar.bz2" => list_tar_bz2(path),
        "tar.xz" => list_tar_xz(path),
        "7z" => Err("7z listing is not yet supported; format identification only.".to_string()),
        other => Err(format!("Unsupported archive format: {other}")),
    }
}

/// Parse an archive and return its full directory listing.
///
/// Runs off the main thread: parsing a large archive index iterates every
/// record, which would otherwise block the webview event loop.
#[tauri::command(async)]
pub fn archive_open(path: String) -> Result<ArchiveInfo, String> {
    let path_buf = Path::new(&path).to_path_buf();
    let format = detect_format(&path_buf)?;

    // 7z: surface the format without crashing the UI; callers can still
    // see metadata and offer "Open with..." paths.
    let entries = if format == "7z" {
        Vec::new()
    } else {
        list_entries(format, &path_buf)?
    };

    let total_uncompressed = entries.iter().map(|e| e.size_bytes).sum();
    let total_compressed = entries.iter().map(|e| e.compressed_size).sum();
    let total_entries = entries.len() as u64;

    Ok(ArchiveInfo {
        path: path_buf.to_string_lossy().into_owned(),
        format: format.to_string(),
        entries,
        total_entries,
        total_uncompressed,
        total_compressed,
    })
}

/// Read a single entry's bytes, capped at [`MAX_PREVIEW_BYTES`] or
/// `max_bytes` (whichever is smaller).
#[tauri::command]
pub fn archive_read_entry(
    archive_path: String,
    entry_path: String,
    max_bytes: u64,
) -> Result<Vec<u8>, String> {
    let path_buf = Path::new(&archive_path).to_path_buf();
    let format = detect_format(&path_buf)?;
    let cap = u64::min(max_bytes, MAX_PREVIEW_BYTES);

    let take = usize::try_from(cap).unwrap_or(usize::MAX);

    match format {
        "zip" => read_zip_entry(&path_buf, &entry_path, take),
        "tar" => {
            let file = File::open(&path_buf).map_err(|e| format!("Failed to open tar: {e}"))?;
            read_tar_entry_stream(file, &entry_path, take)
        }
        "tar.gz" => {
            let file = File::open(&path_buf).map_err(|e| format!("Failed to open tar.gz: {e}"))?;
            read_tar_entry_stream(GzDecoder::new(file), &entry_path, take)
        }
        "tar.bz2" => {
            let file = File::open(&path_buf).map_err(|e| format!("Failed to open tar.bz2: {e}"))?;
            read_tar_entry_stream(BzDecoder::new(file), &entry_path, take)
        }
        "tar.xz" => {
            let file = File::open(&path_buf).map_err(|e| format!("Failed to open tar.xz: {e}"))?;
            read_tar_entry_stream(XzDecoder::new(file), &entry_path, take)
        }
        "7z" => Err("7z preview is not yet supported.".to_string()),
        other => Err(format!("Unsupported archive format: {other}")),
    }
}

fn read_zip_entry(archive: &Path, entry_path: &str, take: usize) -> Result<Vec<u8>, String> {
    let file = File::open(archive).map_err(|e| format!("Failed to open zip: {e}"))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Failed to parse zip: {e}"))?;
    let mut entry = zip
        .by_name(entry_path)
        .map_err(|e| format!("Entry not found: {e}"))?;
    let mut buf = Vec::new();
    entry
        .by_ref()
        .take(take as u64)
        .read_to_end(&mut buf)
        .map_err(|e| format!("Failed to read entry: {e}"))?;
    Ok(buf)
}

fn read_tar_entry_stream<R: Read>(
    reader: R,
    entry_path: &str,
    take: usize,
) -> Result<Vec<u8>, String> {
    let mut archive = tar::Archive::new(reader);
    let entries = archive
        .entries()
        .map_err(|e| format!("Failed to read tar entries: {e}"))?;
    for entry_result in entries {
        let mut entry = entry_result.map_err(|e| format!("Failed to iterate tar entry: {e}"))?;
        let path_string = entry
            .path()
            .map_err(|e| format!("Failed to read entry path: {e}"))?
            .to_string_lossy()
            .replace('\\', "/");
        if path_string == entry_path {
            let mut buf = Vec::new();
            entry
                .by_ref()
                .take(take as u64)
                .read_to_end(&mut buf)
                .map_err(|e| format!("Failed to read entry: {e}"))?;
            return Ok(buf);
        }
    }
    Err(format!("Entry not found: {entry_path}"))
}

/// Reject paths that escape `root` via absolute paths, drive prefixes,
/// or `..` traversal. Returns the safe joined path on success.
fn safe_join(root: &Path, entry_path: &str) -> Result<PathBuf, String> {
    let candidate = Path::new(entry_path);
    let mut buf = root.to_path_buf();
    for component in candidate.components() {
        match component {
            Component::Normal(part) => buf.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(format!("Unsafe entry path rejected: {entry_path}"));
            }
        }
    }
    Ok(buf)
}

/// Compute a non-colliding "rename" path by appending ` (n)` before the
/// extension. Used by the `"rename"` conflict policy.
fn rename_path(target: &Path) -> PathBuf {
    if !target.exists() {
        return target.to_path_buf();
    }
    let parent = target.parent().unwrap_or_else(|| Path::new(""));
    let stem = target
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let ext = target
        .extension()
        .map(|e| e.to_string_lossy().into_owned())
        .unwrap_or_default();
    // Cap retries so the search terminates even when every plausible
    // name on disk is taken; in practice the directory becomes the
    // wider failure long before this limit.
    (1u32..=10_000)
        .map(|i| {
            let name = if ext.is_empty() {
                format!("{stem} ({i})")
            } else {
                format!("{stem} ({i}).{ext}")
            };
            parent.join(name)
        })
        .find(|p| !p.exists())
        .unwrap_or_else(|| target.to_path_buf())
}

/// Resolve where to write a given destination according to `conflict`.
/// Returns `None` when the entry should be skipped.
fn resolve_destination(target: PathBuf, conflict: &str) -> Result<Option<PathBuf>, String> {
    if !target.exists() {
        return Ok(Some(target));
    }
    match conflict {
        "skip" => Ok(None),
        "overwrite" => Ok(Some(target)),
        "rename" => Ok(Some(rename_path(&target))),
        other => Err(format!("Unknown conflict policy: {other}")),
    }
}

/// Extract a single named entry to a specified destination file path.
/// Returns the number of bytes written. Directory entries are created
/// without contents.
///
/// Runs off the main thread: a single entry can be large, and copying it
/// to disk would otherwise block the webview event loop.
#[tauri::command(async)]
pub fn archive_extract_entry(
    archive_path: String,
    entry_path: String,
    destination_path: String,
) -> Result<u64, String> {
    let archive = Path::new(&archive_path).to_path_buf();
    let dest = Path::new(&destination_path).to_path_buf();
    let format = detect_format(&archive)?;

    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create destination directory: {e}"))?;
    }

    match format {
        "zip" => extract_zip_one(&archive, &entry_path, &dest),
        "tar" => {
            let file = File::open(&archive).map_err(|e| format!("Failed to open tar: {e}"))?;
            extract_tar_one_stream(file, &entry_path, &dest)
        }
        "tar.gz" => {
            let file = File::open(&archive).map_err(|e| format!("Failed to open tar.gz: {e}"))?;
            extract_tar_one_stream(GzDecoder::new(file), &entry_path, &dest)
        }
        "tar.bz2" => {
            let file = File::open(&archive).map_err(|e| format!("Failed to open tar.bz2: {e}"))?;
            extract_tar_one_stream(BzDecoder::new(file), &entry_path, &dest)
        }
        "tar.xz" => {
            let file = File::open(&archive).map_err(|e| format!("Failed to open tar.xz: {e}"))?;
            extract_tar_one_stream(XzDecoder::new(file), &entry_path, &dest)
        }
        "7z" => Err("7z extraction is not yet supported.".to_string()),
        other => Err(format!("Unsupported archive format: {other}")),
    }
}

fn extract_zip_one(archive: &Path, entry_path: &str, dest: &Path) -> Result<u64, String> {
    let file = File::open(archive).map_err(|e| format!("Failed to open zip: {e}"))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Failed to parse zip: {e}"))?;
    let mut entry = zip
        .by_name(entry_path)
        .map_err(|e| format!("Entry not found: {e}"))?;
    if entry.is_dir() {
        fs::create_dir_all(dest).map_err(|e| format!("Failed to create directory: {e}"))?;
        return Ok(0);
    }
    let mut out = File::create(dest).map_err(|e| format!("Failed to create file: {e}"))?;
    let written = io::copy(&mut entry, &mut out).map_err(|e| format!("Failed to write: {e}"))?;
    Ok(written)
}

fn extract_tar_one_stream<R: Read>(
    reader: R,
    entry_path: &str,
    dest: &Path,
) -> Result<u64, String> {
    let mut archive = tar::Archive::new(reader);
    let entries = archive
        .entries()
        .map_err(|e| format!("Failed to read tar entries: {e}"))?;
    for entry_result in entries {
        let mut entry = entry_result.map_err(|e| format!("Failed to iterate tar entry: {e}"))?;
        let path_string = entry
            .path()
            .map_err(|e| format!("Failed to read entry path: {e}"))?
            .to_string_lossy()
            .replace('\\', "/");
        if path_string == entry_path {
            if entry.header().entry_type().is_dir() {
                fs::create_dir_all(dest).map_err(|e| format!("Failed to create directory: {e}"))?;
                return Ok(0);
            }
            let mut out = File::create(dest).map_err(|e| format!("Failed to create file: {e}"))?;
            let written =
                io::copy(&mut entry, &mut out).map_err(|e| format!("Failed to write: {e}"))?;
            return Ok(written);
        }
    }
    Err(format!("Entry not found: {entry_path}"))
}

/// Extract a selection of entries (or every entry when the selection
/// is empty) to a destination directory. Returns the number of files
/// actually written; skipped entries do not count.
#[tauri::command(async)]
pub fn archive_extract(
    op_id: String,
    req: ExtractRequest,
    state: tauri::State<'_, crate::cancellation::OperationRegistry>,
) -> Result<u64, String> {
    let token = Arc::new(CancellationToken::new());
    state.register(op_id.clone(), token.clone());
    let result = run_archive_extract(req, &token);
    state.remove(&op_id);
    result
}

fn run_archive_extract(req: ExtractRequest, token: &CancellationToken) -> Result<u64, String> {
    let archive = Path::new(&req.archive_path).to_path_buf();
    let dest_root = Path::new(&req.destination_dir).to_path_buf();
    fs::create_dir_all(&dest_root)
        .map_err(|e| format!("Failed to create destination directory: {e}"))?;
    let format = detect_format(&archive)?;

    let filter: Option<std::collections::HashSet<String>> = if req.entries.is_empty() {
        None
    } else {
        Some(req.entries.iter().cloned().collect())
    };

    let conflict = req.conflict.as_str();

    match format {
        "zip" => extract_zip_all(&archive, &dest_root, filter.as_ref(), conflict, token),
        "tar" => {
            let file = File::open(&archive).map_err(|e| format!("Failed to open tar: {e}"))?;
            extract_tar_all_stream(file, &dest_root, filter.as_ref(), conflict, token)
        }
        "tar.gz" => {
            let file = File::open(&archive).map_err(|e| format!("Failed to open tar.gz: {e}"))?;
            extract_tar_all_stream(
                GzDecoder::new(file),
                &dest_root,
                filter.as_ref(),
                conflict,
                token,
            )
        }
        "tar.bz2" => {
            let file = File::open(&archive).map_err(|e| format!("Failed to open tar.bz2: {e}"))?;
            extract_tar_all_stream(
                BzDecoder::new(file),
                &dest_root,
                filter.as_ref(),
                conflict,
                token,
            )
        }
        "tar.xz" => {
            let file = File::open(&archive).map_err(|e| format!("Failed to open tar.xz: {e}"))?;
            extract_tar_all_stream(
                XzDecoder::new(file),
                &dest_root,
                filter.as_ref(),
                conflict,
                token,
            )
        }
        "7z" => Err("7z extraction is not yet supported.".to_string()),
        other => Err(format!("Unsupported archive format: {other}")),
    }
}

fn extract_zip_all(
    archive: &Path,
    dest_root: &Path,
    filter: Option<&std::collections::HashSet<String>>,
    conflict: &str,
    token: &CancellationToken,
) -> Result<u64, String> {
    let file = File::open(archive).map_err(|e| format!("Failed to open zip: {e}"))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Failed to parse zip: {e}"))?;

    let indices: Vec<usize> = (0..zip.len()).collect();
    let mut written: u64 = 0;
    for i in indices {
        if token.is_cancelled() {
            return Err("Operation cancelled".to_string());
        }
        let mut entry = zip
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {e}"))?;
        let name = entry.name().replace('\\', "/");
        if let Some(set) = filter {
            if !set.contains(&name) {
                continue;
            }
        }
        let target = safe_join(dest_root, &name)?;
        if entry.is_dir() {
            fs::create_dir_all(&target).map_err(|e| format!("Failed to create directory: {e}"))?;
            continue;
        }
        let Some(resolved) = resolve_destination(target, conflict)? else {
            continue;
        };
        if let Some(parent) = resolved.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {e}"))?;
        }
        let mut out = File::create(&resolved).map_err(|e| format!("Failed to create file: {e}"))?;
        io::copy(&mut entry, &mut out).map_err(|e| format!("Failed to write: {e}"))?;
        written += 1;
    }
    Ok(written)
}

fn extract_tar_all_stream<R: Read>(
    reader: R,
    dest_root: &Path,
    filter: Option<&std::collections::HashSet<String>>,
    conflict: &str,
    token: &CancellationToken,
) -> Result<u64, String> {
    let mut archive = tar::Archive::new(reader);
    let entries = archive
        .entries()
        .map_err(|e| format!("Failed to read tar entries: {e}"))?;
    let mut written: u64 = 0;
    for entry_result in entries {
        if token.is_cancelled() {
            return Err("Operation cancelled".to_string());
        }
        let mut entry = entry_result.map_err(|e| format!("Failed to iterate tar entry: {e}"))?;
        let path_string = entry
            .path()
            .map_err(|e| format!("Failed to read entry path: {e}"))?
            .to_string_lossy()
            .replace('\\', "/");
        if let Some(set) = filter {
            if !set.contains(&path_string) {
                continue;
            }
        }
        let target = safe_join(dest_root, &path_string)?;
        if entry.header().entry_type().is_dir() {
            fs::create_dir_all(&target).map_err(|e| format!("Failed to create directory: {e}"))?;
            continue;
        }
        let Some(resolved) = resolve_destination(target, conflict)? else {
            continue;
        };
        if let Some(parent) = resolved.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {e}"))?;
        }
        let mut out = File::create(&resolved).map_err(|e| format!("Failed to create file: {e}"))?;
        io::copy(&mut entry, &mut out).map_err(|e| format!("Failed to write: {e}"))?;
        written += 1;
    }
    Ok(written)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_join_accepts_relative_paths() {
        let root = Path::new("/tmp/out");
        let result = safe_join(root, "foo/bar.txt").unwrap();
        assert_eq!(result, Path::new("/tmp/out/foo/bar.txt"));
    }

    #[test]
    fn safe_join_rejects_parent_traversal() {
        let root = Path::new("/tmp/out");
        let err = safe_join(root, "../escape.txt").unwrap_err();
        assert!(err.contains("Unsafe"));
    }

    #[test]
    fn safe_join_rejects_absolute_paths() {
        let root = Path::new("/tmp/out");
        let err = safe_join(root, "/etc/passwd").unwrap_err();
        assert!(err.contains("Unsafe"));
    }

    #[test]
    fn safe_join_normalises_current_dir_segments() {
        let root = Path::new("/tmp/out");
        let result = safe_join(root, "./foo/./bar").unwrap();
        assert_eq!(result, Path::new("/tmp/out/foo/bar"));
    }

    #[test]
    fn rename_path_returns_same_when_target_missing() {
        let target = Path::new("/tmp/this-should-not-exist-kogu-test/file.txt");
        let result = rename_path(target);
        assert_eq!(result, target);
    }

    #[test]
    fn resolve_destination_skips_when_policy_requests() {
        let dir = std::env::temp_dir().join("kogu-archive-resolve");
        fs::create_dir_all(&dir).unwrap();
        let existing = dir.join("dup.txt");
        fs::write(&existing, b"x").unwrap();
        let resolved = resolve_destination(existing.clone(), "skip").unwrap();
        assert!(resolved.is_none());
        fs::remove_file(&existing).unwrap();
    }

    #[test]
    fn resolve_destination_unknown_policy_errors() {
        let dir = std::env::temp_dir().join("kogu-archive-resolve-2");
        fs::create_dir_all(&dir).unwrap();
        let existing = dir.join("dup.txt");
        fs::write(&existing, b"x").unwrap();
        let err = resolve_destination(existing.clone(), "explode").unwrap_err();
        assert!(err.contains("Unknown conflict policy"));
        fs::remove_file(&existing).unwrap();
    }
}
