//! DNS PTR reverse-lookup helpers shared by the discovery coordinator.

use std::net::IpAddr;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Semaphore;
use tokio::time::timeout;

/// Resolve hostname via DNS PTR (reverse lookup) for a single IP
pub(super) async fn resolve_dns_ptr(ip: IpAddr) -> Option<String> {
    use hickory_resolver::proto::rr::RData;
    use hickory_resolver::Resolver;

    // Create resolver with system configuration
    let resolver = Resolver::builder_tokio().ok()?.build().ok()?;

    // Perform reverse lookup
    let response = resolver.reverse_lookup(ip).await.ok()?;

    // Get the first PTR record and clean up the hostname
    response.answers().iter().find_map(|record| {
        if let RData::PTR(ptr) = &record.data {
            let hostname = ptr.to_string();
            Some(hostname.strip_suffix('.').unwrap_or(&hostname).to_string())
        } else {
            None
        }
    })
}

/// Resolve DNS PTR names for multiple IPs concurrently
pub(super) async fn resolve_dns_ptr_batch(
    ips: &[IpAddr],
    timeout_duration: Duration,
    concurrency: usize,
) -> std::collections::HashMap<String, String> {
    let semaphore = Arc::new(Semaphore::new(concurrency));
    let mut handles = Vec::new();

    for &ip in ips {
        let sem = Arc::clone(&semaphore);
        let timeout_dur = timeout_duration;

        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;

            // Apply timeout to DNS lookup
            let result = timeout(timeout_dur, resolve_dns_ptr(ip)).await.ok()?;

            result.map(|name| (ip.to_string(), name))
        }));
    }

    let mut results = std::collections::HashMap::new();
    for handle in handles {
        if let Ok(Some((ip, name))) = handle.await {
            results.insert(ip, name);
        }
    }

    results
}
