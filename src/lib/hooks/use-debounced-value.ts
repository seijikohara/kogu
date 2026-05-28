/**
 * Project-wide debounce primitives for reactive input-driven
 * computations.
 *
 * Use [`useDebouncedValue`] to throttle a piece of state that drives a
 * downstream effect (Tauri `invoke`, Web Worker `postMessage`, WASM
 * call, network request, or any expensive sync computation). Use
 * [`useDebouncedCallback`] for click / change handlers whose body
 * performs the same kind of work.
 *
 * Picking between debounce and React 19's `useDeferredValue`:
 *
 * - **`useDebouncedValue` (this hook)** — for state that flows into an
 *   `useEffect` performing I/O. `useDeferredValue` does not delay
 *   effects; it only marks the current frame as transitional, so the
 *   effect still fires on every keystroke with the latest value.
 * - **`useDeferredValue`** — for *synchronous* derived JSX where you
 *   want React to keep the previous render visible while computing
 *   the new one. Cheaper to integrate (no `useState` indirection) but
 *   does nothing for effects.
 *
 * Delay defaults: 100ms for cheap formatters, 150ms for medium-cost
 * routes, 200-250ms for expensive (regex AST, WASM compress, etc.).
 * The hook accepts an explicit `delayMs` so per-route tuning stays
 * one number; the default mirrors the medium-cost case.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Return a debounced mirror of `value`. The returned value lags
 * `value` by `delayMs` milliseconds and only updates after `value`
 * has settled — successive changes inside the window collapse into a
 * single update.
 */
export const useDebouncedValue = <T>(value: T, delayMs = 200): T => {
	const [debounced, setDebounced] = useState<T>(value);
	useEffect(() => {
		const handle = window.setTimeout(() => setDebounced(value), delayMs);
		return () => window.clearTimeout(handle);
	}, [value, delayMs]);
	return debounced;
};

/**
 * Return a debounced wrapper around `fn`. Successive calls inside
 * `delayMs` collapse into a single trailing invocation. The wrapper
 * keeps a stable identity across renders (safe to use as an effect
 * dependency or pass to memoized children).
 */
export const useDebouncedCallback = <Args extends readonly unknown[]>(
	fn: (...args: Args) => void,
	delayMs = 200
): ((...args: Args) => void) => {
	const fnRef = useRef(fn);
	const timerRef = useRef<number | null>(null);

	useEffect(() => {
		fnRef.current = fn;
	}, [fn]);

	useEffect(
		() => () => {
			if (timerRef.current !== null) {
				window.clearTimeout(timerRef.current);
			}
		},
		[]
	);

	return useCallback(
		(...args: Args) => {
			if (timerRef.current !== null) {
				window.clearTimeout(timerRef.current);
			}
			timerRef.current = window.setTimeout(() => {
				timerRef.current = null;
				fnRef.current(...args);
			}, delayMs);
		},
		[delayMs]
	);
};
