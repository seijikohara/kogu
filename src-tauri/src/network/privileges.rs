//! Privilege management for the net-scanner sidecar binary
//!
//! Handles checking and setting up persistent privileges for the net-scanner sidecar.
//!
//! ## Platform-specific mechanisms
//!
//! - **macOS 13+**: SMAppService daemon via Login Items (recommended)
//! - **macOS <13**: setuid via `osascript` (legacy fallback)
//! - **Linux**: `setcap cap_net_raw,cap_net_admin+ep` via `pkexec`
//! - **Windows**: Not supported (requires per-execution UAC elevation)

use serde::Serialize;
use tauri::AppHandle;

#[cfg(target_os = "linux")]
use tauri_plugin_shell::ShellExt;

// =============================================================================
// Privilege Status
// =============================================================================

/// Current privilege status of the net-scanner sidecar
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivilegeStatus {
    /// Whether privilege setup has been completed
    pub setup_completed: bool,
    /// Whether privilege setup is available on this platform
    pub setup_available: bool,
    /// Whether user approval is required in System Settings (macOS 13+)
    pub requires_approval: bool,
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
#[allow(dead_code)]
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

/// Check the current privilege status
pub async fn check_status(app: &AppHandle) -> PrivilegeStatus {
    #[cfg(target_os = "macos")]
    {
        check_status_macos(app).await
    }

    #[cfg(target_os = "linux")]
    {
        check_status_linux(app).await
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = app;
        PrivilegeStatus {
            setup_completed: false,
            setup_available: false,
            requires_approval: false,
            message: "Privileged scanning not available on this platform".to_string(),
        }
    }
}

/// macOS: Check privilege status via SMAppService daemon or sidecar
#[cfg(target_os = "macos")]
async fn check_status_macos(app: &AppHandle) -> PrivilegeStatus {
    use super::swift_bridge;

    // In debug mode, SMAppService doesn't work (requires code signing)
    // Check sidecar privileges directly and use legacy setuid method for setup
    if cfg!(debug_assertions) {
        return match super::sidecar::check_privileges(app).await {
            Ok(resp) if resp.success => PrivilegeStatus {
                setup_completed: true,
                setup_available: true,
                requires_approval: false,
                message: "Privileged scanning available (dev mode, setuid)".to_string(),
            },
            Ok(_) | Err(_) => PrivilegeStatus {
                setup_completed: false,
                setup_available: true, // Enable setup via legacy setuid method
                requires_approval: false,
                message: "Click Setup to enable privileged scanning (dev mode)".to_string(),
            },
        };
    }

    // First, check SMAppService daemon status
    let daemon_status = swift_bridge::get_daemon_status();

    if daemon_status.is_registered {
        // Daemon is registered and enabled - try to connect and verify privileges
        if swift_bridge::xpc_connect() && swift_bridge::xpc_ping() {
            match swift_bridge::xpc_check_privileges() {
                Ok(true) => {
                    return PrivilegeStatus {
                        setup_completed: true,
                        setup_available: true,
                        requires_approval: false,
                        message: "Privileged scanning available via daemon".to_string(),
                    };
                }
                Ok(false) => {
                    return PrivilegeStatus {
                        setup_completed: false,
                        setup_available: true,
                        requires_approval: false,
                        message: "Daemon running but not privileged".to_string(),
                    };
                }
                Err(e) => {
                    return PrivilegeStatus {
                        setup_completed: false,
                        setup_available: true,
                        requires_approval: false,
                        message: format!("Daemon privilege check failed: {e}"),
                    };
                }
            }
        }
    }

    if daemon_status.requires_approval {
        return PrivilegeStatus {
            setup_completed: false,
            setup_available: true,
            requires_approval: true,
            message: "Please approve Kogu in System Settings > Login Items".to_string(),
        };
    }

    // Fall back to checking sidecar privileges (legacy setuid mode)
    match super::sidecar::check_privileges(app).await {
        Ok(resp) if resp.success => PrivilegeStatus {
            setup_completed: true,
            setup_available: true,
            requires_approval: false,
            message: "Privileged scanning available".to_string(),
        },
        Ok(resp) => PrivilegeStatus {
            setup_completed: false,
            setup_available: true,
            requires_approval: false,
            message: resp
                .error
                .unwrap_or_else(|| "Privilege check failed".to_string()),
        },
        Err(e) => PrivilegeStatus {
            setup_completed: false,
            setup_available: true,
            requires_approval: false,
            message: format!("Net-scanner unavailable: {e}"),
        },
    }
}

/// Linux: Check privilege status via sidecar
#[cfg(target_os = "linux")]
async fn check_status_linux(app: &AppHandle) -> PrivilegeStatus {
    match super::sidecar::check_privileges(app).await {
        Ok(resp) if resp.success => PrivilegeStatus {
            setup_completed: true,
            setup_available: true,
            requires_approval: false,
            message: "Privileged scanning available".to_string(),
        },
        Ok(resp) => PrivilegeStatus {
            setup_completed: false,
            setup_available: true,
            requires_approval: false,
            message: resp
                .error
                .unwrap_or_else(|| "Privilege check failed".to_string()),
        },
        Err(e) => PrivilegeStatus {
            setup_completed: false,
            setup_available: true,
            requires_approval: false,
            message: format!("Net-scanner unavailable: {e}"),
        },
    }
}

/// Whether privilege setup is available on this platform
#[allow(dead_code)]
fn is_setup_available() -> bool {
    cfg!(target_os = "macos") || cfg!(target_os = "linux")
}

// =============================================================================
// Privilege Setup
// =============================================================================

/// Set up persistent privileges for the net-scanner sidecar binary
///
/// Platform-specific behavior:
/// - macOS 13+: Register daemon via SMAppService (shows in Login Items)
/// - macOS <13: Legacy osascript setuid (fallback)
/// - Linux: `pkexec` → `setcap cap_net_raw,cap_net_admin+ep`
pub async fn setup(app: &AppHandle) -> Result<PrivilegeStatus, String> {
    #[cfg(target_os = "macos")]
    {
        setup_macos()?;
    }

    #[cfg(target_os = "linux")]
    {
        let sidecar_path = resolve_sidecar_path()?;
        setup_linux(app, &sidecar_path).await?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = app;
        Err("Privilege setup is not available on this platform".to_string())
    }

    // Verify setup succeeded
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    Ok(check_status(app).await)
}

/// macOS: Register daemon via SMAppService or fallback to setuid
///
/// This registers the NetScannerDaemon with the system. The user will be prompted
/// to approve the daemon in System Settings > Login Items.
///
/// In development mode (debug builds), SMAppService doesn't work because the app
/// is not code-signed. In this case, we fall back to the legacy setuid method.
#[cfg(target_os = "macos")]
fn setup_macos() -> Result<(), String> {
    use super::swift_bridge;

    // In debug mode, SMAppService won't work (requires code signing)
    // Fall back to legacy setuid method
    if cfg!(debug_assertions) {
        let sidecar_path = resolve_sidecar_path()?;
        return setup_macos_setuid(&sidecar_path);
    }

    // Register the daemon via SMAppService
    match swift_bridge::register_daemon() {
        Ok(()) => {
            // Registration succeeded - check if it requires approval
            let status = swift_bridge::get_daemon_status();
            if status.requires_approval {
                // Open System Settings to Login Items
                swift_bridge::open_login_items_settings();
                Err(
                    "Please approve Kogu in System Settings > Login Items, then try again"
                        .to_string(),
                )
            } else {
                Ok(())
            }
        }
        Err(e) if e.contains("requires user approval") => {
            // Open System Settings to Login Items
            swift_bridge::open_login_items_settings();
            Err("Please approve Kogu in System Settings > Login Items, then try again".to_string())
        }
        Err(e) => Err(format!("Failed to register daemon: {e}")),
    }
}

/// macOS: Legacy setuid method for development mode
///
/// Uses osascript to request admin privileges, change ownership to root,
/// and set the setuid bit on the sidecar. This allows the binary to run
/// with root privileges for raw socket operations.
#[cfg(target_os = "macos")]
fn setup_macos_setuid(sidecar_path: &str) -> Result<(), String> {
    use std::process::Command;

    // Use osascript to run chown + chmod with admin privileges
    // setuid requires: owned by root AND setuid bit set
    let script = format!(
        r#"do shell script "chown root '{}' && chmod u+s '{}'" with administrator privileges"#,
        sidecar_path, sidecar_path
    );

    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| format!("Failed to execute osascript: {e}"))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("User canceled") || stderr.contains("canceled") {
            Err("Setup cancelled by user".to_string())
        } else {
            Err(format!("Failed to set privileges: {}", stderr.trim()))
        }
    }
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

/// Open System Settings to Login Items (macOS only)
///
/// This is called when the daemon requires user approval.
#[cfg(target_os = "macos")]
pub fn open_login_items() -> bool {
    super::swift_bridge::open_login_items_settings()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_privilege_status_serialization() {
        let status = PrivilegeStatus {
            setup_completed: true,
            setup_available: true,
            requires_approval: false,
            message: "Ready".to_string(),
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains(r#""setupCompleted":true"#));
        assert!(json.contains(r#""setupAvailable":true"#));
        assert!(json.contains(r#""requiresApproval":false"#));
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
