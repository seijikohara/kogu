//! Unified worker binary for process isolation
//!
//! This binary is spawned as a subprocess for CPU-intensive cryptographic operations,
//! allowing true cancellation via process termination.
//!
//! Supported operations:
//! - BCrypt hash generation and verification
//! - SSH key generation
//! - GPG key generation
//!
//! Communication protocol:
//! - Input: JSON on stdin (single line)
//! - Output: JSON on stdout (single line)
//!
//! Input format:
//! ```json
//! { "type": "bcrypt", "operation": "hash", "password": "...", "cost": 10 }
//! { "type": "bcrypt", "operation": "verify", "password": "...", "hash": "..." }
//! { "type": "ssh", "algorithm": "ed25519", "comment": "...", "passphrase": "..." }
//! { "type": "gpg", "name": "...", "email": "...", "algorithm": "rsa4096", ... }
//! ```

use serde::{Deserialize, Serialize};
use std::io::{self, BufRead, Write};

// =============================================================================
// Constants
// =============================================================================

/// Minimum allowed BCrypt cost factor
const MIN_BCRYPT_COST: u32 = 4;
/// Maximum allowed BCrypt cost factor
const MAX_BCRYPT_COST: u32 = 20;

// =============================================================================
// Request Types
// =============================================================================

/// Top-level request envelope
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum Request {
    Bcrypt(BcryptRequest),
    Ssh(SshRequest),
    Gpg(GpgRequest),
}

/// BCrypt operation request
#[derive(Debug, Deserialize)]
#[serde(tag = "operation", rename_all = "lowercase")]
enum BcryptRequest {
    Hash { password: String, cost: u32 },
    Verify { password: String, hash: String },
}

/// SSH key algorithm
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
enum SshKeyAlgorithm {
    Ed25519,
    Rsa2048,
    Rsa3072,
    Rsa4096,
    EcdsaP256,
    EcdsaP384,
}

impl SshKeyAlgorithm {
    fn display_name(self) -> &'static str {
        match self {
            Self::Ed25519 => "Ed25519",
            Self::Rsa2048 => "RSA 2048-bit",
            Self::Rsa3072 => "RSA 3072-bit",
            Self::Rsa4096 => "RSA 4096-bit",
            Self::EcdsaP256 => "ECDSA P-256",
            Self::EcdsaP384 => "ECDSA P-384",
        }
    }
}

/// SSH key generation request
#[derive(Debug, Deserialize)]
struct SshRequest {
    algorithm: SshKeyAlgorithm,
    comment: Option<String>,
    passphrase: Option<String>,
}

/// GPG key algorithm
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
enum GpgKeyAlgorithm {
    Rsa2048,
    Rsa3072,
    Rsa4096,
    EcdsaP256,
    EcdsaP384,
}

impl GpgKeyAlgorithm {
    fn display_name(self) -> &'static str {
        match self {
            Self::Rsa2048 => "RSA 2048-bit",
            Self::Rsa3072 => "RSA 3072-bit",
            Self::Rsa4096 => "RSA 4096-bit",
            Self::EcdsaP256 => "ECDSA P-256",
            Self::EcdsaP384 => "ECDSA P-384",
        }
    }

    fn gpg_key_type(self) -> &'static str {
        match self {
            Self::Rsa2048 | Self::Rsa3072 | Self::Rsa4096 => "RSA",
            Self::EcdsaP256 | Self::EcdsaP384 => "ECDSA",
        }
    }

    fn gpg_key_length(self) -> &'static str {
        match self {
            Self::Rsa2048 => "2048",
            Self::Rsa3072 => "3072",
            Self::Rsa4096 => "4096",
            Self::EcdsaP256 => "nistp256",
            Self::EcdsaP384 => "nistp384",
        }
    }
}

/// GPG key generation request
#[derive(Debug, Deserialize)]
struct GpgRequest {
    name: String,
    email: String,
    comment: Option<String>,
    algorithm: GpgKeyAlgorithm,
    passphrase: Option<String>,
}

// =============================================================================
// Response Types
// =============================================================================

/// BCrypt hash result
#[derive(Debug, Serialize)]
struct BcryptHashResult {
    success: bool,
    hash: String,
    cost: u32,
    algorithm: String,
}

/// BCrypt verify result
#[derive(Debug, Serialize)]
struct BcryptVerifyResult {
    success: bool,
    valid: bool,
    message: String,
}

/// SSH key result
#[derive(Debug, Serialize)]
struct SshKeyResult {
    success: bool,
    algorithm: String,
    public_key: String,
    private_key: String,
    fingerprint: String,
    ssh_keygen_command: String,
    method_used: String,
}

/// GPG key result
#[derive(Debug, Serialize)]
struct GpgKeyResult {
    success: bool,
    algorithm: String,
    user_id: String,
    fingerprint: String,
    public_key: String,
    private_key: String,
    gpg_command_interactive: String,
    gpg_command_batch: String,
    method_used: String,
}

/// Error response
#[derive(Debug, Serialize)]
struct ErrorResponse {
    success: bool,
    error: String,
}

// =============================================================================
// BCrypt Handlers
// =============================================================================

fn handle_bcrypt_hash(password: &str, cost: u32) -> String {
    if !(MIN_BCRYPT_COST..=MAX_BCRYPT_COST).contains(&cost) {
        return to_json(&ErrorResponse {
            success: false,
            error: format!(
                "Cost factor must be between {MIN_BCRYPT_COST} and {MAX_BCRYPT_COST}, got {cost}"
            ),
        });
    }

    match bcrypt::hash(password, cost) {
        Ok(hash) => to_json(&BcryptHashResult {
            success: true,
            hash,
            cost,
            algorithm: "2b".to_string(),
        }),
        Err(e) => to_json(&ErrorResponse {
            success: false,
            error: e.to_string(),
        }),
    }
}

fn handle_bcrypt_verify(password: &str, hash: &str) -> String {
    match bcrypt::verify(password, hash) {
        Ok(valid) => to_json(&BcryptVerifyResult {
            success: true,
            valid,
            message: if valid {
                "Password matches the hash".to_string()
            } else {
                "Password does not match the hash".to_string()
            },
        }),
        Err(e) => to_json(&ErrorResponse {
            success: false,
            error: e.to_string(),
        }),
    }
}

// =============================================================================
// SSH Key Generation
// =============================================================================

fn handle_ssh_keygen(req: SshRequest) -> String {
    use ssh_key::{rand_core::OsRng, Algorithm, EcdsaCurve, HashAlg, LineEnding, PrivateKey};

    let comment_str = req.comment.as_deref().unwrap_or("generated-key");

    let private_key = match req.algorithm {
        SshKeyAlgorithm::Ed25519 => match PrivateKey::random(&mut OsRng, Algorithm::Ed25519) {
            Ok(key) => key,
            Err(e) => {
                return to_json(&ErrorResponse {
                    success: false,
                    error: format!("Failed to generate Ed25519 key: {e}"),
                })
            }
        },
        SshKeyAlgorithm::Rsa2048 => {
            match PrivateKey::random(
                &mut OsRng,
                Algorithm::Rsa {
                    hash: Some(HashAlg::Sha256),
                },
            ) {
                Ok(key) => key,
                Err(e) => {
                    return to_json(&ErrorResponse {
                        success: false,
                        error: format!("Failed to generate RSA key: {e}"),
                    })
                }
            }
        }
        SshKeyAlgorithm::Rsa3072 => {
            match PrivateKey::random(
                &mut OsRng,
                Algorithm::Rsa {
                    hash: Some(HashAlg::Sha256),
                },
            ) {
                Ok(key) => key,
                Err(e) => {
                    return to_json(&ErrorResponse {
                        success: false,
                        error: format!("Failed to generate RSA key: {e}"),
                    })
                }
            }
        }
        SshKeyAlgorithm::Rsa4096 => {
            match PrivateKey::random(
                &mut OsRng,
                Algorithm::Rsa {
                    hash: Some(HashAlg::Sha512),
                },
            ) {
                Ok(key) => key,
                Err(e) => {
                    return to_json(&ErrorResponse {
                        success: false,
                        error: format!("Failed to generate RSA key: {e}"),
                    })
                }
            }
        }
        SshKeyAlgorithm::EcdsaP256 => {
            match PrivateKey::random(
                &mut OsRng,
                Algorithm::Ecdsa {
                    curve: EcdsaCurve::NistP256,
                },
            ) {
                Ok(key) => key,
                Err(e) => {
                    return to_json(&ErrorResponse {
                        success: false,
                        error: format!("Failed to generate ECDSA P-256 key: {e}"),
                    })
                }
            }
        }
        SshKeyAlgorithm::EcdsaP384 => {
            match PrivateKey::random(
                &mut OsRng,
                Algorithm::Ecdsa {
                    curve: EcdsaCurve::NistP384,
                },
            ) {
                Ok(key) => key,
                Err(e) => {
                    return to_json(&ErrorResponse {
                        success: false,
                        error: format!("Failed to generate ECDSA P-384 key: {e}"),
                    })
                }
            }
        }
    };

    // Get public key
    let public_key = private_key.public_key();

    // Export public key in OpenSSH format
    let public_key_str = match public_key.to_openssh() {
        Ok(s) => s,
        Err(e) => {
            return to_json(&ErrorResponse {
                success: false,
                error: format!("Failed to export public key: {e}"),
            })
        }
    };

    // Add comment to public key
    let public_key_with_comment = format!("{} {}", public_key_str.trim(), comment_str);

    // Get fingerprint
    let fingerprint = public_key.fingerprint(HashAlg::Sha256).to_string();

    // Export private key
    let private_key_str = match &req.passphrase {
        Some(pass) if !pass.is_empty() => match private_key.encrypt(&mut OsRng, pass) {
            Ok(encrypted) => match encrypted.to_openssh(LineEnding::LF) {
                Ok(s) => s.to_string(),
                Err(e) => {
                    return to_json(&ErrorResponse {
                        success: false,
                        error: format!("Failed to export encrypted private key: {e}"),
                    })
                }
            },
            Err(e) => {
                return to_json(&ErrorResponse {
                    success: false,
                    error: format!("Failed to encrypt private key: {e}"),
                })
            }
        },
        _ => match private_key.to_openssh(LineEnding::LF) {
            Ok(s) => s.to_string(),
            Err(e) => {
                return to_json(&ErrorResponse {
                    success: false,
                    error: format!("Failed to export private key: {e}"),
                })
            }
        },
    };

    // Build ssh-keygen command
    let ssh_keygen_command = build_ssh_keygen_command(req.algorithm, comment_str);

    to_json(&SshKeyResult {
        success: true,
        algorithm: req.algorithm.display_name().to_string(),
        public_key: public_key_with_comment,
        private_key: private_key_str,
        fingerprint,
        ssh_keygen_command,
        method_used: "Library (ssh-key)".to_string(),
    })
}

fn build_ssh_keygen_command(algorithm: SshKeyAlgorithm, comment: &str) -> String {
    let (key_type, bits) = match algorithm {
        SshKeyAlgorithm::Ed25519 => ("ed25519", None),
        SshKeyAlgorithm::Rsa2048 => ("rsa", Some(2048)),
        SshKeyAlgorithm::Rsa3072 => ("rsa", Some(3072)),
        SshKeyAlgorithm::Rsa4096 => ("rsa", Some(4096)),
        SshKeyAlgorithm::EcdsaP256 => ("ecdsa", Some(256)),
        SshKeyAlgorithm::EcdsaP384 => ("ecdsa", Some(384)),
    };

    match bits {
        Some(b) => format!("ssh-keygen -t {key_type} -b {b} -C \"{comment}\""),
        None => format!("ssh-keygen -t {key_type} -C \"{comment}\""),
    }
}

// =============================================================================
// GPG Key Generation
// =============================================================================

fn handle_gpg_keygen(req: GpgRequest) -> String {
    use pgp::composed::{ArmorOptions, KeyType, SecretKeyParamsBuilder, SignedPublicKey};
    use pgp::types::{KeyDetails, Password};

    // Validate
    if req.name.trim().is_empty() {
        return to_json(&ErrorResponse {
            success: false,
            error: "Name is required".to_string(),
        });
    }
    if req.email.trim().is_empty() || !req.email.contains('@') {
        return to_json(&ErrorResponse {
            success: false,
            error: "Valid email is required".to_string(),
        });
    }

    // Build user_id
    let user_id = match &req.comment {
        Some(c) if !c.is_empty() => format!("{} ({c}) <{}>", req.name, req.email),
        _ => format!("{} <{}>", req.name, req.email),
    };

    let mut rng = rand::rngs::OsRng;

    let key_type = match req.algorithm {
        GpgKeyAlgorithm::Rsa2048 => KeyType::Rsa(2048),
        GpgKeyAlgorithm::Rsa3072 => KeyType::Rsa(3072),
        GpgKeyAlgorithm::Rsa4096 => KeyType::Rsa(4096),
        GpgKeyAlgorithm::EcdsaP256 => KeyType::ECDSA(pgp::crypto::ecc_curve::ECCCurve::P256),
        GpgKeyAlgorithm::EcdsaP384 => KeyType::ECDSA(pgp::crypto::ecc_curve::ECCCurve::P384),
    };

    let params = match SecretKeyParamsBuilder::default()
        .key_type(key_type)
        .can_certify(true)
        .can_sign(true)
        .primary_user_id(user_id.clone())
        .build()
    {
        Ok(p) => p,
        Err(e) => {
            return to_json(&ErrorResponse {
                success: false,
                error: format!("Failed to build key params: {e}"),
            })
        }
    };

    let secret_key = match params.generate(rng) {
        Ok(k) => k,
        Err(e) => {
            return to_json(&ErrorResponse {
                success: false,
                error: format!("Failed to generate key: {e}"),
            })
        }
    };

    let password = Password::from(req.passphrase.clone().unwrap_or_default());

    let signed_key = match secret_key.sign(&mut rng, &password) {
        Ok(k) => k,
        Err(e) => {
            return to_json(&ErrorResponse {
                success: false,
                error: format!("Failed to sign key: {e}"),
            })
        }
    };

    let fingerprint = format!("{:X}", signed_key.fingerprint());

    let signed_public_key: SignedPublicKey = signed_key.clone().into();

    let public_key = match signed_public_key.to_armored_string(ArmorOptions::default()) {
        Ok(s) => s,
        Err(e) => {
            return to_json(&ErrorResponse {
                success: false,
                error: format!("Failed to export public key: {e}"),
            })
        }
    };

    let private_key = match signed_key.to_armored_string(ArmorOptions::default()) {
        Ok(s) => s,
        Err(e) => {
            return to_json(&ErrorResponse {
                success: false,
                error: format!("Failed to export private key: {e}"),
            })
        }
    };

    let gpg_command_batch = build_gpg_batch_command(&req);

    to_json(&GpgKeyResult {
        success: true,
        algorithm: req.algorithm.display_name().to_string(),
        user_id,
        fingerprint: format_fingerprint(&fingerprint),
        public_key,
        private_key,
        gpg_command_interactive: "gpg --full-generate-key".to_string(),
        gpg_command_batch,
        method_used: "Library (pgp)".to_string(),
    })
}

fn build_gpg_batch_command(req: &GpgRequest) -> String {
    let key_type = req.algorithm.gpg_key_type();
    let mut lines = vec![
        "%echo Generating GPG key".to_string(),
        format!("Key-Type: {key_type}"),
    ];

    let key_length = req.algorithm.gpg_key_length();
    match req.algorithm {
        GpgKeyAlgorithm::Rsa2048 | GpgKeyAlgorithm::Rsa3072 | GpgKeyAlgorithm::Rsa4096 => {
            lines.push(format!("Key-Length: {key_length}"));
        }
        GpgKeyAlgorithm::EcdsaP256 | GpgKeyAlgorithm::EcdsaP384 => {
            lines.push(format!("Key-Curve: {key_length}"));
        }
    }

    lines.push(format!("Name-Real: {}", req.name));

    if let Some(c) = &req.comment {
        if !c.is_empty() {
            lines.push(format!("Name-Comment: {c}"));
        }
    }

    lines.push(format!("Name-Email: {}", req.email));
    lines.push("Expire-Date: 0".to_string());

    match &req.passphrase {
        Some(pass) if !pass.is_empty() => {
            lines.push(format!("Passphrase: {pass}"));
        }
        _ => {
            lines.push("%no-protection".to_string());
        }
    }

    lines.push("%commit".to_string());
    lines.push("%echo Done".to_string());

    let batch_content = lines.join("\n");
    format!("gpg --batch --gen-key <<'EOF'\n{batch_content}\nEOF")
}

fn format_fingerprint(fingerprint: &str) -> String {
    fingerprint
        .chars()
        .collect::<Vec<_>>()
        .chunks(4)
        .map(|chunk| chunk.iter().collect::<String>())
        .collect::<Vec<_>>()
        .join(" ")
}

// =============================================================================
// Utilities
// =============================================================================

fn to_json<T: Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| {
        r#"{"success":false,"error":"Failed to serialize response"}"#.to_string()
    })
}

// =============================================================================
// Main
// =============================================================================

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    // Read single line from stdin
    let mut input = String::new();
    if stdin.lock().read_line(&mut input).is_err() {
        let _ = writeln!(
            stdout,
            "{}",
            to_json(&ErrorResponse {
                success: false,
                error: "Failed to read input".to_string(),
            })
        );
        return;
    }

    // Parse request
    let request: Request = match serde_json::from_str(&input) {
        Ok(req) => req,
        Err(e) => {
            let _ = writeln!(
                stdout,
                "{}",
                to_json(&ErrorResponse {
                    success: false,
                    error: format!("Invalid request: {e}"),
                })
            );
            return;
        }
    };

    // Process request and get response
    let response = match request {
        Request::Bcrypt(BcryptRequest::Hash { password, cost }) => {
            handle_bcrypt_hash(&password, cost)
        }
        Request::Bcrypt(BcryptRequest::Verify { password, hash }) => {
            handle_bcrypt_verify(&password, &hash)
        }
        Request::Ssh(req) => handle_ssh_keygen(req),
        Request::Gpg(req) => handle_gpg_keygen(req),
    };

    // Write response
    let _ = writeln!(stdout, "{response}");
}
