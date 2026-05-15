/**
 * Persisted reactive state helper.
 *
 * Wraps a Svelte 5 `$state` value with localStorage persistence so ephemeral UI
 * preferences (sidebar collapsed flag, active tabs, per-tool option selections)
 * survive an app restart. Real settings that need cross-device portability or
 * structured schema validation should continue to use the Tauri TOML-backed
 * `settings.ts` service.
 *
 * Design notes:
 * - Returns an object exposing a `current` getter/setter so callers can use
 *   `state.current` for reads/writes and `bind:value={state.current}` for
 *   two-way binding on shadcn-svelte primitives.
 * - SSR-safe: every `localStorage` access is wrapped in `typeof window !==
 *   'undefined'` plus `try/catch`. The Tauri webview always has a window, but
 *   `svelte-check` also validates server context.
 * - 200KB soft cap on serialized JSON guards against accidentally persisting
 *   large code editor content. Writes above the cap are skipped with a
 *   `console.warn`; the in-memory value still updates normally.
 * - Uses `$effect.root` because the helper may be called at module scope
 *   (outside a component context). The root effect is intentionally never
 *   cleaned up — these stores live for the lifetime of the app.
 */

const KEY_PREFIX = 'kogu:';
const MAX_SERIALIZED_LENGTH = 200_000;

/** Reactive value mirrored to localStorage. */
export interface Persisted<T> {
	/** Current value (reactive). */
	current: T;
}

/**
 * Read a JSON-serialised value from localStorage with a typed fallback.
 *
 * Returns the fallback when the key is missing, when storage is unavailable
 * (SSR, privacy mode, quota exceeded reads), or when JSON parsing fails.
 */
const readStored = <T>(key: string, fallback: T): T => {
	if (typeof window === 'undefined') return fallback;
	try {
		const raw = window.localStorage.getItem(key);
		if (raw === null) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
};

/**
 * Write a JSON-serialisable value to localStorage, skipping writes that exceed
 * the soft size cap or fail (quota, disabled storage, SSR).
 */
const writeStored = <T>(key: string, value: T): void => {
	if (typeof window === 'undefined') return;
	try {
		const serialized = JSON.stringify(value);
		if (serialized.length > MAX_SERIALIZED_LENGTH) {
			// Avoid filling the 5 MB localStorage quota with one giant entry.
			console.warn(
				`[persisted] Skipping write for "${key}": serialized size ${serialized.length} exceeds ${MAX_SERIALIZED_LENGTH} chars.`
			);
			return;
		}
		window.localStorage.setItem(key, serialized);
	} catch {
		// Quota exceeded, storage disabled, or value not serialisable.
	}
};

/**
 * Create a reactive value mirrored to `localStorage` under `kogu:<key>`.
 *
 * Reads the stored value on first access (falling back to `initial`) and
 * registers a root effect that writes future updates back to storage.
 *
 * @example
 * ```ts
 * const sidebarOpen = persisted('sidebar:open', true);
 * sidebarOpen.current = false; // persists across restarts
 * ```
 */
export const persisted = <T>(key: string, initial: T): Persisted<T> => {
	const storageKey = `${KEY_PREFIX}${key}`;
	let value = $state<T>(readStored(storageKey, initial));

	$effect.root(() => {
		$effect(() => {
			writeStored(storageKey, value);
		});
	});

	return {
		get current() {
			return value;
		},
		set current(next: T) {
			value = next;
		},
	};
};
