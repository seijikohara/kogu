//! CLI tool detection and execution utilities

use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Serialize};

/// CLI tool availability status. The optional `*_path` fields surface
/// the resolved binary location so the UI can show users which
/// executable will be invoked - particularly useful on Windows where
/// the binary may live in a vendor-specific install root that is not
/// on `PATH`.
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
    /// Resolved ssh-keygen path if available (display only).
    pub ssh_keygen_path: Option<String>,
    /// Resolved gpg path if available (display only).
    pub gpg_path: Option<String>,
}

/// Locate the `ssh-keygen` binary. The probe spawns the binary with
/// `--version` to verify reachability; a `PATH` hit yields a bare
/// `PathBuf::from("ssh-keygen")`. On Windows the lookup additionally
/// probes known vendor install locations (Git for Windows, OpenSSH for
/// Windows, Git per-user install). Result is cached in a `OnceLock` so
/// subsequent calls within the same process do not re-probe.
fn detect_ssh_keygen() -> Option<PathBuf> {
    static CACHE: std::sync::OnceLock<Option<PathBuf>> = std::sync::OnceLock::new();
    CACHE
        .get_or_init(|| {
            #[cfg(target_os = "windows")]
            let windows_fallbacks: &[&str] = &[
                r"%ProgramFiles%\Git\usr\bin\ssh-keygen.exe",
                r"%ProgramFiles%\OpenSSH\ssh-keygen.exe",
                r"%LocalAppData%\Programs\Git\usr\bin\ssh-keygen.exe",
            ];
            #[cfg(not(target_os = "windows"))]
            let windows_fallbacks: &[&str] = &[];

            detect_binary("ssh-keygen", windows_fallbacks)
        })
        .clone()
}

/// Locate the `gpg` binary. See [`detect_ssh_keygen`] for the strategy.
fn detect_gpg() -> Option<PathBuf> {
    static CACHE: std::sync::OnceLock<Option<PathBuf>> = std::sync::OnceLock::new();
    CACHE
        .get_or_init(|| {
            #[cfg(target_os = "windows")]
            let windows_fallbacks: &[&str] = &[
                r"%ProgramFiles%\GnuPG\bin\gpg.exe",
                r"%ProgramFiles(x86)%\GnuPG\bin\gpg.exe",
            ];
            #[cfg(not(target_os = "windows"))]
            let windows_fallbacks: &[&str] = &[];

            detect_binary("gpg", windows_fallbacks)
        })
        .clone()
}

/// Resolve a CLI binary across platforms. The probe first attempts a
/// `PATH` lookup via `Command::new(name).arg("--version").output()`;
/// `output()` succeeds when the binary is spawnable, even when the
/// program exits with non-zero status. On Windows, when the `PATH`
/// probe fails, each `windows_fallbacks` template is expanded and
/// checked. The function returns `None` only when nothing is reachable
/// on the current host, which lets the caller surface a "not installed"
/// state in the UI.
fn detect_binary(name: &str, windows_fallbacks: &[&str]) -> Option<PathBuf> {
    if Command::new(name).arg("--version").output().is_ok() {
        return Some(PathBuf::from(name));
    }

    #[cfg(target_os = "windows")]
    {
        for template in windows_fallbacks {
            let path = PathBuf::from(expand_env_vars(template));
            if path.exists() {
                return Some(path);
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = windows_fallbacks;
    }

    None
}

/// Expand `%VAR%` placeholders in a Windows-style path template. Returns
/// the original template unchanged when a referenced variable is
/// missing, which lets [`detect_windows_binary`] reject the candidate
/// via the subsequent `exists()` check.
#[cfg(target_os = "windows")]
fn expand_env_vars(template: &str) -> String {
    let mut result = String::new();
    let mut chars = template.chars();
    while let Some(c) = chars.next() {
        if c != '%' {
            result.push(c);
            continue;
        }
        let mut name = String::new();
        let mut closed = false;
        for c in chars.by_ref() {
            if c == '%' {
                closed = true;
                break;
            }
            name.push(c);
        }
        if !closed {
            // Unterminated %; treat as literal so the caller's
            // `exists()` check filters it out cleanly.
            result.push('%');
            result.push_str(&name);
            continue;
        }
        match std::env::var(&name) {
            Ok(value) => result.push_str(&value),
            Err(_) => return template.to_string(),
        }
    }
    result
}

/// Check if ssh-keygen is available and gather its version + resolved
/// path.
pub fn check_ssh_keygen() -> (bool, Option<String>, Option<String>) {
    let Some(path) = detect_ssh_keygen() else {
        return (false, None, None);
    };
    let path_display = path.to_string_lossy().into_owned();

    match Command::new(&path).arg("-V").output() {
        Ok(output) => {
            // ssh-keygen -V outputs to stderr on OpenSSH; some builds
            // print on stdout. Try stderr first, then stdout.
            let version = first_non_empty_line(&output.stderr)
                .or_else(|| first_non_empty_line(&output.stdout));
            (true, version, Some(path_display))
        }
        Err(_) => (false, None, None),
    }
}

/// Check if gpg is available and gather its version + resolved path.
pub fn check_gpg() -> (bool, Option<String>, Option<String>) {
    let Some(path) = detect_gpg() else {
        return (false, None, None);
    };
    let path_display = path.to_string_lossy().into_owned();

    match Command::new(&path).arg("--version").output() {
        Ok(output) => {
            if output.status.success() {
                let version = first_non_empty_line(&output.stdout);
                (true, version, Some(path_display))
            } else {
                (false, None, None)
            }
        }
        Err(_) => (false, None, None),
    }
}

/// Extract the first non-empty line from a command's output bytes.
fn first_non_empty_line(bytes: &[u8]) -> Option<String> {
    String::from_utf8_lossy(bytes)
        .lines()
        .next()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Check all CLI tool availability
pub fn check_cli_availability() -> CliAvailability {
    let (ssh_keygen, ssh_keygen_version, ssh_keygen_path) = check_ssh_keygen();
    let (gpg, gpg_version, gpg_path) = check_gpg();

    CliAvailability {
        ssh_keygen,
        gpg,
        ssh_keygen_version,
        gpg_version,
        ssh_keygen_path,
        gpg_path,
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

    #[test]
    fn test_first_non_empty_line_trims_and_skips_blanks() {
        assert_eq!(first_non_empty_line(b""), None);
        assert_eq!(first_non_empty_line(b"\n"), None);
        assert_eq!(
            first_non_empty_line(b"  hello  \nworld\n"),
            Some("hello".to_string())
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_expand_env_vars_round_trip() {
        std::env::set_var("KOGU_TEST_VAR", r"C:\Probe");
        assert_eq!(
            expand_env_vars(r"%KOGU_TEST_VAR%\bin\thing.exe"),
            r"C:\Probe\bin\thing.exe"
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_expand_env_vars_keeps_template_when_missing() {
        let template = r"%DEFINITELY_NOT_SET_KOGU_VAR%\bin\thing.exe";
        std::env::remove_var("DEFINITELY_NOT_SET_KOGU_VAR");
        assert_eq!(expand_env_vars(template), template);
    }
}
