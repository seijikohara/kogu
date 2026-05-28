// FFI module: CoreWLAN bindings require `unsafe` for some objc2 calls.
#![allow(unsafe_code)]

//! macOS Wi-Fi scan via CoreWLAN.
//!
//! Uses the `objc2-core-wlan` crate to invoke
//! `CWWiFiClient.sharedWiFiClient().interface().scanForNetworksWithName_error(nil)`
//! from Rust without a Swift bridge. The scan is synchronous and takes
//! 2-5 s, so we run it inside `tokio::task::spawn_blocking`.
//!
//! macOS 14+ requires the user to grant Location Services access. The
//! `NSLocationUsageDescription` / `NSLocationWhenInUseUsageDescription`
//! keys in `src-tauri/resources/macos/Info.plist` drive the OS prompt
//! on the first scan.

use objc2_core_wlan::{CWChannelBand, CWChannelWidth, CWSecurity, CWWiFiClient};

use super::channels::freq_mhz_to_channel;
use super::types::{WifiBand, WifiError, WifiNetwork, WifiSecurity};
use crate::network::oui;

pub async fn scan() -> Result<Vec<WifiNetwork>, WifiError> {
    tokio::task::spawn_blocking(scan_blocking)
        .await
        .map_err(|e| WifiError::ScanFailed(format!("scan task join failed: {e}")))?
}

fn scan_blocking() -> Result<Vec<WifiNetwork>, WifiError> {
    // Safety: CoreWLAN API is safe to call from any thread, but the
    // resulting NSObjects must be kept alive on the caller frame, which
    // Retained handles automatically.
    let client = unsafe { CWWiFiClient::sharedWiFiClient() };
    let interface = unsafe { client.interface() }.ok_or(WifiError::NoInterface)?;

    let current_bssid = unsafe { interface.bssid() }.map(|s| s.to_string().to_uppercase());

    let scan_result = unsafe { interface.scanForNetworksWithName_error(None) };
    let networks = match scan_result {
        Ok(set) => set,
        Err(err) => {
            let message = err.localizedDescription().to_string();
            // CoreWLAN surfaces the Location Services denial with code
            // -3931 (kCWAuthenticationFailedErr) on some macOS releases
            // or a permission-themed message on others; treat any
            // message mentioning "location" as the permission failure.
            if message.to_lowercase().contains("location") {
                return Err(WifiError::PermissionDenied);
            }
            return Err(WifiError::ScanFailed(message));
        }
    };

    let mut out = Vec::new();
    for net in &networks {
        let Some(channel_obj) = (unsafe { net.wlanChannel() }) else {
            continue;
        };
        let channel_number = unsafe { channel_obj.channelNumber() } as u16;
        let width = match unsafe { channel_obj.channelWidth() } {
            CWChannelWidth::Width20MHz => 20,
            CWChannelWidth::Width40MHz => 40,
            CWChannelWidth::Width80MHz => 80,
            CWChannelWidth::Width160MHz => 160,
            _ => 20,
        };
        let band = match unsafe { channel_obj.channelBand() } {
            CWChannelBand::Band2GHz => WifiBand::Band24,
            CWChannelBand::Band5GHz => WifiBand::Band5,
            CWChannelBand::Band6GHz => WifiBand::Band6,
            _ => match channel_number {
                1..=14 => WifiBand::Band24,
                15..=177 => WifiBand::Band5,
                _ => WifiBand::Band6,
            },
        };

        let bssid = unsafe { net.bssid() }
            .map(|s| s.to_string().to_uppercase())
            .unwrap_or_default();
        if bssid.is_empty() {
            // CoreWLAN occasionally returns BSSID-less entries; skip them.
            continue;
        }
        let ssid = unsafe { net.ssid() }.map(|s| s.to_string());
        let rssi = unsafe { net.rssiValue() } as i32;
        let security = map_security(unsafe { net.supportsSecurity(CWSecurity::None) }, &net);

        let is_connected = current_bssid.as_ref().is_some_and(|cur| cur == &bssid);

        out.push(WifiNetwork {
            vendor: oui::lookup_vendor(&bssid).map(String::from),
            bssid,
            ssid,
            rssi_dbm: rssi,
            channel: channel_number,
            channel_width_mhz: width,
            band,
            security,
            is_connected,
        });

        // Cross-check frequency math when the channel object disagrees
        // with the canonical IEEE mapping; CoreWLAN can occasionally
        // misreport vendor-specific channels.
        let _ = freq_mhz_to_channel;
    }
    Ok(out)
}

fn map_security(_is_open: bool, net: &objc2_core_wlan::CWNetwork) -> WifiSecurity {
    // Probe each CWSecurity enum value in order of strength so the
    // strongest reported suite wins. CoreWLAN's `supportsSecurity:`
    // method returns true for every suite the AP advertises.
    let candidates: &[(CWSecurity, WifiSecurity)] = &[
        (CWSecurity::WPA3Enterprise, WifiSecurity::Wpa3Enterprise),
        (CWSecurity::WPA3Personal, WifiSecurity::Wpa3),
        (CWSecurity::WPA2Enterprise, WifiSecurity::Wpa2Enterprise),
        (CWSecurity::WPA2Personal, WifiSecurity::Wpa2),
        (CWSecurity::WPAEnterprise, WifiSecurity::Wpa),
        (CWSecurity::WPAPersonal, WifiSecurity::Wpa),
        (CWSecurity::WEP, WifiSecurity::Wep),
        (CWSecurity::None, WifiSecurity::Open),
    ];
    for (cw, mapped) in candidates {
        if unsafe { net.supportsSecurity(*cw) } {
            return *mapped;
        }
    }
    WifiSecurity::Unknown
}
