//! Cryptographic key generators module
//!
//! This module provides `BCrypt` hashing, SSH key generation, and GPG key generation
//! with process isolation for cancellable operations.

pub mod bcrypt;
pub mod cli;
pub mod gpg;
pub mod ssh;
pub mod worker;

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

    #[cfg(test)]
    #[error("CLI execution error: {0}")]
    CliExecution(String),

    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),

    #[error("Worker error: {0}")]
    Worker(String),

    #[error("Operation cancelled")]
    Cancelled,
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
