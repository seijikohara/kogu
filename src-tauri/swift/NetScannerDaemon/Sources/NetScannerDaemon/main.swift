//
//  main.swift
//  NetScannerDaemon - Privileged helper for Kogu network scanning
//
//  This daemon runs as a launchd service with root privileges,
//  allowing it to perform raw socket operations for ICMP, ARP, and TCP SYN scans.
//

import Foundation

/// The delegate that handles XPC connections
class ServiceDelegate: NSObject, NSXPCListenerDelegate {
    /// Called when a new connection is received
    func listener(_ listener: NSXPCListener, shouldAcceptNewConnection newConnection: NSXPCConnection) -> Bool {
        // Verify the connecting process is signed by the same developer
        guard validateClient(newConnection) else {
            log("Rejected connection from unauthorized client")
            return false
        }

        // Configure the connection
        newConnection.exportedInterface = NSXPCInterface(with: NetScannerXPC.self)
        newConnection.exportedObject = NetScannerService()

        // Handle connection lifecycle
        newConnection.invalidationHandler = {
            log("Connection invalidated")
        }

        newConnection.interruptionHandler = {
            log("Connection interrupted")
        }

        newConnection.resume()
        log("Accepted connection from authorized client")
        return true
    }

    /// Validate that the connecting client is signed by the same developer
    private func validateClient(_ connection: NSXPCConnection) -> Bool {
        // Get the code signing requirement
        let requirement = "anchor apple generic and identifier \"io.github.seijikohara.kogu\""

        var code: SecCode?
        let pid = connection.processIdentifier

        // Get the code object for the connecting process
        guard SecCodeCopyGuestWithAttributes(nil, [kSecGuestAttributePid: pid] as CFDictionary, [], &code) == errSecSuccess,
              let code = code else {
            log("Failed to get code object for PID \(pid)")
            return false
        }

        // Create the requirement object
        var requirementRef: SecRequirement?
        guard SecRequirementCreateWithString(requirement as CFString, [], &requirementRef) == errSecSuccess,
              let requirementRef = requirementRef else {
            log("Failed to create requirement")
            return false
        }

        // Check if the code satisfies the requirement
        let status = SecCodeCheckValidity(code, [], requirementRef)
        if status != errSecSuccess {
            log("Client validation failed with status: \(status)")
            return false
        }

        return true
    }
}

/// Log messages to stderr (captured by launchd)
func log(_ message: String) {
    let timestamp = ISO8601DateFormatter().string(from: Date())
    fputs("[\(timestamp)] NetScannerDaemon: \(message)\n", stderr)
}

// MARK: - Main Entry Point

log("Starting NetScannerDaemon")

// Create the XPC listener for the Mach service
let listener = NSXPCListener(machServiceName: netScannerMachServiceName)
let delegate = ServiceDelegate()
listener.delegate = delegate

// Start the listener
listener.resume()

log("Listening on Mach service: \(netScannerMachServiceName)")

// Run the main run loop
RunLoop.main.run()
