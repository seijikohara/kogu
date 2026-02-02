//! Net-scanner sidecar communication module
//!
//! Provides process isolation for privileged network operations (TCP SYN, ARP, ICMP)
//! by spawning the `net-scanner` sidecar binary and communicating via JSON stdin/stdout.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

// =============================================================================
// Request / Response Types
// =============================================================================

/// Privilege check request
#[derive(Debug, Serialize)]
pub struct CheckRequest {
    #[serde(rename = "type")]
    request_type: &'static str,
}

impl CheckRequest {
    pub const fn new() -> Self {
        Self {
            request_type: "check",
        }
    }
}

/// Privilege check response
#[derive(Debug, Deserialize)]
pub struct CheckResponse {
    pub success: bool,
    pub tcp_syn: Option<bool>,
    pub error: Option<String>,
}

/// TCP SYN scan request
#[derive(Debug, Serialize)]
pub struct TcpSynRequest {
    #[serde(rename = "type")]
    request_type: &'static str,
    pub targets: Vec<String>,
    pub ports: Vec<u16>,
    pub source_ip: String,
    pub timeout_ms: u64,
}

impl TcpSynRequest {
    pub fn new(targets: Vec<String>, ports: Vec<u16>, source_ip: String, timeout_ms: u64) -> Self {
        Self {
            request_type: "tcp_syn",
            targets,
            ports,
            source_ip,
            timeout_ms,
        }
    }
}

/// TCP SYN scan response
#[derive(Debug, Deserialize)]
pub struct TcpSynResponse {
    pub success: bool,
    pub discovered: Option<Vec<String>>,
    pub error: Option<String>,
}

// =============================================================================
// Sidecar Communication
// =============================================================================

/// Execute a request on the net-scanner sidecar and return the response
pub async fn execute<Req, Res>(app: &AppHandle, request: &Req) -> Result<Res, String>
where
    Req: Serialize + Sync,
    Res: for<'de> Deserialize<'de>,
{
    let request_json =
        serde_json::to_string(request).map_err(|e| format!("Failed to serialize request: {e}"))?;

    let output = spawn_net_scanner(app, &request_json).await?;

    serde_json::from_str(&output).map_err(|e| format!("Failed to parse response: {e}"))
}

/// Spawn the net-scanner sidecar and execute a request
async fn spawn_net_scanner(app: &AppHandle, request_json: &str) -> Result<String, String> {
    let sidecar_command = app
        .shell()
        .sidecar("net-scanner")
        .map_err(|e| format!("Failed to create net-scanner sidecar command: {e}"))?;

    let (mut rx, mut child) = sidecar_command
        .spawn()
        .map_err(|e| format!("Failed to spawn net-scanner sidecar: {e}"))?;

    // Write request to stdin
    let input = format!("{request_json}\n");
    child
        .write(input.as_bytes())
        .map_err(|e| format!("Failed to write to net-scanner stdin: {e}"))?;

    // Collect output
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

    if output.trim().is_empty() {
        return Err("No output from net-scanner".to_string());
    }

    Ok(output)
}

/// Check if the net-scanner sidecar has raw socket privileges
pub async fn check_privileges(app: &AppHandle) -> Result<CheckResponse, String> {
    execute(app, &CheckRequest::new()).await
}

/// Execute TCP SYN scan via the net-scanner sidecar
pub async fn tcp_syn_scan(
    app: &AppHandle,
    targets: Vec<String>,
    ports: Vec<u16>,
    source_ip: String,
    timeout_ms: u64,
) -> Result<TcpSynResponse, String> {
    execute(
        app,
        &TcpSynRequest::new(targets, ports, source_ip, timeout_ms),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_request_serialization() {
        let req = CheckRequest::new();
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""type":"check""#));
    }

    #[test]
    fn test_tcp_syn_request_serialization() {
        let req = TcpSynRequest::new(
            vec!["192.168.1.1".to_string()],
            vec![80, 443],
            "192.168.1.100".to_string(),
            1000,
        );
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains(r#""type":"tcp_syn""#));
        assert!(json.contains("192.168.1.1"));
        assert!(json.contains("192.168.1.100"));
    }

    #[test]
    fn test_check_response_deserialization() {
        let json = r#"{"success":true,"tcp_syn":true}"#;
        let resp: CheckResponse = serde_json::from_str(json).unwrap();
        assert!(resp.success);
        assert_eq!(resp.tcp_syn, Some(true));
    }

    #[test]
    fn test_tcp_syn_response_deserialization() {
        let json =
            r#"{"success":true,"discovered":["192.168.1.1","192.168.1.2"],"duration_ms":500}"#;
        let resp: TcpSynResponse = serde_json::from_str(json).unwrap();
        assert!(resp.success);
        assert_eq!(resp.discovered.as_ref().unwrap().len(), 2);
    }

    #[test]
    fn test_error_response_deserialization() {
        let json = r#"{"success":false,"error":"Permission denied"}"#;
        let resp: CheckResponse = serde_json::from_str(json).unwrap();
        assert!(!resp.success);
        assert_eq!(resp.error.as_deref(), Some("Permission denied"));
    }
}
