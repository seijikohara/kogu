//! Batch text hashing Tauri command.
//!
//! Mirrors [`crate::hash_batch::hash_file_batch`] for inline text input
//! instead of disk files. Lets the frontend drop its `crypto-js`
//! runtime dependency and shifts the cost off the renderer thread via
//! `tokio::task::spawn_blocking`.
//!
//! Algorithm strings match the hash-batch contract (`md5`, `sha1`,
//! `sha256`, `sha512`) so the same wire vocabulary covers both
//! commands.

use std::collections::BTreeMap;

use md5::{Digest as Md5Digest, Md5};
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use sha2::{Sha224, Sha256, Sha384, Sha512};

/// Per-algorithm hex digests of a single text payload.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HashTextResult {
    /// Lower-case hex digests keyed by algorithm id.
    pub hashes: BTreeMap<String, String>,
    /// Byte length of the UTF-8 encoded input. Useful for the UI's
    /// "X bytes" badge without recomputing client-side.
    pub size_bytes: u64,
}

/// Hash an in-memory text payload under each requested algorithm.
///
/// # Arguments
///
/// - `text` — the text payload (UTF-8 from the renderer).
/// - `algorithms` — algorithm ids; unknown values are silently dropped.
///
/// # Errors
///
/// Returns a `String` only when the `spawn_blocking` worker fails to
/// join (an internal panic). Empty algorithms is *not* an error; the
/// returned map is just empty.
#[tauri::command]
pub async fn hash_text_batch(
    text: String,
    algorithms: Vec<String>,
) -> Result<HashTextResult, String> {
    let size_bytes = text.len() as u64;
    let hashes = tokio::task::spawn_blocking(move || compute_hashes(&text, &algorithms))
        .await
        .map_err(|e| format!("hash worker join failed: {e}"))?;
    Ok(HashTextResult { hashes, size_bytes })
}

fn compute_hashes(text: &str, algorithms: &[String]) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    let bytes = text.as_bytes();
    for raw in algorithms {
        let id = raw.to_ascii_lowercase();
        let digest = match id.as_str() {
            "md5" => {
                let mut h = Md5::new();
                h.update(bytes);
                hex::encode(h.finalize())
            }
            "sha1" => {
                let mut h = Sha1::new();
                h.update(bytes);
                hex::encode(h.finalize())
            }
            "sha224" => {
                let mut h = Sha224::new();
                h.update(bytes);
                hex::encode(h.finalize())
            }
            "sha256" => {
                let mut h = Sha256::new();
                h.update(bytes);
                hex::encode(h.finalize())
            }
            "sha384" => {
                let mut h = Sha384::new();
                h.update(bytes);
                hex::encode(h.finalize())
            }
            "sha512" => {
                let mut h = Sha512::new();
                h.update(bytes);
                hex::encode(h.finalize())
            }
            _ => continue,
        };
        out.insert(id, digest);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_known_digests_for_empty_string() {
        // Reference values from RFC 1321 / NIST FIPS test vectors.
        let result = compute_hashes(
            "",
            &[
                "md5".into(),
                "sha1".into(),
                "sha256".into(),
                "sha512".into(),
            ],
        );
        assert_eq!(
            result.get("md5").unwrap(),
            "d41d8cd98f00b204e9800998ecf8427e"
        );
        assert_eq!(
            result.get("sha1").unwrap(),
            "da39a3ee5e6b4b0d3255bfef95601890afd80709"
        );
        assert_eq!(
            result.get("sha256").unwrap(),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn skips_unknown_algorithms() {
        let result = compute_hashes("test", &["md5".into(), "sha3".into()]);
        assert_eq!(result.len(), 1);
        assert!(result.contains_key("md5"));
    }

    #[test]
    fn matches_crypto_js_for_short_text() {
        // crypto-js MD5('hello') = 5d41402abc4b2a76b9719d911017c592
        let result = compute_hashes("hello", &["md5".into()]);
        assert_eq!(
            result.get("md5").unwrap(),
            "5d41402abc4b2a76b9719d911017c592"
        );
    }

    #[tokio::test]
    async fn end_to_end_round_trip() {
        let result = hash_text_batch("hello".to_string(), vec!["sha256".to_string()])
            .await
            .unwrap();
        assert_eq!(result.size_bytes, 5);
        assert_eq!(
            result.hashes.get("sha256").unwrap(),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }
}
