//! SNMP sysName query for hostname resolution
//!
//! Queries network devices for their SNMPv2c sysName using the public community string.
//! This is effective for routers, switches, NAS devices, and other SNMP-enabled equipment.

use std::net::{IpAddr, SocketAddr};
use std::time::Duration;

use csnmp::{ObjectIdentifier, ObjectValue, Snmp2cClient};
use serde::Serialize;

const SYS_NAME_OID: [u32; 9] = [1, 3, 6, 1, 2, 1, 1, 5, 0];
const SYS_DESCR_OID: [u32; 9] = [1, 3, 6, 1, 2, 1, 1, 1, 0];
const SYS_LOCATION_OID: [u32; 9] = [1, 3, 6, 1, 2, 1, 1, 6, 0];
const SYS_CONTACT_OID: [u32; 9] = [1, 3, 6, 1, 2, 1, 1, 4, 0];

const DEFAULT_COMMUNITY: &[u8] = b"public";
const SNMP_PORT: u16 = 161;

/// SNMP device information
///
/// Field names follow SNMP MIB naming convention (sysName, sysDescr, etc.)
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_field_names)]
pub struct SnmpDeviceInfo {
    /// System name (sysName.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sys_name: Option<String>,
    /// System description (sysDescr.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sys_descr: Option<String>,
    /// System location (sysLocation.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sys_location: Option<String>,
    /// System contact (sysContact.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sys_contact: Option<String>,
}

impl SnmpDeviceInfo {
    /// Check if any field is populated
    pub fn is_populated(&self) -> bool {
        self.sys_name.is_some()
            || self.sys_descr.is_some()
            || self.sys_location.is_some()
            || self.sys_contact.is_some()
    }
}

/// Extract a UTF-8 string from an SNMP `OctetString` value, trimming whitespace.
/// Returns `None` for empty values or non-string variants.
fn extract_string(value: &ObjectValue) -> Option<String> {
    match value {
        ObjectValue::String(bytes) => {
            let s = String::from_utf8_lossy(bytes).trim().to_string();
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        }
        _ => None,
    }
}

/// Query SNMP system information for a single IP address using the default community.
pub async fn query_snmp_device_info(ip: IpAddr, timeout: Duration) -> Option<SnmpDeviceInfo> {
    query_snmp_device_info_with_community(ip, DEFAULT_COMMUNITY, timeout).await
}

/// Query SNMP system information using a caller-supplied community string.
///
/// Returns `Some(info)` when at least one MIB-2 system OID resolves; `None`
/// when the host fails to open a session or returns no usable varbinds. Used
/// by discovery to try alternative communities (e.g. `private`) when `public`
/// is rejected.
pub async fn query_snmp_device_info_with_community(
    ip: IpAddr,
    community: &[u8],
    timeout: Duration,
) -> Option<SnmpDeviceInfo> {
    let target = SocketAddr::new(ip, SNMP_PORT);

    let sys_name_oid = ObjectIdentifier::try_from(SYS_NAME_OID.as_slice()).ok()?;
    let sys_descr_oid = ObjectIdentifier::try_from(SYS_DESCR_OID.as_slice()).ok()?;
    let sys_location_oid = ObjectIdentifier::try_from(SYS_LOCATION_OID.as_slice()).ok()?;
    let sys_contact_oid = ObjectIdentifier::try_from(SYS_CONTACT_OID.as_slice()).ok()?;

    let client = Snmp2cClient::new(target, community.to_vec(), None, Some(timeout), 0)
        .await
        .ok()?;

    let mut info = SnmpDeviceInfo::default();

    if let Ok(value) = client.get(sys_name_oid).await {
        info.sys_name = extract_string(&value);
    }
    if let Ok(value) = client.get(sys_descr_oid).await {
        info.sys_descr = extract_string(&value);
    }
    if let Ok(value) = client.get(sys_location_oid).await {
        info.sys_location = extract_string(&value);
    }
    if let Ok(value) = client.get(sys_contact_oid).await {
        info.sys_contact = extract_string(&value);
    }

    if info.is_populated() {
        Some(info)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_snmp_device_info_default() {
        let info = SnmpDeviceInfo::default();
        assert!(!info.is_populated());
    }

    #[test]
    fn test_snmp_device_info_populated() {
        let info = SnmpDeviceInfo {
            sys_name: Some("router1".to_string()),
            ..Default::default()
        };
        assert!(info.is_populated());
    }

    #[test]
    fn test_snmp_device_info_serialization() {
        let info = SnmpDeviceInfo {
            sys_name: Some("router1".to_string()),
            sys_descr: Some("Cisco Router".to_string()),
            sys_location: None,
            sys_contact: None,
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("sysName"));
        assert!(json.contains("router1"));
        assert!(json.contains("sysDescr"));
        assert!(!json.contains("sysLocation"));
        assert!(!json.contains("sysContact"));
    }

    #[test]
    fn test_extract_string_octet_string() {
        let value = ObjectValue::String(b"test".to_vec());
        assert_eq!(extract_string(&value), Some("test".to_string()));
    }

    #[test]
    fn test_extract_string_empty() {
        let value = ObjectValue::String(Vec::new());
        assert_eq!(extract_string(&value), None);
    }

    #[test]
    fn test_extract_string_with_whitespace() {
        let value = ObjectValue::String(b"  router1  ".to_vec());
        assert_eq!(extract_string(&value), Some("router1".to_string()));
    }

    #[test]
    fn test_extract_string_non_string_value() {
        let value = ObjectValue::Integer(42);
        assert_eq!(extract_string(&value), None);
    }
}
