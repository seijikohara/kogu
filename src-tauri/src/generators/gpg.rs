//! GPG/PGP key generation with CLI and library support

use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};

use super::{GenerationMethod, GeneratorError};

/// GPG key algorithm options
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GpgKeyAlgorithm {
    /// RSA with 2048-bit key
    Rsa2048,
    /// RSA with 3072-bit key
    Rsa3072,
    /// RSA with 4096-bit key (recommended for RSA)
    Rsa4096,
    /// ECDSA with NIST P-256 curve
    EcdsaP256,
    /// ECDSA with NIST P-384 curve
    EcdsaP384,
}

impl GpgKeyAlgorithm {
    /// Get display name for the algorithm
    pub const fn display_name(self) -> &'static str {
        match self {
            Self::Rsa2048 => "RSA 2048-bit",
            Self::Rsa3072 => "RSA 3072-bit",
            Self::Rsa4096 => "RSA 4096-bit",
            Self::EcdsaP256 => "ECDSA P-256",
            Self::EcdsaP384 => "ECDSA P-384",
        }
    }

    /// Get GPG key type string
    pub const fn gpg_key_type(self) -> &'static str {
        match self {
            Self::Rsa2048 | Self::Rsa3072 | Self::Rsa4096 => "RSA",
            Self::EcdsaP256 | Self::EcdsaP384 => "ECDSA",
        }
    }

    /// Get key length/curve for GPG
    pub const fn gpg_key_length(self) -> &'static str {
        match self {
            Self::Rsa2048 => "2048",
            Self::Rsa3072 => "3072",
            Self::Rsa4096 => "4096",
            Self::EcdsaP256 => "nistp256",
            Self::EcdsaP384 => "nistp384",
        }
    }
}

/// Options for GPG key generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpgKeyOptions {
    /// User's real name (required)
    pub name: String,
    /// User's email address (required)
    pub email: String,
    /// Optional comment
    pub comment: Option<String>,
    /// Key algorithm to use
    pub algorithm: GpgKeyAlgorithm,
    /// Optional passphrase for key protection
    pub passphrase: Option<String>,
    /// Generation method (CLI or Library)
    #[serde(default)]
    pub method: GenerationMethod,
}

/// Result of GPG key generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpgKeyResult {
    /// Algorithm used
    pub algorithm: String,
    /// User ID string
    pub user_id: String,
    /// Key fingerprint
    pub fingerprint: String,
    /// Public key in ASCII armor format
    pub public_key: String,
    /// Private key in ASCII armor format
    pub private_key: String,
    /// Interactive GPG command
    pub gpg_command_interactive: String,
    /// Batch mode GPG command
    pub gpg_command_batch: String,
    /// Method used for generation
    pub method_used: String,
}

/// Generate GPG key pair
pub fn generate_key(options: GpgKeyOptions) -> Result<GpgKeyResult, GeneratorError> {
    // Validate input before consuming
    if options.name.trim().is_empty() {
        return Err(GeneratorError::InvalidParameter(
            "Name is required".to_string(),
        ));
    }
    if options.email.trim().is_empty() || !options.email.contains('@') {
        return Err(GeneratorError::InvalidParameter(
            "Valid email is required".to_string(),
        ));
    }

    match options.method {
        GenerationMethod::Cli => generate_with_cli(options),
        GenerationMethod::Library => generate_with_library(options),
    }
}

/// Generate GPG key pair using gpg CLI
fn generate_with_cli(options: GpgKeyOptions) -> Result<GpgKeyResult, GeneratorError> {
    // Destructure to consume ownership
    let GpgKeyOptions {
        name,
        email,
        comment,
        algorithm,
        passphrase,
        method: _,
    } = options;

    // Build user_id string
    let user_id = build_user_id(&name, &email, comment.as_deref());

    // Create batch file content
    let batch_content = build_batch_content_from_parts(
        &name,
        &email,
        comment.as_deref(),
        algorithm,
        passphrase.as_deref(),
    );

    // Create temporary batch file
    let temp_dir = std::env::temp_dir();
    let batch_file = temp_dir.join(format!("kogu_gpg_batch_{}", std::process::id()));

    std::fs::write(&batch_file, &batch_content)
        .map_err(|e| GeneratorError::CliExecution(format!("Failed to create batch file: {e}")))?;

    // Generate key using batch mode
    let mut cmd = Command::new("gpg");
    cmd.args(["--batch", "--gen-key"]);
    cmd.arg(&batch_file);
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let output = cmd.output().map_err(|e| {
        let _ = std::fs::remove_file(&batch_file);
        GeneratorError::CliExecution(format!("Failed to execute gpg: {e}"))
    })?;

    // Cleanup batch file
    let _ = std::fs::remove_file(&batch_file);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(GeneratorError::CliExecution(format!(
            "gpg key generation failed: {stderr}"
        )));
    }

    // Extract fingerprint from output
    let stderr = String::from_utf8_lossy(&output.stderr);
    let fingerprint = extract_fingerprint_from_output(&stderr).unwrap_or_else(|| {
        // Try to get fingerprint from gpg --list-keys
        get_fingerprint_by_email(&email).unwrap_or_else(|| "Unknown".to_string())
    });

    // Export public key
    let public_key = export_key(&email, false)?;

    // Export private key
    let private_key = export_key(&email, true)?;

    // Build batch command for display
    let gpg_command_batch = build_batch_command_from_parts(
        &name,
        &email,
        comment.as_deref(),
        algorithm,
        passphrase.as_deref(),
    );

    Ok(GpgKeyResult {
        algorithm: algorithm.display_name().to_string(),
        user_id,
        fingerprint: format_fingerprint(&fingerprint),
        public_key,
        private_key,
        gpg_command_interactive: "gpg --full-generate-key".to_string(),
        gpg_command_batch,
        method_used: "CLI (gpg)".to_string(),
    })
}

/// Generate GPG key pair using Rust library (pgp crate)
fn generate_with_library(options: GpgKeyOptions) -> Result<GpgKeyResult, GeneratorError> {
    use pgp::composed::{ArmorOptions, KeyType, SecretKeyParamsBuilder, SignedPublicKey};
    use pgp::types::{KeyDetails, Password};

    // Destructure to consume ownership
    let GpgKeyOptions {
        name,
        email,
        comment,
        algorithm,
        passphrase,
        method: _,
    } = options;

    // Build user_id string
    let user_id = build_user_id(&name, &email, comment.as_deref());

    let mut rng = rand::rngs::OsRng;

    let key_type = match algorithm {
        GpgKeyAlgorithm::Rsa2048 => KeyType::Rsa(2048),
        GpgKeyAlgorithm::Rsa3072 => KeyType::Rsa(3072),
        GpgKeyAlgorithm::Rsa4096 => KeyType::Rsa(4096),
        GpgKeyAlgorithm::EcdsaP256 => KeyType::ECDSA(pgp::crypto::ecc_curve::ECCCurve::P256),
        GpgKeyAlgorithm::EcdsaP384 => KeyType::ECDSA(pgp::crypto::ecc_curve::ECCCurve::P384),
    };

    let params = SecretKeyParamsBuilder::default()
        .key_type(key_type)
        .can_certify(true)
        .can_sign(true)
        .primary_user_id(user_id.clone())
        .build()
        .map_err(|e| GeneratorError::Gpg(format!("Failed to build key params: {e}")))?;

    let secret_key = params
        .generate(rng)
        .map_err(|e| GeneratorError::Gpg(format!("Failed to generate key: {e}")))?;

    // Get passphrase as Password type
    let password = Password::from(passphrase.clone().unwrap_or_default());

    // Sign the key to create SignedSecretKey
    let signed_key = secret_key
        .sign(&mut rng, &password)
        .map_err(|e| GeneratorError::Gpg(format!("Failed to sign key: {e}")))?;

    // Get fingerprint from signed key (KeyDetails trait)
    let fingerprint = format!("{:X}", signed_key.fingerprint());

    // Convert to public key for export (clone needed as signed_key is used again below)
    let signed_public_key: SignedPublicKey = signed_key.clone().into();

    // Export public key
    let public_key = signed_public_key
        .to_armored_string(ArmorOptions::default())
        .map_err(|e| GeneratorError::Gpg(format!("Failed to export public key: {e}")))?;

    // Export private key
    let private_key = signed_key
        .to_armored_string(ArmorOptions::default())
        .map_err(|e| GeneratorError::Gpg(format!("Failed to export private key: {e}")))?;

    // Build batch command for display
    let gpg_command_batch = build_batch_command_from_parts(
        &name,
        &email,
        comment.as_deref(),
        algorithm,
        passphrase.as_deref(),
    );

    Ok(GpgKeyResult {
        algorithm: algorithm.display_name().to_string(),
        user_id,
        fingerprint: format_fingerprint(&fingerprint),
        public_key,
        private_key,
        gpg_command_interactive: "gpg --full-generate-key".to_string(),
        gpg_command_batch,
        method_used: "Library (pgp)".to_string(),
    })
}

/// Build User ID string from parts
fn build_user_id(name: &str, email: &str, comment: Option<&str>) -> String {
    match comment {
        Some(c) if !c.is_empty() => {
            format!("{name} ({c}) <{email}>")
        }
        _ => format!("{name} <{email}>"),
    }
}

/// Build GPG batch file content from individual parts
fn build_batch_content_from_parts(
    name: &str,
    email: &str,
    comment: Option<&str>,
    algorithm: GpgKeyAlgorithm,
    passphrase: Option<&str>,
) -> String {
    let key_type = algorithm.gpg_key_type();
    let mut lines = vec![
        "%echo Generating GPG key".to_string(),
        format!("Key-Type: {key_type}"),
    ];

    // Add key length/curve
    let key_length = algorithm.gpg_key_length();
    match algorithm {
        GpgKeyAlgorithm::Rsa2048 | GpgKeyAlgorithm::Rsa3072 | GpgKeyAlgorithm::Rsa4096 => {
            lines.push(format!("Key-Length: {key_length}"));
        }
        GpgKeyAlgorithm::EcdsaP256 | GpgKeyAlgorithm::EcdsaP384 => {
            lines.push(format!("Key-Curve: {key_length}"));
        }
    }

    lines.push(format!("Name-Real: {name}"));

    if let Some(c) = comment {
        if !c.is_empty() {
            lines.push(format!("Name-Comment: {c}"));
        }
    }

    lines.push(format!("Name-Email: {email}"));
    lines.push("Expire-Date: 0".to_string());

    if let Some(pass) = passphrase {
        if pass.is_empty() {
            lines.push("%no-protection".to_string());
        } else {
            lines.push(format!("Passphrase: {pass}"));
        }
    } else {
        lines.push("%no-protection".to_string());
    }

    lines.push("%commit".to_string());
    lines.push("%echo Done".to_string());

    lines.join("\n")
}

/// Build the batch command string for display from individual parts
fn build_batch_command_from_parts(
    name: &str,
    email: &str,
    comment: Option<&str>,
    algorithm: GpgKeyAlgorithm,
    passphrase: Option<&str>,
) -> String {
    let batch_content = build_batch_content_from_parts(name, email, comment, algorithm, passphrase);
    format!("gpg --batch --gen-key <<'EOF'\n{batch_content}\nEOF")
}

/// Export a key by email
fn export_key(email: &str, secret: bool) -> Result<String, GeneratorError> {
    let mut cmd = Command::new("gpg");
    cmd.args(["--armor"]);

    if secret {
        cmd.arg("--export-secret-keys");
    } else {
        cmd.arg("--export");
    }

    cmd.arg(email);

    let output = cmd
        .output()
        .map_err(|e| GeneratorError::CliExecution(format!("Failed to export key: {e}")))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(GeneratorError::CliExecution(format!(
            "Failed to export key: {stderr}"
        )))
    }
}

/// Extract fingerprint from gpg output
fn extract_fingerprint_from_output(output: &str) -> Option<String> {
    // Look for fingerprint in gpg output
    for line in output.lines() {
        if line.contains("key") && line.contains("marked as ultimately trusted") {
            // Extract key ID from line like "gpg: key ABCD1234 marked as ultimately trusted"
            let parts: Vec<&str> = line.split_whitespace().collect();
            for (i, part) in parts.iter().enumerate() {
                if *part == "key" && i + 1 < parts.len() {
                    return Some(parts[i + 1].to_string());
                }
            }
        }
    }
    None
}

/// Get fingerprint by email using gpg --list-keys
fn get_fingerprint_by_email(email: &str) -> Option<String> {
    let output = Command::new("gpg")
        .args(["--list-keys", "--fingerprint", email])
        .output()
        .ok()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let trimmed = line.trim();
            // Fingerprint line looks like: "Key fingerprint = XXXX XXXX XXXX..."
            if trimmed.starts_with("Key fingerprint")
                || trimmed
                    .chars()
                    .all(|c| c.is_ascii_hexdigit() || c.is_whitespace())
            {
                let fp: String = trimmed.chars().filter(char::is_ascii_hexdigit).collect();
                if fp.len() >= 16 {
                    return Some(fp);
                }
            }
        }
    }
    None
}

/// Format fingerprint with spaces for readability
fn format_fingerprint(fingerprint: &str) -> String {
    fingerprint
        .chars()
        .collect::<Vec<_>>()
        .chunks(4)
        .map(|chunk| chunk.iter().collect::<String>())
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_user_id_without_comment() {
        let user_id = build_user_id("John Doe", "john@example.com", None);
        assert_eq!(user_id, "John Doe <john@example.com>");
    }

    #[test]
    fn test_build_user_id_with_comment() {
        let user_id = build_user_id("John Doe", "john@example.com", Some("Work Key"));
        assert_eq!(user_id, "John Doe (Work Key) <john@example.com>");
    }

    #[test]
    fn test_format_fingerprint() {
        let fp = "ABCD1234EFGH5678IJKL9012MNOP3456";
        let formatted = format_fingerprint(fp);
        assert_eq!(formatted, "ABCD 1234 EFGH 5678 IJKL 9012 MNOP 3456");
    }

    #[test]
    fn test_algorithm_display_names() {
        assert_eq!(GpgKeyAlgorithm::Rsa4096.display_name(), "RSA 4096-bit");
        assert_eq!(GpgKeyAlgorithm::EcdsaP256.display_name(), "ECDSA P-256");
    }

    #[test]
    fn test_invalid_name() {
        let options = GpgKeyOptions {
            name: String::new(),
            email: "john@example.com".to_string(),
            comment: None,
            algorithm: GpgKeyAlgorithm::Rsa4096,
            passphrase: None,
            method: GenerationMethod::Library,
        };
        let result = generate_key(options);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_email() {
        let options = GpgKeyOptions {
            name: "John Doe".to_string(),
            email: "invalid-email".to_string(),
            comment: None,
            algorithm: GpgKeyAlgorithm::Rsa4096,
            passphrase: None,
            method: GenerationMethod::Library,
        };
        let result = generate_key(options);
        assert!(result.is_err());
    }
}
