//! DNS Lookup command.
//!
//! Async Tauri command backed by `hickory-resolver` that resolves a name
//! against the system resolver, a public preset (Cloudflare / Google /
//! Quad9), or a custom IP. Returns records grouped by type with TTL and
//! the AD (authentic data, DNSSEC validated) flag from the upstream
//! response header.
//!
//! Standard UDP/TCP only — encrypted transports (`DoH` / `DoT` / `DoQ`)
//! are intentionally deferred to a follow-up.

use std::net::IpAddr;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use hickory_resolver::config::{
    NameServerConfig, ResolverConfig, ResolverOpts, CLOUDFLARE, GOOGLE, QUAD9,
};
use hickory_resolver::net::runtime::TokioRuntimeProvider;
use hickory_resolver::proto::rr::RecordType;
use hickory_resolver::{Resolver, TokioResolver};
use serde::{Deserialize, Serialize};

/// User-supplied request for a DNS lookup.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsLookupRequest {
    /// Name (or PTR-formatted reverse query) to resolve.
    pub name: String,
    /// Record types to query, e.g. `["A", "AAAA", "MX"]`.
    pub record_types: Vec<String>,
    /// Resolver selector: `"system"`, `"cloudflare"`, `"google"`, `"quad9"`,
    /// or a bare IPv4 / IPv6 literal.
    pub resolver: String,
    /// Per-query timeout in milliseconds.
    pub timeout_ms: u32,
}

/// One resource record returned by the resolver.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsRecord {
    /// Record type label echoed from the request (e.g. `"A"`).
    pub record_type: String,
    /// Stringified rdata. For MX this includes the preference + exchange,
    /// for SOA the seven SOA fields, etc.
    pub value: String,
    /// TTL reported by the upstream in seconds.
    pub ttl: u32,
}

/// Per-record-type result block.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsTypeResult {
    /// Record type label echoed from the request.
    pub record_type: String,
    /// Records returned for this type. Empty when the upstream returned
    /// NXDOMAIN, NOERROR with no answers, or when a transport error
    /// occurred (in which case `error` is also populated).
    pub records: Vec<DnsRecord>,
    /// Wallclock expiry derived from the smallest TTL in `records`. Zero
    /// when `records` is empty.
    pub ttl_expires_at_ms: u64,
    /// AD (authentic data) flag from the upstream response header. `None`
    /// when no answer was returned.
    pub authentic_data: Option<bool>,
    /// Transport / parse / resolver error string when the lookup failed.
    pub error: Option<String>,
}

/// Aggregated result of one [`DnsLookupRequest`].
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsLookupResult {
    /// Name echoed from the request.
    pub name: String,
    /// Resolver spec echoed from the request.
    pub resolver: String,
    /// Per-type result blocks in the order requested.
    pub results: Vec<DnsTypeResult>,
    /// Total wallclock duration of the whole lookup in milliseconds.
    pub elapsed_ms: u128,
}

/// Map a string label to a hickory `RecordType`. Returns `None` for any
/// label outside the MVP set so the caller can surface a clean error.
fn parse_record_type(s: &str) -> Option<RecordType> {
    match s.to_uppercase().as_str() {
        "A" => Some(RecordType::A),
        "AAAA" => Some(RecordType::AAAA),
        "MX" => Some(RecordType::MX),
        "TXT" => Some(RecordType::TXT),
        "NS" => Some(RecordType::NS),
        "CNAME" => Some(RecordType::CNAME),
        "SOA" => Some(RecordType::SOA),
        "PTR" => Some(RecordType::PTR),
        _ => None,
    }
}

/// Build resolver options with the caller-supplied timeout. `attempts` is
/// pinned to 1 so a slow upstream surfaces a timeout instead of doubling
/// the wallclock when the first probe fails.
fn build_opts(timeout_ms: u32) -> ResolverOpts {
    let mut opts = ResolverOpts::default();
    opts.timeout = Duration::from_millis(u64::from(timeout_ms));
    opts.attempts = 1;
    opts
}

/// Build a [`TokioResolver`] for the requested `spec`. `"system"` reads
/// the platform resolver configuration; the named presets resolve through
/// the bundled IP set over UDP+TCP; any other value is parsed as a bare
/// IPv4 / IPv6 literal that is wired up as both a UDP and a TCP server.
fn build_resolver(spec: &str, timeout_ms: u32) -> Result<TokioResolver, String> {
    let opts = build_opts(timeout_ms);

    if spec == "system" {
        let mut builder = Resolver::builder_tokio().map_err(|e| e.to_string())?;
        *builder.options_mut() = opts;
        return builder.build().map_err(|e| e.to_string());
    }

    let config = match spec {
        "cloudflare" => ResolverConfig::udp_and_tcp(&CLOUDFLARE),
        "google" => ResolverConfig::udp_and_tcp(&GOOGLE),
        "quad9" => ResolverConfig::udp_and_tcp(&QUAD9),
        custom => {
            let ip: IpAddr = custom
                .parse()
                .map_err(|e: std::net::AddrParseError| format!("Invalid resolver IP: {e}"))?;
            ResolverConfig::from_parts(None, vec![], vec![NameServerConfig::udp_and_tcp(ip)])
        }
    };

    Resolver::builder_with_config(config, TokioRuntimeProvider::default())
        .with_options(opts)
        .build()
        .map_err(|e| e.to_string())
}

/// Convert a smallest-TTL value to an absolute wallclock expiry in
/// milliseconds since the Unix epoch. Returns 0 when the system clock is
/// before the epoch (effectively never).
fn ttl_expires_at_ms(ttl_seconds: u32) -> u64 {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX));
    now_ms.saturating_add(u64::from(ttl_seconds).saturating_mul(1000))
}

/// Run a single record-type lookup. Errors are folded into the result
/// (with empty `records`) so the frontend can show per-type problems
/// without aborting the whole query.
async fn lookup_type(
    resolver: &TokioResolver,
    name: &str,
    rt_label: &str,
    rt: RecordType,
) -> DnsTypeResult {
    match resolver.lookup(name, rt).await {
        Ok(lookup) => {
            let records: Vec<DnsRecord> = lookup
                .answers()
                .iter()
                .map(|r| DnsRecord {
                    record_type: rt_label.to_string(),
                    value: r.data.to_string(),
                    ttl: r.ttl,
                })
                .collect();
            let min_ttl = records.iter().map(|r| r.ttl).min().unwrap_or(0);
            let authentic_data = Some(lookup.message().metadata.authentic_data);
            DnsTypeResult {
                record_type: rt_label.to_string(),
                ttl_expires_at_ms: if records.is_empty() {
                    0
                } else {
                    ttl_expires_at_ms(min_ttl)
                },
                records,
                authentic_data,
                error: None,
            }
        }
        Err(e) => DnsTypeResult {
            record_type: rt_label.to_string(),
            records: vec![],
            ttl_expires_at_ms: 0,
            authentic_data: None,
            error: Some(e.to_string()),
        },
    }
}

/// Resolve every requested record type against the chosen resolver and
/// return the aggregated result.
#[tauri::command]
pub async fn dns_lookup(req: DnsLookupRequest) -> Result<DnsLookupResult, String> {
    let started = std::time::Instant::now();
    let resolver = build_resolver(&req.resolver, req.timeout_ms)?;

    let mut results = Vec::with_capacity(req.record_types.len());
    for rt_label in &req.record_types {
        match parse_record_type(rt_label) {
            Some(rt) => results.push(lookup_type(&resolver, &req.name, rt_label, rt).await),
            None => results.push(DnsTypeResult {
                record_type: rt_label.clone(),
                records: vec![],
                ttl_expires_at_ms: 0,
                authentic_data: None,
                error: Some(format!("Unsupported record type: {rt_label}")),
            }),
        }
    }

    Ok(DnsLookupResult {
        name: req.name,
        resolver: req.resolver,
        results,
        elapsed_ms: started.elapsed().as_millis(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_record_type_accepts_supported_types() {
        assert_eq!(parse_record_type("A"), Some(RecordType::A));
        assert_eq!(parse_record_type("aaaa"), Some(RecordType::AAAA));
        assert_eq!(parse_record_type("Mx"), Some(RecordType::MX));
        assert_eq!(parse_record_type("PTR"), Some(RecordType::PTR));
    }

    #[test]
    fn parse_record_type_rejects_out_of_scope_types() {
        assert_eq!(parse_record_type("CAA"), None);
        assert_eq!(parse_record_type("SRV"), None);
        assert_eq!(parse_record_type(""), None);
    }

    #[test]
    fn ttl_expires_at_is_in_the_future_for_nonzero_ttl() {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX));
        let expires = ttl_expires_at_ms(60);
        assert!(expires >= now_ms);
    }
}
