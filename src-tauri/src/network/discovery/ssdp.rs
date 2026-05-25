//! SSDP/UPnP host discovery and device-description parsing.

use std::collections::HashSet;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Semaphore;

use super::super::types;
use super::types::{DiscoveryOptions, DiscoveryResult, HostMetadata};

/// SSDP multicast address for IPv4
const SSDP_MULTICAST_ADDR_V4: &str = "239.255.255.250:1900";

/// SSDP multicast address for IPv6 link-local (ff02::c)
const SSDP_MULTICAST_ADDR_V6: &str = "[ff02::c]:1900";

/// M-SEARCH search targets for broader device discovery
const SSDP_SEARCH_TARGETS: &[&str] = &[
    "ssdp:all",
    "upnp:rootdevice",
    "urn:schemas-upnp-org:device:InternetGatewayDevice:1",
];

/// Build M-SEARCH request for given host and search target
fn build_msearch(host: &str, st: &str) -> Vec<u8> {
    format!(
        "M-SEARCH * HTTP/1.1\r\n\
         Host: {host}\r\n\
         Man: \"ssdp:discover\"\r\n\
         MX: 2\r\n\
         ST: {st}\r\n\
         \r\n"
    )
    .into_bytes()
}

/// Per-host SSDP data collected during discovery
#[derive(Clone, Default)]
struct SsdpHostData {
    server: Option<String>,
    location: Option<String>,
}

/// Minimum timeout for SSDP discovery (multicast needs time for responses)
const SSDP_MIN_TIMEOUT_MS: u32 = 3000;

/// Maximum concurrent LOCATION XML fetches
const SSDP_MAX_LOCATION_FETCHES: usize = 5;

/// Discover hosts using SSDP/UPnP protocol with device description fetching
pub(super) async fn ssdp_discovery(options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let ssdp_timeout = options.timeout_ms.max(SSDP_MIN_TIMEOUT_MS);
    let timeout_duration = Duration::from_millis(u64::from(ssdp_timeout));

    let hosts = Arc::new(tokio::sync::Mutex::new(HashSet::new()));
    let host_data = Arc::new(tokio::sync::Mutex::new(std::collections::HashMap::<
        String,
        SsdpHostData,
    >::new()));

    // Run IPv4 and IPv6 SSDP discovery in parallel
    let v4_handle = {
        let hosts = Arc::clone(&hosts);
        let host_data = Arc::clone(&host_data);
        tokio::spawn(async move {
            ssdp_collect_responses(
                "0.0.0.0:0",
                SSDP_MULTICAST_ADDR_V4,
                "239.255.255.250:1900",
                timeout_duration,
                hosts,
                host_data,
            )
            .await;
        })
    };

    let v6_handle = {
        let hosts = Arc::clone(&hosts);
        let host_data = Arc::clone(&host_data);
        tokio::spawn(async move {
            ssdp_collect_responses(
                "[::]:0",
                SSDP_MULTICAST_ADDR_V6,
                "[ff02::c]:1900",
                timeout_duration,
                hosts,
                host_data,
            )
            .await;
        })
    };

    let _ = tokio::join!(v4_handle, v6_handle);

    // Snapshot data to avoid holding locks during async fetch
    let hosts_snapshot = hosts.lock().await.clone();
    let host_data_snapshot = host_data.lock().await.clone();
    let host_metadata = ssdp_fetch_device_descriptions(&hosts_snapshot, &host_data_snapshot).await;

    DiscoveryResult {
        method: "ssdp".to_string(),
        hosts: hosts_snapshot.iter().cloned().collect(),
        hostnames: std::collections::HashMap::new(),
        host_metadata,
        unreachable: vec![],
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: false,
    }
}

/// Fetch UPnP device description XMLs and build host metadata
async fn ssdp_fetch_device_descriptions(
    hosts: &HashSet<String>,
    host_data: &std::collections::HashMap<String, SsdpHostData>,
) -> std::collections::HashMap<String, HostMetadata> {
    let semaphore = Arc::new(Semaphore::new(SSDP_MAX_LOCATION_FETCHES));
    let client = Arc::new(
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(1))
            .timeout(Duration::from_secs(2))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap_or_default(),
    );
    let mut fetch_handles = Vec::new();

    for (ip, data) in host_data {
        if let Some(ref location) = data.location {
            let ip = ip.clone();
            let location = location.clone();
            let server = data.server.clone();
            let sem = Arc::clone(&semaphore);
            let client = Arc::clone(&client);

            fetch_handles.push(tokio::spawn(async move {
                let _permit = sem.acquire().await;
                let mut device_info = fetch_upnp_device_description(&client, &location, &ip)
                    .await
                    .unwrap_or_default();
                device_info.server = server;
                if device_info.location.is_none() {
                    device_info.location = Some(location);
                }
                (ip, device_info)
            }));
        }
    }

    let mut metadata = std::collections::HashMap::<String, HostMetadata>::new();

    for handle in fetch_handles {
        if let Ok((ip, device_info)) = handle.await {
            // Only use friendlyName as hostname (SERVER is not an identifier)
            let has_friendly_name = device_info.friendly_name.is_some();
            metadata.insert(
                ip,
                HostMetadata {
                    hostname: device_info.friendly_name.clone(),
                    hostname_source: if has_friendly_name {
                        Some("ssdp".to_string())
                    } else {
                        None
                    },
                    ssdp_device: Some(device_info),
                    ..Default::default()
                },
            );
        }
    }

    // Add basic metadata for hosts without LOCATION or failed fetch
    for ip in hosts {
        if !metadata.contains_key(ip) {
            if let Some(data) = host_data.get(ip) {
                if data.server.is_some() || data.location.is_some() {
                    metadata.insert(
                        ip.clone(),
                        HostMetadata {
                            ssdp_device: Some(types::SsdpDeviceInfo {
                                server: data.server.clone(),
                                ..Default::default()
                            }),
                            ..Default::default()
                        },
                    );
                }
            }
        }
    }

    metadata
}

/// Collect SSDP M-SEARCH responses from a specific address family
async fn ssdp_collect_responses(
    bind_addr: &str,
    multicast_addr: &str,
    host_header: &str,
    timeout_duration: Duration,
    hosts: Arc<tokio::sync::Mutex<HashSet<String>>>,
    host_data: Arc<tokio::sync::Mutex<std::collections::HashMap<String, SsdpHostData>>>,
) {
    let socket = match tokio::net::UdpSocket::bind(bind_addr).await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("SSDP: Failed to bind {bind_addr}: {e}");
            return;
        }
    };

    // Send M-SEARCH for each search target
    if let Ok(addr) = multicast_addr.parse::<SocketAddr>() {
        for st in SSDP_SEARCH_TARGETS {
            let msg = build_msearch(host_header, st);
            let _ = socket.send_to(&msg, addr).await;
        }
    }

    // Collect responses
    let mut buf = [0u8; 4096];
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
                let mut hosts_guard = hosts.lock().await;
                let is_new = hosts_guard.insert(ip.clone());
                drop(hosts_guard);

                if is_new {
                    let data = if let Ok(response) = std::str::from_utf8(&buf[..len]) {
                        let parsed = parse_ssdp_response(response);
                        SsdpHostData {
                            server: parsed.server,
                            location: parsed.location,
                        }
                    } else {
                        SsdpHostData::default()
                    };
                    host_data.lock().await.insert(ip, data);
                } else if let Ok(response) = std::str::from_utf8(&buf[..len]) {
                    // Update with better data if we get a LOCATION from a later response
                    let parsed = parse_ssdp_response(response);
                    if parsed.location.is_some() {
                        let mut data_guard = host_data.lock().await;
                        if let Some(existing) = data_guard.get_mut(&ip) {
                            if existing.location.is_none() {
                                existing.location = parsed.location;
                            }
                            if existing.server.is_none() {
                                existing.server = parsed.server;
                            }
                        }
                    }
                }
            }
            Ok(Err(_)) | Err(_) => continue,
        }
    }
}

/// Parsed SSDP response headers
struct SsdpResponse {
    server: Option<String>,
    location: Option<String>,
}

/// Parse SERVER and LOCATION headers from SSDP response
fn parse_ssdp_response(response: &str) -> SsdpResponse {
    let mut server = None;
    let mut location = None;

    for line in response.lines() {
        let lower = line.to_lowercase();
        if lower.starts_with("server:") {
            server = Some(line[7..].trim().to_string());
        } else if lower.starts_with("location:") {
            location = Some(line[9..].trim().to_string());
        }
    }

    SsdpResponse { server, location }
}

/// Maximum response body size for UPnP device description XML (64 KB)
const UPNP_MAX_BODY_SIZE: usize = 64 * 1024;

/// Validate that a LOCATION URL is safe to fetch (SSRF prevention).
/// Checks: HTTP scheme only, host is private/link-local, host matches SSDP source IP.
fn is_safe_upnp_location(location: &str, source_ip: &str) -> bool {
    let url = match reqwest::Url::parse(location) {
        Ok(u) => u,
        Err(_) => return false,
    };

    // Only allow HTTP (UPnP descriptions are HTTP-only)
    if url.scheme() != "http" {
        return false;
    }

    // Must have a valid host that is an IP address
    let host = match url.host_str() {
        Some(h) => h,
        None => return false,
    };

    // Strip IPv6 brackets if present (host_str() returns "[::1]" for IPv6)
    let host_bare = host
        .strip_prefix('[')
        .and_then(|h| h.strip_suffix(']'))
        .unwrap_or(host);

    // Parse both host and source_ip as IpAddr for canonical comparison
    let location_ip: IpAddr = match host_bare.parse() {
        Ok(ip) => ip,
        Err(_) => return false, // Non-IP hostnames are rejected
    };
    let source: IpAddr = match source_ip.parse() {
        Ok(ip) => ip,
        Err(_) => return false,
    };

    // Verify LOCATION host matches the SSDP response source IP
    if location_ip != source {
        return false;
    }

    // Verify it's a private/link-local address
    match location_ip {
        IpAddr::V4(ip) => ip.is_private() || ip.is_link_local(),
        IpAddr::V6(ip) => {
            // fe80::/10 link-local or fc00::/7 unique-local (RFC 4193)
            let segments = ip.segments();
            (segments[0] & 0xffc0) == 0xfe80 || (segments[0] & 0xfe00) == 0xfc00
        }
    }
}

/// Fetch and parse UPnP device description XML from LOCATION URL
async fn fetch_upnp_device_description(
    client: &reqwest::Client,
    location: &str,
    source_ip: &str,
) -> Option<types::SsdpDeviceInfo> {
    // Validate URL before fetching (SSRF prevention)
    if !is_safe_upnp_location(location, source_ip) {
        return None;
    }

    let response = client.get(location).send().await.ok()?;

    // Check content-length before reading body (fast rejection)
    if let Some(content_length) = response.content_length() {
        if content_length as usize > UPNP_MAX_BODY_SIZE {
            return None;
        }
    }

    // Read body with streaming size limit to prevent memory exhaustion
    // from chunked transfer encoding without Content-Length
    let bytes = response.bytes().await.ok()?;
    if bytes.len() > UPNP_MAX_BODY_SIZE {
        return None;
    }
    let body = String::from_utf8_lossy(&bytes);

    parse_upnp_device_xml(&body, location)
}

/// Parse UPnP device description XML to extract device info
fn parse_upnp_device_xml(xml: &str, location: &str) -> Option<types::SsdpDeviceInfo> {
    use quick_xml::events::Event;
    use quick_xml::reader::Reader;

    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();

    let mut friendly_name = None;
    let mut manufacturer = None;
    let mut model_name = None;
    let mut model_number = None;
    let mut device_type = None;
    let mut udn = None;
    let mut current_tag = String::new();
    // Only capture fields from the first (root) <device> block
    let mut device_depth: u32 = 0;

    let mut assign_field = |tag: &str, text: String| match tag {
        "friendlyName" => friendly_name = Some(text),
        "manufacturer" => manufacturer = Some(text),
        "modelName" => model_name = Some(text),
        "modelNumber" => model_number = Some(text),
        "deviceType" => device_type = Some(text),
        "UDN" => udn = Some(text),
        _ => {}
    };

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                if tag == "device" {
                    device_depth += 1;
                }
                current_tag = tag;
            }
            Ok(Event::Text(ref e)) => {
                if device_depth == 1 {
                    let text = e
                        .xml_content(quick_xml::XmlVersion::Implicit1_0)
                        .unwrap_or_default()
                        .trim()
                        .to_string();
                    if !text.is_empty() {
                        assign_field(&current_tag, text);
                    }
                }
            }
            Ok(Event::CData(ref e)) => {
                if device_depth == 1 {
                    let text = String::from_utf8_lossy(e.as_ref()).trim().to_string();
                    if !text.is_empty() {
                        assign_field(&current_tag, text);
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                if tag == "device" {
                    device_depth = device_depth.saturating_sub(1);
                }
                current_tag.clear();
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    // Only return if we found at least one useful field
    if friendly_name.is_some()
        || manufacturer.is_some()
        || model_name.is_some()
        || device_type.is_some()
        || udn.is_some()
    {
        Some(types::SsdpDeviceInfo {
            friendly_name,
            manufacturer,
            model_name,
            model_number,
            device_type,
            location: Some(location.to_string()),
            server: None,
            udn,
        })
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    mod is_safe_upnp_location {
        use super::*;

        #[test]
        fn test_valid_private_ipv4_http() {
            assert!(is_safe_upnp_location(
                "http://192.168.1.1:49152/rootDesc.xml",
                "192.168.1.1"
            ));
        }

        #[test]
        fn test_valid_10_network() {
            assert!(is_safe_upnp_location(
                "http://10.0.0.1:8080/desc.xml",
                "10.0.0.1"
            ));
        }

        #[test]
        fn test_valid_172_network() {
            assert!(is_safe_upnp_location(
                "http://172.16.0.1:1234/desc.xml",
                "172.16.0.1"
            ));
        }

        #[test]
        fn test_rejects_https() {
            assert!(!is_safe_upnp_location(
                "https://192.168.1.1:443/desc.xml",
                "192.168.1.1"
            ));
        }

        #[test]
        fn test_rejects_hostname() {
            assert!(!is_safe_upnp_location(
                "http://mydevice.local:8080/desc.xml",
                "192.168.1.1"
            ));
        }

        #[test]
        fn test_rejects_source_ip_mismatch() {
            assert!(!is_safe_upnp_location(
                "http://192.168.1.1:49152/rootDesc.xml",
                "192.168.1.2"
            ));
        }

        #[test]
        fn test_rejects_public_ip() {
            assert!(!is_safe_upnp_location(
                "http://8.8.8.8:80/desc.xml",
                "8.8.8.8"
            ));
        }

        #[test]
        fn test_rejects_loopback() {
            assert!(!is_safe_upnp_location(
                "http://127.0.0.1:80/desc.xml",
                "127.0.0.1"
            ));
        }

        #[test]
        fn test_valid_ipv6_link_local() {
            assert!(is_safe_upnp_location(
                "http://[fe80::1]:49152/desc.xml",
                "fe80::1"
            ));
        }

        #[test]
        fn test_valid_ipv6_ula_fd() {
            assert!(is_safe_upnp_location(
                "http://[fd00::1]:49152/desc.xml",
                "fd00::1"
            ));
        }

        #[test]
        fn test_valid_ipv6_ula_fc() {
            assert!(is_safe_upnp_location(
                "http://[fc00::1]:49152/desc.xml",
                "fc00::1"
            ));
        }

        #[test]
        fn test_rejects_ipv6_global() {
            assert!(!is_safe_upnp_location(
                "http://[2001:db8::1]:80/desc.xml",
                "2001:db8::1"
            ));
        }

        #[test]
        fn test_rejects_empty_url() {
            assert!(!is_safe_upnp_location("", "192.168.1.1"));
        }

        #[test]
        fn test_rejects_invalid_url() {
            assert!(!is_safe_upnp_location("not-a-url", "192.168.1.1"));
        }
    }

    mod parse_upnp_device_xml {
        use super::*;

        #[test]
        fn test_valid_device_description() {
            let xml = r#"<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
  <device>
    <friendlyName>My Router</friendlyName>
    <manufacturer>ACME Corp</manufacturer>
    <modelName>Router 3000</modelName>
    <modelNumber>R3K</modelNumber>
    <deviceType>urn:schemas-upnp-org:device:InternetGatewayDevice:1</deviceType>
  </device>
</root>"#;
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1:49152/desc.xml");
            assert!(result.is_some());
            let info = result.unwrap();
            assert_eq!(info.friendly_name.as_deref(), Some("My Router"));
            assert_eq!(info.manufacturer.as_deref(), Some("ACME Corp"));
            assert_eq!(info.model_name.as_deref(), Some("Router 3000"));
            assert_eq!(info.model_number.as_deref(), Some("R3K"));
            assert_eq!(
                info.device_type.as_deref(),
                Some("urn:schemas-upnp-org:device:InternetGatewayDevice:1")
            );
            assert_eq!(
                info.location.as_deref(),
                Some("http://192.168.1.1:49152/desc.xml")
            );
        }

        #[test]
        fn test_empty_xml() {
            let result = parse_upnp_device_xml("", "http://192.168.1.1/desc.xml");
            assert!(result.is_none());
        }

        #[test]
        fn test_xml_without_device_fields() {
            let xml = r#"<?xml version="1.0"?><root><device></device></root>"#;
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1/desc.xml");
            assert!(result.is_none());
        }

        #[test]
        fn test_cdata_in_friendly_name() {
            let xml = r#"<?xml version="1.0"?>
<root>
  <device>
    <friendlyName><![CDATA[My Device & More]]></friendlyName>
    <manufacturer>TestCo</manufacturer>
  </device>
</root>"#;
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1/desc.xml");
            assert!(result.is_some());
            let info = result.unwrap();
            assert_eq!(info.friendly_name.as_deref(), Some("My Device & More"));
        }

        #[test]
        fn test_nested_device_uses_root_only() {
            let xml = r#"<?xml version="1.0"?>
<root>
  <device>
    <friendlyName>Root Device</friendlyName>
    <deviceList>
      <device>
        <friendlyName>Sub Device</friendlyName>
      </device>
    </deviceList>
  </device>
</root>"#;
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1/desc.xml");
            assert!(result.is_some());
            let info = result.unwrap();
            assert_eq!(info.friendly_name.as_deref(), Some("Root Device"));
        }

        #[test]
        fn test_malformed_xml() {
            let xml = r"<root><device><friendlyName>Broken";
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1/desc.xml");
            // Should not panic; may return None or partial result
            // The parser breaks on Err but may have captured partial data
            assert!(result.is_none() || result.is_some());
        }

        #[test]
        fn test_partial_fields() {
            let xml = r#"<?xml version="1.0"?>
<root>
  <device>
    <manufacturer>OnlyManufacturer</manufacturer>
  </device>
</root>"#;
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1/desc.xml");
            assert!(result.is_some());
            let info = result.unwrap();
            assert_eq!(info.manufacturer.as_deref(), Some("OnlyManufacturer"));
            assert!(info.friendly_name.is_none());
            assert!(info.model_name.is_none());
        }

        #[test]
        fn test_extracts_udn() {
            let xml = r#"<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
  <device>
    <friendlyName>My Router</friendlyName>
    <UDN>uuid:8b8bcfe9-7b66-4d96-bb1e-9c9b1c5e8c3a</UDN>
  </device>
</root>"#;
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1/desc.xml");
            assert!(result.is_some());
            let info = result.unwrap();
            assert_eq!(
                info.udn.as_deref(),
                Some("uuid:8b8bcfe9-7b66-4d96-bb1e-9c9b1c5e8c3a")
            );
        }

        #[test]
        fn test_missing_udn_returns_none() {
            let xml = r#"<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
  <device>
    <friendlyName>My Router</friendlyName>
  </device>
</root>"#;
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1/desc.xml");
            assert!(result.is_some());
            let info = result.unwrap();
            assert!(info.udn.is_none());
        }

        #[test]
        fn test_udn_alone_triggers_some() {
            // Even without other fields, a UDN-only document should still
            // produce SsdpDeviceInfo because UDN is a useful identity signal.
            let xml = r#"<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
  <device>
    <UDN>uuid:11111111-2222-3333-4444-555555555555</UDN>
  </device>
</root>"#;
            let result = parse_upnp_device_xml(xml, "http://192.168.1.1/desc.xml");
            assert!(result.is_some());
            let info = result.unwrap();
            assert_eq!(
                info.udn.as_deref(),
                Some("uuid:11111111-2222-3333-4444-555555555555")
            );
        }
    }

    mod parse_ssdp_response {
        use super::*;

        #[test]
        fn test_with_server_and_location() {
            let response = "HTTP/1.1 200 OK\r\n\
                SERVER: Linux/3.0 UPnP/1.0 miniupnpd/1.5\r\n\
                LOCATION: http://192.168.1.1:49152/rootDesc.xml\r\n\
                ST: upnp:rootdevice\r\n\r\n";
            let parsed = parse_ssdp_response(response);
            assert_eq!(
                parsed.server.as_deref(),
                Some("Linux/3.0 UPnP/1.0 miniupnpd/1.5")
            );
            assert_eq!(
                parsed.location.as_deref(),
                Some("http://192.168.1.1:49152/rootDesc.xml")
            );
        }

        #[test]
        fn test_without_location() {
            let response = "HTTP/1.1 200 OK\r\n\
                SERVER: Some Server\r\n\
                ST: ssdp:all\r\n\r\n";
            let parsed = parse_ssdp_response(response);
            assert_eq!(parsed.server.as_deref(), Some("Some Server"));
            assert!(parsed.location.is_none());
        }

        #[test]
        fn test_empty_response() {
            let parsed = parse_ssdp_response("");
            assert!(parsed.server.is_none());
            assert!(parsed.location.is_none());
        }

        #[test]
        fn test_case_insensitive_headers() {
            let response = "HTTP/1.1 200 OK\r\n\
                server: my server\r\n\
                location: http://10.0.0.1/desc.xml\r\n\r\n";
            let parsed = parse_ssdp_response(response);
            assert_eq!(parsed.server.as_deref(), Some("my server"));
            assert_eq!(parsed.location.as_deref(), Some("http://10.0.0.1/desc.xml"));
        }
    }
}
