//! NetBIOS Name Service (NBNS) resolution
//!
//! Resolves IP addresses to NetBIOS names using UDP port 137.
//! This is commonly used in Windows networks.

use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::time::Duration;

/// NetBIOS name query result
#[derive(Debug, Clone)]
pub struct NetbiosName {
    /// The NetBIOS name (up to 15 characters)
    pub name: String,
    /// Name type suffix (e.g., 0x00 = Workstation, 0x20 = File Server)
    pub name_type: u8,
    /// Group flag (true = group name, false = unique name)
    pub is_group: bool,
}

/// Resolve an IP address to its NetBIOS name
///
/// Sends a NetBIOS Node Status Request to the target IP and parses the response.
pub fn resolve_netbios_name(ip: IpAddr, timeout: Duration) -> Option<String> {
    let ipv4 = match ip {
        IpAddr::V4(v4) => v4,
        IpAddr::V6(_) => return None, // NetBIOS doesn't support IPv6
    };

    let names = query_netbios_names(ipv4, timeout).ok()?;

    // Find the first unique workstation or file server name
    names
        .into_iter()
        .find(|n| !n.is_group && (n.name_type == 0x00 || n.name_type == 0x20))
        .map(|n| n.name)
}

/// Query all NetBIOS names from a host
fn query_netbios_names(
    ip: Ipv4Addr,
    timeout: Duration,
) -> Result<Vec<NetbiosName>, std::io::Error> {
    let socket = UdpSocket::bind("0.0.0.0:0")?;
    socket.set_read_timeout(Some(timeout))?;
    socket.set_write_timeout(Some(timeout))?;

    let target = SocketAddr::new(IpAddr::V4(ip), 137);

    // Build NetBIOS Node Status Request packet
    let request = build_node_status_request();
    socket.send_to(&request, target)?;

    // Receive response
    let mut buf = [0u8; 1024];
    let (len, _) = socket.recv_from(&mut buf)?;

    // Parse response
    parse_node_status_response(&buf[..len])
}

/// Build a NetBIOS Node Status Request packet
fn build_node_status_request() -> Vec<u8> {
    let mut packet = Vec::with_capacity(50);

    // Transaction ID (random)
    let txid: u16 = rand::random();
    packet.extend_from_slice(&txid.to_be_bytes());

    // Flags: 0x0000 (query, opcode 0, no recursion)
    packet.extend_from_slice(&[0x00, 0x00]);

    // Questions: 1
    packet.extend_from_slice(&[0x00, 0x01]);

    // Answer RRs: 0
    packet.extend_from_slice(&[0x00, 0x00]);

    // Authority RRs: 0
    packet.extend_from_slice(&[0x00, 0x00]);

    // Additional RRs: 0
    packet.extend_from_slice(&[0x00, 0x00]);

    // Question: "*" (wildcard) encoded as NetBIOS name
    // NetBIOS name encoding: each byte becomes two bytes (first nibble + 'A', second nibble + 'A')
    // "*" padded to 16 bytes with spaces, then encoded
    packet.push(0x20); // Length of encoded name (32 bytes)

    // Encode "*" followed by 15 spaces (0x20)
    let name_bytes = [
        b'*', 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
        0x00, // 16th byte is the suffix (0x00)
    ];

    for &byte in &name_bytes {
        packet.push((byte >> 4) + b'A');
        packet.push((byte & 0x0F) + b'A');
    }

    // Null terminator for name
    packet.push(0x00);

    // Type: NBSTAT (0x0021) - Node Status
    packet.extend_from_slice(&[0x00, 0x21]);

    // Class: IN (0x0001)
    packet.extend_from_slice(&[0x00, 0x01]);

    packet
}

/// Skip a `NetBIOS` encoded name and return the new position
fn skip_netbios_name(data: &[u8], start: usize) -> Option<usize> {
    let mut pos = start;

    while pos < data.len() {
        let len = data[pos];

        if len == 0 {
            // Null terminator
            return Some(pos + 1);
        }
        if len >= 0xC0 {
            // Compression pointer (2 bytes)
            return Some(pos + 2);
        }
        // Label: length byte + that many characters
        pos += 1 + len as usize;
    }

    None
}

/// Parse a NetBIOS Node Status Response
fn parse_node_status_response(data: &[u8]) -> Result<Vec<NetbiosName>, std::io::Error> {
    // Minimum: header(12) + some question/answer data
    if data.len() < 57 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Response too short",
        ));
    }

    // NetBIOS Node Status Response structure:
    // Header (12 bytes):
    //   - Transaction ID (2)
    //   - Flags (2)
    //   - Questions (2) - typically 0 in response
    //   - Answer RRs (2) - typically 1
    //   - Authority RRs (2)
    //   - Additional RRs (2)
    // Question Section (if QDCOUNT > 0)
    // Answer Section:
    //   - Name (encoded, variable length or compression pointer)
    //   - Type (2) = 0x0021 (NBSTAT)
    //   - Class (2) = 0x0001 (IN)
    //   - TTL (4)
    //   - RDLENGTH (2)
    //   - RDATA:
    //     - Number of names (1)
    //     - Names (18 bytes each: 15-char name + 1-byte suffix + 2-byte flags)
    //     - Statistics (variable)

    let mut pos = 12; // Skip header

    // Skip Question section if present
    let qdcount = u16::from_be_bytes([data[4], data[5]]) as usize;
    for _ in 0..qdcount {
        pos = skip_netbios_name(data, pos).ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::InvalidData, "Invalid question name")
        })?;
        pos += 4; // Skip QTYPE and QCLASS
    }

    // Now parse Answer section
    let ancount = u16::from_be_bytes([data[6], data[7]]) as usize;
    if ancount == 0 {
        return Ok(Vec::new());
    }

    // Skip answer name
    pos = skip_netbios_name(data, pos).ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidData, "Invalid answer name")
    })?;

    // Skip TYPE(2) + CLASS(2) + TTL(4)
    pos += 8;

    if pos + 2 > data.len() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Response truncated at RDLENGTH",
        ));
    }

    // RDLENGTH
    let rdlength = u16::from_be_bytes([data[pos], data[pos + 1]]) as usize;
    pos += 2;

    if pos + rdlength > data.len() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Response truncated at RDATA",
        ));
    }

    // Number of names (first byte of RDATA)
    let num_names = data[pos] as usize;
    pos += 1;

    let mut names = Vec::with_capacity(num_names);

    for _ in 0..num_names {
        if pos + 18 > data.len() {
            break;
        }

        // Name (15 bytes, space-padded ASCII)
        let name_bytes = &data[pos..pos + 15];

        // Filter out non-printable characters and trim spaces
        let name: String = name_bytes
            .iter()
            .filter(|&&b| b >= 0x20 && b < 0x7F) // Printable ASCII only
            .map(|&b| b as char)
            .collect::<String>()
            .trim_end()
            .to_string();

        // Suffix (1 byte) - name type
        let name_type = data[pos + 15];

        // Flags (2 bytes) - bit 15 (MSB) is group flag
        let flags = u16::from_be_bytes([data[pos + 16], data[pos + 17]]);
        let is_group = (flags & 0x8000) != 0;

        if !name.is_empty() {
            names.push(NetbiosName {
                name,
                name_type,
                is_group,
            });
        }

        pos += 18;
    }

    Ok(names)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_request() {
        let request = build_node_status_request();
        // Should be 50 bytes
        assert_eq!(request.len(), 50);
        // Question count should be 1
        assert_eq!(request[4], 0);
        assert_eq!(request[5], 1);
    }
}
