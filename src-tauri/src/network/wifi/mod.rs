//! Wi-Fi scanning across macOS, Windows, and Linux.
//!
//! Each backend implements a single [`scan`] entry point that returns a
//! `Vec<WifiNetwork>` for the BSSIDs currently visible to the host's
//! wireless radio. The feature is privilege-free; macOS prompts the
//! user for Location Services on first scan, Windows and Linux require
//! no prompt at all.
//!
//! The Tauri commands [`start_wifi_scan`] and [`cancel_wifi_scan`]
//! match the contract of the existing `start_network_scan` /
//! `cancel_network_scan` pair so the frontend feels consistent.

pub mod channels;
pub mod types;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

use std::sync::Arc;

use tauri::ipc::Channel;
use tokio_util::sync::CancellationToken;

pub use types::{WifiBand, WifiError, WifiNetwork, WifiScanEvent, WifiSecurity};

use super::NetworkScannerState;

/// One row in the fixture table consumed by [`fixture_networks`].
#[cfg_attr(not(debug_assertions), allow(dead_code))]
struct FixtureRow {
    bssid: &'static str,
    ssid: Option<&'static str>,
    rssi: i32,
    channel: u16,
    width: u16,
    band: WifiBand,
    security: WifiSecurity,
    is_connected: bool,
}

/// Scan for nearby Wi-Fi access points.
///
/// The `token` is observed cooperatively: the OS-level scan is not
/// cancellable mid-flight, but callers can drop the result by checking
/// the token after the future resolves.
///
/// # Errors
///
/// Returns [`WifiError`] on missing interface, permission denial, or a
/// backend-specific scan failure.
pub async fn scan(token: Arc<CancellationToken>) -> Result<Vec<WifiNetwork>, WifiError> {
    if let Some(fixtures) = fixture_networks() {
        return Ok(fixtures);
    }

    let _ = &token;
    #[cfg(target_os = "macos")]
    {
        macos::scan().await
    }
    #[cfg(target_os = "windows")]
    {
        windows::scan().await
    }
    #[cfg(target_os = "linux")]
    {
        linux::scan().await
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err(WifiError::UnsupportedPlatform)
    }
}

const FIXTURE_ROWS: &[FixtureRow] = {
    use WifiBand::{Band24, Band5, Band6};
    use WifiSecurity::{Open, Wpa, Wpa2, Wpa2Enterprise, Wpa3};
    &[
        FixtureRow {
            bssid: "AA:BB:CC:11:22:33",
            ssid: Some("HomeNet-2G"),
            rssi: -42,
            channel: 6,
            width: 20,
            band: Band24,
            security: Wpa2,
            is_connected: true,
        },
        FixtureRow {
            bssid: "AA:BB:CC:11:22:34",
            ssid: Some("HomeNet-5G"),
            rssi: -47,
            channel: 36,
            width: 80,
            band: Band5,
            security: Wpa2,
            is_connected: false,
        },
        FixtureRow {
            bssid: "AA:BB:CC:11:22:35",
            ssid: Some("HomeNet-6G"),
            rssi: -52,
            channel: 5,
            width: 160,
            band: Band6,
            security: Wpa3,
            is_connected: false,
        },
        FixtureRow {
            bssid: "00:11:22:33:44:55",
            ssid: Some("CafeWiFi"),
            rssi: -68,
            channel: 11,
            width: 20,
            band: Band24,
            security: Open,
            is_connected: false,
        },
        FixtureRow {
            bssid: "DE:AD:BE:EF:00:01",
            ssid: Some("Office-Guest"),
            rssi: -73,
            channel: 44,
            width: 40,
            band: Band5,
            security: Wpa2Enterprise,
            is_connected: false,
        },
        FixtureRow {
            bssid: "DE:AD:BE:EF:00:02",
            ssid: None,
            rssi: -78,
            channel: 149,
            width: 80,
            band: Band5,
            security: Wpa3,
            is_connected: false,
        },
        FixtureRow {
            bssid: "F0:F0:F0:F0:F0:F0",
            ssid: Some("Neighbor"),
            rssi: -82,
            channel: 1,
            width: 20,
            band: Band24,
            security: Wpa,
            is_connected: false,
        },
        FixtureRow {
            bssid: "F0:F0:F0:F0:F0:F1",
            ssid: Some("Neighbor-5G"),
            rssi: -85,
            channel: 161,
            width: 80,
            band: Band5,
            security: Wpa2,
            is_connected: false,
        },
    ]
};

/// Return a hand-crafted network list when `KOGU_WIFI_FIXTURES=1` is
/// set in the process environment. Used during frontend development
/// and on CI runners without a wireless radio.
fn fixture_networks() -> Option<Vec<WifiNetwork>> {
    if std::env::var("KOGU_WIFI_FIXTURES").as_deref() != Ok("1") {
        return None;
    }
    Some(
        FIXTURE_ROWS
            .iter()
            .map(|row| WifiNetwork {
                bssid: row.bssid.to_string(),
                ssid: row.ssid.map(String::from),
                rssi_dbm: row.rssi,
                channel: row.channel,
                channel_width_mhz: row.width,
                band: row.band,
                security: row.security,
                vendor: super::oui::lookup_vendor(row.bssid).map(String::from),
                is_connected: row.is_connected,
            })
            .collect(),
    )
}

// =============================================================================
// Tauri commands
// =============================================================================

/// Start a Wi-Fi scan and stream events via the provided channel.
///
/// The Vec returned at the end mirrors the events streamed via
/// `on_event`; callers can choose either path depending on whether they
/// want incremental UI updates or a single final list.
///
/// # Errors
///
/// Returns the [`WifiError`] message string when the scan fails. The
/// Channel is also notified with `WifiScanEvent::Error` before the
/// `Err` is returned, so the frontend can render an error banner
/// without awaiting the rejected promise.
#[tauri::command]
pub async fn start_wifi_scan(
    scan_id: String,
    on_event: Channel<WifiScanEvent>,
    state: tauri::State<'_, NetworkScannerState>,
) -> Result<Vec<WifiNetwork>, String> {
    let token = Arc::new(CancellationToken::new());
    state.register(scan_id.clone(), token.clone());

    let _ = on_event.send(WifiScanEvent::Started);

    let result = scan(token.clone()).await;

    state.remove(&scan_id);

    if token.is_cancelled() {
        let _ = on_event.send(WifiScanEvent::Cancelled);
        return Err("scan cancelled".to_string());
    }

    match result {
        Ok(networks) => {
            for network in &networks {
                let _ = on_event.send(WifiScanEvent::NetworkFound {
                    network: network.clone(),
                });
            }
            let count = u32::try_from(networks.len()).unwrap_or(u32::MAX);
            let _ = on_event.send(WifiScanEvent::Completed { count });
            Ok(networks)
        }
        Err(error) => {
            let message = error.to_string();
            let _ = on_event.send(WifiScanEvent::Error {
                message: message.clone(),
            });
            Err(message)
        }
    }
}

/// Cancel an in-flight Wi-Fi scan by its `scan_id`.
///
/// Returns `true` when a matching scan was found and cancelled.
#[tauri::command]
pub fn cancel_wifi_scan(scan_id: String, state: tauri::State<'_, NetworkScannerState>) -> bool {
    state.cancel(&scan_id)
}
