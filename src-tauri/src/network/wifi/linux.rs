//! Linux Wi-Fi scan via NetworkManager over DBus.
//!
//! Uses the `zbus` crate to talk to
//! `org.freedesktop.NetworkManager` on the system bus. NetworkManager
//! ships with every common desktop distribution and exposes Wi-Fi scan
//! results to user-mode callers without elevation. When NetworkManager
//! is not running (server installs, containers), [`scan`] returns
//! [`WifiError::ScanFailed`] with a message pointing the user at the
//! missing service.

use std::collections::HashMap;
use std::time::Duration;

use zbus::zvariant::{OwnedObjectPath, OwnedValue};
use zbus::Connection;

use super::channels::freq_mhz_to_channel;
use super::types::{WifiBand, WifiError, WifiNetwork, WifiSecurity};
use crate::network::oui;

const NM_SERVICE: &str = "org.freedesktop.NetworkManager";
const NM_PATH: &str = "/org/freedesktop/NetworkManager";
const NM_IFACE: &str = "org.freedesktop.NetworkManager";
const NM_DEVICE_IFACE: &str = "org.freedesktop.NetworkManager.Device";
const NM_WIRELESS_IFACE: &str = "org.freedesktop.NetworkManager.Device.Wireless";
const NM_AP_IFACE: &str = "org.freedesktop.NetworkManager.AccessPoint";
const NM_DBUS_PROPERTIES: &str = "org.freedesktop.DBus.Properties";
/// `DeviceType` value for Wi-Fi devices (NM_DEVICE_TYPE_WIFI).
const DEVICE_TYPE_WIFI: u32 = 2;
/// Wait this long for the AP list to settle after `RequestScan`.
/// NetworkManager rebuilds the list asynchronously; 1500 ms catches
/// most desktop drivers without making the UI feel stuck.
const SCAN_SETTLE_MS: u64 = 1500;

pub async fn scan() -> Result<Vec<WifiNetwork>, WifiError> {
    let connection = Connection::system()
        .await
        .map_err(|e| WifiError::ScanFailed(format!("system bus unavailable: {e}")))?;

    let device_paths = list_wifi_devices(&connection).await?;
    if device_paths.is_empty() {
        return Err(WifiError::NoInterface);
    }

    let mut networks = Vec::new();
    let mut active_bssids: Vec<String> = Vec::new();
    for device_path in &device_paths {
        if let Ok(active) = active_bssid(&connection, device_path).await {
            if let Some(b) = active {
                active_bssids.push(b);
            }
        }
        // Best-effort scan request; ignore the result since the device
        // may have just rescanned (NM throttles RequestScan).
        let _ = request_scan(&connection, device_path).await;
    }

    tokio::time::sleep(Duration::from_millis(SCAN_SETTLE_MS)).await;

    for device_path in &device_paths {
        let ap_paths = match list_access_points(&connection, device_path).await {
            Ok(paths) => paths,
            Err(e) => {
                return Err(WifiError::ScanFailed(format!(
                    "GetAllAccessPoints failed: {e}"
                )));
            }
        };
        for ap_path in &ap_paths {
            if let Ok(Some(net)) = build_network(&connection, ap_path, &active_bssids).await {
                networks.push(net);
            }
        }
    }
    Ok(networks)
}

async fn list_wifi_devices(connection: &Connection) -> Result<Vec<OwnedObjectPath>, WifiError> {
    let proxy = build_proxy(connection, NM_PATH, NM_IFACE).await?;
    let all_devices: Vec<OwnedObjectPath> = proxy
        .call("GetDevices", &())
        .await
        .map_err(|e| WifiError::ScanFailed(format!("GetDevices failed: {e}")))?;
    let mut out = Vec::new();
    for path in all_devices {
        if let Ok(value) = get_property(connection, &path, NM_DEVICE_IFACE, "DeviceType").await {
            if let Ok(t) = u32::try_from(&value) {
                if t == DEVICE_TYPE_WIFI {
                    out.push(path);
                }
            }
        }
    }
    Ok(out)
}

async fn request_scan(
    connection: &Connection,
    device_path: &OwnedObjectPath,
) -> Result<(), WifiError> {
    let proxy = build_proxy(connection, device_path.as_str(), NM_WIRELESS_IFACE).await?;
    let options: HashMap<String, OwnedValue> = HashMap::new();
    proxy
        .call("RequestScan", &(options,))
        .await
        .map_err(|e| WifiError::ScanFailed(format!("RequestScan failed: {e}")))?;
    Ok(())
}

async fn list_access_points(
    connection: &Connection,
    device_path: &OwnedObjectPath,
) -> Result<Vec<OwnedObjectPath>, zbus::Error> {
    let proxy = build_proxy(connection, device_path.as_str(), NM_WIRELESS_IFACE).await?;
    proxy.call("GetAllAccessPoints", &()).await
}

async fn active_bssid(
    connection: &Connection,
    device_path: &OwnedObjectPath,
) -> Result<Option<String>, WifiError> {
    let value = get_property(
        connection,
        device_path,
        NM_WIRELESS_IFACE,
        "ActiveAccessPoint",
    )
    .await?;
    let active_path = OwnedObjectPath::try_from(value)
        .map_err(|e| WifiError::ScanFailed(format!("unexpected ActiveAccessPoint: {e}")))?;
    if active_path.as_str() == "/" {
        return Ok(None);
    }
    let bssid_value = get_property(connection, &active_path, NM_AP_IFACE, "HwAddress").await?;
    let bssid = String::try_from(bssid_value)
        .map_err(|e| WifiError::ScanFailed(format!("unexpected HwAddress: {e}")))?;
    Ok(Some(bssid.to_uppercase()))
}

async fn build_network(
    connection: &Connection,
    ap_path: &OwnedObjectPath,
    active_bssids: &[String],
) -> Result<Option<WifiNetwork>, WifiError> {
    let ssid_value = get_property(connection, ap_path, NM_AP_IFACE, "Ssid").await?;
    let ssid_bytes: Vec<u8> = Vec::<u8>::try_from(ssid_value).unwrap_or_default();
    let ssid = if ssid_bytes.is_empty() {
        None
    } else {
        Some(String::from_utf8_lossy(&ssid_bytes).into_owned())
    };

    let bssid_value = get_property(connection, ap_path, NM_AP_IFACE, "HwAddress").await?;
    let bssid = String::try_from(bssid_value)
        .map_err(|e| WifiError::ScanFailed(format!("HwAddress: {e}")))?
        .to_uppercase();
    if bssid.is_empty() {
        return Ok(None);
    }

    let strength_value = get_property(connection, ap_path, NM_AP_IFACE, "Strength").await?;
    let strength = u8::try_from(&strength_value).unwrap_or(0);
    // NetworkManager exposes signal strength as 0-100 percent. The
    // canonical mapping back to dBm used across nmcli and the GNOME
    // shell is `dBm = (percent / 2) - 100`.
    let rssi_dbm = i32::from(strength) / 2 - 100;

    let freq_value = get_property(connection, ap_path, NM_AP_IFACE, "Frequency").await?;
    let freq_mhz = u32::try_from(&freq_value).unwrap_or(0);
    let (channel, band) = freq_mhz_to_channel(freq_mhz).unwrap_or((0, WifiBand::Band24));
    if channel == 0 {
        return Ok(None);
    }

    let wpa_flags =
        u32::try_from(&get_property(connection, ap_path, NM_AP_IFACE, "WpaFlags").await?)
            .unwrap_or(0);
    let rsn_flags =
        u32::try_from(&get_property(connection, ap_path, NM_AP_IFACE, "RsnFlags").await?)
            .unwrap_or(0);
    let flags =
        u32::try_from(&get_property(connection, ap_path, NM_AP_IFACE, "Flags").await?).unwrap_or(0);
    let security = security_from_flags(flags, wpa_flags, rsn_flags);

    let is_connected = active_bssids.iter().any(|b| b == &bssid);

    Ok(Some(WifiNetwork {
        vendor: oui::lookup_vendor(&bssid).map(String::from),
        bssid,
        ssid,
        rssi_dbm,
        channel,
        // NetworkManager does not surface channel width over DBus.
        // Default to 20 MHz so the chart still renders a sensible curve.
        channel_width_mhz: 20,
        band,
        security,
        is_connected,
    }))
}

async fn build_proxy<'a>(
    connection: &'a Connection,
    path: &str,
    interface: &str,
) -> Result<zbus::Proxy<'a>, WifiError> {
    zbus::Proxy::new(connection, NM_SERVICE, path, interface)
        .await
        .map_err(|e| WifiError::ScanFailed(format!("proxy creation failed: {e}")))
}

async fn get_property(
    connection: &Connection,
    path: &OwnedObjectPath,
    interface: &str,
    property: &str,
) -> Result<OwnedValue, WifiError> {
    let proxy = build_proxy(connection, path.as_str(), NM_DBUS_PROPERTIES).await?;
    proxy
        .call("Get", &(interface, property))
        .await
        .map_err(|e| WifiError::ScanFailed(format!("Get({interface}, {property}) failed: {e}")))
}

/// Translate the NetworkManager flag triplet into a single
/// [`WifiSecurity`] value. RSN (WPA2/WPA3) flags take priority over WPA
/// flags when both are advertised.
fn security_from_flags(flags: u32, wpa_flags: u32, rsn_flags: u32) -> WifiSecurity {
    const NM_802_11_AP_FLAGS_PRIVACY: u32 = 0x1;
    const NM_802_11_AP_SEC_KEY_MGMT_802_1X: u32 = 0x100;
    const NM_802_11_AP_SEC_KEY_MGMT_SAE: u32 = 0x400;
    const NM_802_11_AP_SEC_KEY_MGMT_OWE: u32 = 0x800;

    let has_privacy = flags & NM_802_11_AP_FLAGS_PRIVACY != 0;
    if rsn_flags & NM_802_11_AP_SEC_KEY_MGMT_802_1X != 0 {
        return WifiSecurity::Wpa2Enterprise;
    }
    if rsn_flags & NM_802_11_AP_SEC_KEY_MGMT_SAE != 0
        || rsn_flags & NM_802_11_AP_SEC_KEY_MGMT_OWE != 0
    {
        return WifiSecurity::Wpa3;
    }
    if rsn_flags != 0 {
        return WifiSecurity::Wpa2;
    }
    if wpa_flags != 0 {
        if wpa_flags & NM_802_11_AP_SEC_KEY_MGMT_802_1X != 0 {
            return WifiSecurity::Wpa;
        }
        return WifiSecurity::Wpa;
    }
    if has_privacy {
        return WifiSecurity::Wep;
    }
    WifiSecurity::Open
}
