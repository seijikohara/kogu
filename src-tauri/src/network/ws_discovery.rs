//! WS-Discovery (Web Services Dynamic Discovery)
//!
//! Discovers devices using WS-Discovery SOAP Probe messages sent via
//! UDP multicast to 239.255.255.250:3702.
//! Commonly used by Windows devices, printers, and cameras.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::time::Duration;

use quick_xml::events::Event;
use quick_xml::reader::Reader;
use serde::Serialize;

/// Multicast address for WS-Discovery
const WSD_MULTICAST_ADDR: &str = "239.255.255.250:3702";

/// Maximum response size
const WSD_MAX_RESPONSE_SIZE: usize = 16384;

/// Result from a WS-Discovery probe response
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WsDiscoveryInfo {
    /// Device types (e.g., "wsdp:Device", "print:PrintDeviceType")
    pub device_types: Vec<String>,
    /// XAddrs - endpoint URLs for the device
    pub xaddrs: Vec<String>,
    /// Scopes - URIs describing device capabilities
    pub scopes: Vec<String>,
}

/// Run WS-Discovery probe and collect responses
pub async fn ws_discovery_probe(timeout_duration: Duration) -> HashMap<String, WsDiscoveryInfo> {
    let mut results = HashMap::new();

    let socket = match tokio::net::UdpSocket::bind("0.0.0.0:0").await {
        Ok(s) => s,
        Err(_) => return results,
    };

    // Limit multicast TTL to 1 hop (LAN only, per WS-Discovery spec)
    let _ = socket.set_ttl(1);

    // Build and send SOAP Probe message
    let message_id = uuid::Uuid::new_v4();
    let probe = build_probe_message(&message_id.to_string());

    let dest: SocketAddr = match WSD_MULTICAST_ADDR.parse() {
        Ok(a) => a,
        Err(_) => return results,
    };

    // Send probe twice for reliability
    for _ in 0..2 {
        if socket.send_to(probe.as_bytes(), dest).await.is_err() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    // Collect responses
    let mut buf = [0u8; WSD_MAX_RESPONSE_SIZE];
    let deadline = tokio::time::Instant::now() + timeout_duration;

    loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }

        match tokio::time::timeout(
            remaining.min(Duration::from_millis(100)),
            socket.recv_from(&mut buf),
        )
        .await
        {
            Ok(Ok((len, addr))) => {
                if addr.ip().is_loopback() {
                    continue;
                }
                let ip = addr.ip().to_string();
                if let Ok(response) = std::str::from_utf8(&buf[..len]) {
                    if let Some(info) = parse_probe_match(response) {
                        results.entry(ip).or_insert(info);
                    }
                }
            }
            Ok(Err(_)) | Err(_) => continue,
        }
    }

    results
}

/// Build a WS-Discovery SOAP Probe message
fn build_probe_message(message_id: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
  xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery">
  <soap:Header>
    <wsa:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>
    <wsa:MessageID>urn:uuid:{message_id}</wsa:MessageID>
  </soap:Header>
  <soap:Body>
    <wsd:Probe/>
  </soap:Body>
</soap:Envelope>"#
    )
}

/// Parse a WS-Discovery ProbeMatch response XML
fn parse_probe_match(xml: &str) -> Option<WsDiscoveryInfo> {
    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();

    let mut device_types = Vec::new();
    let mut xaddrs = Vec::new();
    let mut scopes = Vec::new();
    let mut current_tag = String::new();
    let mut in_probe_match = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                if tag == "ProbeMatch" || tag == "ProbeMatches" {
                    in_probe_match = true;
                }
                current_tag = tag;
            }
            Ok(Event::Text(ref e)) => {
                if in_probe_match {
                    let text = e.unescape().unwrap_or_default().trim().to_string();
                    if !text.is_empty() {
                        match current_tag.as_str() {
                            "Types" => {
                                device_types.extend(text.split_whitespace().map(String::from));
                            }
                            "XAddrs" => {
                                xaddrs.extend(text.split_whitespace().map(String::from));
                            }
                            "Scopes" => {
                                scopes.extend(text.split_whitespace().map(String::from));
                            }
                            _ => {}
                        }
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                if tag == "ProbeMatch" || tag == "ProbeMatches" {
                    in_probe_match = false;
                }
                current_tag.clear();
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    if device_types.is_empty() && xaddrs.is_empty() && scopes.is_empty() {
        return None;
    }

    Some(WsDiscoveryInfo {
        device_types,
        xaddrs,
        scopes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_probe_message() {
        let msg = build_probe_message("test-uuid-1234");
        assert!(msg.contains("urn:uuid:test-uuid-1234"));
        assert!(msg.contains("Probe"));
        assert!(msg.contains("soap:Envelope"));
    }

    #[test]
    fn test_parse_probe_match_valid() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
  xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery"
  xmlns:wsdp="http://schemas.xmlsoap.org/ws/2006/02/devprof">
  <soap:Body>
    <wsd:ProbeMatches>
      <wsd:ProbeMatch>
        <wsd:Types>wsdp:Device</wsd:Types>
        <wsd:Scopes>http://printer.example.com/</wsd:Scopes>
        <wsd:XAddrs>http://192.168.1.100:8080/ws</wsd:XAddrs>
      </wsd:ProbeMatch>
    </wsd:ProbeMatches>
  </soap:Body>
</soap:Envelope>"#;

        let result = parse_probe_match(xml);
        assert!(result.is_some());
        let info = result.unwrap();
        assert_eq!(info.device_types, vec!["wsdp:Device"]);
        assert_eq!(info.xaddrs, vec!["http://192.168.1.100:8080/ws"]);
        assert_eq!(info.scopes, vec!["http://printer.example.com/"]);
    }

    #[test]
    fn test_parse_probe_match_multiple_types() {
        let xml = r#"<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <ProbeMatches>
      <ProbeMatch>
        <Types>wsdp:Device print:PrintDeviceType</Types>
        <XAddrs>http://10.0.0.1/ws http://10.0.0.1/print</XAddrs>
      </ProbeMatch>
    </ProbeMatches>
  </soap:Body>
</soap:Envelope>"#;

        let result = parse_probe_match(xml);
        assert!(result.is_some());
        let info = result.unwrap();
        assert_eq!(info.device_types.len(), 2);
        assert_eq!(info.xaddrs.len(), 2);
    }

    #[test]
    fn test_parse_probe_match_empty() {
        let result = parse_probe_match("<soap:Envelope/>");
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_probe_match_invalid_xml() {
        let result = parse_probe_match("not xml at all");
        assert!(result.is_none());
    }
}
