//! CLI tool detection and execution utilities

use serde::{Deserialize, Serialize};
use std::process::Command;

/// CLI tool availability status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliAvailability {
    /// Whether ssh-keygen is available
    pub ssh_keygen: bool,
    /// Whether gpg is available
    pub gpg: bool,
    /// ssh-keygen version string if available
    pub ssh_keygen_version: Option<String>,
    /// gpg version string if available
    pub gpg_version: Option<String>,
}

/// Check if ssh-keygen is available and get its version
pub fn check_ssh_keygen() -> (bool, Option<String>) {
    match Command::new("ssh-keygen").arg("-V").output() {
        Ok(output) => {
            // ssh-keygen -V outputs to stderr
            let version = String::from_utf8_lossy(&output.stderr)
                .lines()
                .next()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());

            // If -V didn't work, try without args (some versions)
            let version = version.or_else(|| {
                String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
            });

            (true, version)
        }
        Err(_) => (false, None),
    }
}

/// Check if gpg is available and get its version
pub fn check_gpg() -> (bool, Option<String>) {
    match Command::new("gpg").arg("--version").output() {
        Ok(output) => {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty());
                (true, version)
            } else {
                (false, None)
            }
        }
        Err(_) => (false, None),
    }
}

/// Check all CLI tool availability
pub fn check_cli_availability() -> CliAvailability {
    let (ssh_keygen, ssh_keygen_version) = check_ssh_keygen();
    let (gpg, gpg_version) = check_gpg();

    CliAvailability {
        ssh_keygen,
        gpg,
        ssh_keygen_version,
        gpg_version,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_cli_availability() {
        let availability = check_cli_availability();
        // Just verify it doesn't panic and returns valid structure
        // ssh_keygen and gpg availability depends on system configuration
        let _ = availability.ssh_keygen;
        let _ = availability.gpg;
    }
}
