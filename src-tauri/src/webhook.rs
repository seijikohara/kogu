//! Local HTTP listener for inspecting incoming webhook requests.
//!
//! Exposes three Tauri commands (`webhook_start`, `webhook_stop`,
//! `webhook_status`) that manage a single-instance HTTP server bound to
//! `127.0.0.1` only. Every incoming request is emitted to the frontend via
//! the `webhook_request` event with full request metadata (method, path,
//! query, headers, body, remote address, timestamp).
//!
//! # Security
//!
//! The listener binds to `127.0.0.1` exclusively. It is never reachable
//! from another machine, container, or VM. This is enforced in
//! [`bind_loopback`] below — there is no code path that constructs a
//! `0.0.0.0` or routable `SocketAddr`.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::body::to_bytes;
use axum::extract::{ConnectInfo, Request, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::any;
use axum::Router;
use serde::Serialize;
use tauri::Emitter;
use tokio::sync::{oneshot, Mutex};
use uuid::Uuid;

/// Tauri event name carrying each captured request.
const WEBHOOK_REQUEST_EVENT: &str = "webhook_request";

/// Upper bound on captured body bytes. 16 MiB matches what the REST client
/// can already handle and prevents a misconfigured caller from exhausting
/// memory by streaming gigabytes of body.
const MAX_BODY_BYTES: usize = 16 * 1024 * 1024;

/// Result returned to the frontend after a successful start.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookStartResult {
    /// Full origin (e.g. `http://127.0.0.1:54321`).
    pub address: String,
    /// Bound port number. Useful when `port = None` was passed in.
    pub port: u16,
}

/// Reported state for the status command.
#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WebhookStatus {
    /// `true` when a server task is currently running.
    pub running: bool,
    /// Bound origin when running.
    pub address: Option<String>,
    /// Bound port when running.
    pub port: Option<u16>,
}

/// Single captured request emitted to the frontend.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebhookRequest {
    /// Stable id (UUID v4) per request.
    pub id: String,
    /// Unix epoch milliseconds when the request was received.
    pub timestamp_ms: u128,
    /// HTTP method (e.g. `GET`, `POST`).
    pub method: String,
    /// Path component of the request URI (always starts with `/`).
    pub path: String,
    /// Raw query string (does not include leading `?`; empty if absent).
    pub query: String,
    /// Header pairs in arrival order, values lossily UTF-8 decoded.
    pub headers: Vec<(String, String)>,
    /// Request body as UTF-8 lossy text. Truncated at `MAX_BODY_BYTES`.
    pub body: String,
    /// Total body size in bytes (pre-truncation).
    pub body_bytes: u64,
    /// Remote socket address.
    pub remote_addr: String,
}

/// Configurable response applied to every incoming request.
#[derive(Debug, Clone)]
struct ResponseConfig {
    status: u16,
    content_type: String,
    body: String,
}

/// State shared with the request handler.
#[derive(Clone)]
struct HandlerState {
    app: tauri::AppHandle,
    response: ResponseConfig,
}

/// Per-server task handle: shutdown signal + bound metadata.
struct RunningServer {
    shutdown: oneshot::Sender<()>,
    address: String,
    port: u16,
}

/// Tauri-managed state. `None` when no server is running.
#[derive(Default)]
pub struct WebhookState {
    inner: Arc<Mutex<Option<RunningServer>>>,
}

impl WebhookState {
    /// Construct an empty state ready to host a single server.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }
}

/// Build a loopback `SocketAddr`. This is the *only* place the server's
/// bind address is constructed, so the `127.0.0.1` invariant is co-located
/// with the security comment at the top of this file.
fn bind_loopback(port: u16) -> SocketAddr {
    SocketAddr::from(([127, 0, 0, 1], port))
}

/// Convert a [`HeaderMap`] into an ordered `Vec<(String, String)>`. Values
/// that are not valid UTF-8 are reported as an empty string rather than
/// dropped, preserving header ordering for diagnostic display.
fn header_pairs(headers: &HeaderMap<HeaderValue>) -> Vec<(String, String)> {
    headers
        .iter()
        .map(|(name, value)| {
            (
                name.as_str().to_string(),
                value.to_str().unwrap_or("").to_string(),
            )
        })
        .collect()
}

/// Return current wall-clock time in epoch milliseconds. Falls back to `0`
/// when the system clock is before 1970, which is fine for diagnostic UI.
fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis())
}

/// Request handler: capture the request, emit the event, return the
/// user-configured response. Reads the entire body up to `MAX_BODY_BYTES`.
async fn handle(
    State(state): State<HandlerState>,
    ConnectInfo(remote): ConnectInfo<SocketAddr>,
    request: Request,
) -> Response {
    let method = request.method().as_str().to_string();
    let path = request.uri().path().to_string();
    let query = request.uri().query().unwrap_or("").to_string();
    let headers = header_pairs(request.headers());

    let (_, body) = request.into_parts();
    let body_bytes = to_bytes(body, MAX_BODY_BYTES).await.unwrap_or_default();
    let body_len = body_bytes.len();
    let body_text = String::from_utf8_lossy(&body_bytes).into_owned();

    let captured = WebhookRequest {
        id: Uuid::new_v4().to_string(),
        timestamp_ms: now_ms(),
        method,
        path,
        query,
        headers,
        body: body_text,
        body_bytes: body_len as u64,
        remote_addr: remote.to_string(),
    };

    // Fire-and-forget emit: even if the frontend listener is gone we still
    // want to send the response so the caller does not block.
    let _ = state.app.emit(WEBHOOK_REQUEST_EVENT, captured);

    build_response(&state.response)
}

/// Render the user-configured response. Falls back to `200 OK` if the
/// configured status is not a valid HTTP status code.
fn build_response(cfg: &ResponseConfig) -> Response {
    let status = StatusCode::from_u16(cfg.status).unwrap_or(StatusCode::OK);
    let content_type =
        HeaderValue::from_str(&cfg.content_type).unwrap_or(HeaderValue::from_static("text/plain"));
    let mut response = (status, cfg.body.clone()).into_response();
    response
        .headers_mut()
        .insert(axum::http::header::CONTENT_TYPE, content_type);
    response
}

/// Start the listener. Stops any previously running server first so the
/// command is idempotent from the UI's perspective.
///
/// # Errors
///
/// Returns an error string when binding to the requested port fails.
#[tauri::command]
pub async fn webhook_start(
    state: tauri::State<'_, WebhookState>,
    app: tauri::AppHandle,
    port: Option<u16>,
    status: u16,
    response_body: String,
    response_content_type: String,
) -> Result<WebhookStartResult, String> {
    // Replace any existing server before starting the new one so the user
    // cannot accidentally orphan a listener by clicking Start twice.
    {
        let mut guard = state.inner.lock().await;
        if let Some(existing) = guard.take() {
            let _ = existing.shutdown.send(());
        }
    }

    let response = ResponseConfig {
        status,
        content_type: response_content_type,
        body: response_body,
    };
    let handler_state = HandlerState {
        app: app.clone(),
        response,
    };

    let router = Router::new()
        .fallback(any(handle))
        .with_state(handler_state);

    let bind_addr = bind_loopback(port.unwrap_or(0));
    let listener = tokio::net::TcpListener::bind(bind_addr)
        .await
        .map_err(|e| format!("Failed to bind {bind_addr}: {e}"))?;
    let bound = listener
        .local_addr()
        .map_err(|e| format!("Failed to read bound address: {e}"))?;

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    let make_service = router.into_make_service_with_connect_info::<SocketAddr>();

    tokio::spawn(async move {
        let _ = axum::serve(listener, make_service)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .await;
    });

    let address = format!("http://{bound}");
    let port = bound.port();

    {
        let mut guard = state.inner.lock().await;
        *guard = Some(RunningServer {
            shutdown: shutdown_tx,
            address: address.clone(),
            port,
        });
    }

    Ok(WebhookStartResult { address, port })
}

/// Stop the listener if one is running. No-op when already stopped.
///
/// # Errors
///
/// Currently never returns an error; the signature reserves `Result` so a
/// future implementation can surface shutdown failures without breaking
/// the IPC contract.
#[tauri::command]
pub async fn webhook_stop(state: tauri::State<'_, WebhookState>) -> Result<(), String> {
    let taken = {
        let mut guard = state.inner.lock().await;
        guard.take()
    };
    if let Some(existing) = taken {
        let _ = existing.shutdown.send(());
    }
    Ok(())
}

/// Report the current running state of the listener.
///
/// # Errors
///
/// Currently never returns an error; the signature reserves `Result` so a
/// future implementation can surface lock contention or other failures.
#[tauri::command]
pub async fn webhook_status(
    state: tauri::State<'_, WebhookState>,
) -> Result<WebhookStatus, String> {
    let guard = state.inner.lock().await;
    Ok(guard
        .as_ref()
        .map_or_else(WebhookStatus::default, |running| WebhookStatus {
            running: true,
            address: Some(running.address.clone()),
            port: Some(running.port),
        }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bind_loopback_uses_127_0_0_1() {
        let addr = bind_loopback(0);
        assert_eq!(addr.ip().to_string(), "127.0.0.1");
        assert_eq!(addr.port(), 0);
    }

    #[test]
    fn header_pairs_preserves_order_and_lossy_values() {
        let mut headers = HeaderMap::new();
        headers.append("x-first", HeaderValue::from_static("1"));
        headers.append("x-second", HeaderValue::from_static("two"));
        let pairs = header_pairs(&headers);
        assert_eq!(pairs.len(), 2);
        assert_eq!(pairs[0], ("x-first".to_string(), "1".to_string()));
        assert_eq!(pairs[1], ("x-second".to_string(), "two".to_string()));
    }

    #[test]
    fn build_response_falls_back_to_ok_for_invalid_status() {
        let cfg = ResponseConfig {
            status: 9999,
            content_type: "text/plain".to_string(),
            body: "ok".to_string(),
        };
        let response = build_response(&cfg);
        assert_eq!(response.status(), StatusCode::OK);
    }
}
