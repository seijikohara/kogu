//
//  KoguHelper.h
//  FFI interface for Rust to call Swift SMAppService functions
//
//  This header defines the C interface for managing the privileged helper daemon
//  using Apple's SMAppService (macOS 13+).
//

#ifndef KOGU_HELPER_H
#define KOGU_HELPER_H

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/// Result codes for privilege operations
#define KOGU_RESULT_SUCCESS        0
#define KOGU_RESULT_NOT_REGISTERED 1
#define KOGU_RESULT_REQUIRES_APPROVAL 2
#define KOGU_RESULT_ERROR          3
#define KOGU_RESULT_NOT_AVAILABLE  4

/// Register the privileged helper daemon with SMAppService
///
/// This will trigger the system to show a notification prompting the user
/// to enable the helper in System Settings > Login Items.
///
/// @return Result code indicating success or the type of failure
int32_t kogu_register_daemon(void);

/// Unregister the privileged helper daemon
///
/// @return Result code indicating success or failure
int32_t kogu_unregister_daemon(void);

/// Get the daemon status code
///
/// @return Result code indicating current status
int32_t kogu_get_daemon_status_code(void);

/// Check if daemon is registered and enabled
///
/// @return true if daemon is registered and enabled
bool kogu_is_daemon_registered(void);

/// Check if daemon requires user approval
///
/// @return true if daemon requires approval in System Settings
bool kogu_daemon_requires_approval(void);

/// Get error message for current daemon status
///
/// @return Error message string (caller must free with kogu_free_string), or NULL if no error
char* _Nullable kogu_get_daemon_error_message(void);

/// Open System Settings to the Login Items section
///
/// This allows the user to approve or manage the helper daemon.
///
/// @return true if System Settings was opened successfully
bool kogu_open_login_items_settings(void);

/// Free a string allocated by KoguHelper
///
/// @param str The string to free (safe to call with null)
void kogu_free_string(char* _Nullable str);

// =============================================================================
// XPC Client Functions
// =============================================================================

/// Progress callback type for XPC operations
typedef void (*kogu_progress_callback)(
    const void* _Nullable context,
    const char* _Nonnull data,
    int data_len
);

/// Connect to the NetScannerDaemon via XPC
///
/// @return true if connection was established, false otherwise
bool kogu_xpc_connect(void);

/// Disconnect from the NetScannerDaemon
void kogu_xpc_disconnect(void);

/// Ping the daemon to check if it's running
///
/// @return true if daemon is alive, false otherwise
bool kogu_xpc_ping(void);

/// Check if daemon has privileges for raw socket operations
///
/// @param out_is_privileged Pointer to store privilege status
/// @param out_error_message Pointer to store error message (caller must free)
/// @return true if check succeeded, false otherwise
bool kogu_xpc_check_privileges(
    bool* _Nonnull out_is_privileged,
    char* _Nullable * _Nonnull out_error_message
);

/// Execute a discovery operation via XPC
///
/// @param request_json JSON request data
/// @param request_len Length of request data
/// @param context User context passed to callbacks
/// @param progress_callback Called for each progress update
/// @param out_error_message Pointer to store error message (caller must free)
/// @return true if operation succeeded, false otherwise
bool kogu_xpc_discover(
    const char* _Nonnull request_json,
    int request_len,
    const void* _Nullable context,
    kogu_progress_callback _Nonnull progress_callback,
    char* _Nullable * _Nonnull out_error_message
);

/// Execute a scan operation via XPC
///
/// @param request_json JSON request data
/// @param request_len Length of request data
/// @param context User context passed to callbacks
/// @param progress_callback Called for each progress update
/// @param out_error_message Pointer to store error message (caller must free)
/// @return true if operation succeeded, false otherwise
bool kogu_xpc_scan(
    const char* _Nonnull request_json,
    int request_len,
    const void* _Nullable context,
    kogu_progress_callback _Nonnull progress_callback,
    char* _Nullable * _Nonnull out_error_message
);

/// Cancel an active operation
///
/// @param operation_id The operation ID to cancel
/// @return true if cancellation was sent, false otherwise
bool kogu_xpc_cancel(const char* _Nonnull operation_id);

#ifdef __cplusplus
}
#endif

#endif /* KOGU_HELPER_H */
