// FFI module: WlanAPI is C-level FFI requiring `unsafe`.
#![allow(unsafe_code)]

//! Windows Wi-Fi scan via the Native Wi-Fi API.
//!
//! The full implementation is split out so the rest of the backend can
//! ship first; the call flow is `WlanOpenHandle` ->
//! `WlanEnumInterfaces` -> `WlanScan` -> wait -> `WlanGetNetworkBssList`,
//! all under user-mode privileges.

use super::channels::freq_mhz_to_channel;
use super::types::{WifiError, WifiNetwork, WifiSecurity};

#[allow(clippy::unused_async)]
pub async fn scan() -> Result<Vec<WifiNetwork>, WifiError> {
    // Windows backend is implemented in a follow-up PR; surface a clear
    // error so the UI can render an actionable banner instead of an
    // empty list. The fixture path (`KOGU_WIFI_FIXTURES=1`) still works
    // for frontend development on Windows.
    pin_unused_symbols_for_followup();
    Err(WifiError::ScanFailed(
        "Windows Wi-Fi scan is not yet implemented; tracked as a follow-up to PR 1".to_string(),
    ))
}

/// Reference every cross-platform helper / enum variant the Windows
/// implementation will eventually construct, so the `dead_code` lint
/// does not fire against the shared types on this build. Removed when
/// the real `WlanGetNetworkBssList` parser lands.
#[allow(dead_code)]
fn pin_unused_symbols_for_followup() {
    let _ = freq_mhz_to_channel;
    let _ = [WifiError::NoInterface, WifiError::ScanFailed(String::new())];
    let _ = [
        WifiSecurity::Open,
        WifiSecurity::Wep,
        WifiSecurity::Wpa,
        WifiSecurity::Wpa2,
        WifiSecurity::Wpa3,
        WifiSecurity::Wpa2Enterprise,
        WifiSecurity::Wpa3Enterprise,
        WifiSecurity::Unknown,
    ];
}
