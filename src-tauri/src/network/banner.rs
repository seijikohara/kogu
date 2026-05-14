//! TCP banner-grab helpers for discovery
//!
//! Probes well-known service ports for a short identifying response and
//! returns a [`ServiceBanner`] when the bytes look like a recognizable
//! protocol greeting. All reads are bounded to 500 ms and 256 bytes to
//! keep discovery cheap.

use std::time::Duration;

use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;

/// Maximum bytes to read for a single banner attempt
const BANNER_READ_LIMIT: usize = 256;

/// Per-banner read/write timeout
const BANNER_TIMEOUT: Duration = Duration::from_millis(500);

/// Service banner gathered via TCP banner-grab
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceBanner {
    /// Detected protocol name (e.g. "ssh", "http", "smtp", "redis", "ftp")
    pub protocol: String,
    /// Parsed product/version string when extractable
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// Truncated raw banner bytes for display (lossy UTF-8, single-line)
    pub raw: String,
}

/// Read at most `BANNER_READ_LIMIT` bytes within `BANNER_TIMEOUT`
async fn read_passive(stream: &mut TcpStream) -> Option<Vec<u8>> {
    let mut buf = vec![0u8; BANNER_READ_LIMIT];
    match timeout(BANNER_TIMEOUT, stream.read(&mut buf)).await {
        Ok(Ok(n)) if n > 0 => {
            buf.truncate(n);
            Some(buf)
        }
        _ => None,
    }
}

/// Write a request then read up to `BANNER_READ_LIMIT` bytes back
async fn request_response(stream: &mut TcpStream, request: &[u8]) -> Option<Vec<u8>> {
    timeout(BANNER_TIMEOUT, stream.write_all(request))
        .await
        .ok()?
        .ok()?;
    read_passive(stream).await
}

/// Render the first line of a raw byte buffer as a printable string
fn render_first_line(bytes: &[u8]) -> String {
    let text = String::from_utf8_lossy(bytes);
    let first = text.lines().next().unwrap_or("").trim();
    first.chars().take(BANNER_READ_LIMIT).collect()
}

/// Attempt to attach a banner to a freshly-connected TCP stream.
///
/// Dispatches on `port` to choose the right probe. Returns `None` for
/// unsupported ports or when the peer does not respond within the
/// banner-grab budget.
pub async fn grab_banner(mut stream: TcpStream, port: u16) -> Option<ServiceBanner> {
    let ip = stream.peer_addr().ok()?.ip();
    match port {
        22 => parse_ssh_banner(read_passive(&mut stream).await?.as_slice()),
        21 => parse_ftp_banner(read_passive(&mut stream).await?.as_slice()),
        23 => parse_telnet_banner(read_passive(&mut stream).await?.as_slice()),
        25 | 587 => parse_smtp_banner(read_passive(&mut stream).await?.as_slice()),
        80 | 8080 | 443 | 8443 => {
            let request = format!("HEAD / HTTP/1.0\r\nHost: {ip}\r\nConnection: close\r\n\r\n");
            let bytes = request_response(&mut stream, request.as_bytes()).await?;
            parse_http_banner(&bytes)
        }
        6379 => {
            let bytes = request_response(&mut stream, b"INFO\r\n").await?;
            parse_redis_banner(&bytes)
        }
        11211 => {
            let bytes = request_response(&mut stream, b"version\r\n").await?;
            parse_memcached_banner(&bytes)
        }
        _ => None,
    }
}

/// Parse an SSH greeting (`SSH-<proto>-<software>[ <comments>]`)
pub fn parse_ssh_banner(bytes: &[u8]) -> Option<ServiceBanner> {
    let raw = render_first_line(bytes);
    let rest = raw.strip_prefix("SSH-")?;
    // SSH-2.0-OpenSSH_8.6p1 or SSH-1.99-Foo
    let mut parts = rest.splitn(2, '-');
    let _proto = parts.next()?;
    let software = parts.next().unwrap_or("").trim();
    let version = if software.is_empty() {
        None
    } else {
        Some(
            software
                .split_whitespace()
                .next()
                .unwrap_or(software)
                .to_string(),
        )
    };
    Some(ServiceBanner {
        protocol: "ssh".to_string(),
        version,
        raw,
    })
}

/// Parse an FTP greeting (`220 <text>`)
pub fn parse_ftp_banner(bytes: &[u8]) -> Option<ServiceBanner> {
    let raw = render_first_line(bytes);
    let rest = raw
        .strip_prefix("220 ")
        .or_else(|| raw.strip_prefix("220-"))?;
    Some(ServiceBanner {
        protocol: "ftp".to_string(),
        version: Some(rest.trim().to_string()).filter(|s| !s.is_empty()),
        raw,
    })
}

/// Telnet rarely speaks plain text; just record any non-empty banner
pub fn parse_telnet_banner(bytes: &[u8]) -> Option<ServiceBanner> {
    let raw = render_first_line(bytes);
    if raw.is_empty() {
        return None;
    }
    Some(ServiceBanner {
        protocol: "telnet".to_string(),
        version: None,
        raw,
    })
}

/// Parse an SMTP greeting (`220 <host> <software>`)
pub fn parse_smtp_banner(bytes: &[u8]) -> Option<ServiceBanner> {
    let raw = render_first_line(bytes);
    let rest = raw
        .strip_prefix("220 ")
        .or_else(|| raw.strip_prefix("220-"))?;
    // Skip the host name and capture the remainder as version hint.
    let mut iter = rest.splitn(2, char::is_whitespace);
    let _host = iter.next()?;
    let software = iter.next().unwrap_or("").trim();
    let version = if software.is_empty() {
        None
    } else {
        Some(software.to_string())
    };
    Some(ServiceBanner {
        protocol: "smtp".to_string(),
        version,
        raw,
    })
}

/// Parse an HTTP response and return the `Server:` header when present
pub fn parse_http_banner(bytes: &[u8]) -> Option<ServiceBanner> {
    let text = String::from_utf8_lossy(bytes);
    let mut lines = text.split("\r\n");
    let status_line = lines.next()?.trim();
    if !status_line.starts_with("HTTP/") {
        return None;
    }
    let server = lines.find_map(|line| {
        let lower = line.to_ascii_lowercase();
        lower
            .strip_prefix("server:")
            .map(|_| line.get("server:".len()..).unwrap_or("").trim().to_string())
    });
    Some(ServiceBanner {
        protocol: "http".to_string(),
        version: server.clone().filter(|s| !s.is_empty()),
        raw: server.unwrap_or_else(|| status_line.to_string()),
    })
}

/// Parse a Redis `INFO` reply, returning the `redis_version` field
pub fn parse_redis_banner(bytes: &[u8]) -> Option<ServiceBanner> {
    let text = String::from_utf8_lossy(bytes);
    let first = text.lines().next().unwrap_or("").trim();
    // Look for "redis_version:<x.y.z>"
    let version = text
        .lines()
        .find_map(|line| line.trim().strip_prefix("redis_version:"))
        .map(|v| v.trim().to_string());
    if version.is_none() && !first.starts_with('$') && !first.starts_with("# Server") {
        return None;
    }
    Some(ServiceBanner {
        protocol: "redis".to_string(),
        version,
        raw: first.chars().take(BANNER_READ_LIMIT).collect(),
    })
}

/// Parse a memcached `version` reply (`VERSION 1.6.21`)
pub fn parse_memcached_banner(bytes: &[u8]) -> Option<ServiceBanner> {
    let raw = render_first_line(bytes);
    let version = raw.strip_prefix("VERSION ").map(|v| v.trim().to_string());
    version.as_ref()?;
    Some(ServiceBanner {
        protocol: "memcached".to_string(),
        version,
        raw,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ssh_banner_extracts_software_version() {
        let banner = parse_ssh_banner(b"SSH-2.0-OpenSSH_8.6p1 Ubuntu-4ubuntu0.1\r\n").unwrap();
        assert_eq!(banner.protocol, "ssh");
        assert_eq!(banner.version.as_deref(), Some("OpenSSH_8.6p1"));
        assert!(banner.raw.starts_with("SSH-2.0-OpenSSH_8.6p1"));
    }

    #[test]
    fn ssh_banner_handles_missing_software() {
        let banner = parse_ssh_banner(b"SSH-1.99-\r\n").unwrap();
        assert_eq!(banner.protocol, "ssh");
        assert!(banner.version.is_none());
    }

    #[test]
    fn ssh_banner_rejects_non_ssh_input() {
        assert!(parse_ssh_banner(b"HTTP/1.1 200 OK\r\n").is_none());
    }

    #[test]
    fn http_banner_extracts_server_header() {
        let bytes = b"HTTP/1.1 200 OK\r\nServer: nginx/1.25.0\r\nContent-Length: 0\r\n\r\n";
        let banner = parse_http_banner(bytes).unwrap();
        assert_eq!(banner.protocol, "http");
        assert_eq!(banner.version.as_deref(), Some("nginx/1.25.0"));
        assert_eq!(banner.raw, "nginx/1.25.0");
    }

    #[test]
    fn http_banner_without_server_header_keeps_status_line() {
        let bytes = b"HTTP/1.0 404 Not Found\r\nContent-Length: 0\r\n\r\n";
        let banner = parse_http_banner(bytes).unwrap();
        assert_eq!(banner.protocol, "http");
        assert!(banner.version.is_none());
        assert_eq!(banner.raw, "HTTP/1.0 404 Not Found");
    }

    #[test]
    fn http_banner_rejects_non_http_input() {
        assert!(parse_http_banner(b"+OK Redis ready\r\n").is_none());
    }

    #[test]
    fn smtp_banner_extracts_software() {
        let bytes = b"220 mail.example.com ESMTP Postfix (Debian/GNU)\r\n";
        let banner = parse_smtp_banner(bytes).unwrap();
        assert_eq!(banner.protocol, "smtp");
        assert_eq!(
            banner.version.as_deref(),
            Some("ESMTP Postfix (Debian/GNU)")
        );
    }

    #[test]
    fn smtp_banner_handles_multiline_prefix() {
        let bytes = b"220-mail.example.com SMTP server ready\r\n";
        let banner = parse_smtp_banner(bytes).unwrap();
        assert_eq!(banner.protocol, "smtp");
        assert_eq!(banner.version.as_deref(), Some("SMTP server ready"));
    }

    #[test]
    fn smtp_banner_rejects_non_220_input() {
        assert!(parse_smtp_banner(b"HELO test\r\n").is_none());
    }

    #[test]
    fn ftp_banner_records_greeting() {
        let banner = parse_ftp_banner(b"220 (vsFTPd 3.0.5)\r\n").unwrap();
        assert_eq!(banner.protocol, "ftp");
        assert_eq!(banner.version.as_deref(), Some("(vsFTPd 3.0.5)"));
    }

    #[test]
    fn redis_banner_parses_version_field() {
        let bytes = b"$3636\r\n# Server\r\nredis_version:7.2.4\r\nos:Linux\r\n";
        let banner = parse_redis_banner(bytes).unwrap();
        assert_eq!(banner.protocol, "redis");
        assert_eq!(banner.version.as_deref(), Some("7.2.4"));
    }

    #[test]
    fn memcached_banner_parses_version() {
        let banner = parse_memcached_banner(b"VERSION 1.6.21\r\n").unwrap();
        assert_eq!(banner.protocol, "memcached");
        assert_eq!(banner.version.as_deref(), Some("1.6.21"));
    }

    #[test]
    fn memcached_banner_rejects_unknown_reply() {
        assert!(parse_memcached_banner(b"ERROR\r\n").is_none());
    }

    #[test]
    fn telnet_banner_records_non_empty_line() {
        let banner = parse_telnet_banner(b"\xffsome login prompt\r\n").unwrap();
        assert_eq!(banner.protocol, "telnet");
        assert!(banner.raw.contains("some login prompt"));
    }

    #[test]
    fn telnet_banner_rejects_empty_input() {
        assert!(parse_telnet_banner(b"").is_none());
    }
}
