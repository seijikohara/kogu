//! TLS handshake inspector command.
//!
//! Performs a real TLS handshake against a `host:port` and returns the
//! negotiated parameters together with the full peer certificate chain.
//!
//! The connection deliberately uses a custom certificate verifier that
//! accepts every certificate. This lets the inspector surface expired,
//! self-signed, and otherwise invalid certificates instead of failing the
//! handshake. The result is therefore unsafe for any trust decision.

use std::sync::Arc;
use std::time::{Duration, Instant};

use base64::Engine as _;
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{ClientConfig, DigitallySignedStruct, SignatureScheme};
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_rustls::TlsConnector;

/// Request payload sent from the frontend.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TlsInspectRequest {
    /// Target host (DNS name or IP literal).
    pub host: String,
    /// Target TCP port.
    pub port: u16,
    /// Optional SNI override. Defaults to `host` when `None` or empty.
    pub sni: Option<String>,
    /// Combined TCP-connect and TLS-handshake timeout in milliseconds.
    pub timeout_ms: u32,
}

/// Successful inspection result.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TlsInspectResult {
    /// Echo of the requested host.
    pub host: String,
    /// Echo of the requested port.
    pub port: u16,
    /// Effective SNI sent in the `ClientHello`.
    pub sni: String,
    /// Negotiated TLS protocol version (e.g. `TLSv1_3`).
    pub negotiated_version: String,
    /// Negotiated cipher suite name (e.g. `TLS13_AES_256_GCM_SHA384`).
    pub cipher_suite: String,
    /// Negotiated ALPN protocol, if any.
    pub alpn: Option<String>,
    /// Peer certificate chain as base64-encoded DER blobs, leaf first.
    pub peer_chain_base64: Vec<String>,
    /// Wall-clock elapsed time from start of TCP connect to handshake completion.
    pub elapsed_ms: u128,
}

/// Certificate verifier that accepts every certificate without validation.
///
/// Used exclusively for inspection. The inspector must surface broken
/// certificates (expired / self-signed / wrong host), which the default
/// verifier rejects before the chain is delivered to the application.
#[derive(Debug)]
struct AcceptAllVerifier;

impl ServerCertVerifier for AcceptAllVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        vec![
            SignatureScheme::RSA_PKCS1_SHA256,
            SignatureScheme::RSA_PKCS1_SHA384,
            SignatureScheme::RSA_PKCS1_SHA512,
            SignatureScheme::ECDSA_NISTP256_SHA256,
            SignatureScheme::ECDSA_NISTP384_SHA384,
            SignatureScheme::ECDSA_NISTP521_SHA512,
            SignatureScheme::RSA_PSS_SHA256,
            SignatureScheme::RSA_PSS_SHA384,
            SignatureScheme::RSA_PSS_SHA512,
            SignatureScheme::ED25519,
        ]
    }
}

/// Build a permissive TLS client config so the inspector can observe broken
/// certificates without the default verifier rejecting them.
fn build_client_config() -> Result<ClientConfig, String> {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let mut config = ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .map_err(|e| format!("Failed to build TLS config: {e}"))?
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(AcceptAllVerifier))
        .with_no_client_auth();
    config.alpn_protocols = vec![b"h2".to_vec(), b"http/1.1".to_vec()];
    Ok(config)
}

/// Resolve the effective SNI value, falling back to the host when missing or empty.
fn resolve_sni(sni: Option<&str>, host: &str) -> String {
    sni.map(str::trim)
        .filter(|s| !s.is_empty())
        .map_or_else(|| host.to_string(), str::to_string)
}

/// Format the negotiated protocol version using the rustls `Debug` representation.
fn format_protocol_version(version: rustls::ProtocolVersion) -> String {
    format!("{version:?}")
}

/// Format the negotiated cipher suite using the rustls `Debug` representation.
fn format_cipher_suite(suite: rustls::SupportedCipherSuite) -> String {
    format!("{:?}", suite.suite())
}

/// Inspect a TLS endpoint and return the negotiated parameters and chain.
///
/// # Errors
///
/// Returns a human-readable error string for invalid SNI, TCP connect failures,
/// handshake failures, or operation timeouts.
#[tauri::command]
pub async fn tls_inspect(req: TlsInspectRequest) -> Result<TlsInspectResult, String> {
    let started = Instant::now();
    let timeout_duration = Duration::from_millis(u64::from(req.timeout_ms));
    let sni = resolve_sni(req.sni.as_deref(), &req.host);

    let config = build_client_config()?;
    let connector = TlsConnector::from(Arc::new(config));

    let server_name = ServerName::try_from(sni.clone())
        .map_err(|e| format!("Invalid SNI: {e}"))?;

    let addr = format!("{}:{}", req.host, req.port);
    let stream = timeout(timeout_duration, TcpStream::connect(&addr))
        .await
        .map_err(|_| "Connection timed out".to_string())?
        .map_err(|e| format!("TCP connect: {e}"))?;

    let tls_stream = timeout(timeout_duration, connector.connect(server_name, stream))
        .await
        .map_err(|_| "TLS handshake timed out".to_string())?
        .map_err(|e| format!("TLS handshake: {e}"))?;

    let elapsed_ms = started.elapsed().as_millis();

    let (negotiated_version, cipher_suite, alpn, peer_chain_der) = {
        let (_, session) = tls_stream.get_ref();
        let version = session
            .protocol_version()
            .map_or_else(|| "Unknown".to_string(), format_protocol_version);
        let cipher = session
            .negotiated_cipher_suite()
            .map_or_else(|| "Unknown".to_string(), format_cipher_suite);
        let alpn = session
            .alpn_protocol()
            .map(|p| String::from_utf8_lossy(p).into_owned());
        let chain: Vec<Vec<u8>> = session
            .peer_certificates()
            .map(|certs| certs.iter().map(|c| c.as_ref().to_vec()).collect())
            .unwrap_or_default();
        (version, cipher, alpn, chain)
    };

    // Best-effort graceful close; we already captured everything we need.
    let mut tls_stream = tls_stream;
    let _ = tls_stream.shutdown().await;

    let peer_chain_base64: Vec<String> = peer_chain_der
        .iter()
        .map(|der| base64::engine::general_purpose::STANDARD.encode(der))
        .collect();

    Ok(TlsInspectResult {
        host: req.host,
        port: req.port,
        sni,
        negotiated_version,
        cipher_suite,
        alpn,
        peer_chain_base64,
        elapsed_ms,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_sni_uses_host_when_override_missing() {
        assert_eq!(resolve_sni(None, "example.com"), "example.com");
    }

    #[test]
    fn resolve_sni_uses_host_when_override_blank() {
        assert_eq!(resolve_sni(Some("   "), "example.com"), "example.com");
    }

    #[test]
    fn resolve_sni_prefers_override_when_present() {
        assert_eq!(resolve_sni(Some("alt.example.com"), "example.com"), "alt.example.com");
    }
}
