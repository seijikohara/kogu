//
//  SMAppServiceBridge.swift
//  Swift implementation of SMAppService wrapper for Kogu privileged helper
//
//  This module provides a C-compatible interface for managing the NetScannerDaemon
//  using Apple's SMAppService API (macOS 13+).
//

import AppKit
import Foundation
import ServiceManagement

// MARK: - Constants

/// The bundle identifier for the privileged helper daemon
private let daemonBundleIdentifier = "io.github.seijikohara.kogu.NetScannerDaemon"

// MARK: - C-Compatible Result Codes

/// Result codes for privilege operations
public let KOGU_RESULT_SUCCESS: Int32 = 0
public let KOGU_RESULT_NOT_REGISTERED: Int32 = 1
public let KOGU_RESULT_REQUIRES_APPROVAL: Int32 = 2
public let KOGU_RESULT_ERROR: Int32 = 3
public let KOGU_RESULT_NOT_AVAILABLE: Int32 = 4

// MARK: - Helper Functions

/// Convert a Swift String to a C string that must be freed by the caller
private func toCString(_ string: String) -> UnsafeMutablePointer<CChar> {
    return strdup(string)!
}

// MARK: - C Interface Implementation

/// Register the privileged helper daemon with SMAppService
///
/// This will trigger the system to show a notification prompting the user
/// to enable the helper in System Settings > Login Items.
///
/// @return Result code indicating success or the type of failure
@_cdecl("kogu_register_daemon")
public func koguRegisterDaemon() -> Int32 {
    if #available(macOS 13.0, *) {
        let service = SMAppService.daemon(plistName: "\(daemonBundleIdentifier).plist")

        do {
            try service.register()
            return KOGU_RESULT_SUCCESS
        } catch let error as NSError {
            // Check for specific error codes
            if error.domain == "SMAppServiceErrorDomain" {
                switch error.code {
                case 1: // Already registered
                    return KOGU_RESULT_SUCCESS
                case 2: // Requires approval
                    return KOGU_RESULT_REQUIRES_APPROVAL
                default:
                    break
                }
            }
            return KOGU_RESULT_ERROR
        }
    } else {
        return KOGU_RESULT_NOT_AVAILABLE
    }
}

/// Unregister the privileged helper daemon
///
/// @return Result code indicating success or failure
@_cdecl("kogu_unregister_daemon")
public func koguUnregisterDaemon() -> Int32 {
    if #available(macOS 13.0, *) {
        let service = SMAppService.daemon(plistName: "\(daemonBundleIdentifier).plist")

        do {
            try service.unregister()
            return KOGU_RESULT_SUCCESS
        } catch {
            return KOGU_RESULT_ERROR
        }
    } else {
        return KOGU_RESULT_NOT_AVAILABLE
    }
}

/// Get the daemon status code
///
/// @return Result code indicating current status
@_cdecl("kogu_get_daemon_status_code")
public func koguGetDaemonStatusCode() -> Int32 {
    if #available(macOS 13.0, *) {
        let service = SMAppService.daemon(plistName: "\(daemonBundleIdentifier).plist")
        let status = service.status

        switch status {
        case .notRegistered:
            return KOGU_RESULT_NOT_REGISTERED
        case .enabled:
            return KOGU_RESULT_SUCCESS
        case .requiresApproval:
            return KOGU_RESULT_REQUIRES_APPROVAL
        case .notFound:
            return KOGU_RESULT_ERROR
        @unknown default:
            return KOGU_RESULT_ERROR
        }
    } else {
        return KOGU_RESULT_NOT_AVAILABLE
    }
}

/// Check if daemon is registered and enabled
///
/// @return true if daemon is registered and enabled
@_cdecl("kogu_is_daemon_registered")
public func koguIsDaemonRegistered() -> Bool {
    if #available(macOS 13.0, *) {
        let service = SMAppService.daemon(plistName: "\(daemonBundleIdentifier).plist")
        return service.status == .enabled
    } else {
        return false
    }
}

/// Check if daemon requires user approval
///
/// @return true if daemon requires approval in System Settings
@_cdecl("kogu_daemon_requires_approval")
public func koguDaemonRequiresApproval() -> Bool {
    if #available(macOS 13.0, *) {
        let service = SMAppService.daemon(plistName: "\(daemonBundleIdentifier).plist")
        return service.status == .requiresApproval
    } else {
        return false
    }
}

/// Get error message for current daemon status
///
/// @return Error message string (caller must free with kogu_free_string), or NULL if no error
@_cdecl("kogu_get_daemon_error_message")
public func koguGetDaemonErrorMessage() -> UnsafeMutablePointer<CChar>? {
    if #available(macOS 13.0, *) {
        let service = SMAppService.daemon(plistName: "\(daemonBundleIdentifier).plist")

        switch service.status {
        case .notRegistered:
            return toCString("Daemon is not registered")
        case .enabled:
            return nil
        case .requiresApproval:
            return toCString("Daemon requires approval in System Settings > Login Items")
        case .notFound:
            return toCString("Daemon plist not found in app bundle")
        @unknown default:
            return toCString("Unknown daemon status")
        }
    } else {
        return toCString("SMAppService requires macOS 13.0 or later")
    }
}

/// Open System Settings to the Login Items section
///
/// This allows the user to approve or manage the helper daemon.
///
/// @return true if System Settings was opened successfully
@_cdecl("kogu_open_login_items_settings")
public func koguOpenLoginItemsSettings() -> Bool {
    if #available(macOS 13.0, *) {
        // Open System Settings directly to Login Items
        if let url = URL(string: "x-apple.systempreferences:com.apple.LoginItems-Settings.extension") {
            return NSWorkspace.shared.open(url)
        }
        return false
    } else {
        return false
    }
}

/// Free a string allocated by KoguHelper
///
/// @param str The string to free (safe to call with null)
@_cdecl("kogu_free_string")
public func koguFreeString(_ str: UnsafeMutablePointer<CChar>?) {
    if let str = str {
        free(str)
    }
}
