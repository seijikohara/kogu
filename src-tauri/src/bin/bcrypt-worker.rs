//! BCrypt worker binary for process isolation
//!
//! This binary is spawned as a subprocess for BCrypt operations,
//! allowing true cancellation via process termination.
//!
//! Communication protocol:
//! - Input: JSON on stdin (single line)
//! - Output: JSON on stdout (single line)
//!
//! Input format:
//! ```json
//! { "operation": "hash", "password": "...", "cost": 10 }
//! { "operation": "verify", "password": "...", "hash": "..." }
//! ```
//!
//! Output format:
//! ```json
//! { "success": true, "hash": "...", "cost": 10, "algorithm": "2b" }
//! { "success": true, "valid": true, "message": "..." }
//! { "success": false, "error": "..." }
//! ```

use serde::{Deserialize, Serialize};
use std::io::{self, BufRead, Write};

/// Minimum allowed cost factor
const MIN_COST: u32 = 4;
/// Maximum allowed cost factor
const MAX_COST: u32 = 20;

/// Input request from the main process
#[derive(Debug, Deserialize)]
#[serde(tag = "operation", rename_all = "lowercase")]
enum Request {
    Hash { password: String, cost: u32 },
    Verify { password: String, hash: String },
}

/// Output response to the main process
#[derive(Debug, Serialize)]
#[serde(untagged)]
enum Response {
    HashSuccess {
        success: bool,
        hash: String,
        cost: u32,
        algorithm: String,
    },
    VerifySuccess {
        success: bool,
        valid: bool,
        message: String,
    },
    Error {
        success: bool,
        error: String,
    },
}

fn handle_hash(password: &str, cost: u32) -> Response {
    if !(MIN_COST..=MAX_COST).contains(&cost) {
        return Response::Error {
            success: false,
            error: format!("Cost factor must be between {MIN_COST} and {MAX_COST}, got {cost}"),
        };
    }

    match bcrypt::hash(password, cost) {
        Ok(hash) => Response::HashSuccess {
            success: true,
            hash,
            cost,
            algorithm: "2b".to_string(),
        },
        Err(e) => Response::Error {
            success: false,
            error: e.to_string(),
        },
    }
}

fn handle_verify(password: &str, hash: &str) -> Response {
    match bcrypt::verify(password, hash) {
        Ok(valid) => Response::VerifySuccess {
            success: true,
            valid,
            message: if valid {
                "Password matches the hash".to_string()
            } else {
                "Password does not match the hash".to_string()
            },
        },
        Err(e) => Response::Error {
            success: false,
            error: e.to_string(),
        },
    }
}

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    // Read single line from stdin
    let mut input = String::new();
    if stdin.lock().read_line(&mut input).is_err() {
        let response = Response::Error {
            success: false,
            error: "Failed to read input".to_string(),
        };
        let _ = writeln!(
            stdout,
            "{}",
            serde_json::to_string(&response).unwrap_or_default()
        );
        return;
    }

    // Parse request
    let request: Request = match serde_json::from_str(&input) {
        Ok(req) => req,
        Err(e) => {
            let response = Response::Error {
                success: false,
                error: format!("Invalid request: {e}"),
            };
            let _ = writeln!(
                stdout,
                "{}",
                serde_json::to_string(&response).unwrap_or_default()
            );
            return;
        }
    };

    // Process request
    let response = match request {
        Request::Hash { password, cost } => handle_hash(&password, cost),
        Request::Verify { password, hash } => handle_verify(&password, &hash),
    };

    // Write response
    let _ = writeln!(
        stdout,
        "{}",
        serde_json::to_string(&response).unwrap_or_default()
    );
}
