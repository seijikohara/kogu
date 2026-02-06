//
//  NetScannerProtocol.swift
//  XPC protocol for network scanner daemon
//

import Foundation

/// XPC protocol for communication between Kogu app and NetScannerDaemon
///
/// The daemon receives JSON requests and returns JSON Lines responses.
/// This allows reusing the existing net-scanner IPC protocol.
@objc(NetScannerXPC)
public protocol NetScannerXPC {
    /// Ping the daemon to check if it's running
    ///
    /// - Parameter reply: Called with true if daemon is alive
    func ping(reply: @escaping (Bool) -> Void)

    /// Execute a network discovery operation
    ///
    /// - Parameters:
    ///   - requestJson: JSON-encoded discovery request
    ///   - progressHandler: Called with each JSON Lines response
    ///   - completion: Called when operation completes with final status
    func discover(
        requestJson: Data,
        progressHandler: @escaping (Data) -> Void,
        completion: @escaping (Bool, String?) -> Void
    )

    /// Execute a port scan operation
    ///
    /// - Parameters:
    ///   - requestJson: JSON-encoded scan request
    ///   - progressHandler: Called with each JSON Lines response
    ///   - completion: Called when operation completes with final status
    func scan(
        requestJson: Data,
        progressHandler: @escaping (Data) -> Void,
        completion: @escaping (Bool, String?) -> Void
    )

    /// Check if privileged operations are available
    ///
    /// - Parameter reply: Called with result (success, isPrivileged, errorMessage)
    func checkPrivileges(reply: @escaping (Bool, Bool, String?) -> Void)

    /// Cancel an active operation
    ///
    /// - Parameters:
    ///   - operationId: The ID of the operation to cancel
    ///   - reply: Called with true if operation was cancelled
    func cancel(operationId: String, reply: @escaping (Bool) -> Void)
}

/// Mach service name for the XPC connection
public let netScannerMachServiceName = "io.github.seijikohara.kogu.scanner"
