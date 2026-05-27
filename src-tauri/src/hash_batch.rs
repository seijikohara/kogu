//! File hash batch command.
//!
//! Reads N files from disk and computes the selected hash algorithms
//! (MD5 / SHA-1 / SHA-256 / SHA-512) for each one. Files are processed
//! concurrently with a configurable in-flight cap so a long list does
//! not flood the disk queue or pin every CPU core on the digest loop.
//!
//! The frontend file-picker can stage dozens of files, so streaming
//! reads and per-algorithm hash incremental updates keep memory bounded
//! to the read buffer regardless of file size.

use std::path::Path;
use std::sync::Arc;

use md5::{Digest as Md5Digest, Md5};
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use sha2::{Sha256, Sha512};
use tokio::fs::File;
use tokio::io::{AsyncReadExt, BufReader};
use tokio::sync::Semaphore;

/// Streaming read buffer size (1 MiB). Picked to amortize syscall
/// overhead without inflating peak memory when many files are in flight.
const READ_BUFFER_BYTES: usize = 1024 * 1024;

/// Maximum concurrent file hashing tasks. Caps disk pressure and
/// digest CPU usage when batching dozens of files.
const MAX_INFLIGHT: usize = 4;

/// Single-file hash result.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHashResult {
    /// Original absolute path supplied by the frontend.
    pub path: String,
    /// File size in bytes. Zero when the read failed before any size
    /// information could be obtained.
    pub size_bytes: u64,
    /// Map from algorithm id (`md5`, `sha1`, `sha256`, `sha512`) to
    /// lower-case hex digest. Algorithms outside the requested set are
    /// omitted.
    pub hashes: std::collections::BTreeMap<String, String>,
    /// Stringified error when the file could not be hashed, otherwise
    /// `None`. A non-`None` `error` means the `hashes` map is empty.
    pub error: Option<String>,
}

/// Multi-algorithm digest accumulator. Each variant is enabled per
/// the frontend's `algorithms` request so unused digests skip the
/// per-chunk update cost entirely.
struct DigestSet {
    md5: Option<Md5>,
    sha1: Option<Sha1>,
    sha256: Option<Sha256>,
    sha512: Option<Sha512>,
}

impl DigestSet {
    fn from_algorithms(algorithms: &[String]) -> Self {
        let lookup: Vec<String> = algorithms.iter().map(|a| a.to_ascii_lowercase()).collect();
        let wants = |name: &str| lookup.iter().any(|a| a == name);
        Self {
            md5: wants("md5").then(Md5::new),
            sha1: wants("sha1").then(Sha1::new),
            sha256: wants("sha256").then(Sha256::new),
            sha512: wants("sha512").then(Sha512::new),
        }
    }

    fn update(&mut self, chunk: &[u8]) {
        if let Some(d) = self.md5.as_mut() {
            d.update(chunk);
        }
        if let Some(d) = self.sha1.as_mut() {
            d.update(chunk);
        }
        if let Some(d) = self.sha256.as_mut() {
            d.update(chunk);
        }
        if let Some(d) = self.sha512.as_mut() {
            d.update(chunk);
        }
    }

    fn finalize(self) -> std::collections::BTreeMap<String, String> {
        let mut out = std::collections::BTreeMap::new();
        if let Some(d) = self.md5 {
            out.insert("md5".to_string(), hex::encode(d.finalize()));
        }
        if let Some(d) = self.sha1 {
            out.insert("sha1".to_string(), hex::encode(d.finalize()));
        }
        if let Some(d) = self.sha256 {
            out.insert("sha256".to_string(), hex::encode(d.finalize()));
        }
        if let Some(d) = self.sha512 {
            out.insert("sha512".to_string(), hex::encode(d.finalize()));
        }
        out
    }
}

async fn hash_one_file(path: String, algorithms: Arc<Vec<String>>) -> FileHashResult {
    let path_buf = Path::new(&path).to_path_buf();

    let metadata = match tokio::fs::metadata(&path_buf).await {
        Ok(m) => m,
        Err(e) => {
            return FileHashResult {
                path,
                size_bytes: 0,
                hashes: std::collections::BTreeMap::new(),
                error: Some(format!("Failed to stat file: {e}")),
            };
        }
    };

    if !metadata.is_file() {
        return FileHashResult {
            path,
            size_bytes: metadata.len(),
            hashes: std::collections::BTreeMap::new(),
            error: Some(format!("Not a regular file: {}", path_buf.display())),
        };
    }

    let size_bytes = metadata.len();

    let file = match File::open(&path_buf).await {
        Ok(f) => f,
        Err(e) => {
            return FileHashResult {
                path,
                size_bytes,
                hashes: std::collections::BTreeMap::new(),
                error: Some(format!("Failed to open file: {e}")),
            };
        }
    };

    let mut reader = BufReader::with_capacity(READ_BUFFER_BYTES, file);
    let mut digests = DigestSet::from_algorithms(&algorithms);
    let mut buffer = vec![0u8; READ_BUFFER_BYTES];

    loop {
        let read = match reader.read(&mut buffer).await {
            Ok(n) => n,
            Err(e) => {
                return FileHashResult {
                    path,
                    size_bytes,
                    hashes: std::collections::BTreeMap::new(),
                    error: Some(format!("Failed to read file: {e}")),
                };
            }
        };
        if read == 0 {
            break;
        }
        digests.update(&buffer[..read]);
    }

    FileHashResult {
        path,
        size_bytes,
        hashes: digests.finalize(),
        error: None,
    }
}

/// Hash a batch of files with the selected algorithms.
///
/// Results are returned in the same order as the input `paths`. Per-file
/// errors are reported in the `error` field of the corresponding
/// [`FileHashResult`] rather than failing the whole batch.
///
/// # Errors
///
/// Returns an error only when the input is structurally invalid (empty
/// `paths` or no recognized algorithms in `algorithms`). Per-file IO
/// failures surface as a non-`None` `error` on the matching result.
#[tauri::command]
pub async fn hash_file_batch(
    paths: Vec<String>,
    algorithms: Vec<String>,
) -> Result<Vec<FileHashResult>, String> {
    if paths.is_empty() {
        return Err("No files provided".to_string());
    }
    let recognized: Vec<String> = algorithms
        .iter()
        .map(|a| a.to_ascii_lowercase())
        .filter(|a| matches!(a.as_str(), "md5" | "sha1" | "sha256" | "sha512"))
        .collect();
    if recognized.is_empty() {
        return Err("No supported algorithms selected".to_string());
    }

    let algorithms = Arc::new(recognized);
    let semaphore = Arc::new(Semaphore::new(MAX_INFLIGHT));

    let mut handles = Vec::with_capacity(paths.len());
    for path in paths {
        let algorithms = Arc::clone(&algorithms);
        let semaphore = Arc::clone(&semaphore);
        handles.push(tokio::spawn(async move {
            // Permit acquisition failure means the semaphore was closed,
            // which we treat as a soft-cancel and surface as an error
            // rather than panicking inside the spawned task.
            let Ok(_permit) = semaphore.acquire_owned().await else {
                return FileHashResult {
                    path: path.clone(),
                    size_bytes: 0,
                    hashes: std::collections::BTreeMap::new(),
                    error: Some("Hash batch cancelled".to_string()),
                };
            };
            hash_one_file(path, algorithms).await
        }));
    }

    let mut results = Vec::with_capacity(handles.len());
    for handle in handles {
        match handle.await {
            Ok(r) => results.push(r),
            Err(e) => results.push(FileHashResult {
                path: String::new(),
                size_bytes: 0,
                hashes: std::collections::BTreeMap::new(),
                error: Some(format!("Hash task failed: {e}")),
            }),
        }
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn write_temp(bytes: &[u8]) -> NamedTempFile {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(bytes).unwrap();
        file.flush().unwrap();
        file
    }

    #[tokio::test]
    async fn hashes_empty_file() {
        let file = write_temp(b"");
        let path = file.path().to_string_lossy().into_owned();
        let res = hash_file_batch(vec![path], vec!["md5".into(), "sha256".into()])
            .await
            .unwrap();
        assert_eq!(res.len(), 1);
        assert!(res[0].error.is_none(), "{:?}", res[0].error);
        assert_eq!(
            res[0].hashes.get("md5").unwrap(),
            "d41d8cd98f00b204e9800998ecf8427e"
        );
        assert_eq!(
            res[0].hashes.get("sha256").unwrap(),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[tokio::test]
    async fn hashes_known_payload() {
        // "abc" -> SHA-1: a9993e36... / SHA-256: ba7816bf...
        let file = write_temp(b"abc");
        let path = file.path().to_string_lossy().into_owned();
        let res = hash_file_batch(
            vec![path],
            vec!["sha1".into(), "sha256".into(), "sha512".into()],
        )
        .await
        .unwrap();
        assert_eq!(
            res[0].hashes.get("sha1").unwrap(),
            "a9993e364706816aba3e25717850c26c9cd0d89d"
        );
        assert_eq!(
            res[0].hashes.get("sha256").unwrap(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert!(res[0].hashes.get("sha512").unwrap().len() == 128);
        assert_eq!(res[0].size_bytes, 3);
    }

    #[tokio::test]
    async fn reports_per_file_error_for_missing_path() {
        let res = hash_file_batch(
            vec!["/definitely/not/a/real/path/xyz".into()],
            vec!["sha256".into()],
        )
        .await
        .unwrap();
        assert_eq!(res.len(), 1);
        assert!(res[0].error.is_some());
        assert!(res[0].hashes.is_empty());
    }

    #[tokio::test]
    async fn rejects_empty_paths() {
        let res = hash_file_batch(vec![], vec!["sha256".into()]).await;
        assert!(res.is_err());
    }

    #[tokio::test]
    async fn rejects_unsupported_algorithms() {
        let res = hash_file_batch(vec!["x".into()], vec!["sha3".into()]).await;
        assert!(res.is_err());
    }
}
