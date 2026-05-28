//! Text compression / decompression Tauri commands.
//!
//! Replaces the in-process `brotli-wasm` + `CompressionStream`
//! pipeline previously used by `src/lib/services/compression.ts`. The
//! Rust crates (`flate2` for gzip, `brotli` for brotli) are 2–5x
//! faster than their browser-side equivalents and run inside
//! `tokio::task::spawn_blocking` so the renderer thread stays free.
//!
//! Compressed bytes round-trip as base64 to match the existing wire
//! contract the frontend already expected from `brotli-wasm`. Both
//! commands return both input and output byte counts so the route can
//! display the compression ratio without re-measuring.

use std::io::{Read, Write};

use base64::Engine;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression as GzipLevel;
use serde::{Deserialize, Serialize};

/// Supported compression algorithms. Matches the frontend
/// `CompressionAlgorithm` union (`'gzip' | 'brotli'`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Algorithm {
    Gzip,
    Brotli,
}

impl Algorithm {
    fn parse(raw: &str) -> Result<Self, String> {
        match raw.to_ascii_lowercase().as_str() {
            "gzip" => Ok(Self::Gzip),
            "brotli" => Ok(Self::Brotli),
            other => Err(format!("unknown algorithm: {other}")),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressResponse {
    /// Compressed payload encoded as standard base64 (no line breaks).
    pub bytes_base64: String,
    /// Resolved algorithm id (`gzip` or `brotli`).
    pub algorithm: String,
    /// Byte length of the input string (UTF-8 encoded).
    pub input_bytes: u64,
    /// Byte length of the compressed payload (pre-base64).
    pub output_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecompressResponse {
    /// Decompressed UTF-8 text.
    pub text: String,
    /// Algorithm the bytes were decoded with — resolved when caller
    /// passes `auto`.
    pub algorithm: String,
    /// Byte length of the compressed payload (pre-base64).
    pub input_bytes: u64,
    /// Byte length of the decoded text.
    pub output_bytes: u64,
}

/// Compress `text` under `algorithm` at the given level.
///
/// `level` semantics:
/// - gzip: 1–9 (flate2 `Compression::new`).
/// - brotli: 0–11 (brotli quality parameter).
///
/// # Errors
///
/// Returns `String` on algorithm parse failure, compression failure,
/// or worker join failure.
#[tauri::command]
pub async fn string_compress(
    text: String,
    algorithm: String,
    level: u32,
) -> Result<CompressResponse, String> {
    let algo = Algorithm::parse(&algorithm)?;
    let input_bytes = text.len() as u64;
    let bytes = tokio::task::spawn_blocking(move || -> Result<Vec<u8>, String> {
        match algo {
            Algorithm::Gzip => compress_gzip(text.as_bytes(), level),
            Algorithm::Brotli => compress_brotli(text.as_bytes(), level),
        }
    })
    .await
    .map_err(|e| format!("compression worker join failed: {e}"))??;
    let output_bytes = bytes.len() as u64;
    Ok(CompressResponse {
        bytes_base64: base64::engine::general_purpose::STANDARD.encode(&bytes),
        algorithm: match algo {
            Algorithm::Gzip => "gzip".into(),
            Algorithm::Brotli => "brotli".into(),
        },
        input_bytes,
        output_bytes,
    })
}

/// Decompress a base64 payload under `algorithm`.
///
/// `algorithm = "auto"` sniffs the gzip magic bytes (`1F 8B`) and
/// falls back to brotli on miss.
///
/// # Errors
///
/// Returns `String` on base64 decode failure, algorithm parse
/// failure, decompression failure, UTF-8 decode failure, or worker
/// join failure.
#[tauri::command]
pub async fn string_decompress(
    bytes_base64: String,
    algorithm: String,
) -> Result<DecompressResponse, String> {
    let raw = base64::engine::general_purpose::STANDARD
        .decode(bytes_base64.as_bytes())
        .map_err(|e| format!("base64 decode failed: {e}"))?;
    let input_bytes = raw.len() as u64;

    let resolved: Algorithm = if algorithm.eq_ignore_ascii_case("auto") {
        if raw.len() >= 2 && raw[0] == 0x1f && raw[1] == 0x8b {
            Algorithm::Gzip
        } else {
            Algorithm::Brotli
        }
    } else {
        Algorithm::parse(&algorithm)?
    };

    let decoded = tokio::task::spawn_blocking(move || -> Result<Vec<u8>, String> {
        match resolved {
            Algorithm::Gzip => decompress_gzip(&raw),
            Algorithm::Brotli => decompress_brotli(&raw),
        }
    })
    .await
    .map_err(|e| format!("decompression worker join failed: {e}"))??;

    let text = String::from_utf8(decoded).map_err(|e| format!("invalid UTF-8 output: {e}"))?;
    let output_bytes = text.len() as u64;
    Ok(DecompressResponse {
        text,
        algorithm: match resolved {
            Algorithm::Gzip => "gzip".into(),
            Algorithm::Brotli => "brotli".into(),
        },
        input_bytes,
        output_bytes,
    })
}

fn compress_gzip(input: &[u8], level: u32) -> Result<Vec<u8>, String> {
    let clamped = level.clamp(1, 9);
    let mut encoder = GzEncoder::new(Vec::new(), GzipLevel::new(clamped));
    encoder
        .write_all(input)
        .map_err(|e| format!("gzip encode failed: {e}"))?;
    encoder
        .finish()
        .map_err(|e| format!("gzip finish failed: {e}"))
}

fn decompress_gzip(input: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoder = GzDecoder::new(input);
    let mut out = Vec::new();
    decoder
        .read_to_end(&mut out)
        .map_err(|e| format!("gzip decode failed: {e}"))?;
    Ok(out)
}

fn compress_brotli(input: &[u8], level: u32) -> Result<Vec<u8>, String> {
    let quality = level.min(11);
    // Window size 22 is the brotli default and matches what brotli-wasm
    // produced; outputs round-trip with existing payloads.
    let mut writer = brotli::CompressorWriter::new(Vec::new(), 4096, quality, 22);
    writer
        .write_all(input)
        .map_err(|e| format!("brotli encode failed: {e}"))?;
    writer
        .flush()
        .map_err(|e| format!("brotli flush failed: {e}"))?;
    Ok(writer.into_inner())
}

fn decompress_brotli(input: &[u8]) -> Result<Vec<u8>, String> {
    let mut reader = brotli::Decompressor::new(input, 4096);
    let mut out = Vec::new();
    reader
        .read_to_end(&mut out)
        .map_err(|e| format!("brotli decode failed: {e}"))?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "The quick brown fox jumps over the lazy dog. Hello, world!";

    #[tokio::test]
    async fn gzip_round_trip() {
        let compressed = string_compress(SAMPLE.to_string(), "gzip".to_string(), 6)
            .await
            .unwrap();
        let decompressed = string_decompress(compressed.bytes_base64, "gzip".to_string())
            .await
            .unwrap();
        assert_eq!(decompressed.text, SAMPLE);
        assert_eq!(decompressed.algorithm, "gzip");
    }

    #[tokio::test]
    async fn brotli_round_trip() {
        let compressed = string_compress(SAMPLE.to_string(), "brotli".to_string(), 6)
            .await
            .unwrap();
        let decompressed = string_decompress(compressed.bytes_base64, "brotli".to_string())
            .await
            .unwrap();
        assert_eq!(decompressed.text, SAMPLE);
        assert_eq!(decompressed.algorithm, "brotli");
    }

    #[tokio::test]
    async fn auto_detects_gzip() {
        let compressed = string_compress(SAMPLE.to_string(), "gzip".to_string(), 6)
            .await
            .unwrap();
        let decompressed = string_decompress(compressed.bytes_base64, "auto".to_string())
            .await
            .unwrap();
        assert_eq!(decompressed.algorithm, "gzip");
        assert_eq!(decompressed.text, SAMPLE);
    }

    #[tokio::test]
    async fn auto_falls_back_to_brotli() {
        let compressed = string_compress(SAMPLE.to_string(), "brotli".to_string(), 6)
            .await
            .unwrap();
        let decompressed = string_decompress(compressed.bytes_base64, "auto".to_string())
            .await
            .unwrap();
        assert_eq!(decompressed.algorithm, "brotli");
        assert_eq!(decompressed.text, SAMPLE);
    }

    #[tokio::test]
    async fn unknown_algorithm_errors() {
        let err = string_compress(SAMPLE.to_string(), "lz4".to_string(), 6)
            .await
            .unwrap_err();
        assert!(err.contains("unknown algorithm"));
    }
}
