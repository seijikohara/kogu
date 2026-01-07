//! Port definitions and service name mappings

/// Well-known port to service name mapping
pub const WELL_KNOWN_SERVICES: &[(u16, &str)] = &[
    (21, "ftp"),
    (22, "ssh"),
    (23, "telnet"),
    (25, "smtp"),
    (53, "dns"),
    (80, "http"),
    (110, "pop3"),
    (111, "rpc"),
    (135, "msrpc"),
    (139, "netbios"),
    (143, "imap"),
    (443, "https"),
    (445, "smb"),
    (465, "smtps"),
    (587, "submission"),
    (993, "imaps"),
    (995, "pop3s"),
    (1433, "mssql"),
    (1521, "oracle"),
    (2049, "nfs"),
    (3306, "mysql"),
    (3389, "rdp"),
    (5432, "postgresql"),
    (5900, "vnc"),
    (5984, "couchdb"),
    (6379, "redis"),
    (8080, "http-alt"),
    (8443, "https-alt"),
    (9200, "elasticsearch"),
    (11211, "memcached"),
    (27017, "mongodb"),
];

/// Quick scan ports - common services
pub const QUICK_SCAN_PORTS: &[u16] = &[
    21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995, 1433, 1521, 3306, 3389,
    5432, 5900, 6379, 8080, 8443, 27017,
];

/// Web service ports
pub const WEB_PORTS: &[u16] = &[80, 443, 3000, 5000, 8000, 8080, 8443, 8888];

/// Database ports
pub const DATABASE_PORTS: &[u16] = &[
    1433,  // MS SQL Server
    1521,  // Oracle
    3306,  // MySQL / MariaDB
    5432,  // PostgreSQL
    5984,  // CouchDB
    6379,  // Redis
    9200,  // Elasticsearch
    11211, // Memcached
    27017, // MongoDB
];

/// Get service name for a port
pub fn get_service_name(port: u16) -> Option<&'static str> {
    WELL_KNOWN_SERVICES
        .iter()
        .find(|(p, _)| *p == port)
        .map(|(_, name)| *name)
}

/// Parse a port range string into a vector of ports
///
/// Supports formats:
/// - Single port: "80"
/// - Range: "1-1024"
/// - List: "80,443,8080"
/// - Mixed: "22,80-100,443"
///
/// # Errors
///
/// Returns an error if the port range is invalid
pub fn parse_port_range(input: &str) -> Result<Vec<u16>, String> {
    let mut ports = Vec::new();

    for part in input.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }

        if part.contains('-') {
            let range_parts: Vec<&str> = part.split('-').collect();
            if range_parts.len() != 2 {
                return Err(format!("Invalid range format: {part}"));
            }

            let start: u16 = range_parts[0]
                .trim()
                .parse()
                .map_err(|_| format!("Invalid port number: {}", range_parts[0]))?;
            let end: u16 = range_parts[1]
                .trim()
                .parse()
                .map_err(|_| format!("Invalid port number: {}", range_parts[1]))?;

            if start > end {
                return Err(format!("Invalid range: {start} > {end}"));
            }

            for port in start..=end {
                if !ports.contains(&port) {
                    ports.push(port);
                }
            }
        } else {
            let port: u16 = part
                .parse()
                .map_err(|_| format!("Invalid port number: {part}"))?;
            if port == 0 {
                return Err("Port 0 is not valid".to_string());
            }
            if !ports.contains(&port) {
                ports.push(port);
            }
        }
    }

    if ports.is_empty() {
        return Err("No valid ports specified".to_string());
    }

    ports.sort_unstable();
    Ok(ports)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_single_port() {
        assert_eq!(parse_port_range("80").unwrap(), vec![80]);
    }

    #[test]
    fn test_parse_port_list() {
        assert_eq!(
            parse_port_range("80,443,8080").unwrap(),
            vec![80, 443, 8080]
        );
    }

    #[test]
    fn test_parse_port_range() {
        assert_eq!(parse_port_range("1-5").unwrap(), vec![1, 2, 3, 4, 5]);
    }

    #[test]
    fn test_parse_mixed() {
        assert_eq!(
            parse_port_range("22, 80-82, 443").unwrap(),
            vec![22, 80, 81, 82, 443]
        );
    }

    #[test]
    fn test_get_service_name() {
        assert_eq!(get_service_name(22), Some("ssh"));
        assert_eq!(get_service_name(80), Some("http"));
        assert_eq!(get_service_name(12345), None);
    }
}
