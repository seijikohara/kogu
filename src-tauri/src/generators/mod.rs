//! Cryptographic key generators module
//!
//! This module provides BCrypt hashing, SSH key generation, and GPG key generation
//! with support for both CLI tools and Rust library fallbacks.

pub mod bcrypt;
pub mod cli;
pub mod gpg;
pub mod ssh;

use serde::Serialize;
use thiserror::Error;

/// Common error type for all generators
#[derive(Debug, Error)]
pub enum GeneratorError {
    #[error("BCrypt error: {0}")]
    Bcrypt(String),

    #[error("SSH key generation error: {0}")]
    SshKey(String),

    #[error("GPG key generation error: {0}")]
    Gpg(String),

    #[error("CLI execution error: {0}")]
    CliExecution(String),

    /// CLI tool is not available (reserved for future use)
    #[allow(dead_code)]
    #[error("CLI tool not available: {0}")]
    CliNotAvailable(String),

    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),
}

impl Serialize for GeneratorError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Generation method preference
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum GenerationMethod {
    /// Use CLI tool if available
    #[default]
    Cli,
    /// Use Rust library
    Library,
}
