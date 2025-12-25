//! Network scanner implementation

use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr, ToSocketAddrs};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use ipnetwork::IpNetwork;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::{broadcast, Semaphore};
use tokio::time::timeout;

use super::netbios::resolve_netbios_name;
use super::ports::{
    get_service_name, parse_port_range, DATABASE_PORTS, QUICK_SCAN_PORTS, WEB_PORTS,
};
use super::types::{
    HostResult, HostnameResolutionOptions, PortInfo, PortPreset, PortState, ScanMode, ScanProgress,
    ScanRequest, ScanResults,
};

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

/// Run a network scan
pub async fn run_scan(
    request: ScanRequest,
    app: AppHandle,
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
    let _ = app.emit(
        "network-scan-progress",
        ScanProgress::Started {
            total_hosts,
            total_ports,
        },
    );

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

            let _ = app.emit(
                "network-scan-progress",
                ScanProgress::HostDiscovered {
                    host: host_result.clone(),
                },
            );

            results.push(host_result);
        }

        // Update progress after host discovery
        let scanned = scanned_hosts.fetch_add(1, Ordering::SeqCst) + 1;
        #[allow(clippy::cast_precision_loss)]
        let percentage = (scanned as f32 / total_hosts as f32) * 100.0;

        let _ = app.emit(
            "network-scan-progress",
            ScanProgress::Progress {
                scanned_hosts: scanned,
                total_hosts,
                percentage,
                current_ip: next_ip,
                discovered_hosts: results.len() as u32,
                discovered_ports: total_discovered_ports,
            },
        );
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
    let _ = app.emit(
        "network-scan-progress",
        ScanProgress::Completed {
            results: scan_results.clone(),
        },
    );

    Ok(scan_results)
}

/// Parse target string into list of IP addresses
fn parse_targets(target: &str) -> Result<Vec<IpAddr>, String> {
    let target = target.trim();

    // Try parsing as CIDR
    if target.contains('/') {
        let network: IpNetwork = target
            .parse()
            .map_err(|e| format!("Invalid CIDR notation: {e}"))?;
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

    let mut port_results: HashMap<u16, (PortState, Option<String>)> = HashMap::new();

    for handle in handles {
        if let Ok(Some((port, result))) = handle.await {
            if let Some((state, banner)) = result {
                if state == PortState::Open {
                    port_results.insert(port, (state, banner));
                }
            }
        }
    }

    // Convert to sorted PortInfo list
    let mut open_ports: Vec<PortInfo> = port_results
        .into_iter()
        .map(|(port, (state, banner))| PortInfo {
            port,
            state,
            service: get_service_name(port).map(String::from),
            banner,
        })
        .collect();

    open_ports.sort_by_key(|p| p.port);
    open_ports
}

/// Scan a single port
async fn scan_port(
    addr: SocketAddr,
    timeout_duration: Duration,
) -> Option<(PortState, Option<String>)> {
    match timeout(timeout_duration, TcpStream::connect(addr)).await {
        Ok(Ok(stream)) => {
            // Port is open, try banner grabbing
            let banner = grab_banner(stream, timeout_duration).await;
            Some((PortState::Open, banner))
        }
        Ok(Err(_)) => {
            // Connection refused = closed
            Some((PortState::Closed, None))
        }
        Err(_) => {
            // Timeout = filtered
            Some((PortState::Filtered, None))
        }
    }
}

/// Try to grab a banner from an open port
async fn grab_banner(stream: TcpStream, timeout_duration: Duration) -> Option<String> {
    // Only attempt banner grabbing for specific ports
    let port = stream.peer_addr().ok()?.port();

    // HTTP/HTTPS ports - send HTTP request
    if matches!(port, 80 | 8080 | 8000 | 8888) {
        return grab_http_banner(stream, timeout_duration).await;
    }

    // For other ports, try to read initial banner
    grab_raw_banner(stream, timeout_duration).await
}

/// Grab HTTP banner
async fn grab_http_banner(mut stream: TcpStream, timeout_duration: Duration) -> Option<String> {
    let request = "HEAD / HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n";

    if stream.write_all(request.as_bytes()).await.is_err() {
        return None;
    }

    let mut reader = BufReader::new(stream);
    let mut first_line = String::new();

    match timeout(timeout_duration, reader.read_line(&mut first_line)).await {
        Ok(Ok(_)) => {
            let banner = first_line.trim().to_string();
            if banner.is_empty() {
                None
            } else {
                Some(banner)
            }
        }
        _ => None,
    }
}

/// Grab raw banner (for SSH, FTP, etc.)
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
