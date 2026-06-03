//! Drive / Disk Info command surface.
//!
//! Exposes two Tauri commands:
//!
//! * [`drives_list`] — enumerate mounted disks via the `sysinfo` crate and
//!   return a serializable snapshot of each one.
//! * [`folder_size_scan`] — walk the immediate children of a folder using
//!   `walkdir`, computing recursive sizes for each subdirectory. Emits
//!   `drive-info-scan-progress` events while the scan runs so the
//!   frontend can render a live progress indicator.
//!
//! All filesystem access happens entirely on the backend; the frontend
//! only renders the serialized result, mirroring how the rest of the
//! Files-category tools (File Inspector, Hex Editor) are structured.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

use serde::Serialize;
use sysinfo::Disks;
use tauri::Emitter;
use walkdir::WalkDir;

/// Snapshot of a single mounted drive / partition.
///
/// Some fields (`is_removable`, `is_read_only`) are reported by
/// `sysinfo` on the major desktop platforms (macOS, Linux, Windows) but
/// are not guaranteed to be accurate on every filesystem. The frontend
/// renders the raw value without trying to interpret edge cases.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    /// Display name of the drive (volume label) when the platform
    /// provides one. Falls back to the mount point's basename.
    pub name: String,
    /// Absolute mount point (`/`, `/Volumes/Foo`, `C:\\`).
    pub mount_point: String,
    /// Filesystem type string (`apfs`, `ntfs`, `ext4`).
    pub file_system: String,
    /// Drive kind label (`SSD`, `HDD`, `Unknown`).
    pub kind: String,
    /// Total capacity in bytes.
    pub total_bytes: u64,
    /// Available bytes for the current user.
    pub available_bytes: u64,
    /// Used bytes, computed as `total_bytes - available_bytes`.
    pub used_bytes: u64,
    /// Whether the drive is removable (USB stick, SD card).
    pub is_removable: bool,
    /// Whether the drive is mounted read-only.
    pub is_read_only: bool,
}

fn kind_label(kind: sysinfo::DiskKind) -> String {
    match kind {
        sysinfo::DiskKind::HDD => "HDD".to_string(),
        sysinfo::DiskKind::SSD => "SSD".to_string(),
        sysinfo::DiskKind::Unknown(code) => {
            if code < 0 {
                "Unknown".to_string()
            } else {
                format!("Other ({code})")
            }
        }
    }
}

fn drive_from_sysinfo(disk: &sysinfo::Disk) -> DriveInfo {
    let mount_point = disk.mount_point().to_string_lossy().into_owned();
    let raw_name = disk.name().to_string_lossy().into_owned();
    let name = if raw_name.is_empty() {
        Path::new(&mount_point)
            .file_name()
            .map_or_else(|| mount_point.clone(), |s| s.to_string_lossy().into_owned())
    } else {
        raw_name
    };
    let total_bytes = disk.total_space();
    let available_bytes = disk.available_space();
    let used_bytes = total_bytes.saturating_sub(available_bytes);
    DriveInfo {
        name,
        mount_point,
        file_system: disk.file_system().to_string_lossy().into_owned(),
        kind: kind_label(disk.kind()),
        total_bytes,
        available_bytes,
        used_bytes,
        is_removable: disk.is_removable(),
        is_read_only: disk.is_read_only(),
    }
}

/// Enumerate every mounted disk / partition the OS reports.
///
/// `sysinfo::Disks::new_with_refreshed_list()` performs a single
/// stat-per-disk pass, which is fast enough to call synchronously on
/// the UI thread for the typical desktop case (single-digit drive
/// count).
#[must_use]
#[tauri::command]
pub fn drives_list() -> Vec<DriveInfo> {
    let disks = Disks::new_with_refreshed_list();
    disks.list().iter().map(drive_from_sysinfo).collect()
}

/// One row in the result of [`folder_size_scan`]. Represents either an
/// immediate file or an immediate subdirectory of the scanned folder,
/// with a cumulative byte count.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FolderSizeEntry {
    /// Absolute path of the entry.
    pub path: String,
    /// Final path component (basename).
    pub name: String,
    /// `true` for directories, `false` for files.
    pub is_dir: bool,
    /// Cumulative size in bytes. For directories, the recursive sum of
    /// all file sizes underneath. For files, the file size.
    pub size_bytes: u64,
}

/// Progress payload emitted on `drive-info-scan-progress` events while a
/// folder scan is running. The frontend listens for these to render a
/// live entry count and accumulated byte total.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FolderScanProgress {
    /// Number of filesystem entries (files + directories) visited so
    /// far. Includes both immediate children and deep descendants.
    pub entries_visited: u64,
    /// Sum of all file sizes seen so far during the walk.
    pub bytes_seen: u64,
}

/// Walk `root` recursively and accumulate per-immediate-child sizes.
///
/// The walk is bounded by [`MAX_VISITED`] to keep the IPC payload and
/// UI render bounded for pathological folder trees (e.g. someone
/// picking `/`). Symlinks are not followed to avoid cycles.
const MAX_VISITED: u64 = 5_000_000;

/// Throttle progress events to one per [`PROGRESS_INTERVAL`] entries.
const PROGRESS_INTERVAL: u64 = 2_000;

fn entry_size(entry: &walkdir::DirEntry) -> u64 {
    entry
        .metadata()
        .map_or(0, |m| if m.is_file() { m.len() } else { 0 })
}

/// Identify which immediate child of `root` an absolute descendant
/// path belongs to.
fn child_index(root: &Path, descendant: &Path, children: &[PathBuf]) -> Option<usize> {
    if descendant == root {
        return None;
    }
    let relative = descendant.strip_prefix(root).ok()?;
    let first = relative.components().next()?;
    let first_path = root.join(first.as_os_str());
    children.iter().position(|p| p == &first_path)
}

fn collect_children(root: &Path) -> Result<Vec<FolderSizeEntry>, String> {
    let mut children: Vec<FolderSizeEntry> = Vec::new();
    let read_dir = std::fs::read_dir(root).map_err(|e| format!("Failed to read folder: {e}"))?;
    for entry_res in read_dir {
        let Ok(entry) = entry_res else { continue };
        let path = entry.path();
        let name = path
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default();
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let is_dir = metadata.is_dir();
        // File-size entries are immediate; directory sizes are filled
        // in during the recursive walk pass below.
        let size_bytes = if is_dir { 0 } else { metadata.len() };
        children.push(FolderSizeEntry {
            path: path.to_string_lossy().into_owned(),
            name,
            is_dir,
            size_bytes,
        });
    }
    Ok(children)
}

/// Scan a folder for per-immediate-child cumulative sizes (du-like).
///
/// # Errors
///
/// Returns an error string when `path` cannot be opened or is not a
/// directory. Per-entry I/O errors during the walk are ignored so a
/// single unreadable file does not abort the scan.
// Runs on a worker thread so the recursive directory walk never blocks the
// UI event loop. (Not currently wired to a route; off-thread keeps it
// freeze-safe should a caller be added.)
#[tauri::command(async)]
pub fn folder_size_scan(
    path: String,
    app: tauri::AppHandle,
) -> Result<Vec<FolderSizeEntry>, String> {
    let root = PathBuf::from(&path);
    let metadata = std::fs::metadata(&root).map_err(|e| format!("Failed to stat folder: {e}"))?;
    if !metadata.is_dir() {
        return Err(format!("Not a directory: {path}"));
    }

    let started = Instant::now();
    let mut entries = collect_children(&root)?;
    let child_paths: Vec<PathBuf> = entries.iter().map(|e| PathBuf::from(&e.path)).collect();
    let mut child_sizes: Vec<u64> = entries.iter().map(|e| e.size_bytes).collect();

    let visited = Arc::new(AtomicU64::new(0));
    let bytes = Arc::new(AtomicU64::new(0));

    let walker = WalkDir::new(&root)
        .follow_links(false)
        .min_depth(1)
        .into_iter()
        .filter_map(Result::ok);

    for entry in walker {
        let depth = entry.depth();
        if depth == 0 {
            continue;
        }
        let visited_count = visited.fetch_add(1, Ordering::Relaxed) + 1;
        if visited_count > MAX_VISITED {
            break;
        }
        let size = entry_size(&entry);
        if size > 0 {
            bytes.fetch_add(size, Ordering::Relaxed);
        }

        if depth > 1 {
            // Deep descendant: attribute size to the immediate-child bucket.
            if let Some(idx) = child_index(&root, entry.path(), &child_paths) {
                if let Some(slot) = child_sizes.get_mut(idx) {
                    *slot = slot.saturating_add(size);
                }
            }
        }

        if visited_count.is_multiple_of(PROGRESS_INTERVAL) {
            let payload = FolderScanProgress {
                entries_visited: visited_count,
                bytes_seen: bytes.load(Ordering::Relaxed),
            };
            // Best-effort emit; ignore failures so a missing window
            // listener cannot abort the scan.
            let _ = app.emit("drive-info-scan-progress", payload);
        }
    }

    for (idx, entry) in entries.iter_mut().enumerate() {
        if entry.is_dir {
            if let Some(size) = child_sizes.get(idx) {
                entry.size_bytes = *size;
            }
        }
    }

    entries.sort_by_key(|e| std::cmp::Reverse(e.size_bytes));

    let final_payload = FolderScanProgress {
        entries_visited: visited.load(Ordering::Relaxed),
        bytes_seen: bytes.load(Ordering::Relaxed),
    };
    let _ = app.emit("drive-info-scan-progress", final_payload);
    let _ = started.elapsed();

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn kind_label_renders_known_kinds() {
        assert_eq!(kind_label(sysinfo::DiskKind::HDD), "HDD");
        assert_eq!(kind_label(sysinfo::DiskKind::SSD), "SSD");
        assert_eq!(kind_label(sysinfo::DiskKind::Unknown(-1)), "Unknown");
        assert_eq!(kind_label(sysinfo::DiskKind::Unknown(5)), "Other (5)");
    }

    #[test]
    fn child_index_locates_first_segment() {
        let root = PathBuf::from("/tmp/root");
        let children = vec![PathBuf::from("/tmp/root/a"), PathBuf::from("/tmp/root/b")];
        let target = PathBuf::from("/tmp/root/a/deep/file.txt");
        assert_eq!(child_index(&root, &target, &children), Some(0));
        let target_b = PathBuf::from("/tmp/root/b/file.txt");
        assert_eq!(child_index(&root, &target_b, &children), Some(1));
        let target_root = PathBuf::from("/tmp/root");
        assert_eq!(child_index(&root, &target_root, &children), None);
    }

    #[test]
    fn collect_children_lists_immediate_entries() {
        let dir = std::env::temp_dir().join(format!(
            "kogu-drive-info-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_or(0, |d| d.as_nanos())
        ));
        fs::create_dir_all(&dir).unwrap();
        fs::create_dir_all(dir.join("sub")).unwrap();
        fs::write(dir.join("file.txt"), b"hello").unwrap();
        let children = collect_children(&dir).unwrap();
        assert_eq!(children.len(), 2);
        let file = children.iter().find(|c| c.name == "file.txt").unwrap();
        assert_eq!(file.size_bytes, 5);
        assert!(!file.is_dir);
        let sub = children.iter().find(|c| c.name == "sub").unwrap();
        assert!(sub.is_dir);
        // Directory-size accumulation happens in folder_size_scan, not
        // in collect_children; the immediate sub-folder size starts at
        // zero here.
        assert_eq!(sub.size_bytes, 0);
        fs::remove_dir_all(&dir).unwrap();
    }
}
