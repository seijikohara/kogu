//! SNMP sysName query for hostname resolution
//!
//! Queries network devices for their SNMPv2c sysName using the public community string.
//! This is effective for routers, switches, NAS devices, and other SNMP-enabled equipment.

use std::net::IpAddr;
use std::time::Duration;

use serde::Serialize;
use snmp2::{Oid, SyncSession, Value};

/// SNMP MIB-2 system group OIDs
const SYS_NAME_OID: [u64; 9] = [1, 3, 6, 1, 2, 1, 1, 5, 0];
const SYS_DESCR_OID: [u64; 9] = [1, 3, 6, 1, 2, 1, 1, 1, 0];
const SYS_LOCATION_OID: [u64; 9] = [1, 3, 6, 1, 2, 1, 1, 6, 0];
const SYS_CONTACT_OID: [u64; 9] = [1, 3, 6, 1, 2, 1, 1, 4, 0];

/// Default SNMP community string
const DEFAULT_COMMUNITY: &[u8] = b"public";

/// Default SNMP port
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

/// Extract string value from SNMP Value
fn extract_string(value: &Value<'_>) -> Option<String> {
    match value {
        Value::OctetString(bytes) => {
            // Try to parse as UTF-8, fall back to lossy conversion
            let s = String::from_utf8_lossy(bytes).to_string();
            if s.is_empty() {
                None
            } else {
                Some(s.trim().to_string())
            }
        }
        _ => None,
    }
}

/// Query SNMP system information for a single IP address
///
/// Queries sysName, sysDescr, sysLocation, and sysContact.
/// Returns SnmpDeviceInfo if the device responds to any query.
#[allow(clippy::large_stack_frames)]
pub fn query_snmp_device_info(ip: IpAddr, timeout: Duration) -> Option<SnmpDeviceInfo> {
    let addr = format!("{ip}:{SNMP_PORT}");

    let sys_name_oid = Oid::from(&SYS_NAME_OID).ok()?;
    let sys_descr_oid = Oid::from(&SYS_DESCR_OID).ok()?;
    let sys_location_oid = Oid::from(&SYS_LOCATION_OID).ok()?;
    let sys_contact_oid = Oid::from(&SYS_CONTACT_OID).ok()?;

    let mut session = SyncSession::new_v2c(&addr, DEFAULT_COMMUNITY, Some(timeout), 0).ok()?;

    let mut info = SnmpDeviceInfo::default();

    // Query each OID individually (some devices may not support all OIDs)
    if let Ok(response) = session.get(&sys_name_oid) {
        for (_oid, value) in response.varbinds {
            info.sys_name = extract_string(&value);
        }
    }

    if let Ok(response) = session.get(&sys_descr_oid) {
        for (_oid, value) in response.varbinds {
            info.sys_descr = extract_string(&value);
        }
    }

    if let Ok(response) = session.get(&sys_location_oid) {
        for (_oid, value) in response.varbinds {
            info.sys_location = extract_string(&value);
        }
    }

    if let Ok(response) = session.get(&sys_contact_oid) {
        for (_oid, value) in response.varbinds {
            info.sys_contact = extract_string(&value);
        }
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
        // sys_location and sys_contact should be skipped
        assert!(!json.contains("sysLocation"));
        assert!(!json.contains("sysContact"));
    }

    #[test]
    fn test_extract_string_octet_string() {
        let value = Value::OctetString(b"test");
        assert_eq!(extract_string(&value), Some("test".to_string()));
    }

    #[test]
    fn test_extract_string_empty() {
        let value = Value::OctetString(b"");
        assert_eq!(extract_string(&value), None);
    }

    #[test]
    fn test_extract_string_with_whitespace() {
        let value = Value::OctetString(b"  router1  ");
        assert_eq!(extract_string(&value), Some("router1".to_string()));
    }

    #[test]
    fn test_extract_string_non_string_value() {
        let value = Value::Integer(42);
        assert_eq!(extract_string(&value), None);
    }
}
