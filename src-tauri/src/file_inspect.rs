//! File inspector command.
//!
//! Reads a single file from disk and returns the raw metadata the
//! frontend needs to compute hashes, magic-byte MIME detection,
//! permissions, and previews. All hashing and decoding happens on the
//! frontend; this command exists because the browser sandbox cannot
//! reach the filesystem.
//!
//! For files up to [`MAX_FULL_BYTES`] (500 MB) the entire content is
//! returned base64-encoded so the frontend can compute hashes over the
//! whole file. Beyond that threshold only the first 4096 bytes are
//! returned, which still supports magic-byte sniffing and previews.

use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine as _;
use serde::Serialize;

/// Maximum byte count returned in `full_bytes_b64`. Anything larger is
/// considered too costly to ship through the IPC boundary in one shot.
const MAX_FULL_BYTES: u64 = 500 * 1024 * 1024;

/// Number of leading bytes always returned for magic-byte sniffing,
/// hex preview, and text preview.
const HEAD_BYTES: usize = 4096;

/// Result payload for `file_inspect`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInspectResult {
    /// Absolute path the file was read from.
    pub path: String,
    /// Final path component (e.g. `image.png`).
    pub filename: String,
    /// Extension without the leading dot, lowercased. Empty string when
    /// the filename has no extension.
    pub extension: String,
    /// File size in bytes.
    pub size_bytes: u64,
    /// Creation time as Unix milliseconds (when available).
    pub created_ms: Option<i64>,
    /// Modification time as Unix milliseconds (when available).
    pub modified_ms: Option<i64>,
    /// Last-access time as Unix milliseconds (when available).
    pub accessed_ms: Option<i64>,
    /// Octal Unix permission bits (e.g. `0644`). `None` on Windows.
    pub permissions_octal: Option<String>,
    /// Human-readable Unix permission string (e.g. `rw-r--r--`). `None`
    /// on Windows.
    pub permissions_string: Option<String>,
    /// Whether the file is read-only.
    pub readonly: bool,
    /// First [`HEAD_BYTES`] bytes of the file, base64-encoded.
    pub head_bytes_b64: String,
    /// Entire file content, base64-encoded. `None` when the file is
    /// larger than [`MAX_FULL_BYTES`].
    pub full_bytes_b64: Option<String>,
}

fn system_time_to_unix_ms(time: SystemTime) -> Option<i64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|d| i64::try_from(d.as_millis()).ok())
}

#[cfg(unix)]
fn unix_mode_bits(metadata: &fs::Metadata) -> u32 {
    use std::os::unix::fs::PermissionsExt;
    metadata.permissions().mode()
}

#[cfg(unix)]
fn format_octal(mode: u32) -> String {
    // Strip file-type bits and keep the permission triplet plus the
    // sticky / setuid / setgid bits in the leading digit.
    format!("0{:o}", mode & 0o7777)
}

#[cfg(unix)]
fn format_rwx(mode: u32) -> String {
    let triplet = |bits: u32,
                   exec_bit: u32,
                   special_bit: u32,
                   special_lower: char,
                   special_upper: char|
     -> String {
        let r = if bits & 0o4 != 0 { 'r' } else { '-' };
        let w = if bits & 0o2 != 0 { 'w' } else { '-' };
        let x_set = bits & 0o1 != 0;
        let special_set = mode & special_bit != 0;
        let x = match (x_set, special_set) {
            (true, true) => special_lower,
            (false, true) => special_upper,
            (true, false) => 'x',
            (false, false) => '-',
        };
        let _ = exec_bit; // reserved for future use; kept to surface intent
        format!("{r}{w}{x}")
    };

    let user = triplet((mode >> 6) & 0o7, 0o100, 0o4000, 's', 'S');
    let group = triplet((mode >> 3) & 0o7, 0o010, 0o2000, 's', 'S');
    let other = triplet(mode & 0o7, 0o001, 0o1000, 't', 'T');
    format!("{user}{group}{other}")
}

fn read_head(path: &Path, size: u64) -> Result<Vec<u8>, String> {
    let take = u64::min(size, HEAD_BYTES as u64);
    if take == 0 {
        return Ok(Vec::new());
    }
    let bytes = fs::read(path).map_err(|e| format!("Failed to read file head: {e}"))?;
    let usize_take = usize::try_from(take).unwrap_or(HEAD_BYTES);
    Ok(bytes.into_iter().take(usize_take).collect())
}

fn read_full(path: &Path) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|e| format!("Failed to read file: {e}"))
}

/// Inspect a file and return its metadata, head bytes, and (when small
/// enough) full contents for client-side hashing.
///
/// # Errors
///
/// Returns a stringified error when the path cannot be opened, the
/// file metadata cannot be queried, or reading the bytes fails.
#[tauri::command]
pub fn file_inspect(path: String) -> Result<FileInspectResult, String> {
    let path_buf = Path::new(&path).to_path_buf();
    let metadata = fs::metadata(&path_buf).map_err(|e| format!("Failed to stat file: {e}"))?;

    if !metadata.is_file() {
        return Err(format!("Not a regular file: {path}"));
    }

    let size_bytes = metadata.len();
    let filename = path_buf
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let extension = path_buf
        .extension()
        .map(|s| s.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();

    let created_ms = metadata.created().ok().and_then(system_time_to_unix_ms);
    let modified_ms = metadata.modified().ok().and_then(system_time_to_unix_ms);
    let accessed_ms = metadata.accessed().ok().and_then(system_time_to_unix_ms);

    let readonly = metadata.permissions().readonly();
    #[cfg(unix)]
    let (permissions_octal, permissions_string) = {
        let mode = unix_mode_bits(&metadata);
        (Some(format_octal(mode)), Some(format_rwx(mode)))
    };
    #[cfg(not(unix))]
    let (permissions_octal, permissions_string): (Option<String>, Option<String>) = (None, None);

    // For files larger than the cap we still want the head bytes for
    // magic detection and previews; only the full-buffer hashing path
    // degrades.
    let full_bytes = if size_bytes <= MAX_FULL_BYTES {
        Some(read_full(&path_buf)?)
    } else {
        None
    };

    let head_bytes: Vec<u8> = if let Some(full) = full_bytes.as_ref() {
        full.iter().take(HEAD_BYTES).copied().collect()
    } else {
        read_head(&path_buf, size_bytes)?
    };

    let engine = base64::engine::general_purpose::STANDARD;
    let head_bytes_b64 = engine.encode(&head_bytes);
    let full_bytes_b64 = full_bytes.as_ref().map(|b| engine.encode(b));

    Ok(FileInspectResult {
        path: path_buf.to_string_lossy().into_owned(),
        filename,
        extension,
        size_bytes,
        created_ms,
        modified_ms,
        accessed_ms,
        permissions_octal,
        permissions_string,
        readonly,
        head_bytes_b64,
        full_bytes_b64,
    })
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn format_octal_strips_filetype_bits() {
        // 0o100644 is a regular file with 0644 perms.
        assert_eq!(format_octal(0o100_644), "0644");
        assert_eq!(format_octal(0o040_755), "0755");
    }

    #[test]
    fn format_rwx_renders_classic_triplets() {
        assert_eq!(format_rwx(0o644), "rw-r--r--");
        assert_eq!(format_rwx(0o755), "rwxr-xr-x");
        assert_eq!(format_rwx(0o600), "rw-------");
    }

    #[test]
    fn format_rwx_renders_setuid_setgid_sticky() {
        // Setuid (04000) with exec on user.
        assert_eq!(format_rwx(0o4_755), "rwsr-xr-x");
        // Setuid without exec on user keeps the uppercase form.
        assert_eq!(format_rwx(0o4_655), "rwSr-xr-x");
        // Sticky bit with exec on other.
        assert_eq!(format_rwx(0o1_777), "rwxrwxrwt");
    }
}
