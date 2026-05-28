// FFI module: WlanAPI is C-level FFI requiring `unsafe`.
#![allow(unsafe_code)]

//! Windows Wi-Fi scan via the Native Wi-Fi API.
//!
//! The full implementation is split out so the rest of the backend can
//! ship first; the call flow is `WlanOpenHandle` ->
//! `WlanEnumInterfaces` -> `WlanScan` -> wait -> `WlanGetNetworkBssList`,
//! all under user-mode privileges.

use super::channels::freq_mhz_to_channel;
use super::types::{WifiError, WifiNetwork};

#[allow(clippy::unused_async)]
pub async fn scan() -> Result<Vec<WifiNetwork>, WifiError> {
    // Windows backend is implemented in a follow-up PR; surface a clear
    // error so the UI can render an actionable banner instead of an
    // empty list. The fixture path (`KOGU_WIFI_FIXTURES=1`) still works
    // for frontend development on Windows.
    //
    // `freq_mhz_to_channel` is referenced here so the helper is not
    // dead-code on the Windows build; the actual implementation will
    // call it when parsing `WLAN_BSS_ENTRY::ulChCenterFrequency`.
    let _ = freq_mhz_to_channel;
    Err(WifiError::ScanFailed(
        "Windows Wi-Fi scan is not yet implemented; tracked as a follow-up to PR 1".to_string(),
    ))
}
