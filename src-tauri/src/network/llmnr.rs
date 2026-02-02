//! LLMNR (Link-Local Multicast Name Resolution) - RFC 4795
//!
//! Used for hostname resolution of discovered hosts, particularly Windows devices.
//! Sends DNS-format queries to multicast address 224.0.0.252:5355 (IPv4).

use std::time::Duration;

/// LLMNR multicast address (IPv4)
const LLMNR_MULTICAST_ADDR: &str = "224.0.0.252:5355";

/// Resolve a hostname via LLMNR reverse lookup.
///
/// Sends a PTR query for the given IP address to the LLMNR multicast group.
/// Returns the resolved hostname if found.
pub async fn resolve_hostname(ip: &str, timeout_duration: Duration) -> Option<String> {
    let parsed_ip: std::net::IpAddr = ip.parse().ok()?;

    // Build reverse DNS name for PTR query
    let ptr_name = match parsed_ip {
        std::net::IpAddr::V4(v4) => {
            let octets = v4.octets();
            format!(
                "{}.{}.{}.{}.in-addr.arpa",
                octets[3], octets[2], octets[1], octets[0]
            )
        }
        std::net::IpAddr::V6(_) => {
            // IPv6 LLMNR is less commonly used; skip for now
            return None;
        }
    };

    let socket = tokio::net::UdpSocket::bind("0.0.0.0:0").await.ok()?;
    let dest: std::net::SocketAddr = LLMNR_MULTICAST_ADDR.parse().ok()?;

    // Build DNS-format query for PTR record
    let query = build_llmnr_query(&ptr_name, 0x000C)?; // 0x000C = PTR record type
    socket.send_to(&query, dest).await.ok()?;

    // Wait for response
    let mut buf = [0u8; 1024];
    match tokio::time::timeout(timeout_duration, socket.recv_from(&mut buf)).await {
        Ok(Ok((len, _addr))) => parse_llmnr_ptr_response(&buf[..len]),
        _ => None,
    }
}

/// Build an LLMNR (DNS-format) query packet
fn build_llmnr_query(name: &str, qtype: u16) -> Option<Vec<u8>> {
    let mut packet = Vec::with_capacity(64);

    // Transaction ID (random)
    let tid: u16 = rand::random();
    packet.extend_from_slice(&tid.to_be_bytes());

    // Flags: standard query, no recursion
    packet.extend_from_slice(&[0x00, 0x00]);

    // QDCOUNT: 1 question
    packet.extend_from_slice(&1u16.to_be_bytes());
    // ANCOUNT, NSCOUNT, ARCOUNT: 0
    packet.extend_from_slice(&[0, 0, 0, 0, 0, 0]);

    // Question section: encode name
    for label in name.split('.') {
        let len = label.len();
        if len > 63 || len == 0 {
            return None;
        }
        packet.push(len as u8);
        packet.extend_from_slice(label.as_bytes());
    }
    packet.push(0); // Root label

    // QTYPE
    packet.extend_from_slice(&qtype.to_be_bytes());
    // QCLASS: IN (1)
    packet.extend_from_slice(&1u16.to_be_bytes());

    Some(packet)
}

/// Parse an LLMNR response for a PTR record, returning the resolved hostname
fn parse_llmnr_ptr_response(data: &[u8]) -> Option<String> {
    if data.len() < 12 {
        return None;
    }

    // Check flags: QR bit should be 1 (response)
    if data[2] & 0x80 == 0 {
        return None;
    }

    // Check ANCOUNT >= 1
    let ancount = u16::from_be_bytes([data[4], data[5]]);
    if ancount == 0 {
        return None;
    }

    // Skip question section
    let mut offset = 12;
    offset = skip_dns_name(data, offset)?;
    offset += 4; // QTYPE + QCLASS

    if offset >= data.len() {
        return None;
    }

    // Parse answer section
    offset = skip_dns_name(data, offset)?;
    if offset + 10 > data.len() {
        return None;
    }

    let rtype = u16::from_be_bytes([data[offset], data[offset + 1]]);
    offset += 8; // TYPE(2) + CLASS(2) + TTL(4)

    let rdlength = u16::from_be_bytes([data[offset], data[offset + 1]]) as usize;
    offset += 2;

    if rtype != 0x000C || offset + rdlength > data.len() {
        return None;
    }

    // Read PTR name
    read_dns_name(data, offset)
}

/// Skip a DNS name in a packet, handling compression pointers
fn skip_dns_name(data: &[u8], mut offset: usize) -> Option<usize> {
    loop {
        if offset >= data.len() {
            return None;
        }
        let len = data[offset] as usize;
        if len == 0 {
            return Some(offset + 1);
        }
        if len & 0xC0 == 0xC0 {
            // Compression pointer
            return Some(offset + 2);
        }
        offset += 1 + len;
    }
}

/// Read a DNS name from a packet, following compression pointers
fn read_dns_name(data: &[u8], mut offset: usize) -> Option<String> {
    let mut name = String::new();
    let mut depth = 0;
    let mut last_ptr_offset = usize::MAX;

    loop {
        if offset >= data.len() || depth > 10 {
            return None;
        }
        let len = data[offset] as usize;
        if len == 0 {
            break;
        }
        if len & 0xC0 == 0xC0 {
            // Compression pointer
            if offset + 1 >= data.len() {
                return None;
            }
            let ptr = ((len & 0x3F) << 8) | data[offset + 1] as usize;
            // Detect self-referencing or backward-to-same pointer loops
            if ptr >= offset || ptr == last_ptr_offset {
                return None;
            }
            last_ptr_offset = offset;
            offset = ptr;
            depth += 1;
            continue;
        }
        offset += 1;
        if offset + len > data.len() {
            return None;
        }
        if !name.is_empty() {
            name.push('.');
        }
        name.push_str(&String::from_utf8_lossy(&data[offset..offset + len]));
        offset += len;
    }

    // Remove trailing dot and ".in-addr.arpa" if present for clean hostname
    let clean = name.trim_end_matches('.').to_string();

    if clean.is_empty() {
        None
    } else {
        Some(clean)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_llmnr_query() {
        let query = build_llmnr_query("test.local", 0x0001).unwrap();
        // Header: 12 bytes
        // Question: 4(test) + 5(local) + 1(root) + 4(QTYPE+QCLASS)
        assert_eq!(query.len(), 12 + 4 + 1 + 5 + 1 + 4 + 1);

        // Check QDCOUNT = 1
        assert_eq!(query[4], 0);
        assert_eq!(query[5], 1);

        // Check name encoding
        assert_eq!(query[12], 4); // "test" length
        assert_eq!(&query[13..17], b"test");
        assert_eq!(query[17], 5); // "local" length
        assert_eq!(&query[18..23], b"local");
        assert_eq!(query[23], 0); // Root label
    }

    #[test]
    fn test_build_llmnr_query_empty_label() {
        assert!(build_llmnr_query("", 0x0001).is_none());
    }

    #[test]
    fn test_skip_dns_name() {
        // Simple name: \x04test\x05local\x00
        let data = [
            0x04, b't', b'e', b's', b't', 0x05, b'l', b'o', b'c', b'a', b'l', 0x00,
        ];
        assert_eq!(skip_dns_name(&data, 0), Some(12));
    }

    #[test]
    fn test_skip_dns_name_compression() {
        // Compression pointer: \xc0\x0c
        let data = [0xc0, 0x0c];
        assert_eq!(skip_dns_name(&data, 0), Some(2));
    }

    #[test]
    fn test_read_dns_name() {
        let data = [
            0x04, b't', b'e', b's', b't', 0x05, b'l', b'o', b'c', b'a', b'l', 0x00,
        ];
        let name = read_dns_name(&data, 0);
        assert_eq!(name.as_deref(), Some("test.local"));
    }

    #[test]
    fn test_parse_llmnr_ptr_response_too_short() {
        assert!(parse_llmnr_ptr_response(&[0; 10]).is_none());
    }

    #[test]
    fn test_parse_llmnr_ptr_response_query_not_response() {
        // QR bit = 0 (query, not response)
        let mut data = [0u8; 20];
        data[2] = 0x00; // QR = 0
        assert!(parse_llmnr_ptr_response(&data).is_none());
    }

    #[test]
    fn test_parse_llmnr_ptr_response_valid() {
        // Build a valid LLMNR PTR response for 1.3.168.192.in-addr.arpa → myhost
        let mut pkt = Vec::new();

        // Header: TID=0x1234, QR=1 (response), QDCOUNT=1, ANCOUNT=1
        pkt.extend_from_slice(&[0x12, 0x34]); // TID
        pkt.extend_from_slice(&[0x80, 0x00]); // Flags: QR=1
        pkt.extend_from_slice(&[0x00, 0x01]); // QDCOUNT=1
        pkt.extend_from_slice(&[0x00, 0x01]); // ANCOUNT=1
        pkt.extend_from_slice(&[0x00, 0x00]); // NSCOUNT=0
        pkt.extend_from_slice(&[0x00, 0x00]); // ARCOUNT=0

        // Question: 1.3.168.192.in-addr.arpa PTR IN
        // "1"
        pkt.push(1);
        pkt.push(b'1');
        // "3"
        pkt.push(1);
        pkt.push(b'3');
        // "168"
        pkt.push(3);
        pkt.extend_from_slice(b"168");
        // "192"
        pkt.push(3);
        pkt.extend_from_slice(b"192");
        // "in-addr"
        pkt.push(7);
        pkt.extend_from_slice(b"in-addr");
        // "arpa"
        pkt.push(4);
        pkt.extend_from_slice(b"arpa");
        // Root
        pkt.push(0);
        // QTYPE=PTR (0x000C), QCLASS=IN (0x0001)
        pkt.extend_from_slice(&[0x00, 0x0C, 0x00, 0x01]);

        // Answer: name=compression pointer to question, TYPE=PTR, CLASS=IN, TTL=0, RDLENGTH=8
        // Name: compression pointer to offset 12 (question name)
        pkt.extend_from_slice(&[0xC0, 0x0C]);
        // TYPE=PTR
        pkt.extend_from_slice(&[0x00, 0x0C]);
        // CLASS=IN
        pkt.extend_from_slice(&[0x00, 0x01]);
        // TTL=0
        pkt.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]);
        // RDLENGTH=8 (6 for "myhost" label + 1 root + padding)
        pkt.extend_from_slice(&[0x00, 0x08]);
        // PTR RDATA: "myhost" (label)
        pkt.push(6);
        pkt.extend_from_slice(b"myhost");
        pkt.push(0); // Root label

        let result = parse_llmnr_ptr_response(&pkt);
        assert!(result.is_some());
        assert_eq!(result.unwrap(), "myhost");
    }

    #[test]
    fn test_read_dns_name_rejects_forward_pointer() {
        // Compression pointer pointing forward (ptr > offset) should be rejected
        // Offset 0: pointer to offset 4 (forward reference)
        let data = [0xC0, 0x04, 0x00, 0x00, 0x04, b't', b'e', b's', b't', 0x00];
        assert!(read_dns_name(&data, 0).is_none());
    }

    #[test]
    fn test_read_dns_name_rejects_self_pointer() {
        // Compression pointer pointing to itself
        let data = [0xC0, 0x00];
        assert!(read_dns_name(&data, 0).is_none());
    }
}
