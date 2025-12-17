---
paths: '{src-tauri/**/*.rs,**/*.ts}'
---

# Tauri Command Patterns

## Tauri 2.x API

This project uses Tauri 2.x. Key differences from 1.x:

- Plugin-based architecture
- New permission system
- Updated API paths

## Rust Commands

### Basic Command

```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| eprintln!("Application error: {e}"));
}
```

### Async Command

```rust
#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    // Async operation
    Ok("data".to_string())
}
```

### With State

```rust
use std::sync::Mutex;

struct AppState {
    counter: Mutex<i32>,
}

#[tauri::command]
fn increment(state: tauri::State<AppState>) -> Result<i32, String> {
    let mut counter = state
        .counter
        .lock()
        .map_err(|e| format!("Lock poisoned: {e}"))?;
    *counter += 1;
    Ok(*counter)
}
```

## Frontend Invocation

### Basic Call

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke<string>('greet', { name: 'World' });
```

### With Error Handling

```typescript
import { invoke } from '@tauri-apps/api/core';

const fetchData = async (url: string): Promise<Result<string>> => {
	try {
		const data = await invoke<string>('fetch_data', { url });
		return { ok: true, value: data };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
};
```

## Plugins Used

### Clipboard

```typescript
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';

// Write to clipboard
await writeText('Hello, World!');

// Read from clipboard
const text = await readText();
```

### OS Info

```typescript
import { platform, arch, version } from '@tauri-apps/plugin-os';

const os = await platform(); // 'macos', 'windows', 'linux'
const architecture = await arch(); // 'x86_64', 'aarch64'
```

### Opener

```typescript
import { open } from '@tauri-apps/plugin-opener';

// Open URL in default browser
await open('https://example.com');

// Open file with default app
await open('/path/to/file.pdf');
```

## Capabilities Configuration

Permissions are configured in `src-tauri/capabilities/default.json`:

```json
{
	"$schema": "../gen/schemas/desktop-schema.json",
	"identifier": "default",
	"description": "Default capabilities",
	"windows": ["main"],
	"permissions": ["core:default", "opener:default", "clipboard-manager:default", "os:default"]
}
```

## Window Management

### Main Window Config

```json
// src-tauri/tauri.conf.json
{
	"app": {
		"windows": [
			{
				"title": "Kogu",
				"width": 1200,
				"height": 800,
				"resizable": true,
				"fullscreen": false,
				"decorations": true
			}
		]
	}
}
```

### Programmatic Window

```rust
use tauri::Manager;

#[tauri::command]
fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    tauri::WebviewWindowBuilder::new(
        &app,
        "settings",
        tauri::WebviewUrl::App("settings".into())
    )
    .title("Settings")
    .inner_size(600.0, 400.0)
    .build()
    .map_err(|e| format!("Failed to create window: {e}"))?;
    Ok(())
}
```

## Event System

### Emit from Rust

```rust
use tauri::Emitter;

#[tauri::command]
fn process_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    // Emit progress events
    app.emit("progress", 50)
        .map_err(|e| format!("Emit failed: {e}"))?;
    // ... processing ...
    app.emit("progress", 100)
        .map_err(|e| format!("Emit failed: {e}"))?;
    Ok(())
}
```

### Listen in Frontend

```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<number>('progress', (event) => {
	console.log(`Progress: ${event.payload}%`);
});

// Cleanup
unlisten();
```

## Best Practices

### Error Handling

```rust
#[derive(Debug, thiserror::Error)]
enum CommandError {
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("Parse error: {0}")]
    ParseError(String),
}

impl serde::Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[tauri::command]
fn read_file(path: String) -> Result<String, CommandError> {
    std::fs::read_to_string(&path)
        .map_err(|_| CommandError::FileNotFound(path))
}
```

### Type Safety

Define shared types:

```rust
// Rust
#[derive(serde::Serialize, serde::Deserialize)]
struct FileInfo {
    name: String,
    size: u64,
    modified: u64,
}
```

```typescript
// TypeScript
interface FileInfo {
	name: string;
	size: number;
	modified: number;
}

const info = await invoke<FileInfo>('get_file_info', { path });
```
