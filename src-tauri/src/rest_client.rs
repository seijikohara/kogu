//! HTTP REST client command.
//!
//! Provides a single Tauri command, [`rest_client_send`], that performs an
//! arbitrary HTTP request and returns the response captured as UTF-8 lossy
//! text along with timing and size metadata. The client uses `rustls-tls`
//! to avoid linking against system OpenSSL.

use std::time::Instant;

use serde::{Deserialize, Serialize};

/// HTTP request payload sent from the frontend.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestRequest {
    /// HTTP method (e.g. `GET`, `POST`). Parsed with [`reqwest::Method`].
    pub method: String,
    /// Absolute request URL.
    pub url: String,
    /// Request headers as ordered key/value pairs.
    pub headers: Vec<(String, String)>,
    /// Optional request body. Empty bodies are not transmitted.
    pub body: Option<String>,
    /// Whether to follow HTTP redirects (capped at 10 hops when enabled).
    pub follow_redirects: bool,
    /// Total request timeout in milliseconds.
    pub timeout_ms: u32,
}

/// HTTP response payload returned to the frontend.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestResponse {
    /// HTTP status code (e.g. 200, 404).
    pub status: u16,
    /// Canonical status reason phrase (e.g. "OK", "Not Found").
    pub status_text: String,
    /// Response headers in arrival order.
    pub headers: Vec<(String, String)>,
    /// Response body as UTF-8 lossy text.
    pub body: String,
    /// Total response body size in bytes.
    pub bytes_received: u64,
    /// Elapsed wall-clock time from request build to body read, in milliseconds.
    pub elapsed_ms: u128,
    /// Time to first byte: request build until the response headers arrive,
    /// in milliseconds. Covers DNS, connect, TLS, and server processing.
    pub ttfb_ms: u128,
    /// Time spent reading the response body after the headers arrived, in
    /// milliseconds (`elapsed_ms - ttfb_ms`).
    pub download_ms: u128,
    /// Final URL after redirects (matches `url` when redirects are disabled).
    pub final_url: String,
}

/// Send an arbitrary HTTP request and return the response.
///
/// # Errors
///
/// Returns an error string for invalid method names, client build failures,
/// transport errors (DNS, TLS, timeout), or body reads that exceed the
/// configured timeout.
#[tauri::command]
pub async fn rest_client_send(req: RestRequest) -> Result<RestResponse, String> {
    let started = Instant::now();

    let redirect_policy = if req.follow_redirects {
        reqwest::redirect::Policy::limited(10)
    } else {
        reqwest::redirect::Policy::none()
    };

    let client = reqwest::Client::builder()
        .redirect(redirect_policy)
        .timeout(std::time::Duration::from_millis(u64::from(req.timeout_ms)))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let method = req
        .method
        .parse::<reqwest::Method>()
        .map_err(|e| format!("Invalid HTTP method '{}': {e}", req.method))?;

    let request_with_headers = req
        .headers
        .iter()
        .fold(client.request(method, &req.url), |builder, (k, v)| {
            builder.header(k, v)
        });

    let request = match req.body.as_ref().filter(|b| !b.is_empty()) {
        Some(body) => request_with_headers.body(body.clone()),
        None => request_with_headers,
    };

    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    // The response future resolves once the status and headers have arrived, so
    // the elapsed time here is the time to first byte (DNS + connect + TLS +
    // server processing). The body is streamed separately below.
    let ttfb_ms = started.elapsed().as_millis();

    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or("").to_string();
    let headers: Vec<(String, String)> = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();
    let final_url = response.url().to_string();

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))?;
    let bytes_received = bytes.len() as u64;
    let body = String::from_utf8_lossy(&bytes).into_owned();

    let elapsed_ms = started.elapsed().as_millis();

    Ok(RestResponse {
        status: status.as_u16(),
        status_text,
        headers,
        body,
        bytes_received,
        elapsed_ms,
        ttfb_ms,
        download_ms: elapsed_ms.saturating_sub(ttfb_ms),
        final_url,
    })
}
