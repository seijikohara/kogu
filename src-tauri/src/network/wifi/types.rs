//! Shared Wi-Fi data model.
//!
//! `WifiNetwork` is the cross-platform abstraction returned by every
//! platform backend in this module. The serde rename matches the rest
//! of `network/types.rs` so the frontend can consume the JSON with
//! `camelCase` keys.

use serde::Serialize;

/// 802.11 frequency band a Wi-Fi network broadcasts on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WifiBand {
    /// 2.4 GHz (channels 1-14).
    Band24,
    /// 5 GHz (channels 36-165 by region).
    Band5,
    /// 6 GHz (Wi-Fi 6E; channels 1-233).
    Band6,
}

/// 802.11 link-layer security suite.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WifiSecurity {
    Open,
    Wep,
    Wpa,
    Wpa2,
    Wpa3,
    Wpa2Enterprise,
    Wpa3Enterprise,
    Unknown,
}

/// Single access point as seen from the host's wireless radio.
///
/// `ssid` is `None` when the AP hides its name (suppresses beacons).
/// `vendor` is enriched on the Rust side via
/// [`crate::network::oui::lookup_vendor`] so the frontend does not need
/// the OUI database.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WifiNetwork {
    /// MAC address of the AP in `AA:BB:CC:DD:EE:FF` form.
    pub bssid: String,
    /// Broadcast SSID; `None` for hidden networks.
    pub ssid: Option<String>,
    /// Received signal strength in dBm. Negative values; -30 is strong, -90 is weak.
    pub rssi_dbm: i32,
    /// Primary 20 MHz channel number.
    pub channel: u16,
    /// HT / VHT / HE channel width (20, 40, 80, 160, or 320 MHz).
    pub channel_width_mhz: u16,
    /// Band derived from the primary channel.
    pub band: WifiBand,
    /// Link-layer security suite.
    pub security: WifiSecurity,
    /// OUI-resolved vendor name; `None` when the BSSID prefix is unknown.
    pub vendor: Option<String>,
    /// True when this AP is the one the host is currently associated with.
    pub is_connected: bool,
}

/// Streaming event emitted to the frontend during a scan via
/// `tauri::ipc::Channel<WifiScanEvent>`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum WifiScanEvent {
    Started,
    NetworkFound { network: WifiNetwork },
    Completed { count: u32 },
    Cancelled,
    Error { message: String },
}

/// Failure modes for [`super::scan`].
#[derive(Debug, Clone)]
pub enum WifiError {
    /// No wireless interface available on this host.
    NoInterface,
    /// User denied a required OS-level permission (macOS Location Services).
    PermissionDenied,
    /// Scan request itself failed (driver error, NM unavailable, etc.).
    ScanFailed(String),
    /// Target OS has no implementation in this build.
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    UnsupportedPlatform,
}

impl std::fmt::Display for WifiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NoInterface => f.write_str("No wireless interface available"),
            Self::PermissionDenied => f.write_str(
                "Permission to read nearby Wi-Fi networks was denied. \
                 On macOS, grant Location Services access in System Settings.",
            ),
            Self::ScanFailed(detail) => write!(f, "Wi-Fi scan failed: {detail}"),
            #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
            Self::UnsupportedPlatform => {
                f.write_str("Wi-Fi scan is not supported on this platform")
            }
        }
    }
}

impl std::error::Error for WifiError {}
