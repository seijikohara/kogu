//! SSH key generation with CLI and library support

use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use ssh_key::{
    private::{EcdsaKeypair, Ed25519Keypair, RsaKeypair},
    HashAlg, LineEnding, PrivateKey,
};
use std::process::{Command, Stdio};

use super::{GenerationMethod, GeneratorError};

/// SSH key algorithm options
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SshKeyAlgorithm {
    /// Ed25519 (recommended, modern, fast)
    Ed25519,
    /// ECDSA with NIST P-256 curve
    EcdsaP256,
    /// ECDSA with NIST P-384 curve
    EcdsaP384,
    /// RSA with 2048-bit key
    Rsa2048,
    /// RSA with 3072-bit key
    Rsa3072,
    /// RSA with 4096-bit key
    Rsa4096,
}

impl SshKeyAlgorithm {
    /// Get display name for the algorithm
    pub const fn display_name(self) -> &'static str {
        match self {
            Self::Ed25519 => "Ed25519",
            Self::EcdsaP256 => "ECDSA P-256",
            Self::EcdsaP384 => "ECDSA P-384",
            Self::Rsa2048 => "RSA 2048-bit",
            Self::Rsa3072 => "RSA 3072-bit",
            Self::Rsa4096 => "RSA 4096-bit",
        }
    }

    /// Get ssh-keygen command arguments for this algorithm
    pub fn ssh_keygen_args(self) -> Vec<&'static str> {
        match self {
            Self::Ed25519 => vec!["-t", "ed25519"],
            Self::EcdsaP256 => vec!["-t", "ecdsa", "-b", "256"],
            Self::EcdsaP384 => vec!["-t", "ecdsa", "-b", "384"],
            Self::Rsa2048 => vec!["-t", "rsa", "-b", "2048"],
            Self::Rsa3072 => vec!["-t", "rsa", "-b", "3072"],
            Self::Rsa4096 => vec!["-t", "rsa", "-b", "4096"],
        }
    }

    /// Get the default filename for this algorithm
    pub const fn default_filename(self) -> &'static str {
        match self {
            Self::Ed25519 => "id_ed25519",
            Self::EcdsaP256 | Self::EcdsaP384 => "id_ecdsa",
            Self::Rsa2048 | Self::Rsa3072 | Self::Rsa4096 => "id_rsa",
        }
    }

    /// Whether this algorithm is recommended (used by frontend)
    #[allow(dead_code)]
    pub const fn is_recommended(self) -> bool {
        matches!(self, Self::Ed25519)
    }
}

/// Options for SSH key generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshKeyOptions {
    /// Key algorithm to use
    pub algorithm: SshKeyAlgorithm,
    /// Optional comment (typically email or user@host)
    pub comment: Option<String>,
    /// Optional passphrase for key encryption
    pub passphrase: Option<String>,
    /// Generation method (CLI or Library)
    #[serde(default)]
    pub method: GenerationMethod,
}

/// Result of SSH key generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshKeyResult {
    /// Algorithm used
    pub algorithm: String,
    /// Public key in OpenSSH format
    pub public_key: String,
    /// Private key in PEM format
    pub private_key: String,
    /// Key fingerprint (SHA-256)
    pub fingerprint: String,
    /// Equivalent ssh-keygen command
    pub ssh_keygen_command: String,
    /// Method used for generation
    pub method_used: String,
}

/// Generate SSH key pair
pub fn generate_key(options: &SshKeyOptions) -> Result<SshKeyResult, GeneratorError> {
    match options.method {
        GenerationMethod::Cli => generate_with_cli(options),
        GenerationMethod::Library => generate_with_library(options),
    }
}

/// Generate SSH key pair using ssh-keygen CLI
fn generate_with_cli(options: &SshKeyOptions) -> Result<SshKeyResult, GeneratorError> {
    let temp_dir = std::env::temp_dir();
    let pid = std::process::id();
    let key_path = temp_dir.join(format!("kogu_ssh_key_{pid}"));
    let key_path_str = key_path.to_string_lossy();
    let pub_key_path = format!("{key_path_str}.pub");

    // Remove existing files if any
    let _ = std::fs::remove_file(&key_path);
    let _ = std::fs::remove_file(&pub_key_path);

    // Build command
    let mut cmd = Command::new("ssh-keygen");
    cmd.args(options.algorithm.ssh_keygen_args());
    cmd.args(["-f", &key_path_str]);
    cmd.args(["-N", options.passphrase.as_deref().unwrap_or("")]);

    if let Some(comment) = &options.comment {
        if !comment.is_empty() {
            cmd.args(["-C", comment]);
        }
    }

    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let output = cmd
        .output()
        .map_err(|e| GeneratorError::CliExecution(format!("Failed to execute ssh-keygen: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Cleanup
        let _ = std::fs::remove_file(&key_path);
        let _ = std::fs::remove_file(&pub_key_path);
        return Err(GeneratorError::CliExecution(format!(
            "ssh-keygen failed: {stderr}"
        )));
    }

    // Read generated keys
    let private_key = std::fs::read_to_string(&key_path).map_err(|e| {
        let _ = std::fs::remove_file(&key_path);
        let _ = std::fs::remove_file(&pub_key_path);
        GeneratorError::CliExecution(format!("Failed to read private key: {e}"))
    })?;

    let public_key = std::fs::read_to_string(&pub_key_path).map_err(|e| {
        let _ = std::fs::remove_file(&key_path);
        let _ = std::fs::remove_file(&pub_key_path);
        GeneratorError::CliExecution(format!("Failed to read public key: {e}"))
    })?;

    // Get fingerprint
    let fingerprint_output = Command::new("ssh-keygen")
        .args(["-lf", &pub_key_path])
        .output()
        .map_err(|e| GeneratorError::CliExecution(format!("Failed to get fingerprint: {e}")))?;

    let fingerprint = if fingerprint_output.status.success() {
        let output = String::from_utf8_lossy(&fingerprint_output.stdout);
        output
            .split_whitespace()
            .nth(1)
            .unwrap_or("Unknown")
            .to_string()
    } else {
        "Unknown".to_string()
    };

    // Cleanup temp files
    let _ = std::fs::remove_file(&key_path);
    let _ = std::fs::remove_file(&pub_key_path);

    Ok(SshKeyResult {
        algorithm: options.algorithm.display_name().to_string(),
        public_key: public_key.trim().to_string(),
        private_key,
        fingerprint,
        ssh_keygen_command: build_ssh_keygen_command(options),
        method_used: "CLI (ssh-keygen)".to_string(),
    })
}

/// Generate SSH key pair using Rust library
fn generate_with_library(options: &SshKeyOptions) -> Result<SshKeyResult, GeneratorError> {
    let mut rng = OsRng;
    let comment = options.comment.as_deref().unwrap_or("");

    let private_key: PrivateKey = match options.algorithm {
        SshKeyAlgorithm::Ed25519 => {
            let keypair = Ed25519Keypair::random(&mut rng);
            PrivateKey::from(keypair)
        }
        SshKeyAlgorithm::EcdsaP256 => {
            let keypair = EcdsaKeypair::random(&mut rng, ssh_key::EcdsaCurve::NistP256)
                .map_err(|e| GeneratorError::SshKey(e.to_string()))?;
            PrivateKey::from(keypair)
        }
        SshKeyAlgorithm::EcdsaP384 => {
            let keypair = EcdsaKeypair::random(&mut rng, ssh_key::EcdsaCurve::NistP384)
                .map_err(|e| GeneratorError::SshKey(e.to_string()))?;
            PrivateKey::from(keypair)
        }
        SshKeyAlgorithm::Rsa2048 => {
            let keypair = RsaKeypair::random(&mut rng, 2048)
                .map_err(|e| GeneratorError::SshKey(e.to_string()))?;
            PrivateKey::from(keypair)
        }
        SshKeyAlgorithm::Rsa3072 => {
            let keypair = RsaKeypair::random(&mut rng, 3072)
                .map_err(|e| GeneratorError::SshKey(e.to_string()))?;
            PrivateKey::from(keypair)
        }
        SshKeyAlgorithm::Rsa4096 => {
            let keypair = RsaKeypair::random(&mut rng, 4096)
                .map_err(|e| GeneratorError::SshKey(e.to_string()))?;
            PrivateKey::from(keypair)
        }
    };

    let public_key = private_key.public_key();
    let fingerprint = public_key.fingerprint(HashAlg::Sha256).to_string();

    // Format public key with comment
    let public_key_str = if comment.is_empty() {
        public_key
            .to_openssh()
            .map_err(|e| GeneratorError::SshKey(e.to_string()))?
    } else {
        format!(
            "{} {}",
            public_key
                .to_openssh()
                .map_err(|e| GeneratorError::SshKey(e.to_string()))?,
            comment
        )
    };

    // Format private key (with optional encryption)
    let private_key_str = if let Some(passphrase) = &options.passphrase {
        if passphrase.is_empty() {
            private_key
                .to_openssh(LineEnding::LF)
                .map_err(|e| GeneratorError::SshKey(e.to_string()))?
                .to_string()
        } else {
            private_key
                .encrypt(&mut rng, passphrase)
                .map_err(|e| GeneratorError::SshKey(e.to_string()))?
                .to_openssh(LineEnding::LF)
                .map_err(|e| GeneratorError::SshKey(e.to_string()))?
                .to_string()
        }
    } else {
        private_key
            .to_openssh(LineEnding::LF)
            .map_err(|e| GeneratorError::SshKey(e.to_string()))?
            .to_string()
    };

    Ok(SshKeyResult {
        algorithm: options.algorithm.display_name().to_string(),
        public_key: public_key_str,
        private_key: private_key_str,
        fingerprint,
        ssh_keygen_command: build_ssh_keygen_command(options),
        method_used: "Library (ssh-key)".to_string(),
    })
}

/// Build the equivalent ssh-keygen command string
fn build_ssh_keygen_command(options: &SshKeyOptions) -> String {
    let mut parts = vec!["ssh-keygen".to_string()];
    parts.extend(
        options
            .algorithm
            .ssh_keygen_args()
            .iter()
            .map(std::string::ToString::to_string),
    );

    if let Some(comment) = &options.comment {
        if !comment.is_empty() {
            parts.push("-C".to_string());
            parts.push(format!("\"{comment}\""));
        }
    }

    parts.push("-f".to_string());
    let filename = options.algorithm.default_filename();
    parts.push(format!("~/.ssh/{filename}"));

    parts.join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ed25519_generation_library() {
        let options = SshKeyOptions {
            algorithm: SshKeyAlgorithm::Ed25519,
            comment: Some("test@example.com".to_string()),
            passphrase: None,
            method: GenerationMethod::Library,
        };

        let result = generate_key(&options);
        assert!(result.is_ok());

        let key = result.unwrap();
        assert!(key.public_key.contains("ssh-ed25519"));
        assert!(key.private_key.contains("OPENSSH PRIVATE KEY"));
        assert!(!key.fingerprint.is_empty());
    }

    #[test]
    fn test_ssh_keygen_command_generation() {
        let options = SshKeyOptions {
            algorithm: SshKeyAlgorithm::Ed25519,
            comment: Some("user@host".to_string()),
            passphrase: None,
            method: GenerationMethod::Library,
        };

        let cmd = build_ssh_keygen_command(&options);
        assert!(cmd.contains("ssh-keygen"));
        assert!(cmd.contains("-t ed25519"));
        assert!(cmd.contains("-C \"user@host\""));
    }

    #[test]
    fn test_algorithm_display_names() {
        assert_eq!(SshKeyAlgorithm::Ed25519.display_name(), "Ed25519");
        assert_eq!(SshKeyAlgorithm::Rsa4096.display_name(), "RSA 4096-bit");
    }
}
