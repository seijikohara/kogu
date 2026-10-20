/**
 * Runtime shims for mermaid 12 on older WebKit.
 *
 * mermaid 12 is built for Safari 17.4. kogu keeps macOS 13 as its minimum and
 * builds for `safari16` (see `build.target` in vite.config.ts). Vite lowers
 * mermaid's syntax for that target, but it cannot add missing runtime APIs.
 * mermaid and its dependencies call these APIs without a feature check:
 *
 * - `new CSSStyleSheet()` (Safari 16.4): mermaid builds a style sheet on every
 *   render. mermaid 11.15+ already needed it.
 * - `URL.canParse` (Safari 17): @braintree/sanitize-url checks diagram links.
 * - `Object.groupBy` (Safari 17.4): chevrotain validates mermaid's use-case
 *   diagram grammar. This one is new in mermaid 12.
 *
 * Each shim installs only when the API is missing, so current WebViews keep
 * their native implementations.
 */

const defineMissing = (target: object, name: string, value: unknown): void => {
	if (typeof Reflect.get(target, name) === 'function') return;
	Object.defineProperty(target, name, { value, writable: true, configurable: true });
};

/** Follow the spec: group by property key, into an object with a null prototype. */
const objectGroupBy = <T>(
	items: Iterable<T>,
	keyOf: (item: T, index: number) => PropertyKey
): Record<PropertyKey, T[]> => {
	const groups: Record<PropertyKey, T[]> = Object.create(null);
	let index = 0;
	for (const item of items) {
		const key = keyOf(item, index);
		index += 1;
		const group = groups[key];
		if (group) group.push(item);
		else groups[key] = [item];
	}
	return groups;
};

const urlCanParse = (url: string | URL, base?: string | URL): boolean => {
	try {
		return new URL(url, base).href.length > 0;
	} catch {
		return false;
	}
};

const canConstructStyleSheets = (): boolean => {
	try {
		return new CSSStyleSheet() instanceof CSSStyleSheet;
	} catch {
		return false;
	}
};

/**
 * Stand in for the `CSSStyleSheet` constructor with the sheet of an inert
 * `<style media="not all">` element. mermaid only inserts and reads rules
 * synchronously, so the element is removed after the current task.
 */
function StyleElementSheet(): CSSStyleSheet {
	const style = document.createElement('style');
	style.media = 'not all';
	document.head.append(style);
	const { sheet } = style;
	if (!sheet) throw new TypeError('CSSStyleSheet shim: <style> has no sheet');
	setTimeout(() => style.remove(), 0);
	return sheet;
}

/** Install the shims mermaid 12 needs; call this before importing mermaid. */
export const installMermaidPolyfills = (): void => {
	defineMissing(Object, 'groupBy', objectGroupBy);
	defineMissing(URL, 'canParse', urlCanParse);
	if (typeof CSSStyleSheet === 'function' && !canConstructStyleSheets()) {
		StyleElementSheet.prototype = CSSStyleSheet.prototype;
		Object.defineProperty(globalThis, 'CSSStyleSheet', {
			value: StyleElementSheet,
			writable: true,
			configurable: true,
		});
	}
};
