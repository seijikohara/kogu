//! WebSocket Tester backend.
//!
//! Provides Tauri commands and a per-connection state map that bridge a
//! [`tokio_tungstenite`] WebSocket session to the frontend through Tauri
//! events. Each active connection has a unique string id (chosen by the
//! frontend, typically a UUID) that is used to address sends and closes.
//!
//! Custom request headers are deferred to a follow-up change: the MVP only
//! supports plain `ws://` / `wss://` connections with an optional list of
//! subprotocols.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use futures::{SinkExt, StreamExt};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::protocol::{Message, WebSocketConfig};

/// Maximum number of bytes echoed back to the frontend per frame. Larger
/// frames are truncated to keep the IPC payload bounded; the byte size is
/// preserved separately in [`WsMessagePayload::size_bytes`].
const MAX_FRAME_PREVIEW_BYTES: usize = 64 * 1024;

/// Per-connection control channel. Send a [`ControlMessage`] to ask the
/// connection task to either dispatch a frame or close the socket.
#[derive(Debug)]
enum ControlMessage {
    /// Forward a frame to the WebSocket peer.
    Send(Message),
    /// Initiate a clean close.
    Close,
}

/// Tauri-managed map of active connections. The mutex is uncontended in
/// practice (one entry per active socket), so a [`std::sync::Mutex`] is
/// sufficient and avoids dragging an async lock through command bodies.
#[derive(Default)]
pub struct WebSocketState {
    connections: Mutex<HashMap<String, mpsc::Sender<ControlMessage>>>,
}

impl WebSocketState {
    /// Construct an empty state map.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    fn insert(&self, conn_id: String, tx: mpsc::Sender<ControlMessage>) -> Result<(), String> {
        self.connections
            .lock()
            .map_err(|e| format!("WebSocket state lock poisoned: {e}"))?
            .insert(conn_id, tx);
        Ok(())
    }

    fn take(&self, conn_id: &str) -> Result<Option<mpsc::Sender<ControlMessage>>, String> {
        Ok(self
            .connections
            .lock()
            .map_err(|e| format!("WebSocket state lock poisoned: {e}"))?
            .remove(conn_id))
    }

    fn get(&self, conn_id: &str) -> Result<Option<mpsc::Sender<ControlMessage>>, String> {
        Ok(self
            .connections
            .lock()
            .map_err(|e| format!("WebSocket state lock poisoned: {e}"))?
            .get(conn_id)
            .cloned())
    }
}

/// Event payload describing a single WebSocket frame, in either direction.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WsMessagePayload {
    conn_id: String,
    direction: &'static str,
    kind: &'static str,
    data: String,
    size_bytes: u64,
    timestamp_ms: u64,
}

/// Event payload describing a connection-state transition.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WsStatePayload {
    conn_id: String,
    state: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
}

/// Decode a hex-encoded byte string. Whitespace and ASCII separator
/// characters (`:`, `-`, `,`, `_`) are ignored so the caller can paste
/// space-separated or `aa:bb:cc` style hex without preprocessing.
fn decode_hex(hex: &str) -> Result<Vec<u8>, String> {
    let cleaned: String = hex
        .chars()
        .filter(|c| !c.is_whitespace() && !matches!(c, ':' | '-' | ',' | '_'))
        .collect();
    if !cleaned.len().is_multiple_of(2) {
        return Err("Hex string must have an even number of digits".to_string());
    }
    (0..cleaned.len())
        .step_by(2)
        .map(|i| {
            cleaned
                .get(i..i + 2)
                .ok_or_else(|| "Hex string range error".to_string())
                .and_then(|pair| {
                    u8::from_str_radix(pair, 16)
                        .map_err(|e| format!("Invalid hex pair '{pair}': {e}"))
                })
        })
        .collect()
}

/// Encode bytes as a lowercase, separator-free hex string.
fn encode_hex(bytes: &[u8]) -> String {
    use std::fmt::Write as _;
    bytes
        .iter()
        .fold(String::with_capacity(bytes.len() * 2), |mut acc, b| {
            let _ = write!(&mut acc, "{b:02x}");
            acc
        })
}

/// Current unix timestamp in milliseconds. Returns `0` if the system clock
/// is set before the unix epoch, which should not happen in practice.
fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX))
}

/// Build a [`WsMessagePayload`] describing an outbound text or binary frame
/// that the client is about to send to the peer.
fn build_sent_payload(
    conn_id: &str,
    kind: &'static str,
    data: String,
    size_bytes: u64,
) -> WsMessagePayload {
    WsMessagePayload {
        conn_id: conn_id.to_string(),
        direction: "sent",
        kind,
        data,
        size_bytes,
        timestamp_ms: now_ms(),
    }
}

/// Emit a [`WsStatePayload`] on the `ws_state` channel; logs (does not
/// propagate) emit failures because state transitions are advisory.
fn emit_state(app: &AppHandle, conn_id: &str, state: &'static str, reason: Option<String>) {
    let payload = WsStatePayload {
        conn_id: conn_id.to_string(),
        state,
        reason,
    };
    let _ = app.emit("ws_state", payload);
}

/// Emit a [`WsMessagePayload`] on the `ws_message` channel.
fn emit_message(app: &AppHandle, payload: WsMessagePayload) {
    let _ = app.emit("ws_message", payload);
}

/// Convert an inbound [`Message`] from the WebSocket peer into the JSON
/// payload that the frontend renders as a chat bubble. Binary frames are
/// hex-encoded; ping/pong/close frames carry a textual description.
fn payload_from_received(conn_id: &str, msg: &Message) -> WsMessagePayload {
    let (kind, data, size_bytes): (&'static str, String, u64) = match msg {
        Message::Text(text) => {
            let bytes = text.as_bytes();
            let preview = if bytes.len() > MAX_FRAME_PREVIEW_BYTES {
                String::from_utf8_lossy(&bytes[..MAX_FRAME_PREVIEW_BYTES]).into_owned()
            } else {
                text.to_string()
            };
            ("text", preview, bytes.len() as u64)
        }
        Message::Binary(bytes) => {
            let slice = if bytes.len() > MAX_FRAME_PREVIEW_BYTES {
                &bytes[..MAX_FRAME_PREVIEW_BYTES]
            } else {
                bytes.as_ref()
            };
            ("binary", encode_hex(slice), bytes.len() as u64)
        }
        Message::Ping(payload) => ("ping", encode_hex(payload), payload.len() as u64),
        Message::Pong(payload) => ("pong", encode_hex(payload), payload.len() as u64),
        Message::Close(frame) => {
            let summary = frame.as_ref().map_or_else(
                || "no close frame".to_string(),
                |f| format!("{}: {}", u16::from(f.code), f.reason),
            );
            let len = summary.len() as u64;
            ("close", summary, len)
        }
        // tungstenite::Message::Frame is reserved for raw frame relaying and
        // is never produced by the high-level read API. Surface it as a
        // placeholder so downstream consumers always see a valid kind.
        Message::Frame(_) => ("binary", String::new(), 0),
    };
    WsMessagePayload {
        conn_id: conn_id.to_string(),
        direction: "received",
        kind,
        data,
        size_bytes,
        timestamp_ms: now_ms(),
    }
}

/// Open a WebSocket connection to `url`. Connection state transitions are
/// streamed to the frontend on the `ws_state` channel; received frames are
/// streamed on `ws_message`.
///
/// `headers` is accepted for API stability but is currently ignored — custom
/// header support is deferred to a follow-up change. `subprotocols` is
/// joined into a `Sec-WebSocket-Protocol` request header when non-empty.
#[tauri::command]
pub async fn ws_connect(
    state: State<'_, WebSocketState>,
    app: AppHandle,
    conn_id: String,
    url: String,
    headers: Vec<(String, String)>,
    subprotocols: Vec<String>,
) -> Result<(), String> {
    // Custom headers are deferred; the parameter is accepted to keep the
    // frontend API stable when we re-enable them.
    let _ = headers;

    emit_state(&app, &conn_id, "connecting", None);

    let mut request = url
        .as_str()
        .into_client_request()
        .map_err(|e| format!("Invalid WebSocket URL: {e}"))?;

    if !subprotocols.is_empty() {
        let joined = subprotocols.join(", ");
        let header_value = joined
            .parse()
            .map_err(|e| format!("Invalid subprotocol list '{joined}': {e}"))?;
        request
            .headers_mut()
            .insert("Sec-WebSocket-Protocol", header_value);
    }

    let config: Option<WebSocketConfig> = None;
    let connect_result = tokio_tungstenite::connect_async_with_config(request, config, false).await;

    let (ws_stream, _response) = match connect_result {
        Ok(pair) => pair,
        Err(e) => {
            let reason = format!("{e}");
            emit_state(&app, &conn_id, "closed", Some(reason.clone()));
            return Err(reason);
        }
    };

    emit_state(&app, &conn_id, "open", None);

    let (mut writer, mut reader) = ws_stream.split();
    let (tx, mut rx) = mpsc::channel::<ControlMessage>(32);
    state.insert(conn_id.clone(), tx)?;

    let app_for_task = app.clone();
    let conn_id_for_task = conn_id.clone();

    // The connection task cannot move the `State` directly (it borrows from
    // the command's stack frame). Instead, it captures the AppHandle and
    // looks up the managed `WebSocketState` from inside the task to remove
    // its entry when the read loop ends.
    tokio::spawn(async move {
        let close_reason: Option<String> = loop {
            tokio::select! {
                control = rx.recv() => {
                    match control {
                        Some(ControlMessage::Send(msg)) => {
                            if let Err(e) = writer.send(msg).await {
                                break Some(format!("Send failed: {e}"));
                            }
                        }
                        Some(ControlMessage::Close) => {
                            emit_state(&app_for_task, &conn_id_for_task, "closing", None);
                            let _ = writer.send(Message::Close(None)).await;
                            break Some("client closed".to_string());
                        }
                        None => {
                            // Channel dropped from the state map; treat as a
                            // client-initiated close.
                            break Some("connection handle dropped".to_string());
                        }
                    }
                }
                incoming = reader.next() => {
                    match incoming {
                        Some(Ok(msg)) => {
                            let is_close = matches!(msg, Message::Close(_));
                            emit_message(&app_for_task, payload_from_received(&conn_id_for_task, &msg));
                            if is_close {
                                break match msg {
                                    Message::Close(Some(frame)) => Some(format!(
                                        "peer closed: {} {}",
                                        u16::from(frame.code),
                                        frame.reason
                                    )),
                                    _ => Some("peer closed".to_string()),
                                };
                            }
                        }
                        Some(Err(e)) => {
                            break Some(format!("Read error: {e}"));
                        }
                        None => {
                            break Some("stream ended".to_string());
                        }
                    }
                }
            }
        };

        // Cleanup: remove the entry from the managed state map if it has not
        // already been taken by ws_close.
        if let Some(ws_state) = app_for_task.try_state::<WebSocketState>() {
            let _ = ws_state.take(&conn_id_for_task);
        }
        emit_state(&app_for_task, &conn_id_for_task, "closed", close_reason);
    });

    Ok(())
}

/// Send a single frame on an open WebSocket connection. `kind` must be
/// either `"text"` or `"binary"`; binary frames carry hex-encoded bytes in
/// `data`.
#[tauri::command]
pub async fn ws_send(
    state: State<'_, WebSocketState>,
    app: AppHandle,
    conn_id: String,
    kind: String,
    data: String,
) -> Result<(), String> {
    let tx = state
        .get(&conn_id)?
        .ok_or_else(|| format!("No active connection for id '{conn_id}'"))?;

    let (message, payload) = match kind.as_str() {
        "text" => {
            let size = data.len() as u64;
            (
                Message::Text(data.clone().into()),
                build_sent_payload(&conn_id, "text", data, size),
            )
        }
        "binary" => {
            let bytes = decode_hex(&data)?;
            let size = bytes.len() as u64;
            let preview = if bytes.len() > MAX_FRAME_PREVIEW_BYTES {
                encode_hex(&bytes[..MAX_FRAME_PREVIEW_BYTES])
            } else {
                encode_hex(&bytes)
            };
            (
                Message::Binary(bytes.into()),
                build_sent_payload(&conn_id, "binary", preview, size),
            )
        }
        other => return Err(format!("Unsupported frame kind '{other}'")),
    };

    tx.send(ControlMessage::Send(message))
        .await
        .map_err(|e| format!("Failed to enqueue send: {e}"))?;

    // Reflect the outbound frame to the frontend so the chat log can show
    // both sides without waiting for the writer to acknowledge.
    emit_message(&app, payload);
    Ok(())
}

/// Request an orderly close on an open WebSocket connection. The matching
/// `ws_state` event with `state: "closed"` is emitted from the connection
/// task once the close handshake finishes.
#[tauri::command]
pub async fn ws_close(state: State<'_, WebSocketState>, conn_id: String) -> Result<(), String> {
    let tx = state
        .take(&conn_id)?
        .ok_or_else(|| format!("No active connection for id '{conn_id}'"))?;
    tx.send(ControlMessage::Close)
        .await
        .map_err(|e| format!("Failed to enqueue close: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_hex_accepts_lowercase() {
        assert_eq!(decode_hex("48656c6c6f").unwrap(), b"Hello");
    }

    #[test]
    fn test_decode_hex_accepts_uppercase_and_spaces() {
        assert_eq!(decode_hex("48 65 6C 6C 6F").unwrap(), b"Hello");
    }

    #[test]
    fn test_decode_hex_accepts_colon_separators() {
        assert_eq!(decode_hex("aa:bb:cc").unwrap(), vec![0xaa, 0xbb, 0xcc]);
    }

    #[test]
    fn test_decode_hex_rejects_odd_length() {
        assert!(decode_hex("abc").is_err());
    }

    #[test]
    fn test_decode_hex_rejects_invalid_digits() {
        assert!(decode_hex("zz").is_err());
    }

    #[test]
    fn test_encode_hex_roundtrip() {
        let bytes = vec![0x00, 0x10, 0xff, 0xab];
        assert_eq!(decode_hex(&encode_hex(&bytes)).unwrap(), bytes);
    }
}
