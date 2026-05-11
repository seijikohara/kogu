---
description: Start Kogu in Tauri dev mode. If a Tauri dev session is already running, stop it (with its Vite child) and clear stale build caches before starting a fresh instance. Use when the user asks to start, restart, relaunch, or reboot Tauri, or when Vite SSR errors point to stale module caches.
disable-model-invocation: true
allowed-tools: Bash(pgrep *), Bash(pkill *), Bash(ps *), Bash(lsof *), Bash(rm -rf .vite), Bash(rm -rf .svelte-kit/cache), Bash(bun run tauri:dev *), Bash(sleep *)
---

# Tauri Dev Restart

Run Kogu in Tauri dev mode with a clean Vite cache. The flow always lands in the same end state — a single fresh `tauri:dev` process — whether or not one was already running.

## When to use

- The user asks to start, restart, relaunch, reboot, or kick Tauri.
- Vite returns `500 Internal Error` for routes that pass `bun run check` (a stale SSR module-runner cache, see "Why clear caches" below).
- The user changes a shadcn / shell / panel primitive (e.g., `OptionsRail`, `OptionsPanel`, `CollapsibleAside`) and HMR fails to pick it up.

## Steps

### 1. Detect running Tauri dev session

```bash
pgrep -af "bun run tauri:dev|tauri dev|vite dev"
```

If the command returns one or more PIDs, a Tauri dev session is active. Proceed to step 2. Otherwise jump to step 3.

### 2. Stop the running session

Find the top-level `bun run tauri:dev` PID and kill its process group so the bash wrapper, `tauri dev`, and `vite dev` children all exit together:

```bash
TAURI_PID=$(pgrep -f "bun run tauri:dev" | head -1)
if [ -n "$TAURI_PID" ]; then
  pkill -TERM -P "$TAURI_PID" 2>/dev/null
  kill -TERM "$TAURI_PID" 2>/dev/null
fi
```

Verify everything is gone (Vite listens on port 1420, so its absence is a good signal):

```bash
sleep 2
lsof -nP -iTCP:1420 -sTCP:LISTEN
pgrep -af "bun run tauri:dev|tauri dev|vite dev"
```

If processes remain after 5 seconds, escalate with `SIGKILL`:

```bash
pkill -KILL -f "bun run tauri:dev|tauri dev|vite dev"
```

Do not use `kill -9` as the first move — it leaves the Cargo build lockfile and Vite's IPC socket in a dirty state, which makes the next start slower.

### 3. Clear stale build caches

```bash
rm -rf .vite
rm -rf .svelte-kit/cache
```

Do **not** delete `.svelte-kit` wholesale or `src-tauri/target` — those caches are expensive to rebuild and rarely cause SSR errors.

### 4. Start a fresh dev session

Launch in the background so the agent stays interactive:

```bash
bun run tauri:dev
```

Run this via `Bash` with `run_in_background: true`. The bash wrapper runs `bun run build:sidecar` first (rebuilds the Rust sidecar) and then `tauri dev --no-watch`. Initial start typically takes 30–60 seconds (Cargo + Vite warm-up).

### 5. Confirm readiness

Poll for the Vite dev port and report when it is listening:

```bash
for i in {1..60}; do
  lsof -nP -iTCP:1420 -sTCP:LISTEN >/dev/null 2>&1 && echo "ready" && break
  sleep 2
done
```

If the loop times out (120 seconds), inspect the background task output for the first error before retrying.

## Why clear caches

Vite's SSR module-runner keeps a per-route dependency graph in `.vite/`. When a long-lived dev session straddles multiple PR cycles that touch shadcn primitives or shell components (e.g., `OptionsRail` → `CollapsibleAside`), the cached graph diverges from disk. The symptom is `Preloading data for /<route> failed with the following error: Internal Error` in Tauri logs — these are warnings from SvelteKit's `data-sveltekit-preload-data="hover"`, not real navigation failures, but they still poison subsequent navigations. Wiping `.vite` forces a clean transform pass.

`.svelte-kit/cache` is wiped for the same reason: SvelteKit memoizes route manifests there and can hold references to deleted exports.

## Safety rules

- Never `kill -9` as the first move. `SIGTERM` first, `SIGKILL` only after a 5-second grace period.
- Never delete `src-tauri/target` or `.svelte-kit` wholesale to "fix" cache issues. They are not the source of dev-mode SSR cache bugs and rebuilding them takes minutes.
- Do not start a second `tauri:dev` if one is already running. Two Vite instances will fight over port 1420 and produce confusing logs.
- Do not run this skill while a Cargo / Vite build is finishing — wait for the previous start to settle (Vite listening on 1420) before issuing another restart, otherwise the sidecar build can corrupt the target directory.

## Troubleshooting

### Vite stays on port 1420 after kill

A leftover `node` or `bun` process is holding the port. Identify and kill it:

```bash
lsof -nP -iTCP:1420 -sTCP:LISTEN
kill -TERM <PID>
```

### Cargo build fails immediately after restart

If the sidecar build fails with a file-locking error, an old `cargo build` was still running. Wait 10 seconds and retry. If it persists, check `src-tauri/target/.rustc_info.json` for stale process IDs.

### Browser shows old content after restart

The Tauri webview caches the previous URL. Either:

- Navigate to a different route via the sidebar, or
- Force a reload with `window.location.reload()` from the webview console.
