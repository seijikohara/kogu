//! Network scanner sidecar binary for privileged operations
//!
//! This binary is spawned as a subprocess for network operations that
//! require elevated privileges (raw sockets). It can be granted persistent
//! privileges via setuid (macOS) or setcap (Linux) without elevating the
//! main application process.
//!
//! # Supported Operations
//!
//! - Privilege check (raw socket creation test)
//! - Host discovery (ICMP, ARP, TCP, mDNS, SSDP, UDP, WS-Discovery)
//! - Port scanning with service detection
//! - Local network interface enumeration
//! - mDNS/Bonjour service discovery
//! - Discovery method availability check
//!
//! # Communication Protocol
//!
//! - **Input**: Single JSON line on stdin ([`Request`])
//! - **Output**: JSON Lines on stdout (each a [`Response`])
//! - **Cancellation**: Main process kills this process

// Inherit clippy settings from library but allow print_stdout for JSON Lines output
#![allow(clippy::print_stdout)]

use std::io::{self, BufRead};
use std::net::IpAddr;
use std::sync::Arc;

use kogu_lib::network::sidecar::{MethodAvailability, Request, Response};
use kogu_lib::network::{
    check_privileges as check_method_privilege, discover_hosts, discover_mdns_services,
    get_available_methods, get_local_interfaces, scanner, DiscoveryEvent, DiscoveryEventSink,
    ScanProgress, ScanProgressSink,
};
use pnet::packet::ip::IpNextHeaderProtocols;
use pnet::transport::{self, TransportChannelType, TransportProtocol};

// =============================================================================
// Stdout Event Sinks (JSON Lines streaming)
// =============================================================================

/// Streams discovery events to stdout as JSON Lines
struct StdoutDiscoveryEventSink;

impl DiscoveryEventSink for StdoutDiscoveryEventSink {
    fn send(&self, event: DiscoveryEvent) -> Result<(), String> {
        let response = Response::DiscoveryEvent { event };
        let json = serde_json::to_string(&response)
            .map_err(|e| format!("Failed to serialize discovery event: {e}"))?;
        println!("{json}");
        Ok(())
    }
}

/// Streams scan progress to stdout as JSON Lines
struct StdoutScanProgressSink;

impl ScanProgressSink for StdoutScanProgressSink {
    fn emit(&self, progress: ScanProgress) -> Result<(), String> {
        let response = Response::ScanProgress { progress };
        let json = serde_json::to_string(&response)
            .map_err(|e| format!("Failed to serialize scan progress: {e}"))?;
        println!("{json}");
        Ok(())
    }
}

// =============================================================================
// Response Helpers
// =============================================================================

/// Serialize and print a single response line to stdout
fn write_response(response: &Response) {
    match serde_json::to_string(response) {
        Ok(json) => println!("{json}"),
        Err(e) => {
            // Last resort: print a manually constructed error
            println!(r#"{{"type":"error","message":"Failed to serialize response: {e}"}}"#);
        }
    }
}

/// Write an error response to stdout
fn write_error(message: impl Into<String>) {
    write_response(&Response::Error {
        message: message.into(),
    });
}

// =============================================================================
// Command Handlers
// =============================================================================

/// Check raw socket privileges (synchronous — no tokio needed)
fn handle_check() {
    let protocol =
        TransportChannelType::Layer4(TransportProtocol::Ipv4(IpNextHeaderProtocols::Tcp));
    let has_privileges = transport::transport_channel(4096, protocol).is_ok();
    write_response(&Response::CheckResult {
        success: has_privileges,
    });
}

/// Parse target strings to IP addresses, expanding CIDR ranges
fn parse_targets(targets: &[String]) -> Vec<IpAddr> {
    let mut ip_targets = Vec::new();
    for target in targets {
        if let Ok(ip) = target.parse::<IpAddr>() {
            ip_targets.push(ip);
        } else if target.contains('/') {
            if let Ok(network) = target.parse::<ipnetwork::IpNetwork>() {
                if let ipnetwork::IpNetwork::V4(v4net) = network {
                    if v4net.prefix() < 31 {
                        let net_addr = IpAddr::V4(v4net.network());
                        let bcast_addr = IpAddr::V4(v4net.broadcast());
                        ip_targets.extend(
                            network
                                .iter()
                                .filter(|ip| *ip != net_addr && *ip != bcast_addr),
                        );
                        continue;
                    }
                }
                ip_targets.extend(network.iter());
            }
        }
    }
    ip_targets
}

/// Run host discovery with streaming events
async fn handle_discover(targets: Vec<String>, options: kogu_lib::network::DiscoveryOptions) {
    let ip_targets = parse_targets(&targets);
    if ip_targets.is_empty() {
        write_error("No valid IP addresses provided");
        return;
    }

    let (scan_state, _rx) = scanner::ScanState::new();
    let scan_state = Arc::new(scan_state);
    let event_sink = StdoutDiscoveryEventSink;

    let results = discover_hosts(&ip_targets, &options, &event_sink, &scan_state).await;

    write_response(&Response::DiscoveryComplete { results });
}

/// Run a port scan with streaming progress
async fn handle_scan(request: kogu_lib::network::ScanRequest) {
    let (scan_state, _rx) = scanner::ScanState::new();
    let scan_state = Arc::new(scan_state);
    let progress_sink = StdoutScanProgressSink;

    match scanner::run_scan(request, &progress_sink, scan_state).await {
        Ok(results) => write_response(&Response::ScanComplete { results }),
        Err(e) => write_error(e),
    }
}

/// Get local network interfaces
fn handle_get_interfaces() {
    let info = get_local_interfaces();
    write_response(&Response::LocalInterfaces { info });
}

/// Discover mDNS/Bonjour services
async fn handle_discover_mdns(service_types: Vec<String>, duration_ms: u32) {
    match discover_mdns_services(service_types, duration_ms).await {
        Ok(results) => write_response(&Response::MdnsResults { results }),
        Err(e) => write_error(e),
    }
}

/// Get available discovery methods and their privilege status
async fn handle_get_methods() {
    let raw_methods = get_available_methods().await;
    let methods = raw_methods
        .into_iter()
        .map(|(method, available)| MethodAvailability { method, available })
        .collect();
    write_response(&Response::DiscoveryMethods { methods });
}

/// Check if a specific discovery method has required privileges
async fn handle_check_privilege(method: kogu_lib::network::DiscoveryMethod) {
    let available = check_method_privilege(method).await;
    write_response(&Response::DiscoveryPrivilege { available });
}

// =============================================================================
// Main
// =============================================================================

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let stdin = io::stdin();

    // Read single JSON line from stdin
    let mut input = String::new();
    if stdin.lock().read_line(&mut input).is_err() {
        write_error("Failed to read input");
        return;
    }

    // Parse request
    let request: Request = match serde_json::from_str(&input) {
        Ok(req) => req,
        Err(e) => {
            write_error(format!("Invalid request: {e}"));
            return;
        }
    };

    // Dispatch to handler
    match request {
        Request::Check => handle_check(),
        Request::Discover { targets, options } => handle_discover(targets, options).await,
        Request::Scan { request } => handle_scan(request).await,
        Request::GetLocalInterfaces => handle_get_interfaces(),
        Request::DiscoverMdns {
            service_types,
            duration_ms,
        } => handle_discover_mdns(service_types, duration_ms).await,
        Request::GetDiscoveryMethods => handle_get_methods().await,
        Request::CheckDiscoveryPrivilege { method } => handle_check_privilege(method).await,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_request_deserialize() {
        let input = r#"{"type": "check"}"#;
        let req: Request = serde_json::from_str(input).ok().unwrap();
        assert!(matches!(req, Request::Check));
    }

    #[test]
    fn test_discover_request_deserialize() {
        let input = r#"{"type": "discover", "targets": ["192.168.1.0/24"], "options": {"methods": ["tcp_connect"], "timeoutMs": 3000, "concurrency": 100}}"#;
        let req: Request = serde_json::from_str(input).ok().unwrap();
        assert!(matches!(req, Request::Discover { .. }));
    }

    #[test]
    fn test_scan_request_deserialize() {
        let input = r#"{"type": "scan", "request": {"target": "192.168.1.1", "mode": "quick", "portPreset": "web", "concurrency": 100, "timeoutMs": 3000}}"#;
        let req: Request = serde_json::from_str(input).ok().unwrap();
        assert!(matches!(req, Request::Scan { .. }));
    }

    #[test]
    fn test_get_local_interfaces_request_deserialize() {
        let input = r#"{"type": "get_local_interfaces"}"#;
        let req: Request = serde_json::from_str(input).ok().unwrap();
        assert!(matches!(req, Request::GetLocalInterfaces));
    }

    #[test]
    fn test_discover_mdns_request_deserialize() {
        let input =
            r#"{"type": "discover_mdns", "service_types": ["_http._tcp"], "duration_ms": 5000}"#;
        let req: Request = serde_json::from_str(input).ok().unwrap();
        assert!(matches!(req, Request::DiscoverMdns { .. }));
    }

    #[test]
    fn test_get_discovery_methods_request_deserialize() {
        let input = r#"{"type": "get_discovery_methods"}"#;
        let req: Request = serde_json::from_str(input).ok().unwrap();
        assert!(matches!(req, Request::GetDiscoveryMethods));
    }

    #[test]
    fn test_check_discovery_privilege_request_deserialize() {
        let input = r#"{"type": "check_discovery_privilege", "method": "icmp_ping"}"#;
        let req: Request = serde_json::from_str(input).ok().unwrap();
        assert!(matches!(req, Request::CheckDiscoveryPrivilege { .. }));
    }

    #[test]
    fn test_check_result_response_serialize() {
        let resp = Response::CheckResult { success: true };
        let json = serde_json::to_string(&resp).ok().unwrap();
        assert!(json.contains(r#""type":"check_result""#));
        assert!(json.contains(r#""success":true"#));
    }

    #[test]
    fn test_error_response_serialize() {
        let resp = Response::Error {
            message: "test error".to_string(),
        };
        let json = serde_json::to_string(&resp).ok().unwrap();
        assert!(json.contains(r#""type":"error""#));
        assert!(json.contains("test error"));
    }

    #[test]
    fn test_invalid_request_json() {
        let input = "not json";
        let result: Result<Request, _> = serde_json::from_str(input);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_targets_single_ip() {
        let targets = vec!["192.168.1.1".to_string()];
        let result = parse_targets(&targets);
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_parse_targets_cidr() {
        let targets = vec!["192.168.1.0/30".to_string()];
        let result = parse_targets(&targets);
        // /30 has 4 IPs, minus network and broadcast = 2 usable
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_parse_targets_invalid() {
        let targets = vec!["not-an-ip".to_string()];
        let result = parse_targets(&targets);
        assert!(result.is_empty());
    }
}
