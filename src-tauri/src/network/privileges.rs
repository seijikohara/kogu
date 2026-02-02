//! Privilege management for the net-scanner sidecar binary
//!
//! Handles checking and setting up persistent privileges for the net-scanner sidecar.
//!
//! ## Platform-specific mechanisms
//!
//! - **macOS**: setuid via `osascript` (admin password dialog)
//! - **Linux**: `setcap cap_net_raw,cap_net_admin+ep` via `pkexec`
//! - **Windows**: Not supported (requires per-execution UAC elevation)

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

// =============================================================================
// Privilege Status
// =============================================================================

/// Current privilege status of the net-scanner sidecar
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivilegeStatus {
    /// Whether TCP SYN scanning is available
    pub tcp_syn: bool,
    /// Whether privilege setup has been completed
    pub setup_completed: bool,
    /// Whether privilege setup is available on this platform
    pub setup_available: bool,
    /// Human-readable status message
    pub message: String,
}

// =============================================================================
// Sidecar Binary Path Resolution
// =============================================================================

/// Compile-time target triple matching Tauri's sidecar naming convention
const TARGET_TRIPLE: &str = env!("TAURI_ENV_TARGET_TRIPLE");

/// Resolve the absolute path to the net-scanner sidecar binary
///
/// Tries two naming conventions in order:
/// 1. With target triple suffix (production bundle): `net-scanner-aarch64-apple-darwin`
/// 2. Without suffix (dev mode / cargo build): `net-scanner`
fn resolve_sidecar_path() -> Result<String, String> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("Failed to get current executable path: {e}"))?
        .parent()
        .ok_or_else(|| "Current executable has no parent directory".to_string())?
        .to_path_buf();

    let candidates = [
        exe_dir.join(format!("net-scanner-{TARGET_TRIPLE}")),
        exe_dir.join("net-scanner"),
    ];

    candidates
        .iter()
        .find(|p| p.exists())
        .and_then(|p| p.to_str())
        .map(String::from)
        .ok_or_else(|| format!("Net-scanner binary not found in {}", exe_dir.display()))
}

// =============================================================================
// Privilege Check
// =============================================================================

/// Check the current privilege status by spawning the net-scanner sidecar
pub async fn check_status(app: &AppHandle) -> PrivilegeStatus {
    match super::sidecar::check_privileges(app).await {
        Ok(resp) if resp.success => {
            let tcp_syn = resp.tcp_syn.unwrap_or(false);
            PrivilegeStatus {
                tcp_syn,
                setup_completed: tcp_syn,
                setup_available: is_setup_available(),
                message: if tcp_syn {
                    "Privileged scanning available".to_string()
                } else {
                    "Privilege setup required for advanced scanning".to_string()
                },
            }
        }
        Ok(resp) => PrivilegeStatus {
            tcp_syn: false,
            setup_completed: false,
            setup_available: is_setup_available(),
            message: resp
                .error
                .unwrap_or_else(|| "Privilege check failed".to_string()),
        },
        Err(e) => PrivilegeStatus {
            tcp_syn: false,
            setup_completed: false,
            setup_available: is_setup_available(),
            message: format!("Net-scanner unavailable: {e}"),
        },
    }
}

/// Whether privilege setup is available on this platform
fn is_setup_available() -> bool {
    cfg!(target_os = "macos") || cfg!(target_os = "linux")
}

// =============================================================================
// Privilege Setup
// =============================================================================

/// Set up persistent privileges for the net-scanner sidecar binary
///
/// This triggers a platform-specific admin password dialog:
/// - macOS: `osascript` → admin dialog → `chown root && chmod u+s`
/// - Linux: `pkexec` → `setcap cap_net_raw,cap_net_admin+ep`
pub async fn setup(app: &AppHandle) -> Result<PrivilegeStatus, String> {
    let sidecar_path = resolve_sidecar_path()?;

    #[cfg(target_os = "macos")]
    setup_macos(app, &sidecar_path).await?;

    #[cfg(target_os = "linux")]
    setup_linux(app, &sidecar_path).await?;

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    return Err("Privilege setup is not available on this platform".to_string());

    // Verify setup succeeded
    Ok(check_status(app).await)
}

/// macOS: Set setuid bit via osascript admin dialog
#[cfg(target_os = "macos")]
async fn setup_macos(app: &AppHandle, sidecar_path: &str) -> Result<(), String> {
    let script = format!(
        "do shell script \"chown root '{sidecar_path}' && chmod u+s '{sidecar_path}'\" with administrator privileges"
    );

    let output = app
        .shell()
        .command("osascript")
        .args(["-e", &script])
        .output()
        .await
        .map_err(|e| format!("Failed to execute osascript: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("User canceled") || stderr.contains("-128") {
            return Err("Setup cancelled by user".to_string());
        }
        return Err(format!("Privilege setup failed: {}", stderr.trim()));
    }

    Ok(())
}

/// Linux: Set file capabilities via pkexec + setcap
#[cfg(target_os = "linux")]
async fn setup_linux(app: &AppHandle, sidecar_path: &str) -> Result<(), String> {
    let output = app
        .shell()
        .command("pkexec")
        .args(["setcap", "cap_net_raw,cap_net_admin+ep", sidecar_path])
        .output()
        .await
        .map_err(|e| format!("Failed to execute pkexec: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("dismissed") || stderr.contains("Not authorized") {
            return Err("Setup cancelled by user".to_string());
        }
        return Err(format!("Privilege setup failed: {}", stderr.trim()));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_privilege_status_serialization() {
        let status = PrivilegeStatus {
            tcp_syn: true,
            setup_completed: true,
            setup_available: true,
            message: "Ready".to_string(),
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains(r#""tcpSyn":true"#));
        assert!(json.contains(r#""setupCompleted":true"#));
    }

    #[test]
    fn test_is_setup_available() {
        // Should return true on macOS and Linux
        let available = is_setup_available();
        if cfg!(target_os = "macos") || cfg!(target_os = "linux") {
            assert!(available);
        } else {
            assert!(!available);
        }
    }

    #[test]
    fn test_target_triple_is_set() {
        // TARGET_TRIPLE should be set at compile time by Tauri's build.rs
        assert!(!TARGET_TRIPLE.is_empty());
        assert!(
            TARGET_TRIPLE.contains("apple-darwin")
                || TARGET_TRIPLE.contains("unknown-linux")
                || TARGET_TRIPLE.contains("pc-windows")
        );
    }

    #[test]
    fn test_resolve_sidecar_path_contains_net_scanner() {
        let result = resolve_sidecar_path();
        // In CI or environments without the binary, this may fail — that's acceptable
        if let Ok(path) = result {
            assert!(path.contains("net-scanner"));
        }
    }
}
