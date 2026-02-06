//! Network scanner implementation

use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr, ToSocketAddrs};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use ipnetwork::IpNetwork;
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{ClientConfig, DigitallySignedStruct, SignatureScheme};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::{broadcast, Semaphore};
use tokio::time::timeout;
use tokio_rustls::TlsConnector;

use super::netbios::resolve_netbios_name;
use super::ports::{
    get_service_name, parse_port_range, DATABASE_PORTS, QUICK_SCAN_PORTS, WEB_PORTS,
};
use super::types::{
    HostResult, HostnameResolutionOptions, PortInfo, PortPreset, PortState, ScanMode, ScanProgress,
    ScanProgressSink, ScanRequest, ScanResults, TlsCertInfo,
};

// =============================================================================
// TLS Certificate Verification (accept-all for inspection)
// =============================================================================

/// TLS certificate verifier that accepts all certificates for inspection purposes.
/// Used only during port scanning to extract certificate information.
#[derive(Debug)]
struct AcceptAllVerifier;

impl ServerCertVerifier for AcceptAllVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        rustls::crypto::ring::default_provider()
            .signature_verification_algorithms
            .supported_schemes()
    }
}

// =============================================================================
// Port Classification
// =============================================================================

const fn is_tls_port(port: u16) -> bool {
    matches!(port, 443 | 636 | 853 | 993 | 995 | 8443 | 9443)
}

const fn is_http_port(port: u16) -> bool {
    matches!(port, 80 | 8080 | 8000 | 8888)
}

// =============================================================================
// Scan State
// =============================================================================

/// Scan state for managing cancellation
pub struct ScanState {
    /// Cancel signal sender
    pub cancel_tx: broadcast::Sender<()>,
    /// Whether scan is cancelled
    pub cancelled: AtomicBool,
}

impl ScanState {
    /// Create a new scan state
    pub fn new() -> (Self, broadcast::Receiver<()>) {
        let (cancel_tx, cancel_rx) = broadcast::channel(1);
        (
            Self {
                cancel_tx,
                cancelled: AtomicBool::new(false),
            },
            cancel_rx,
        )
    }

    /// Cancel the scan
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
        let _ = self.cancel_tx.send(());
    }

    /// Check if cancelled
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }
}

// =============================================================================
// Main Scan Logic
// =============================================================================

/// Run a network scan
pub async fn run_scan(
    request: ScanRequest,
    progress_sink: &dyn ScanProgressSink,
    scan_state: Arc<ScanState>,
) -> Result<ScanResults, String> {
    let start_time = Instant::now();
    let start_time_str = chrono_format_now();

    // Parse targets (IPs from CIDR or single IP/hostname)
    let targets = parse_targets(&request.target)?;
    let total_hosts = targets.len() as u32;

    // Resolve ports based on mode and preset
    let ports = resolve_ports(&request)?;
    let total_ports = ports.len() as u32;

    // Emit started event
    let _ = progress_sink.emit(ScanProgress::Started {
        total_hosts,
        total_ports,
    });

    // Scan configuration
    let timeout_duration = Duration::from_millis(u64::from(request.timeout_ms));
    let semaphore = Arc::new(Semaphore::new(request.concurrency as usize));

    // Scan state
    let scanned_hosts = Arc::new(AtomicU32::new(0));
    let mut results: Vec<HostResult> = Vec::new();
    let mut total_discovered_ports: u32 = 0;

    // Scan each host
    for (index, target_ip) in targets.iter().enumerate() {
        if scan_state.is_cancelled() {
            return Err("Scan cancelled".to_string());
        }

        let host_start = Instant::now();
        let ip_str = target_ip.to_string();

        // Get next IP for preview (if available)
        let next_ip = targets.get(index + 1).map(ToString::to_string);

        // Resolve hostname if requested
        let hostname = resolve_hostname_with_options(target_ip, &request.resolution).await;

        // Scan all ports for this host
        let open_ports = scan_host_ports(
            *target_ip,
            &ports,
            timeout_duration,
            Arc::clone(&semaphore),
            Arc::clone(&scan_state),
        )
        .await;

        // If we found open ports, emit host discovered event first (before progress)
        if !open_ports.is_empty() {
            total_discovered_ports += open_ports.len() as u32;

            let host_result = HostResult {
                ip: ip_str.clone(),
                hostname: hostname.clone(),
                ports: open_ports.clone(),
                scan_duration_ms: host_start.elapsed().as_millis() as u64,
            };

            let _ = progress_sink.emit(ScanProgress::HostDiscovered {
                host: host_result.clone(),
            });

            results.push(host_result);
        }

        // Update progress after host discovery
        let scanned = scanned_hosts.fetch_add(1, Ordering::SeqCst) + 1;
        #[allow(clippy::cast_precision_loss)]
        let percentage = (scanned as f32 / total_hosts as f32) * 100.0;

        let _ = progress_sink.emit(ScanProgress::Progress {
            scanned_hosts: scanned,
            total_hosts,
            percentage,
            current_ip: next_ip,
            discovered_hosts: results.len() as u32,
            discovered_ports: total_discovered_ports,
        });
    }

    let end_time_str = chrono_format_now();
    let scan_duration_ms = start_time.elapsed().as_millis() as u64;

    let total_open_ports: usize = results.iter().map(|h| h.ports.len()).sum();

    let scan_results = ScanResults {
        hosts: results.clone(),
        total_hosts_scanned: total_hosts,
        hosts_with_open_ports: results.len() as u32,
        total_open_ports: total_open_ports as u32,
        scan_duration_ms,
        start_time: start_time_str,
        end_time: end_time_str,
    };

    // Emit completed event
    let _ = progress_sink.emit(ScanProgress::Completed {
        results: scan_results.clone(),
    });

    Ok(scan_results)
}

// =============================================================================
// Target & Port Parsing
// =============================================================================

/// Parse target string into list of IP addresses
fn parse_targets(target: &str) -> Result<Vec<IpAddr>, String> {
    let target = target.trim();

    // Try parsing as CIDR
    if target.contains('/') {
        let network: IpNetwork = target
            .parse()
            .map_err(|e| format!("Invalid CIDR notation: {e}"))?;

        // For IPv4 networks with prefix < 31, exclude network and broadcast addresses
        if let IpNetwork::V4(v4net) = network {
            if v4net.prefix() < 31 {
                let network_addr = IpAddr::V4(v4net.network());
                let broadcast_addr = IpAddr::V4(v4net.broadcast());
                return Ok(network
                    .iter()
                    .filter(|ip| *ip != network_addr && *ip != broadcast_addr)
                    .collect());
            }
        }
        return Ok(network.iter().collect());
    }

    // Try parsing as IP address
    if let Ok(ip) = target.parse::<IpAddr>() {
        return Ok(vec![ip]);
    }

    // Try resolving as hostname
    let socket_addr = format!("{target}:0");
    match socket_addr.to_socket_addrs() {
        Ok(mut addrs) => {
            if let Some(addr) = addrs.next() {
                Ok(vec![addr.ip()])
            } else {
                Err(format!("Could not resolve hostname: {target}"))
            }
        }
        Err(e) => Err(format!("Could not resolve hostname: {e}")),
    }
}

/// Resolve ports based on scan mode and preset
fn resolve_ports(request: &ScanRequest) -> Result<Vec<u16>, String> {
    match request.mode {
        ScanMode::Quick => Ok(QUICK_SCAN_PORTS.to_vec()),
        ScanMode::Full => Ok((1..=65535).collect()),
        ScanMode::Custom => {
            if let Some(ref range) = request.port_range {
                parse_port_range(range)
            } else {
                // Fall back to preset
                match request.port_preset {
                    PortPreset::WellKnown => Ok((1..=1024).collect()),
                    PortPreset::Web => Ok(WEB_PORTS.to_vec()),
                    PortPreset::Database => Ok(DATABASE_PORTS.to_vec()),
                    PortPreset::Custom => Err("Custom preset requires port_range".to_string()),
                }
            }
        }
    }
}

// =============================================================================
// Port Scanning
// =============================================================================

/// Scan all ports on a single host
async fn scan_host_ports(
    ip: IpAddr,
    ports: &[u16],
    timeout_duration: Duration,
    semaphore: Arc<Semaphore>,
    scan_state: Arc<ScanState>,
) -> Vec<PortInfo> {
    let mut handles = Vec::with_capacity(ports.len());

    for &port in ports {
        let sem = Arc::clone(&semaphore);
        let state = Arc::clone(&scan_state);
        let addr = SocketAddr::new(ip, port);

        let handle = tokio::spawn(async move {
            if state.is_cancelled() {
                return None;
            }

            let _permit = sem.acquire().await.ok()?;

            if state.is_cancelled() {
                return None;
            }

            let result = scan_port(addr, timeout_duration).await;
            Some((port, result))
        });

        handles.push(handle);
    }

    let mut port_results: HashMap<u16, (PortState, Option<String>, Option<TlsCertInfo>)> =
        HashMap::new();

    for handle in handles {
        if let Ok(Some((port, result))) = handle.await {
            if let Some((state, banner, tls_cert)) = result {
                if state == PortState::Open {
                    port_results.insert(port, (state, banner, tls_cert));
                }
            }
        }
    }

    // Convert to sorted PortInfo list
    let mut open_ports: Vec<PortInfo> = port_results
        .into_iter()
        .map(|(port, (state, banner, tls_cert))| PortInfo {
            port,
            state,
            service: get_service_name(port).map(String::from),
            banner,
            tls_cert,
        })
        .collect();

    open_ports.sort_by_key(|p| p.port);
    open_ports
}

/// Scan a single port with banner grabbing and optional TLS cert extraction
async fn scan_port(
    addr: SocketAddr,
    timeout_duration: Duration,
) -> Option<(PortState, Option<String>, Option<TlsCertInfo>)> {
    let start = Instant::now();

    match timeout(timeout_duration, TcpStream::connect(addr)).await {
        Ok(Ok(stream)) => {
            // Port is open, try banner grabbing with remaining time budget
            let remaining = timeout_duration.saturating_sub(start.elapsed());
            let remaining = remaining.max(Duration::from_millis(200));
            let (banner, tls_cert) = grab_banner_and_tls(stream, remaining).await;
            Some((PortState::Open, banner, tls_cert))
        }
        Ok(Err(_)) => {
            // Connection refused = closed
            Some((PortState::Closed, None, None))
        }
        Err(_) => {
            // Timeout = filtered
            Some((PortState::Filtered, None, None))
        }
    }
}

// =============================================================================
// Banner Grabbing & TLS Inspection
// =============================================================================

/// Grab banner and optionally extract TLS certificate info
async fn grab_banner_and_tls(
    stream: TcpStream,
    timeout_duration: Duration,
) -> (Option<String>, Option<TlsCertInfo>) {
    let port = match stream.peer_addr() {
        Ok(addr) => addr.port(),
        Err(_) => return (None, None),
    };

    // TLS ports: do TLS handshake + cert extraction + HTTP over TLS
    if is_tls_port(port) {
        return grab_tls_info(stream, timeout_duration).await;
    }

    // Plain HTTP ports: send HTTP request and parse Server header
    if is_http_port(port) {
        let banner = grab_http_banner(stream, timeout_duration).await;
        return (banner, None);
    }

    // RTSP port: send RTSP OPTIONS request
    if port == 554 {
        let banner = grab_rtsp_banner(stream, timeout_duration).await;
        return (banner, None);
    }

    // Other ports: try to read initial banner (SSH, FTP, SMTP, etc.)
    let banner = grab_raw_banner(stream, timeout_duration).await;
    (banner, None)
}

/// Perform TLS handshake, extract certificate info, and grab HTTP banner over TLS
async fn grab_tls_info(
    stream: TcpStream,
    timeout_duration: Duration,
) -> (Option<String>, Option<TlsCertInfo>) {
    let addr = match stream.peer_addr() {
        Ok(a) => a,
        Err(_) => return (None, None),
    };

    // Build TLS config with accept-all verifier
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let config =
        match ClientConfig::builder_with_provider(provider).with_safe_default_protocol_versions() {
            Ok(builder) => builder
                .dangerous()
                .with_custom_certificate_verifier(Arc::new(AcceptAllVerifier))
                .with_no_client_auth(),
            Err(_) => return (None, None),
        };

    let connector = TlsConnector::from(Arc::new(config));

    // Use IP address as server name (we're scanning by IP, not hostname)
    let ip_addr = rustls::pki_types::IpAddr::from(addr.ip());
    let server_name = ServerName::from(ip_addr);

    // TLS handshake with timeout
    let tls_stream = match timeout(timeout_duration, connector.connect(server_name, stream)).await {
        Ok(Ok(s)) => s,
        _ => return (None, None),
    };

    // Extract certificate info from the connection
    let tls_cert = tls_stream
        .get_ref()
        .1
        .peer_certificates()
        .and_then(|certs| certs.first())
        .and_then(|cert| parse_x509_cert(cert.as_ref()));

    // Try to grab HTTP banner over TLS
    let banner = grab_http_banner_tls(tls_stream, timeout_duration).await;

    (banner, tls_cert)
}

/// Parse X.509 certificate DER bytes to extract key information
fn parse_x509_cert(der: &[u8]) -> Option<TlsCertInfo> {
    let (_, cert) = x509_parser::parse_x509_certificate(der).ok()?;

    // Extract Common Name from subject
    let common_name = cert
        .subject()
        .iter_common_name()
        .next()
        .and_then(|cn| cn.as_str().ok())
        .map(String::from);

    // Extract Subject Alternative Names
    let subject_alt_names = cert
        .subject_alternative_name()
        .ok()
        .flatten()
        .map(|san| {
            san.value
                .general_names
                .iter()
                .filter_map(|name| match name {
                    x509_parser::extensions::GeneralName::DNSName(dns) => Some((*dns).to_string()),
                    x509_parser::extensions::GeneralName::IPAddress(ip_bytes) => {
                        match ip_bytes.len() {
                            4 => Some(format!(
                                "{}.{}.{}.{}",
                                ip_bytes[0], ip_bytes[1], ip_bytes[2], ip_bytes[3]
                            )),
                            16 => {
                                let addr =
                                    std::net::Ipv6Addr::from(<[u8; 16]>::try_from(*ip_bytes).ok()?);
                                Some(addr.to_string())
                            }
                            _ => None,
                        }
                    }
                    _ => None,
                })
                .collect()
        })
        .unwrap_or_default();

    // Extract issuer CN
    let issuer = cert
        .issuer()
        .iter_common_name()
        .next()
        .and_then(|cn| cn.as_str().ok())
        .map(String::from);

    // Self-signed check: subject == issuer
    let is_self_signed = cert.subject() == cert.issuer();

    Some(TlsCertInfo {
        common_name,
        subject_alt_names,
        issuer,
        is_self_signed,
    })
}

/// Grab HTTP banner by sending HEAD request and extracting Server header
async fn grab_http_banner(mut stream: TcpStream, timeout_duration: Duration) -> Option<String> {
    let host = stream.peer_addr().ok()?.ip().to_string();
    let request = format!("HEAD / HTTP/1.0\r\nHost: {host}\r\nConnection: close\r\n\r\n");

    stream.write_all(request.as_bytes()).await.ok()?;
    extract_server_header(stream, timeout_duration).await
}

/// Grab HTTP banner over an established TLS connection
async fn grab_http_banner_tls(
    mut stream: tokio_rustls::client::TlsStream<TcpStream>,
    timeout_duration: Duration,
) -> Option<String> {
    let host = stream.get_ref().0.peer_addr().ok()?.ip().to_string();
    let request = format!("HEAD / HTTP/1.0\r\nHost: {host}\r\nConnection: close\r\n\r\n");

    stream.write_all(request.as_bytes()).await.ok()?;
    extract_server_header(stream, timeout_duration).await
}

/// Read HTTP response headers and extract Server header value
async fn extract_server_header<R: tokio::io::AsyncRead + Unpin>(
    reader: R,
    timeout_duration: Duration,
) -> Option<String> {
    let mut reader = BufReader::new(reader);
    let mut status_line: Option<String> = None;
    let mut server: Option<String> = None;

    // Read up to 20 header lines
    for _ in 0..20 {
        let mut line = String::new();
        match timeout(timeout_duration, reader.read_line(&mut line)).await {
            Ok(Ok(0)) => break,
            Ok(Ok(_)) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    break;
                }
                if status_line.is_none() {
                    status_line = Some(trimmed.to_string());
                } else {
                    let lower = trimmed.to_ascii_lowercase();
                    if lower.starts_with("server:") {
                        server = Some(trimmed[7..].trim().to_string());
                    }
                }
            }
            _ => break,
        }
    }

    // Prefer Server header, fall back to status line
    server.or(status_line)
}

/// Grab RTSP banner by sending OPTIONS request
async fn grab_rtsp_banner(mut stream: TcpStream, timeout_duration: Duration) -> Option<String> {
    let addr = stream.peer_addr().ok()?;
    let request = format!(
        "OPTIONS rtsp://{}:{} RTSP/1.0\r\nCSeq: 1\r\n\r\n",
        addr.ip(),
        addr.port()
    );
    stream.write_all(request.as_bytes()).await.ok()?;
    extract_server_header(stream, timeout_duration).await
}

/// Grab raw banner (for SSH, FTP, SMTP, etc. that send banner on connect)
async fn grab_raw_banner(stream: TcpStream, timeout_duration: Duration) -> Option<String> {
    let mut reader = BufReader::new(stream);
    let mut banner = String::new();

    match timeout(timeout_duration, reader.read_line(&mut banner)).await {
        Ok(Ok(_)) => {
            let banner = banner.trim().to_string();
            if banner.is_empty() {
                None
            } else {
                // Limit banner length
                Some(banner.chars().take(200).collect())
            }
        }
        _ => None,
    }
}

// =============================================================================
// Hostname Resolution
// =============================================================================

/// Resolve IP to hostname using configured methods
async fn resolve_hostname_with_options(
    ip: &IpAddr,
    options: &Option<HostnameResolutionOptions>,
) -> Option<String> {
    let opts = options.as_ref().cloned().unwrap_or_default();
    let timeout_duration = Duration::from_millis(u64::from(opts.timeout_ms));

    // Skip if all methods disabled
    if !opts.dns && !opts.mdns && !opts.netbios {
        return None;
    }

    let ip_owned = *ip;

    // Try each method in order of reliability
    // 1. DNS reverse lookup (most reliable for internet hosts)
    if opts.dns {
        if let Some(name) = resolve_dns(ip_owned, timeout_duration).await {
            return Some(name);
        }
    }

    // 2. mDNS resolution (for .local hosts)
    if opts.mdns {
        if let Some(name) = resolve_mdns(ip_owned, timeout_duration).await {
            return Some(name);
        }
    }

    // 3. NetBIOS resolution (for Windows hosts)
    if opts.netbios {
        if let Some(name) = resolve_netbios(ip_owned, timeout_duration).await {
            return Some(name);
        }
    }

    None
}

/// Resolve IP to hostname via DNS reverse lookup (PTR record)
async fn resolve_dns(ip: IpAddr, timeout_duration: Duration) -> Option<String> {
    let ip_str = ip.to_string();

    let result = tokio::time::timeout(
        timeout_duration,
        tokio::task::spawn_blocking(move || dns_lookup::lookup_addr(&ip_str.parse().ok()?).ok()),
    )
    .await;

    match result {
        Ok(Ok(name)) => name,
        _ => None,
    }
}

/// Resolve IP to hostname via mDNS (for .local addresses)
async fn resolve_mdns(ip: IpAddr, timeout_duration: Duration) -> Option<String> {
    // mDNS is typically used for .local names
    // For now, we try a simple reverse lookup which may work for some mDNS responders
    let ip_str = ip.to_string();

    let result = tokio::time::timeout(
        timeout_duration,
        tokio::task::spawn_blocking(move || {
            // Try to resolve using the system resolver which may include mDNS
            dns_lookup::lookup_addr(&ip_str.parse().ok()?).ok()
        }),
    )
    .await;

    match result {
        Ok(Ok(Some(name))) if name.ends_with(".local") => Some(name),
        _ => None,
    }
}

/// Resolve IP to hostname via NetBIOS Name Service
async fn resolve_netbios(ip: IpAddr, timeout_duration: Duration) -> Option<String> {
    tokio::task::spawn_blocking(move || resolve_netbios_name(ip, timeout_duration))
        .await
        .ok()
        .flatten()
}

// =============================================================================
// Time Utilities
// =============================================================================

/// Get current time as ISO 8601 string
fn chrono_format_now() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now();
    let duration = now
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    let nanos = duration.subsec_nanos();

    // Simple ISO 8601 format without chrono crate
    let (year, month, day, hour, min, sec) = timestamp_to_datetime(secs);
    format!(
        "{year:04}-{month:02}-{day:02}T{hour:02}:{min:02}:{sec:02}.{:03}Z",
        nanos / 1_000_000
    )
}

/// Convert Unix timestamp to datetime components
fn timestamp_to_datetime(timestamp: u64) -> (u32, u32, u32, u32, u32, u32) {
    const SECS_PER_MIN: u64 = 60;
    const SECS_PER_HOUR: u64 = 3600;
    const SECS_PER_DAY: u64 = 86400;

    let days = timestamp / SECS_PER_DAY;
    let remaining = timestamp % SECS_PER_DAY;

    let hour = (remaining / SECS_PER_HOUR) as u32;
    let min = ((remaining % SECS_PER_HOUR) / SECS_PER_MIN) as u32;
    let sec = (remaining % SECS_PER_MIN) as u32;

    // Calculate year, month, day from days since epoch
    let (year, month, day) = days_to_ymd(days);

    (year, month, day, hour, min, sec)
}

/// Convert days since Unix epoch to year, month, day
fn days_to_ymd(days: u64) -> (u32, u32, u32) {
    // Simplified calculation
    let mut remaining_days = days as i64;
    let mut year = 1970u32;

    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }

    let leap = is_leap_year(year);
    let days_in_months: [i64; 12] = if leap {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 1u32;
    for days_in_month in days_in_months {
        if remaining_days < days_in_month {
            break;
        }
        remaining_days -= days_in_month;
        month += 1;
    }

    let day = remaining_days as u32 + 1;
    (year, month, day)
}

/// Check if a year is a leap year
const fn is_leap_year(year: u32) -> bool {
    (year.is_multiple_of(4) && !year.is_multiple_of(100)) || year.is_multiple_of(400)
}
