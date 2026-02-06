//! TLS Certificate SAN extraction for hostname resolution
//!
//! Extracts Subject Alternative Names (dNSName) from TLS certificates
//! for web servers, IoT devices, and other HTTPS-enabled hosts.

use std::net::IpAddr;
use std::sync::Arc;
use std::time::Duration;

use rustls::pki_types::ServerName;
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_rustls::TlsConnector;
use x509_parser::prelude::*;

/// Extract DNS names from TLS certificate Subject Alternative Names
///
/// Connects to the given IP:port with TLS and extracts dNSName entries
/// from the certificate's Subject Alternative Name extension.
pub async fn extract_tls_san_names(
    ip: IpAddr,
    port: u16,
    timeout_duration: Duration,
) -> Vec<String> {
    // Create TLS config with explicit ring CryptoProvider
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let config = match rustls::ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
    {
        Ok(builder) => builder
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(AcceptAnyCert))
            .with_no_client_auth(),
        Err(_) => return Vec::new(),
    };

    let connector = TlsConnector::from(Arc::new(config));

    // Connect with timeout
    let addr = format!("{ip}:{port}");
    let stream = match timeout(timeout_duration, TcpStream::connect(&addr)).await {
        Ok(Ok(s)) => s,
        Ok(Err(_)) | Err(_) => return Vec::new(),
    };

    // Use IP as server name (we're not doing hostname verification)
    let server_name = match ServerName::try_from(ip.to_string()) {
        Ok(name) => name,
        Err(_) => {
            // Fall back to a dummy name for the handshake
            match ServerName::try_from("localhost".to_string()) {
                Ok(name) => name,
                Err(_) => return Vec::new(),
            }
        }
    };

    // Perform TLS handshake
    let tls_stream = match timeout(timeout_duration, connector.connect(server_name, stream)).await {
        Ok(Ok(s)) => s,
        Ok(Err(_)) | Err(_) => return Vec::new(),
    };

    // Extract peer certificates
    let (_, server_conn) = tls_stream.get_ref();
    let certs = match server_conn.peer_certificates() {
        Some(c) if !c.is_empty() => c,
        _ => return Vec::new(),
    };

    // Parse the first certificate (server certificate)
    let cert_der = &certs[0];
    let (_, cert) = match X509Certificate::from_der(cert_der.as_ref()) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    // Extract DNS names from Subject Alternative Name extension
    let mut dns_names = Vec::new();

    if let Ok(Some(san)) = cert.subject_alternative_name() {
        for name in &san.value.general_names {
            if let GeneralName::DNSName(dns_name) = name {
                let name_str = dns_name.to_string();
                // Skip wildcard certificates' wildcard prefix
                let clean_name = name_str
                    .strip_prefix("*.")
                    .map(String::from)
                    .unwrap_or(name_str);
                if !clean_name.is_empty() && !dns_names.contains(&clean_name) {
                    dns_names.push(clean_name);
                }
            }
        }
    }

    dns_names
}

/// Custom certificate verifier that accepts any certificate
/// Used only for extracting certificate information, not for security
#[derive(Debug)]
struct AcceptAnyCert;

impl rustls::client::danger::ServerCertVerifier for AcceptAnyCert {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        vec![
            rustls::SignatureScheme::RSA_PKCS1_SHA256,
            rustls::SignatureScheme::RSA_PKCS1_SHA384,
            rustls::SignatureScheme::RSA_PKCS1_SHA512,
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            rustls::SignatureScheme::ECDSA_NISTP384_SHA384,
            rustls::SignatureScheme::ECDSA_NISTP521_SHA512,
            rustls::SignatureScheme::RSA_PSS_SHA256,
            rustls::SignatureScheme::RSA_PSS_SHA384,
            rustls::SignatureScheme::RSA_PSS_SHA512,
            rustls::SignatureScheme::ED25519,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_extract_tls_san_names_unreachable_host() {
        // Connecting to an unreachable address should return empty vec
        let result = extract_tls_san_names(
            "192.0.2.1".parse().unwrap(), // TEST-NET, unreachable
            443,
            Duration::from_millis(100),
        )
        .await;
        assert!(result.is_empty());
    }
}
