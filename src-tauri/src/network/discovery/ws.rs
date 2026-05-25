//! Discovery-layer wrapper around the WS-Discovery SOAP probe.
//!
//! The real probe implementation lives in the sibling `ws_discovery` module.

use std::time::Duration;

use super::super::ws_discovery;
use super::types::{DiscoveryOptions, DiscoveryResult, HostMetadata};

/// Discover hosts using WS-Discovery SOAP Probe
pub(super) async fn ws_discovery_method(options: &DiscoveryOptions) -> DiscoveryResult {
    let start = std::time::Instant::now();
    let timeout_duration = Duration::from_millis(u64::from(options.timeout_ms.max(3000)));

    let results = Box::pin(ws_discovery::ws_discovery_probe(timeout_duration)).await;

    let hosts: Vec<String> = results.keys().cloned().collect();
    let host_metadata: std::collections::HashMap<String, HostMetadata> = results
        .into_iter()
        .map(|(ip, info)| {
            (
                ip,
                HostMetadata {
                    ws_discovery: Some(info),
                    ..Default::default()
                },
            )
        })
        .collect();

    DiscoveryResult {
        method: "ws_discovery".to_string(),
        hosts,
        hostnames: std::collections::HashMap::new(),
        host_metadata,
        unreachable: vec![],
        duration_ms: start.elapsed().as_millis() as u64,
        error: None,
        requires_privileges: false,
    }
}
