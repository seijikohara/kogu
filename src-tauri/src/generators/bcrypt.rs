//! `BCrypt` hash generation and verification with process isolation
//!
//! This module provides `BCrypt` operations that run in a separate process,
//! enabling true cancellation via process termination.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use super::GeneratorError;

/// Result of `BCrypt` hash generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BcryptHashResult {
    /// The generated `BCrypt` hash
    pub hash: String,
    /// Cost factor used
    pub cost: u32,
    /// `BCrypt` algorithm version (e.g., "2b")
    pub algorithm: String,
}

/// Result of `BCrypt` verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BcryptVerifyResult {
    /// Whether the password matches the hash
    pub valid: bool,
    /// Human-readable result message
    pub message: String,
}

/// Information about a `BCrypt` cost factor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BcryptCostInfo {
    /// Cost factor value
    pub cost: u32,
    /// Estimated computation time in milliseconds
    pub estimated_time_ms: f64,
    /// Security level label
    pub security_level: String,
}

/// Minimum allowed cost factor
pub const MIN_COST: u32 = 4;
/// Maximum allowed cost factor (practical limit)
pub const MAX_COST: u32 = 20;
/// Default cost factor (reserved for frontend use)
#[allow(dead_code)]
pub const DEFAULT_COST: u32 = 10;

// =============================================================================
// Sidecar Request/Response Types
// =============================================================================

/// Request to send to the bcrypt-worker sidecar
#[derive(Debug, Serialize)]
#[serde(tag = "operation", rename_all = "lowercase")]
enum WorkerRequest {
    Hash { password: String, cost: u32 },
    Verify { password: String, hash: String },
}

/// Response from the bcrypt-worker sidecar
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum WorkerResponse {
    HashSuccess {
        #[serde(rename = "success")]
        _success: bool,
        hash: String,
        cost: u32,
        algorithm: String,
    },
    VerifySuccess {
        #[serde(rename = "success")]
        _success: bool,
        valid: bool,
        message: String,
    },
    Error {
        #[serde(rename = "success")]
        _success: bool,
        error: String,
    },
}

// =============================================================================
// Process Management
// =============================================================================

/// State for managing the `BCrypt` worker process
#[derive(Default)]
pub struct BcryptProcessState {
    /// Currently running child process
    child: Mutex<Option<CommandChild>>,
}

impl BcryptProcessState {
    /// Create a new process state
    pub const fn new() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }

    /// Store a child process handle
    fn set_child(&self, child: CommandChild) {
        let mut guard = self
            .child
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        *guard = Some(child);
    }

    /// Take the child process handle (removes it from state)
    fn take_child(&self) -> Option<CommandChild> {
        let mut guard = self
            .child
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        guard.take()
    }

    /// Kill the current child process if running
    pub fn kill(&self) -> bool {
        self.take_child().is_some_and(|child| child.kill().is_ok())
    }
}

// =============================================================================
// Process-Isolated Operations
// =============================================================================

/// Generate a `BCrypt` hash using process isolation
///
/// Spawns a separate process for the computation, allowing true cancellation.
pub async fn generate_hash_isolated(
    app: &AppHandle,
    password: String,
    cost: u32,
    state: &BcryptProcessState,
) -> Result<BcryptHashResult, GeneratorError> {
    if !(MIN_COST..=MAX_COST).contains(&cost) {
        return Err(GeneratorError::InvalidParameter(format!(
            "Cost factor must be between {MIN_COST} and {MAX_COST}, got {cost}"
        )));
    }

    // Create request
    let request = WorkerRequest::Hash { password, cost };
    let request_json =
        serde_json::to_string(&request).map_err(|e| GeneratorError::Bcrypt(e.to_string()))?;

    // Spawn sidecar and get output
    let output = spawn_worker(app, &request_json, state).await?;

    // Parse response
    let response: WorkerResponse =
        serde_json::from_str(&output).map_err(|e| GeneratorError::Bcrypt(e.to_string()))?;

    match response {
        WorkerResponse::HashSuccess {
            hash,
            cost,
            algorithm,
            ..
        } => Ok(BcryptHashResult {
            hash,
            cost,
            algorithm,
        }),
        WorkerResponse::Error { error, .. } => Err(GeneratorError::Bcrypt(error)),
        WorkerResponse::VerifySuccess { .. } => Err(GeneratorError::Bcrypt(
            "Unexpected response type: expected hash result".to_string(),
        )),
    }
}

/// Verify a `BCrypt` hash using process isolation
///
/// Spawns a separate process for the computation, allowing true cancellation.
pub async fn verify_hash_isolated(
    app: &AppHandle,
    password: String,
    hash: String,
    state: &BcryptProcessState,
) -> Result<BcryptVerifyResult, GeneratorError> {
    // Create request
    let request = WorkerRequest::Verify { password, hash };
    let request_json =
        serde_json::to_string(&request).map_err(|e| GeneratorError::Bcrypt(e.to_string()))?;

    // Spawn sidecar and get output
    let output = spawn_worker(app, &request_json, state).await?;

    // Parse response
    let response: WorkerResponse =
        serde_json::from_str(&output).map_err(|e| GeneratorError::Bcrypt(e.to_string()))?;

    match response {
        WorkerResponse::VerifySuccess { valid, message, .. } => {
            Ok(BcryptVerifyResult { valid, message })
        }
        WorkerResponse::Error { error, .. } => Err(GeneratorError::Bcrypt(error)),
        WorkerResponse::HashSuccess { .. } => Err(GeneratorError::Bcrypt(
            "Unexpected response type: expected verify result".to_string(),
        )),
    }
}

/// Spawn the bcrypt-worker sidecar and execute a request
async fn spawn_worker(
    app: &AppHandle,
    request_json: &str,
    state: &BcryptProcessState,
) -> Result<String, GeneratorError> {
    // Kill any existing process first
    state.kill();

    // Create the sidecar command
    // Note: Use just the binary name, not the full path
    let sidecar_command = app
        .shell()
        .sidecar("bcrypt-worker")
        .map_err(|e| GeneratorError::Bcrypt(format!("Failed to create sidecar command: {e}")))?;

    // Spawn the sidecar process
    let (mut rx, mut child) = sidecar_command
        .spawn()
        .map_err(|e| GeneratorError::Bcrypt(format!("Failed to spawn sidecar: {e}")))?;

    // Write request to stdin (with newline for line-based reading)
    let input = format!("{request_json}\n");
    child
        .write(input.as_bytes())
        .map_err(|e| GeneratorError::Bcrypt(format!("Failed to write to stdin: {e}")))?;

    // Store child handle for potential cancellation
    state.set_child(child);

    // Collect output from the process
    let mut output = String::new();
    let mut stderr_output = String::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                output.push_str(&line);
            }
            CommandEvent::Stderr(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                stderr_output.push_str(&line);
            }
            CommandEvent::Error(e) => {
                // Clear child from state
                state.take_child();
                return Err(GeneratorError::Bcrypt(format!("Process error: {e}")));
            }
            CommandEvent::Terminated(status) => {
                // Clear child from state
                state.take_child();

                // Check if process exited successfully (code 0)
                let success = status.code == Some(0);
                if !success {
                    // Check if it was killed (signal termination indicates cancellation)
                    if status.signal.is_some() {
                        return Err(GeneratorError::Cancelled);
                    }
                    // Include stderr in error message if available
                    let error_msg = if stderr_output.trim().is_empty() {
                        format!("Worker exited with code: {:?}", status.code)
                    } else {
                        format!(
                            "Worker exited with code {:?}: {}",
                            status.code,
                            stderr_output.trim()
                        )
                    };
                    return Err(GeneratorError::Bcrypt(error_msg));
                }
                break;
            }
            _ => {}
        }
    }

    if output.trim().is_empty() {
        return Err(GeneratorError::Bcrypt("No output from worker".to_string()));
    }

    Ok(output)
}

// =============================================================================
// Cost Information
// =============================================================================

/// Get information about a cost factor
///
/// # Arguments
/// * `cost` - The cost factor to get info for
///
/// # Returns
/// Information about the cost factor
pub fn get_cost_info(cost: u32) -> BcryptCostInfo {
    // Approximate computation time: ~100ms at cost 10, doubles for each increment
    let base_time_ms = 100.0;
    let base_cost = 10i32;
    // cost is guaranteed to be at most MAX_COST (20), so this conversion always succeeds
    let cost_i32 = i32::try_from(cost).unwrap_or(i32::MAX);
    let estimated_time_ms = base_time_ms * 2_f64.powi(cost_i32 - base_cost);

    let security_level = match cost {
        0..=5 => "Very Low",
        6..=7 => "Low",
        8..=9 => "Medium",
        10..=11 => "Standard",
        12..=13 => "High",
        14..=15 => "Very High",
        _ => "Extreme",
    }
    .to_string();

    BcryptCostInfo {
        cost,
        estimated_time_ms,
        security_level,
    }
}

// =============================================================================
// Synchronous Operations (for testing)
// =============================================================================

/// Generate a `BCrypt` hash from a password (synchronous, for testing)
#[cfg(test)]
fn generate_hash(password: &str, cost: u32) -> Result<BcryptHashResult, GeneratorError> {
    if !(MIN_COST..=MAX_COST).contains(&cost) {
        return Err(GeneratorError::InvalidParameter(format!(
            "Cost factor must be between {MIN_COST} and {MAX_COST}, got {cost}"
        )));
    }

    let hash = bcrypt::hash(password, cost).map_err(|e| GeneratorError::Bcrypt(e.to_string()))?;

    Ok(BcryptHashResult {
        hash,
        cost,
        algorithm: "2b".to_string(),
    })
}

/// Verify a password against a `BCrypt` hash (synchronous, for testing)
#[cfg(test)]
fn verify_hash(password: &str, hash: &str) -> Result<BcryptVerifyResult, GeneratorError> {
    match bcrypt::verify(password, hash) {
        Ok(valid) => Ok(BcryptVerifyResult {
            valid,
            message: if valid {
                "Password matches the hash".to_string()
            } else {
                "Password does not match the hash".to_string()
            },
        }),
        Err(e) => Err(GeneratorError::Bcrypt(e.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_hash() {
        let result = generate_hash("password123", 4);
        assert!(result.is_ok());
        let hash_result = result.unwrap();
        assert!(hash_result.hash.starts_with("$2b$04$"));
        assert_eq!(hash_result.cost, 4);
        assert_eq!(hash_result.algorithm, "2b");
    }

    #[test]
    fn test_verify_correct_password() {
        let hash_result = generate_hash("password123", 4).unwrap();
        let verify_result = verify_hash("password123", &hash_result.hash).unwrap();
        assert!(verify_result.valid);
    }

    #[test]
    fn test_verify_wrong_password() {
        let hash_result = generate_hash("password123", 4).unwrap();
        let verify_result = verify_hash("wrongpassword", &hash_result.hash).unwrap();
        assert!(!verify_result.valid);
    }

    #[test]
    fn test_invalid_cost_too_low() {
        let result = generate_hash("password", 3);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_cost_too_high() {
        let result = generate_hash("password", 32);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_cost_info() {
        let info = get_cost_info(10);
        assert_eq!(info.cost, 10);
        assert!((info.estimated_time_ms - 100.0).abs() < 0.1);
        assert_eq!(info.security_level, "Standard");

        let info_high = get_cost_info(14);
        assert_eq!(info_high.security_level, "Very High");
    }
}
