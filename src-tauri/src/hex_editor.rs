//! Hex editor / viewer commands.
//!
//! Provides three commands the frontend hex tool relies on:
//!
//! - `hex_open`   - inspect a file and return its size and modified
//!   timestamp so the viewer can size its virtual scroll viewport
//!   without first reading every byte.
//! - `hex_read`   - read a byte slice (offset + length) so the viewer
//!   can lazily fetch only the rows that are visible.
//! - `hex_save`   - apply a list of patch / insert / delete operations
//!   and write the result back to disk, optionally creating a `.bak`
//!   backup first.
//!
//! The save path re-reads the whole file into memory before applying
//! ops. That is sufficient for files up to a few hundred megabytes and
//! keeps the implementation pure-functional; streaming edits for
//! gigabyte-class files is deferred.

use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

/// Metadata returned by `hex_open` so the viewer can render virtual
/// scroll geometry without reading the entire file.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HexFileInfo {
    /// Absolute path the file lives at.
    pub path: String,
    /// Total file size in bytes.
    pub size_bytes: u64,
    /// Modification time as Unix milliseconds (when available).
    pub modified_ms: Option<i64>,
}

/// Single edit operation. The frontend collects these into an ordered
/// list and the backend applies them sequentially to an in-memory copy
/// of the file before writing back.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexEditOp {
    /// Byte offset at which the operation starts.
    pub offset: u64,
    /// Original bytes at `offset`. Used as a sanity check so concurrent
    /// file changes outside the editor do not silently get clobbered.
    pub original: Vec<u8>,
    /// New bytes. For `patch` the length matches `original`; for
    /// `insert` the original is empty; for `delete` the replacement is
    /// empty.
    pub replacement: Vec<u8>,
    /// `"patch"`, `"insert"`, or `"delete"`.
    pub kind: String,
}

fn system_time_to_unix_ms(time: SystemTime) -> Option<i64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|d| i64::try_from(d.as_millis()).ok())
}

/// Open a file and return its metadata.
///
/// # Errors
///
/// Returns a stringified error when the path cannot be stat-ed or when
/// the target is not a regular file.
#[tauri::command]
pub fn hex_open(path: String) -> Result<HexFileInfo, String> {
    let path_buf = Path::new(&path).to_path_buf();
    let metadata = fs::metadata(&path_buf).map_err(|e| format!("Failed to stat file: {e}"))?;
    if !metadata.is_file() {
        return Err(format!("Not a regular file: {path}"));
    }
    let modified_ms = metadata.modified().ok().and_then(system_time_to_unix_ms);
    Ok(HexFileInfo {
        path: path_buf.to_string_lossy().into_owned(),
        size_bytes: metadata.len(),
        modified_ms,
    })
}

/// Read a slice of a file starting at `offset` for at most `length`
/// bytes. Returns `Vec<u8>` so Tauri can serialise it as a number array
/// (the frontend reconstructs a `Uint8Array`).
///
/// # Errors
///
/// Returns a stringified error when the file cannot be opened, the
/// requested range is out of bounds, or reading fails.
#[tauri::command]
pub fn hex_read(path: String, offset: u64, length: u64) -> Result<Vec<u8>, String> {
    let path_buf = Path::new(&path).to_path_buf();
    let metadata = fs::metadata(&path_buf).map_err(|e| format!("Failed to stat file: {e}"))?;
    let size = metadata.len();
    if offset > size {
        return Err(format!(
            "Offset {offset} is past end of file ({size} bytes)"
        ));
    }
    let take = u64::min(length, size.saturating_sub(offset));
    let usize_take = usize::try_from(take).unwrap_or(0);
    let usize_offset = usize::try_from(offset).unwrap_or(0);
    let full = fs::read(&path_buf).map_err(|e| format!("Failed to read file: {e}"))?;
    Ok(full
        .into_iter()
        .skip(usize_offset)
        .take(usize_take)
        .collect())
}

/// Apply a single edit op to an in-memory buffer. Returns the new
/// buffer.
fn apply_op(buffer: Vec<u8>, op: &HexEditOp) -> Result<Vec<u8>, String> {
    let offset = usize::try_from(op.offset).map_err(|_| "Offset exceeds usize".to_string())?;
    match op.kind.as_str() {
        "patch" => {
            if op.original.len() != op.replacement.len() {
                return Err("patch op requires equal-length original and replacement".to_string());
            }
            if offset + op.original.len() > buffer.len() {
                return Err(format!(
                    "patch op offset {} + len {} exceeds buffer ({})",
                    offset,
                    op.original.len(),
                    buffer.len()
                ));
            }
            // Sanity-check original bytes match what is actually in the
            // buffer before applying the patch. This guards against the
            // file changing under the editor between read and save.
            let actual = &buffer[offset..offset + op.original.len()];
            if actual != op.original.as_slice() {
                return Err(format!(
                    "patch sanity check failed at offset {offset}: file content changed"
                ));
            }
            let mut next = buffer;
            next.splice(
                offset..offset + op.replacement.len(),
                op.replacement.iter().copied(),
            );
            Ok(next)
        }
        "insert" => {
            if offset > buffer.len() {
                return Err(format!(
                    "insert op offset {} exceeds buffer ({})",
                    offset,
                    buffer.len()
                ));
            }
            let mut next = buffer;
            next.splice(offset..offset, op.replacement.iter().copied());
            Ok(next)
        }
        "delete" => {
            let end = offset + op.original.len();
            if end > buffer.len() {
                return Err(format!(
                    "delete op offset {} + len {} exceeds buffer ({})",
                    offset,
                    op.original.len(),
                    buffer.len()
                ));
            }
            let actual = &buffer[offset..end];
            if actual != op.original.as_slice() {
                return Err(format!(
                    "delete sanity check failed at offset {offset}: file content changed"
                ));
            }
            let mut next = buffer;
            next.drain(offset..end);
            Ok(next)
        }
        other => Err(format!("Unknown op kind: {other}")),
    }
}

/// Apply a list of edits to `path` and write the result back. When
/// `backup` is true, the original file is moved to `<path>.bak` before
/// the new contents are written.
///
/// Returns the new file size as a decimal string.
///
/// # Errors
///
/// Returns a stringified error when reading the file fails, any op is
/// out of bounds, the backup rename fails, or the final write fails.
#[tauri::command]
pub fn hex_save(path: String, ops: Vec<HexEditOp>, backup: bool) -> Result<String, String> {
    let path_buf = Path::new(&path).to_path_buf();
    let original = fs::read(&path_buf).map_err(|e| format!("Failed to read file: {e}"))?;

    let edited = ops.iter().try_fold(original, apply_op)?;

    if backup {
        let mut backup_path = path_buf.clone();
        let backup_name = match path_buf.file_name() {
            Some(name) => {
                let mut s = name.to_os_string();
                s.push(".bak");
                s
            }
            None => return Err("Cannot derive backup name from path".to_string()),
        };
        backup_path.set_file_name(backup_name);
        // Best-effort: remove existing backup so we can rename over it.
        if backup_path.exists() {
            fs::remove_file(&backup_path)
                .map_err(|e| format!("Failed to remove old backup: {e}"))?;
        }
        fs::copy(&path_buf, &backup_path).map_err(|e| format!("Failed to write backup: {e}"))?;
    }

    fs::write(&path_buf, &edited).map_err(|e| format!("Failed to write file: {e}"))?;
    Ok(edited.len().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn op(kind: &str, offset: u64, original: &[u8], replacement: &[u8]) -> HexEditOp {
        HexEditOp {
            offset,
            original: original.to_vec(),
            replacement: replacement.to_vec(),
            kind: kind.to_string(),
        }
    }

    #[test]
    fn patch_replaces_bytes_in_place() {
        let buf = vec![0u8, 1, 2, 3, 4];
        let result = apply_op(buf, &op("patch", 1, &[1, 2], &[0xAA, 0xBB])).unwrap();
        assert_eq!(result, vec![0, 0xAA, 0xBB, 3, 4]);
    }

    #[test]
    fn patch_fails_on_sanity_mismatch() {
        let buf = vec![0u8, 1, 2, 3];
        let err = apply_op(buf, &op("patch", 1, &[9, 9], &[0xAA, 0xBB])).unwrap_err();
        assert!(err.contains("sanity"));
    }

    #[test]
    fn patch_requires_equal_lengths() {
        let buf = vec![0u8, 1, 2, 3];
        let err = apply_op(buf, &op("patch", 0, &[0], &[0, 1])).unwrap_err();
        assert!(err.contains("equal-length"));
    }

    #[test]
    fn insert_grows_buffer() {
        let buf = vec![0u8, 1, 2];
        let result = apply_op(buf, &op("insert", 1, &[], &[9, 9])).unwrap();
        assert_eq!(result, vec![0, 9, 9, 1, 2]);
    }

    #[test]
    fn insert_at_end_appends() {
        let buf = vec![0u8, 1];
        let result = apply_op(buf, &op("insert", 2, &[], &[9])).unwrap();
        assert_eq!(result, vec![0, 1, 9]);
    }

    #[test]
    fn delete_shrinks_buffer() {
        let buf = vec![0u8, 1, 2, 3, 4];
        let result = apply_op(buf, &op("delete", 1, &[1, 2], &[])).unwrap();
        assert_eq!(result, vec![0, 3, 4]);
    }

    #[test]
    fn delete_fails_on_sanity_mismatch() {
        let buf = vec![0u8, 1, 2, 3];
        let err = apply_op(buf, &op("delete", 1, &[9, 9], &[])).unwrap_err();
        assert!(err.contains("sanity"));
    }

    #[test]
    fn unknown_kind_is_rejected() {
        let buf = vec![0u8, 1, 2];
        let err = apply_op(buf, &op("rotate", 0, &[], &[])).unwrap_err();
        assert!(err.contains("Unknown op kind"));
    }

    #[test]
    fn ops_apply_in_order() {
        // delete then insert: simulate a length-changing edit.
        let buf = vec![0u8, 1, 2, 3, 4];
        let step1 = apply_op(buf, &op("delete", 1, &[1], &[])).unwrap();
        let step2 = apply_op(step1, &op("insert", 1, &[], &[0xAA, 0xBB])).unwrap();
        assert_eq!(step2, vec![0, 0xAA, 0xBB, 2, 3, 4]);
    }
}
