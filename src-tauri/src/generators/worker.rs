//! Unified worker process management for CPU-intensive operations
//!
//! This module provides process isolation for `BCrypt`, SSH, and GPG operations,
//! enabling true cancellation via process termination.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use super::GeneratorError;

// =============================================================================
// Process State Management
// =============================================================================

/// State for managing the worker process
#[derive(Default)]
pub struct WorkerProcessState {
    /// Currently running child process
    child: Mutex<Option<CommandChild>>,
}

impl WorkerProcessState {
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
// Worker Communication
// =============================================================================

/// Execute a request on the worker sidecar
pub async fn execute<Req, Res>(
    app: &AppHandle,
    request: &Req,
    state: &WorkerProcessState,
) -> Result<Res, GeneratorError>
where
    Req: Serialize + Sync,
    Res: for<'de> Deserialize<'de>,
{
    // Serialize request
    let request_json =
        serde_json::to_string(request).map_err(|e| GeneratorError::Worker(e.to_string()))?;

    // Spawn worker and get output
    let output = spawn_worker(app, &request_json, state).await?;

    // Parse response
    serde_json::from_str(&output).map_err(|e| GeneratorError::Worker(e.to_string()))
}

/// Spawn the worker sidecar and execute a request
async fn spawn_worker(
    app: &AppHandle,
    request_json: &str,
    state: &WorkerProcessState,
) -> Result<String, GeneratorError> {
    // Kill any existing process first
    state.kill();

    // Create the sidecar command
    let sidecar_command = app
        .shell()
        .sidecar("worker")
        .map_err(|e| GeneratorError::Worker(format!("Failed to create sidecar command: {e}")))?;

    // Spawn the sidecar process
    let (mut rx, mut child) = sidecar_command
        .spawn()
        .map_err(|e| GeneratorError::Worker(format!("Failed to spawn sidecar: {e}")))?;

    // Write request to stdin (with newline for line-based reading)
    let input = format!("{request_json}\n");
    child
        .write(input.as_bytes())
        .map_err(|e| GeneratorError::Worker(format!("Failed to write to stdin: {e}")))?;

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
                return Err(GeneratorError::Worker(format!("Process error: {e}")));
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
                    return Err(GeneratorError::Worker(error_msg));
                }
                break;
            }
            _ => {}
        }
    }

    if output.trim().is_empty() {
        return Err(GeneratorError::Worker("No output from worker".to_string()));
    }

    Ok(output)
}

// =============================================================================
// BCrypt Types
// =============================================================================

/// `BCrypt` hash request
#[derive(Debug, Serialize)]
pub struct BcryptHashRequest {
    #[serde(rename = "type")]
    pub request_type: &'static str,
    pub operation: &'static str,
    pub password: String,
    pub cost: u32,
}

impl BcryptHashRequest {
    pub const fn new(password: String, cost: u32) -> Self {
        Self {
            request_type: "bcrypt",
            operation: "hash",
            password,
            cost,
        }
    }
}

/// `BCrypt` verify request
#[derive(Debug, Serialize)]
pub struct BcryptVerifyRequest {
    #[serde(rename = "type")]
    pub request_type: &'static str,
    pub operation: &'static str,
    pub password: String,
    pub hash: String,
}

impl BcryptVerifyRequest {
    pub const fn new(password: String, hash: String) -> Self {
        Self {
            request_type: "bcrypt",
            operation: "verify",
            password,
            hash,
        }
    }
}

/// `BCrypt` hash response
#[derive(Debug, Deserialize)]
pub struct BcryptHashResponse {
    pub success: bool,
    pub hash: Option<String>,
    pub cost: Option<u32>,
    pub algorithm: Option<String>,
    pub error: Option<String>,
}

/// `BCrypt` verify response
#[derive(Debug, Deserialize)]
pub struct BcryptVerifyResponse {
    pub success: bool,
    pub valid: Option<bool>,
    pub message: Option<String>,
    pub error: Option<String>,
}

// =============================================================================
// SSH Key Types
// =============================================================================

/// SSH key generation request
#[derive(Debug, Serialize)]
pub struct SshKeyRequest {
    #[serde(rename = "type")]
    pub request_type: &'static str,
    pub algorithm: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passphrase: Option<String>,
}

impl SshKeyRequest {
    pub fn new(algorithm: &str, comment: Option<String>, passphrase: Option<String>) -> Self {
        Self {
            request_type: "ssh",
            algorithm: algorithm.to_string(),
            comment,
            passphrase,
        }
    }
}

/// SSH key generation response
#[derive(Debug, Deserialize)]
pub struct SshKeyResponse {
    pub success: bool,
    pub algorithm: Option<String>,
    pub public_key: Option<String>,
    pub private_key: Option<String>,
    pub fingerprint: Option<String>,
    pub ssh_keygen_command: Option<String>,
    pub method_used: Option<String>,
    pub error: Option<String>,
}

// =============================================================================
// GPG Key Types
// =============================================================================

/// GPG key generation request
#[derive(Debug, Serialize)]
pub struct GpgKeyRequest {
    #[serde(rename = "type")]
    pub request_type: &'static str,
    pub name: String,
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    pub algorithm: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passphrase: Option<String>,
}

impl GpgKeyRequest {
    pub fn new(
        name: String,
        email: String,
        comment: Option<String>,
        algorithm: &str,
        passphrase: Option<String>,
    ) -> Self {
        Self {
            request_type: "gpg",
            name,
            email,
            comment,
            algorithm: algorithm.to_string(),
            passphrase,
        }
    }
}

/// GPG key generation response
#[derive(Debug, Deserialize)]
pub struct GpgKeyResponse {
    pub success: bool,
    pub algorithm: Option<String>,
    pub user_id: Option<String>,
    pub fingerprint: Option<String>,
    pub public_key: Option<String>,
    pub private_key: Option<String>,
    pub gpg_command_interactive: Option<String>,
    pub gpg_command_batch: Option<String>,
    pub method_used: Option<String>,
    pub error: Option<String>,
}
