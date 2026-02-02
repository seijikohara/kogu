//! Network scanner sidecar binary for privileged operations
//!
//! This binary is spawned as a subprocess for network operations that
//! require elevated privileges (raw sockets). It can be granted persistent
//! privileges via setuid (macOS) or setcap (Linux) without elevating the
//! main application process.
//!
//! Supported operations:
//! - Privilege check (test raw socket creation)
//! - TCP SYN scan (host discovery via half-open connections)
//!
//! Communication protocol:
//! - Input: JSON on stdin (single line)
//! - Output: JSON on stdout (single line)

use std::collections::HashSet;
use std::io::{self, BufRead, Write};
use std::net::{IpAddr, Ipv4Addr};
use std::time::Duration;

use pnet::packet::ip::IpNextHeaderProtocols;
use pnet::packet::tcp::{ipv4_checksum, MutableTcpPacket, TcpFlags, TcpPacket};
use pnet::packet::Packet;
use pnet::transport::{self, TransportChannelType, TransportProtocol};
use serde::{Deserialize, Serialize};

// =============================================================================
// Request Types
// =============================================================================

/// Top-level request envelope
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum Request {
    /// Check if this binary has raw socket privileges
    Check,
    /// Perform TCP SYN scan
    TcpSyn(TcpSynRequest),
}

/// TCP SYN scan request
#[derive(Debug, Deserialize)]
struct TcpSynRequest {
    /// Target IPv4 addresses to scan
    targets: Vec<String>,
    /// Ports to send SYN packets to
    ports: Vec<u16>,
    /// Source IP address for packets
    source_ip: String,
    /// Timeout in milliseconds for response collection
    timeout_ms: u64,
}

// =============================================================================
// Response Types
// =============================================================================

/// Privilege check result
#[derive(Debug, Serialize)]
struct CheckResponse {
    success: bool,
    /// Whether raw TCP sockets can be created
    tcp_syn: bool,
}

/// TCP SYN scan result
#[derive(Debug, Serialize)]
struct TcpSynResponse {
    success: bool,
    /// Discovered host IPs (responded with SYN-ACK or RST)
    discovered: Vec<String>,
    /// Duration of the scan in milliseconds
    duration_ms: u64,
}

/// Error response
#[derive(Debug, Serialize)]
struct ErrorResponse {
    success: bool,
    error: String,
}

// =============================================================================
// Privilege Check
// =============================================================================

fn handle_check() -> String {
    let protocol =
        TransportChannelType::Layer4(TransportProtocol::Ipv4(IpNextHeaderProtocols::Tcp));
    let tcp_syn = transport::transport_channel(4096, protocol).is_ok();

    to_json(&CheckResponse {
        success: true,
        tcp_syn,
    })
}

// =============================================================================
// TCP SYN Scan
// =============================================================================

fn handle_tcp_syn(req: TcpSynRequest) -> String {
    let start = std::time::Instant::now();

    // Parse target IPs
    let ipv4_targets: Vec<Ipv4Addr> = req
        .targets
        .iter()
        .filter_map(|s| s.parse::<Ipv4Addr>().ok())
        .collect();

    if ipv4_targets.is_empty() {
        return to_json(&ErrorResponse {
            success: false,
            error: "No valid IPv4 targets provided".to_string(),
        });
    }

    // Parse source IP
    let source_ip: Ipv4Addr = match req.source_ip.parse() {
        Ok(ip) => ip,
        Err(_) => {
            return to_json(&ErrorResponse {
                success: false,
                error: format!("Invalid source IP: {}", req.source_ip),
            })
        }
    };

    // Validate ports
    if req.ports.is_empty() {
        return to_json(&ErrorResponse {
            success: false,
            error: "No ports specified".to_string(),
        });
    }

    // Create raw socket transport channel
    let protocol =
        TransportChannelType::Layer4(TransportProtocol::Ipv4(IpNextHeaderProtocols::Tcp));

    let (mut tx, mut rx) = match transport::transport_channel(4096, protocol) {
        Ok(pair) => pair,
        Err(e) => {
            return to_json(&ErrorResponse {
                success: false,
                error: format!("Failed to create raw socket: {e}. Requires elevated privileges."),
            })
        }
    };

    let mut discovered = HashSet::new();
    let timeout_duration = Duration::from_millis(req.timeout_ms);

    // Send SYN packets to all targets and ports
    for target in &ipv4_targets {
        for &port in &req.ports {
            let _ = send_syn_packet(&mut tx, source_ip, *target, port);
        }
    }

    // Collect SYN-ACK / RST responses
    let start_recv = std::time::Instant::now();
    let target_set: HashSet<IpAddr> = ipv4_targets.iter().map(|ip| IpAddr::V4(*ip)).collect();

    while start_recv.elapsed() < timeout_duration {
        let mut iter = transport::tcp_packet_iter(&mut rx);
        match iter.next_with_timeout(Duration::from_millis(100)) {
            Ok(Some((packet, addr))) => {
                if target_set.contains(&addr) {
                    let flags = packet.get_flags();
                    // SYN-ACK (port open) or RST (port closed) both indicate host is alive
                    let is_syn_ack =
                        flags & (TcpFlags::SYN | TcpFlags::ACK) == (TcpFlags::SYN | TcpFlags::ACK);
                    let is_rst = flags & TcpFlags::RST != 0;
                    if is_syn_ack || is_rst {
                        discovered.insert(addr);
                    }
                }
            }
            Ok(None) | Err(_) => {
                std::thread::sleep(Duration::from_millis(10));
            }
        }
    }

    to_json(&TcpSynResponse {
        success: true,
        discovered: discovered.iter().map(ToString::to_string).collect(),
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Send a TCP SYN packet with proper checksum calculation
fn send_syn_packet(
    tx: &mut transport::TransportSender,
    source: Ipv4Addr,
    target: Ipv4Addr,
    port: u16,
) -> Result<(), String> {
    let mut tcp_buffer = [0u8; 20];
    let mut tcp_packet =
        MutableTcpPacket::new(&mut tcp_buffer).ok_or("Failed to create TCP packet")?;

    tcp_packet.set_source(rand::random::<u16>().max(1024));
    tcp_packet.set_destination(port);
    tcp_packet.set_sequence(rand::random());
    tcp_packet.set_acknowledgement(0);
    tcp_packet.set_data_offset(5);
    tcp_packet.set_flags(TcpFlags::SYN);
    tcp_packet.set_window(64240);
    tcp_packet.set_urgent_ptr(0);

    // Calculate TCP checksum using pseudo-header (RFC 793)
    let checksum = {
        let tcp_packet_ref =
            TcpPacket::new(tcp_packet.packet()).ok_or("Failed to create TcpPacket for checksum")?;
        ipv4_checksum(&tcp_packet_ref, &source, &target)
    };
    tcp_packet.set_checksum(checksum);

    tx.send_to(tcp_packet, IpAddr::V4(target))
        .map_err(|e| format!("Failed to send packet: {e}"))?;

    Ok(())
}

// =============================================================================
// Utilities
// =============================================================================

fn to_json<T: Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| {
        r#"{"success":false,"error":"Failed to serialize response"}"#.to_string()
    })
}

// =============================================================================
// Main
// =============================================================================

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    // Read single line from stdin
    let mut input = String::new();
    if stdin.lock().read_line(&mut input).is_err() {
        let _ = writeln!(
            stdout,
            "{}",
            to_json(&ErrorResponse {
                success: false,
                error: "Failed to read input".to_string(),
            })
        );
        return;
    }

    // Parse request
    let request: Request = match serde_json::from_str(&input) {
        Ok(req) => req,
        Err(e) => {
            let _ = writeln!(
                stdout,
                "{}",
                to_json(&ErrorResponse {
                    success: false,
                    error: format!("Invalid request: {e}"),
                })
            );
            return;
        }
    };

    // Process request
    let response = match request {
        Request::Check => handle_check(),
        Request::TcpSyn(req) => handle_tcp_syn(req),
    };

    // Write response
    let _ = writeln!(stdout, "{response}");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_request_deserialize() {
        let input = r#"{"type": "check"}"#;
        let req: Request = serde_json::from_str(input).unwrap();
        assert!(matches!(req, Request::Check));
    }

    #[test]
    fn test_tcp_syn_request_deserialize() {
        let input = r#"{
            "type": "tcp_syn",
            "targets": ["192.168.1.1", "192.168.1.2"],
            "ports": [22, 80, 443],
            "source_ip": "192.168.1.100",
            "timeout_ms": 1000
        }"#;
        let req: Request = serde_json::from_str(input).unwrap();
        match req {
            Request::TcpSyn(syn) => {
                assert_eq!(syn.targets.len(), 2);
                assert_eq!(syn.ports, vec![22, 80, 443]);
                assert_eq!(syn.source_ip, "192.168.1.100");
                assert_eq!(syn.timeout_ms, 1000);
            }
            _ => panic!("Expected TcpSyn request"),
        }
    }

    #[test]
    fn test_check_response_serialize() {
        let resp = CheckResponse {
            success: true,
            tcp_syn: false,
        };
        let json = to_json(&resp);
        assert!(json.contains(r#""success":true"#));
        assert!(json.contains(r#""tcp_syn":false"#));
    }

    #[test]
    fn test_tcp_syn_response_serialize() {
        let resp = TcpSynResponse {
            success: true,
            discovered: vec!["192.168.1.1".to_string()],
            duration_ms: 500,
        };
        let json = to_json(&resp);
        assert!(json.contains(r#""success":true"#));
        assert!(json.contains("192.168.1.1"));
    }

    #[test]
    fn test_error_response_serialize() {
        let resp = ErrorResponse {
            success: false,
            error: "test error".to_string(),
        };
        let json = to_json(&resp);
        assert!(json.contains(r#""success":false"#));
        assert!(json.contains("test error"));
    }

    #[test]
    fn test_invalid_request_json() {
        let input = "not json";
        let result: Result<Request, _> = serde_json::from_str(input);
        assert!(result.is_err());
    }

    #[test]
    fn test_tcp_syn_no_targets() {
        let req = TcpSynRequest {
            targets: vec![],
            ports: vec![80],
            source_ip: "192.168.1.100".to_string(),
            timeout_ms: 1000,
        };
        let response = handle_tcp_syn(req);
        assert!(response.contains("No valid IPv4 targets"));
    }

    #[test]
    fn test_tcp_syn_invalid_source_ip() {
        let req = TcpSynRequest {
            targets: vec!["192.168.1.1".to_string()],
            ports: vec![80],
            source_ip: "not-an-ip".to_string(),
            timeout_ms: 1000,
        };
        let response = handle_tcp_syn(req);
        assert!(response.contains("Invalid source IP"));
    }

    #[test]
    fn test_tcp_syn_no_ports() {
        let req = TcpSynRequest {
            targets: vec!["192.168.1.1".to_string()],
            ports: vec![],
            source_ip: "192.168.1.100".to_string(),
            timeout_ms: 1000,
        };
        let response = handle_tcp_syn(req);
        assert!(response.contains("No ports specified"));
    }
}
