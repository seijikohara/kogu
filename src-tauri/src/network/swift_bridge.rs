//! FFI bindings for the KoguHelper Swift library
//!
//! This module provides safe Rust wrappers around the C interface defined in KoguHelper.h.
//! The Swift library uses SMAppService to manage the privileged helper daemon.
//!
//! # Safety
//!
//! This module uses unsafe code for FFI calls to the Swift library. All unsafe
//! operations are encapsulated in safe Rust wrappers that handle memory management
//! and error handling appropriately.

#![allow(unsafe_code)] // Required for FFI calls to Swift library

use std::ffi::CStr;

// =============================================================================
// FFI Result Codes (matching KoguHelper.h)
// =============================================================================

/// Result codes from Swift privilege operations
#[repr(i32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KoguResultCode {
    /// Operation completed successfully
    Success = 0,
    /// Daemon is not registered
    NotRegistered = 1,
    /// Daemon requires user approval in System Settings
    RequiresApproval = 2,
    /// Operation failed with an error
    Error = 3,
    /// Feature not available on this OS version
    NotAvailable = 4,
}

impl From<i32> for KoguResultCode {
    fn from(code: i32) -> Self {
        match code {
            0 => Self::Success,
            1 => Self::NotRegistered,
            2 => Self::RequiresApproval,
            3 => Self::Error,
            4 => Self::NotAvailable,
            _ => Self::Error,
        }
    }
}

// =============================================================================
// FFI Function Declarations
// =============================================================================

extern "C" {
    fn kogu_register_daemon() -> i32;
    fn kogu_unregister_daemon() -> i32;
    fn kogu_get_daemon_status_code() -> i32;
    fn kogu_is_daemon_registered() -> bool;
    fn kogu_daemon_requires_approval() -> bool;
    fn kogu_get_daemon_error_message() -> *mut libc::c_char;
    fn kogu_open_login_items_settings() -> bool;
    fn kogu_free_string(str: *mut libc::c_char);
}

// =============================================================================
// Safe Rust Wrappers
// =============================================================================

/// Result of a daemon status check
#[derive(Debug, Clone)]
pub struct DaemonStatus {
    /// Result code from the status check
    pub code: KoguResultCode,
    /// Whether the daemon is registered and enabled
    pub is_registered: bool,
    /// Whether user approval is required in System Settings
    pub requires_approval: bool,
    /// Error message if operation failed
    pub error_message: Option<String>,
}

impl From<KoguResultCode> for Result<(), String> {
    fn from(code: KoguResultCode) -> Self {
        match code {
            KoguResultCode::Success => Ok(()),
            KoguResultCode::NotRegistered => Err("Daemon is not registered".to_string()),
            KoguResultCode::RequiresApproval => {
                Err("Daemon requires user approval in System Settings".to_string())
            }
            KoguResultCode::Error => Err("Operation failed".to_string()),
            KoguResultCode::NotAvailable => {
                Err("SMAppService requires macOS 13.0 or later".to_string())
            }
        }
    }
}

/// Register the privileged helper daemon with SMAppService
///
/// This triggers the system to show a notification prompting the user
/// to enable the helper in System Settings > Login Items.
///
/// # Returns
/// - `Ok(())` if registration succeeded or daemon is already registered
/// - `Err(String)` if registration failed or requires user approval
pub fn register_daemon() -> Result<(), String> {
    let code = KoguResultCode::from(unsafe { kogu_register_daemon() });
    code.into()
}

/// Unregister the privileged helper daemon
///
/// # Returns
/// - `Ok(())` if unregistration succeeded
/// - `Err(String)` if unregistration failed
pub fn unregister_daemon() -> Result<(), String> {
    let code = KoguResultCode::from(unsafe { kogu_unregister_daemon() });
    code.into()
}

/// Get the current status of the privileged helper daemon
///
/// # Returns
/// A `DaemonStatus` struct with the current registration state
pub fn get_daemon_status() -> DaemonStatus {
    let code = KoguResultCode::from(unsafe { kogu_get_daemon_status_code() });
    let is_registered = unsafe { kogu_is_daemon_registered() };
    let requires_approval = unsafe { kogu_daemon_requires_approval() };

    let error_message = {
        let ptr = unsafe { kogu_get_daemon_error_message() };
        if ptr.is_null() {
            None
        } else {
            let msg = unsafe { CStr::from_ptr(ptr) }
                .to_string_lossy()
                .into_owned();
            unsafe { kogu_free_string(ptr) };
            Some(msg)
        }
    };

    DaemonStatus {
        code,
        is_registered,
        requires_approval,
        error_message,
    }
}

/// Open System Settings to the Login Items section
///
/// This allows the user to approve or manage the helper daemon.
///
/// # Returns
/// - `true` if System Settings was opened successfully
/// - `false` if opening failed
pub fn open_login_items_settings() -> bool {
    unsafe { kogu_open_login_items_settings() }
}

// =============================================================================
// XPC Client FFI Declarations
// =============================================================================

/// Progress callback type for XPC operations
type ProgressCallback =
    extern "C" fn(context: *const std::ffi::c_void, data: *const libc::c_char, data_len: i32);

extern "C" {
    fn kogu_xpc_connect() -> bool;
    fn kogu_xpc_disconnect();
    fn kogu_xpc_ping() -> bool;
    fn kogu_xpc_check_privileges(
        out_is_privileged: *mut bool,
        out_error_message: *mut *mut libc::c_char,
    ) -> bool;
    fn kogu_xpc_discover(
        request_json: *const libc::c_char,
        request_len: i32,
        context: *const std::ffi::c_void,
        progress_callback: ProgressCallback,
        out_error_message: *mut *mut libc::c_char,
    ) -> bool;
    fn kogu_xpc_scan(
        request_json: *const libc::c_char,
        request_len: i32,
        context: *const std::ffi::c_void,
        progress_callback: ProgressCallback,
        out_error_message: *mut *mut libc::c_char,
    ) -> bool;
    fn kogu_xpc_cancel(operation_id: *const libc::c_char) -> bool;
}

// =============================================================================
// XPC Client Safe Wrappers
// =============================================================================

/// Connect to the NetScannerDaemon via XPC
pub fn xpc_connect() -> bool {
    unsafe { kogu_xpc_connect() }
}

/// Disconnect from the NetScannerDaemon
pub fn xpc_disconnect() {
    unsafe { kogu_xpc_disconnect() }
}

/// Ping the daemon to check if it's running
pub fn xpc_ping() -> bool {
    unsafe { kogu_xpc_ping() }
}

/// Check if daemon has privileges for raw socket operations
pub fn xpc_check_privileges() -> Result<bool, String> {
    let mut is_privileged = false;
    let mut error_message: *mut libc::c_char = std::ptr::null_mut();

    let success =
        unsafe { kogu_xpc_check_privileges(&raw mut is_privileged, &raw mut error_message) };

    if !error_message.is_null() {
        let msg = unsafe { CStr::from_ptr(error_message) }
            .to_string_lossy()
            .into_owned();
        unsafe { kogu_free_string(error_message) };
        if !success {
            return Err(msg);
        }
    }

    Ok(is_privileged)
}

/// Result of an XPC operation
pub struct XpcOperationResult {
    /// Whether the operation succeeded
    pub success: bool,
    /// Error message if operation failed
    pub error: Option<String>,
}

/// Execute a discovery operation via XPC
///
/// # Arguments
/// * `request_json` - JSON-encoded discovery request
/// * `progress_callback` - Called for each JSON Lines response
///
/// # Returns
/// Result indicating success or failure
pub fn xpc_discover<F>(request_json: &str, mut progress_callback: F) -> XpcOperationResult
where
    F: FnMut(&str),
{
    xpc_operation("discover", request_json, &mut progress_callback)
}

/// Execute a scan operation via XPC
///
/// # Arguments
/// * `request_json` - JSON-encoded scan request
/// * `progress_callback` - Called for each JSON Lines response
///
/// # Returns
/// Result indicating success or failure
pub fn xpc_scan<F>(request_json: &str, mut progress_callback: F) -> XpcOperationResult
where
    F: FnMut(&str),
{
    xpc_operation("scan", request_json, &mut progress_callback)
}

/// Execute an XPC operation with progress callback
fn xpc_operation<F>(command: &str, request_json: &str, callback: &mut F) -> XpcOperationResult
where
    F: FnMut(&str),
{
    use std::ffi::CString;

    // Trampoline function that calls back into Rust
    extern "C" fn trampoline<F: FnMut(&str)>(
        context: *const std::ffi::c_void,
        data: *const libc::c_char,
        data_len: i32,
    ) {
        let callback = unsafe { &mut *context.cast::<F>().cast_mut() };
        let slice = unsafe { std::slice::from_raw_parts(data.cast::<u8>(), data_len as usize) };
        if let Ok(s) = std::str::from_utf8(slice) {
            callback(s);
        }
    }

    let request_cstr = match CString::new(request_json) {
        Ok(s) => s,
        Err(e) => {
            return XpcOperationResult {
                success: false,
                error: Some(format!("Invalid request JSON: {e}")),
            }
        }
    };

    let mut error_message: *mut libc::c_char = std::ptr::null_mut();
    let context = std::ptr::from_mut(callback).cast::<std::ffi::c_void>();

    let success = match command {
        "discover" => unsafe {
            kogu_xpc_discover(
                request_cstr.as_ptr(),
                request_json.len() as i32,
                context,
                trampoline::<F>,
                &raw mut error_message,
            )
        },
        "scan" => unsafe {
            kogu_xpc_scan(
                request_cstr.as_ptr(),
                request_json.len() as i32,
                context,
                trampoline::<F>,
                &raw mut error_message,
            )
        },
        _ => {
            return XpcOperationResult {
                success: false,
                error: Some(format!("Unknown command: {command}")),
            }
        }
    };

    let error = if !error_message.is_null() {
        let msg = unsafe { CStr::from_ptr(error_message) }
            .to_string_lossy()
            .into_owned();
        unsafe { kogu_free_string(error_message) };
        Some(msg)
    } else {
        None
    };

    XpcOperationResult { success, error }
}

/// Cancel an active XPC operation
pub fn xpc_cancel(operation_id: &str) -> bool {
    use std::ffi::CString;

    let op_id = match CString::new(operation_id) {
        Ok(s) => s,
        Err(_) => return false,
    };

    unsafe { kogu_xpc_cancel(op_id.as_ptr()) }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_result_code_conversion() {
        assert_eq!(KoguResultCode::from(0), KoguResultCode::Success);
        assert_eq!(KoguResultCode::from(1), KoguResultCode::NotRegistered);
        assert_eq!(KoguResultCode::from(2), KoguResultCode::RequiresApproval);
        assert_eq!(KoguResultCode::from(3), KoguResultCode::Error);
        assert_eq!(KoguResultCode::from(4), KoguResultCode::NotAvailable);
        assert_eq!(KoguResultCode::from(99), KoguResultCode::Error);
    }

    #[test]
    fn test_result_code_to_result() {
        let ok: Result<(), String> = KoguResultCode::Success.into();
        assert!(ok.is_ok());

        let err: Result<(), String> = KoguResultCode::NotAvailable.into();
        assert!(err.is_err());
        assert!(err.unwrap_err().contains("macOS 13.0"));
    }
}
