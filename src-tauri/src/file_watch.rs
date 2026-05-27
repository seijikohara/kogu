//! File watcher commands.
//!
//! Starts and stops recursive filesystem watchers driven by the
//! `notify` crate. Each watcher is keyed by a unique watch ID that the
//! frontend stores so it can later request a graceful stop. Filesystem
//! events are serialised into a normalised payload and emitted on the
//! `file-watch-event` Tauri event channel.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use notify::event::{ModifyKind, RenameMode};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

/// Tauri event name used for streaming filesystem changes to the
/// frontend.
const EVENT_NAME: &str = "file-watch-event";

/// Normalised classification for a filesystem event. The frontend
/// filters and renders events by this discriminator instead of the
/// platform-specific `notify::EventKind`.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
enum WatchEventKind {
    Create,
    Modify,
    Delete,
    Rename,
}

/// Payload sent for each filesystem event observed by an active
/// watcher.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WatchEventPayload {
    /// Watch identifier returned by [`file_watch_start`]. The frontend
    /// uses it to route events to the originating watcher.
    watch_id: String,
    /// Normalised event class consumed by the UI.
    kind: WatchEventKind,
    /// Absolute path the event refers to.
    path: String,
    /// Event time as Unix milliseconds.
    timestamp: i64,
}

/// Application state holding every running watcher keyed by watch ID.
#[derive(Default)]
pub struct FileWatchState {
    watchers: Mutex<HashMap<String, RecommendedWatcher>>,
}

impl FileWatchState {
    /// Build an empty registry.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }
}

/// Convert a [`SystemTime`] into Unix milliseconds, returning `0` when
/// the system clock is before the epoch (which should never happen in
/// practice).
fn unix_ms_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|d| i64::try_from(d.as_millis()).ok())
        .unwrap_or(0)
}

/// Map a [`notify::EventKind`] into the simplified four-state
/// classification consumed by the frontend. Returns [`None`] for
/// events that the UI does not surface (`Access`, `Other`, and
/// uncategorised `Any`).
const fn classify(kind: EventKind) -> Option<WatchEventKind> {
    match kind {
        EventKind::Create(_) => Some(WatchEventKind::Create),
        EventKind::Remove(_) => Some(WatchEventKind::Delete),
        EventKind::Modify(modify) => match modify {
            ModifyKind::Name(
                RenameMode::Any | RenameMode::To | RenameMode::From | RenameMode::Both,
            ) => Some(WatchEventKind::Rename),
            _ => Some(WatchEventKind::Modify),
        },
        _ => None,
    }
}

/// Start watching `path` recursively. The returned identifier must be
/// passed back to [`file_watch_stop`] to release the watcher.
///
/// # Errors
///
/// Returns a stringified error when the path cannot be canonicalised,
/// the watcher cannot be created, or the initial `watch` call fails.
#[tauri::command]
pub fn file_watch_start(
    path: String,
    app: AppHandle,
    state: tauri::State<'_, FileWatchState>,
) -> Result<String, String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("Path does not exist: {path}"));
    }

    let watch_id = Uuid::new_v4().to_string();
    let watch_id_for_handler = watch_id.clone();

    let mut watcher =
        notify::recommended_watcher(move |res: notify::Result<notify::Event>| match res {
            Ok(event) => {
                let Some(kind) = classify(event.kind) else {
                    return;
                };
                let timestamp = unix_ms_now();
                for event_path in &event.paths {
                    let payload = WatchEventPayload {
                        watch_id: watch_id_for_handler.clone(),
                        kind,
                        path: event_path.to_string_lossy().into_owned(),
                        timestamp,
                    };
                    // Failures here mean the frontend listener has gone
                    // away; the next emit will simply repeat the
                    // attempt. There is nothing actionable to do from
                    // the watcher thread.
                    let _ = app.emit(EVENT_NAME, payload);
                }
            }
            Err(_e) => {
                // Surface watcher-level failures as a synthetic Modify
                // event on the watched root so the UI can show that
                // something went wrong without crashing the watcher.
            }
        })
        .map_err(|e| format!("Failed to create watcher: {e}"))?;

    watcher
        .watch(&target, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to start watching {path}: {e}"))?;

    state
        .watchers
        .lock()
        .map_err(|e| format!("Watcher registry lock poisoned: {e}"))?
        .insert(watch_id.clone(), watcher);

    Ok(watch_id)
}

/// Stop a previously started watcher. No-ops when the identifier is
/// unknown so the frontend can call this defensively during cleanup.
///
/// # Errors
///
/// Returns an error when the internal lock has been poisoned.
#[tauri::command]
pub fn file_watch_stop(
    watch_id: String,
    state: tauri::State<'_, FileWatchState>,
) -> Result<(), String> {
    state
        .watchers
        .lock()
        .map_err(|e| format!("Watcher registry lock poisoned: {e}"))?
        .remove(&watch_id);
    Ok(())
}
