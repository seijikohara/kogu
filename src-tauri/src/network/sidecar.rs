//! Net-scanner sidecar communication module
//!
//! Provides process isolation for privileged network operations (ARP, ICMP)
//! by spawning the `net-scanner` sidecar binary and communicating via JSON stdin/stdout.
//!
//! # IPC Protocol
//!
//! - **Input**: Single JSON line on stdin (a [`Request`])
//! - **Output**: One or more JSON Lines on stdout (each a [`Response`])
//! - **Streaming**: Discovery and scan commands emit multiple response lines
//!   before a final completion line
//! - **Cancellation**: Kill the sidecar process

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use super::discovery::{DiscoveryEvent, DiscoveryMethod, DiscoveryOptions, DiscoveryResult};
use super::types::{
    LocalNetworkInfo, MdnsDiscoveryResults, ScanProgress, ScanRequest, ScanResults,
};

// =============================================================================
// IPC Protocol Types (shared between sidecar binary and main process)
// =============================================================================

/// Sidecar request — sent as a single JSON line on stdin
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Request {
    /// Check if this binary has raw socket privileges
    Check,
    /// Run host discovery with streaming events
    Discover {
        /// Target IP addresses or CIDR ranges
        targets: Vec<String>,
        /// Discovery options (methods, timeouts, etc.)
        options: DiscoveryOptions,
    },
    /// Run a port scan with streaming progress
    Scan {
        /// Scan request parameters
        request: ScanRequest,
    },
    /// Get local network interfaces
    GetLocalInterfaces,
    /// Discover mDNS/Bonjour services
    DiscoverMdns {
        /// Service types to discover
        service_types: Vec<String>,
        /// Discovery duration in milliseconds
        duration_ms: u32,
    },
    /// Get available discovery methods and their privilege status
    GetDiscoveryMethods,
    /// Check if a specific discovery method has required privileges
    CheckDiscoveryPrivilege {
        /// Method to check
        method: DiscoveryMethod,
    },
}

/// Sidecar response — written as JSON Lines to stdout (one per line)
///
/// Streaming commands (Discover, Scan) emit multiple lines:
/// intermediate events followed by a final completion response.
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Response {
    /// Privilege check result
    CheckResult {
        /// Whether raw socket privileges are available
        success: bool,
    },
    /// Streaming: a single discovery event
    DiscoveryEvent {
        /// The discovery event data
        event: DiscoveryEvent,
    },
    /// Final: discovery completed with aggregated results
    DiscoveryComplete {
        /// All discovery results
        results: Vec<DiscoveryResult>,
    },
    /// Streaming: a scan progress update
    ScanProgress {
        /// The scan progress data
        progress: ScanProgress,
    },
    /// Final: scan completed with results
    ScanComplete {
        /// Scan results
        results: ScanResults,
    },
    /// One-shot: local network interfaces
    LocalInterfaces {
        /// Network interface information
        info: LocalNetworkInfo,
    },
    /// One-shot: mDNS discovery results
    MdnsResults {
        /// Discovered mDNS services
        results: MdnsDiscoveryResults,
    },
    /// One-shot: available discovery methods
    DiscoveryMethods {
        /// Methods with availability status
        methods: Vec<MethodAvailability>,
    },
    /// One-shot: privilege check for a specific method
    DiscoveryPrivilege {
        /// Whether the method is available
        available: bool,
    },
    /// Error response
    Error {
        /// Error message
        message: String,
    },
}

/// Availability of a discovery method
#[derive(Debug, Serialize)]
pub struct MethodAvailability {
    /// The discovery method
    pub method: DiscoveryMethod,
    /// Whether the method is available (has required privileges)
    pub available: bool,
}

// =============================================================================
// Response Envelope (for deserialization in main process)
// =============================================================================

/// Response envelope for deserialization — uses `serde_json::Value` for inner
/// types to avoid requiring `Deserialize` on all network types.
///
/// The main process forwards these values as-is to the frontend
/// (via Tauri Channel or event emitter), preserving the original JSON.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ResponseEnvelope {
    /// Privilege check result
    CheckResult {
        /// Whether raw socket privileges are available
        success: bool,
    },
    /// Streaming: a single discovery event
    DiscoveryEvent {
        /// Raw JSON of the discovery event
        event: serde_json::Value,
    },
    /// Final: discovery completed with aggregated results
    DiscoveryComplete {
        /// Raw JSON of the discovery results array
        results: serde_json::Value,
    },
    /// Streaming: a scan progress update
    ScanProgress {
        /// Raw JSON of the scan progress
        progress: serde_json::Value,
    },
    /// Final: scan completed with results
    ScanComplete {
        /// Raw JSON of the scan results
        results: serde_json::Value,
    },
    /// One-shot: local network interfaces
    LocalInterfaces {
        /// Raw JSON of the network interface info
        info: serde_json::Value,
    },
    /// One-shot: mDNS discovery results
    MdnsResults {
        /// Raw JSON of the mDNS results
        results: serde_json::Value,
    },
    /// One-shot: available discovery methods
    DiscoveryMethods {
        /// Raw JSON of the methods array
        methods: serde_json::Value,
    },
    /// One-shot: privilege check for a specific method
    DiscoveryPrivilege {
        /// Whether the method is available
        available: bool,
    },
    /// Error response
    Error {
        /// Error message
        message: String,
    },
}

// =============================================================================
// Legacy Response Type (used by check_privileges return type)
// =============================================================================

/// Privilege check response
#[derive(Debug, Deserialize)]
pub struct CheckResponse {
    /// Whether the privilege check succeeded
    pub success: bool,
    /// Error message if the check failed
    pub error: Option<String>,
}

// =============================================================================
// Sidecar Communication
// =============================================================================

/// Spawn the sidecar with a typed request, returning the event receiver and child process.
///
/// The caller reads streaming JSON Lines from the receiver and can kill the
/// child for cancellation.
pub fn spawn_with_request(
    app: &AppHandle,
    request: &Request,
) -> Result<(tokio::sync::mpsc::Receiver<CommandEvent>, CommandChild), String> {
    let request_json =
        serde_json::to_string(request).map_err(|e| format!("Failed to serialize request: {e}"))?;

    let sidecar_command = app
        .shell()
        .sidecar("net-scanner")
        .map_err(|e| format!("Failed to create net-scanner sidecar command: {e}"))?;

    let (rx, mut child) = sidecar_command
        .spawn()
        .map_err(|e| format!("Failed to spawn net-scanner sidecar: {e}"))?;

    let input = format!("{request_json}\n");
    child
        .write(input.as_bytes())
        .map_err(|e| format!("Failed to write to net-scanner stdin: {e}"))?;

    Ok((rx, child))
}

/// Execute a one-shot sidecar command and return the response.
///
/// For commands that produce a single response line (not streaming).
pub async fn execute_oneshot(
    app: &AppHandle,
    request: &Request,
) -> Result<ResponseEnvelope, String> {
    let (mut rx, _child) = spawn_with_request(app, request)?;

    let mut last_output = String::new();
    let mut stderr_output = String::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    last_output = trimmed.to_string();
                }
            }
            CommandEvent::Stderr(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                stderr_output.push_str(&line);
            }
            CommandEvent::Error(e) => {
                return Err(format!("Net-scanner process error: {e}"));
            }
            CommandEvent::Terminated(status) => {
                if status.code != Some(0) {
                    let error_msg = if stderr_output.trim().is_empty() {
                        format!("Net-scanner exited with code: {:?}", status.code)
                    } else {
                        format!(
                            "Net-scanner exited with code {:?}: {}",
                            status.code,
                            stderr_output.trim()
                        )
                    };
                    return Err(error_msg);
                }
                break;
            }
            _ => {}
        }
    }

    if last_output.is_empty() {
        return Err("No output from net-scanner".to_string());
    }

    serde_json::from_str(&last_output).map_err(|e| format!("Failed to parse sidecar response: {e}"))
}

/// Check if the net-scanner sidecar has raw socket privileges
pub async fn check_privileges(app: &AppHandle) -> Result<CheckResponse, String> {
    match execute_oneshot(app, &Request::Check).await? {
        ResponseEnvelope::CheckResult { success } => Ok(CheckResponse {
            success,
            error: None,
        }),
        ResponseEnvelope::Error { message } => Ok(CheckResponse {
            success: false,
            error: Some(message),
        }),
        _ => Err("Unexpected response from net-scanner".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_response_deserialization() {
        let json = r#"{"success":true}"#;
        let resp: CheckResponse = serde_json::from_str(json).unwrap();
        assert!(resp.success);
    }

    #[test]
    fn test_error_response_deserialization() {
        let json = r#"{"success":false,"error":"Permission denied"}"#;
        let resp: CheckResponse = serde_json::from_str(json).unwrap();
        assert!(!resp.success);
        assert_eq!(resp.error.as_deref(), Some("Permission denied"));
    }

    #[test]
    fn test_request_serialization() {
        let req = Request::Check;
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""type":"check""#));
    }

    #[test]
    fn test_response_envelope_deserialize_check() {
        let json = r#"{"type":"check_result","success":true}"#;
        let resp: ResponseEnvelope = serde_json::from_str(json).unwrap();
        assert!(matches!(
            resp,
            ResponseEnvelope::CheckResult { success: true }
        ));
    }

    #[test]
    fn test_response_envelope_deserialize_error() {
        let json = r#"{"type":"error","message":"test error"}"#;
        let resp: ResponseEnvelope = serde_json::from_str(json).unwrap();
        assert!(matches!(resp, ResponseEnvelope::Error { .. }));
    }

    #[test]
    fn test_response_envelope_deserialize_discovery_event() {
        let json = r#"{"type":"discovery_event","event":{"event":"methodStarted","data":{"method":"tcp_connect"}}}"#;
        let resp: ResponseEnvelope = serde_json::from_str(json).unwrap();
        assert!(matches!(resp, ResponseEnvelope::DiscoveryEvent { .. }));
    }

    #[test]
    fn test_response_envelope_deserialize_privilege() {
        let json = r#"{"type":"discovery_privilege","available":false}"#;
        let resp: ResponseEnvelope = serde_json::from_str(json).unwrap();
        assert!(matches!(
            resp,
            ResponseEnvelope::DiscoveryPrivilege { available: false }
        ));
    }
}
