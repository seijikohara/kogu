//
//  NetScannerService.swift
//  XPC service implementation for network scanning
//

import Foundation

/// Implementation of the NetScannerXPC protocol
class NetScannerService: NSObject, NetScannerXPC {
    /// Active operations indexed by operation ID
    private var activeOperations: [String: Process] = [:]
    private let operationsLock = NSLock()

    /// Path to the net-scanner binary
    private var netScannerPath: String {
        // In production, the daemon and net-scanner are in the same directory
        let daemonPath = ProcessInfo.processInfo.arguments[0]
        let daemonDir = (daemonPath as NSString).deletingLastPathComponent
        return (daemonDir as NSString).appendingPathComponent("net-scanner")
    }

    // MARK: - NetScannerXPC Protocol

    func ping(reply: @escaping (Bool) -> Void) {
        log("Received ping request")
        reply(true)
    }

    func discover(
        requestJson: Data,
        progressHandler: @escaping (Data) -> Void,
        completion: @escaping (Bool, String?) -> Void
    ) {
        executeNetScanner(
            command: "discover",
            requestJson: requestJson,
            progressHandler: progressHandler,
            completion: completion
        )
    }

    func scan(
        requestJson: Data,
        progressHandler: @escaping (Data) -> Void,
        completion: @escaping (Bool, String?) -> Void
    ) {
        executeNetScanner(
            command: "scan",
            requestJson: requestJson,
            progressHandler: progressHandler,
            completion: completion
        )
    }

    func checkPrivileges(reply: @escaping (Bool, Bool, String?) -> Void) {
        log("Checking privileges")

        // When running as root via launchd, we have privileges
        let isRoot = geteuid() == 0

        if isRoot {
            reply(true, true, nil)
        } else {
            reply(true, false, "Daemon is not running as root")
        }
    }

    func cancel(operationId: String, reply: @escaping (Bool) -> Void) {
        log("Cancelling operation: \(operationId)")

        operationsLock.lock()
        defer { operationsLock.unlock() }

        if let process = activeOperations.removeValue(forKey: operationId) {
            process.terminate()
            reply(true)
        } else {
            reply(false)
        }
    }

    // MARK: - Private Methods

    /// Execute the net-scanner binary with the given request
    private func executeNetScanner(
        command: String,
        requestJson: Data,
        progressHandler: @escaping (Data) -> Void,
        completion: @escaping (Bool, String?) -> Void
    ) {
        log("Executing net-scanner command: \(command)")

        // Check if net-scanner exists
        guard FileManager.default.fileExists(atPath: netScannerPath) else {
            log("net-scanner not found at: \(netScannerPath)")
            completion(false, "net-scanner binary not found")
            return
        }

        // Parse request to get operation ID
        let operationId: String
        do {
            if let json = try JSONSerialization.jsonObject(with: requestJson) as? [String: Any],
               let id = json["operation_id"] as? String {
                operationId = id
            } else {
                operationId = UUID().uuidString
            }
        } catch {
            operationId = UUID().uuidString
        }

        // Create the process
        let process = Process()
        process.executableURL = URL(fileURLWithPath: netScannerPath)

        // Set up pipes
        let stdinPipe = Pipe()
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()

        process.standardInput = stdinPipe
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        // Track the operation
        operationsLock.lock()
        activeOperations[operationId] = process
        operationsLock.unlock()

        // Handle stdout (JSON Lines)
        stdoutPipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if !data.isEmpty {
                // Split by newlines and send each line as a progress update
                if let string = String(data: data, encoding: .utf8) {
                    for line in string.components(separatedBy: "\n") where !line.isEmpty {
                        if let lineData = line.data(using: .utf8) {
                            progressHandler(lineData)
                        }
                    }
                }
            }
        }

        // Handle stderr (logging)
        stderrPipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if !data.isEmpty, let string = String(data: data, encoding: .utf8) {
                log("net-scanner stderr: \(string)")
            }
        }

        // Handle completion
        process.terminationHandler = { [weak self] proc in
            // Clean up
            stdoutPipe.fileHandleForReading.readabilityHandler = nil
            stderrPipe.fileHandleForReading.readabilityHandler = nil

            self?.operationsLock.lock()
            self?.activeOperations.removeValue(forKey: operationId)
            self?.operationsLock.unlock()

            let success = proc.terminationStatus == 0
            let errorMessage = success ? nil : "net-scanner exited with code \(proc.terminationStatus)"

            log("net-scanner completed with status: \(proc.terminationStatus)")
            completion(success, errorMessage)
        }

        // Start the process
        do {
            try process.run()

            // Write the request JSON to stdin
            stdinPipe.fileHandleForWriting.write(requestJson)
            stdinPipe.fileHandleForWriting.write("\n".data(using: .utf8)!)
            try stdinPipe.fileHandleForWriting.close()

            log("net-scanner started with PID: \(process.processIdentifier)")
        } catch {
            log("Failed to start net-scanner: \(error)")

            operationsLock.lock()
            activeOperations.removeValue(forKey: operationId)
            operationsLock.unlock()

            completion(false, "Failed to start net-scanner: \(error.localizedDescription)")
        }
    }
}
