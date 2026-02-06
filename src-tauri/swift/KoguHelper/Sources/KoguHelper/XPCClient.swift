//
//  XPCClient.swift
//  XPC client for communicating with NetScannerDaemon
//

import Foundation

// MARK: - XPC Protocol (must match daemon's protocol)

@objc(NetScannerXPC)
protocol NetScannerXPC {
    func ping(reply: @escaping (Bool) -> Void)
    func discover(
        requestJson: Data,
        progressHandler: @escaping (Data) -> Void,
        completion: @escaping (Bool, String?) -> Void
    )
    func scan(
        requestJson: Data,
        progressHandler: @escaping (Data) -> Void,
        completion: @escaping (Bool, String?) -> Void
    )
    func checkPrivileges(reply: @escaping (Bool, Bool, String?) -> Void)
    func cancel(operationId: String, reply: @escaping (Bool) -> Void)
}

// MARK: - XPC Client State

private let netScannerMachServiceName = "io.github.seijikohara.kogu.scanner"

/// Shared XPC connection (lazily created)
private var sharedConnection: NSXPCConnection?
private let connectionLock = NSLock()

/// Progress callback storage (indexed by operation ID)
private var progressCallbacks: [String: (UnsafePointer<CChar>, Int) -> Void] = [:]
private let callbackLock = NSLock()

// MARK: - C Interface for XPC Client

/// Connect to the NetScannerDaemon via XPC
///
/// @return true if connection was established, false otherwise
@_cdecl("kogu_xpc_connect")
public func koguXpcConnect() -> Bool {
    connectionLock.lock()
    defer { connectionLock.unlock() }

    if sharedConnection != nil {
        return true
    }

    let connection = NSXPCConnection(machServiceName: netScannerMachServiceName)
    connection.remoteObjectInterface = NSXPCInterface(with: NetScannerXPC.self)

    connection.invalidationHandler = {
        connectionLock.lock()
        sharedConnection = nil
        connectionLock.unlock()
    }

    connection.resume()
    sharedConnection = connection

    return true
}

/// Disconnect from the NetScannerDaemon
@_cdecl("kogu_xpc_disconnect")
public func koguXpcDisconnect() {
    connectionLock.lock()
    defer { connectionLock.unlock() }

    sharedConnection?.invalidate()
    sharedConnection = nil
}

/// Ping the daemon to check if it's running
///
/// @return true if daemon is alive, false otherwise
@_cdecl("kogu_xpc_ping")
public func koguXpcPing() -> Bool {
    guard let connection = getConnection() else {
        return false
    }

    let semaphore = DispatchSemaphore(value: 0)
    var result = false

    let proxy = connection.remoteObjectProxyWithErrorHandler { error in
        semaphore.signal()
    } as? NetScannerXPC

    proxy?.ping { alive in
        result = alive
        semaphore.signal()
    }

    _ = semaphore.wait(timeout: .now() + 5)
    return result
}

/// Check if daemon has privileges for raw socket operations
///
/// @param outIsPrivileged Pointer to store privilege status
/// @param outErrorMessage Pointer to store error message (caller must free)
/// @return true if check succeeded, false otherwise
@_cdecl("kogu_xpc_check_privileges")
public func koguXpcCheckPrivileges(
    outIsPrivileged: UnsafeMutablePointer<Bool>,
    outErrorMessage: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>
) -> Bool {
    guard let connection = getConnection() else {
        outIsPrivileged.pointee = false
        outErrorMessage.pointee = strdup("Not connected to daemon")
        return false
    }

    let semaphore = DispatchSemaphore(value: 0)
    var success = false

    let proxy = connection.remoteObjectProxyWithErrorHandler { error in
        outIsPrivileged.pointee = false
        outErrorMessage.pointee = strdup(error.localizedDescription)
        semaphore.signal()
    } as? NetScannerXPC

    proxy?.checkPrivileges { ok, isPrivileged, errorMessage in
        success = ok
        outIsPrivileged.pointee = isPrivileged
        if let msg = errorMessage {
            outErrorMessage.pointee = strdup(msg)
        } else {
            outErrorMessage.pointee = nil
        }
        semaphore.signal()
    }

    _ = semaphore.wait(timeout: .now() + 10)
    return success
}

/// Type for progress callback from Rust
public typealias ProgressCallback = @convention(c) (
    UnsafeRawPointer?,  // context
    UnsafePointer<CChar>,  // data (JSON line)
    Int  // data length
) -> Void

/// Execute a discovery operation via XPC
///
/// @param requestJson JSON request data
/// @param requestLen Length of request data
/// @param context User context passed to callbacks
/// @param progressCallback Called for each progress update
/// @param outErrorMessage Pointer to store error message (caller must free)
/// @return true if operation succeeded, false otherwise
@_cdecl("kogu_xpc_discover")
public func koguXpcDiscover(
    requestJson: UnsafePointer<CChar>,
    requestLen: Int,
    context: UnsafeRawPointer?,
    progressCallback: ProgressCallback,
    outErrorMessage: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>
) -> Bool {
    return executeXpcOperation(
        command: "discover",
        requestJson: requestJson,
        requestLen: requestLen,
        context: context,
        progressCallback: progressCallback,
        outErrorMessage: outErrorMessage
    )
}

/// Execute a scan operation via XPC
///
/// @param requestJson JSON request data
/// @param requestLen Length of request data
/// @param context User context passed to callbacks
/// @param progressCallback Called for each progress update
/// @param outErrorMessage Pointer to store error message (caller must free)
/// @return true if operation succeeded, false otherwise
@_cdecl("kogu_xpc_scan")
public func koguXpcScan(
    requestJson: UnsafePointer<CChar>,
    requestLen: Int,
    context: UnsafeRawPointer?,
    progressCallback: ProgressCallback,
    outErrorMessage: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>
) -> Bool {
    return executeXpcOperation(
        command: "scan",
        requestJson: requestJson,
        requestLen: requestLen,
        context: context,
        progressCallback: progressCallback,
        outErrorMessage: outErrorMessage
    )
}

/// Cancel an active operation
///
/// @param operationId The operation ID to cancel
/// @return true if cancellation was sent, false otherwise
@_cdecl("kogu_xpc_cancel")
public func koguXpcCancel(operationId: UnsafePointer<CChar>) -> Bool {
    guard let connection = getConnection() else {
        return false
    }

    let opId = String(cString: operationId)
    let semaphore = DispatchSemaphore(value: 0)
    var result = false

    let proxy = connection.remoteObjectProxyWithErrorHandler { _ in
        semaphore.signal()
    } as? NetScannerXPC

    proxy?.cancel(operationId: opId) { success in
        result = success
        semaphore.signal()
    }

    _ = semaphore.wait(timeout: .now() + 5)
    return result
}

// MARK: - Private Helpers

private func getConnection() -> NSXPCConnection? {
    connectionLock.lock()
    defer { connectionLock.unlock() }
    return sharedConnection
}

private func executeXpcOperation(
    command: String,
    requestJson: UnsafePointer<CChar>,
    requestLen: Int,
    context: UnsafeRawPointer?,
    progressCallback: ProgressCallback,
    outErrorMessage: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>
) -> Bool {
    guard let connection = getConnection() else {
        outErrorMessage.pointee = strdup("Not connected to daemon")
        return false
    }

    // Convert request to Data
    let requestData = Data(bytes: requestJson, count: requestLen)

    let semaphore = DispatchSemaphore(value: 0)
    var success = false

    let proxy = connection.remoteObjectProxyWithErrorHandler { error in
        outErrorMessage.pointee = strdup(error.localizedDescription)
        semaphore.signal()
    } as? NetScannerXPC

    // Progress handler
    let progressHandler: (Data) -> Void = { data in
        data.withUnsafeBytes { (buffer: UnsafeRawBufferPointer) in
            if let ptr = buffer.baseAddress?.assumingMemoryBound(to: CChar.self) {
                progressCallback(context, ptr, data.count)
            }
        }
    }

    // Completion handler
    let completion: (Bool, String?) -> Void = { ok, errorMessage in
        success = ok
        if let msg = errorMessage {
            outErrorMessage.pointee = strdup(msg)
        } else {
            outErrorMessage.pointee = nil
        }
        semaphore.signal()
    }

    // Execute the operation
    if command == "discover" {
        proxy?.discover(
            requestJson: requestData,
            progressHandler: progressHandler,
            completion: completion
        )
    } else if command == "scan" {
        proxy?.scan(
            requestJson: requestData,
            progressHandler: progressHandler,
            completion: completion
        )
    } else {
        outErrorMessage.pointee = strdup("Unknown command: \(command)")
        return false
    }

    // Wait for completion (with timeout)
    let timeout = semaphore.wait(timeout: .now() + 600) // 10 minute timeout
    if timeout == .timedOut {
        outErrorMessage.pointee = strdup("Operation timed out")
        return false
    }

    return success
}
