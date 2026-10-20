import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installMermaidPolyfills } from './mermaid-runtime';

type GroupBy = <T>(
	items: Iterable<T>,
	keyOf: (item: T, index: number) => PropertyKey
) => Record<PropertyKey, T[]>;

// Snapshot the globals the shims touch so every test can remove them and
// restore the jsdom originals afterwards.
const saved = {
	groupBy: Object.getOwnPropertyDescriptor(Object, 'groupBy'),
	canParse: Object.getOwnPropertyDescriptor(URL, 'canParse'),
	styleSheet: Object.getOwnPropertyDescriptor(globalThis, 'CSSStyleSheet'),
};

const restore = (target: object, name: string, descriptor: PropertyDescriptor | undefined) => {
	Reflect.deleteProperty(target, name);
	if (descriptor) Object.defineProperty(target, name, descriptor);
};

const readGroupBy = (): GroupBy => {
	const groupBy: unknown = Reflect.get(Object, 'groupBy');
	if (typeof groupBy !== 'function') throw new Error('Object.groupBy is missing');
	return (items, keyOf) => Reflect.apply(groupBy, Object, [items, keyOf]);
};

describe('installMermaidPolyfills', () => {
	beforeEach(() => {
		Reflect.deleteProperty(Object, 'groupBy');
		Reflect.deleteProperty(URL, 'canParse');
	});

	afterEach(() => {
		restore(Object, 'groupBy', saved.groupBy);
		restore(URL, 'canParse', saved.canParse);
		restore(globalThis, 'CSSStyleSheet', saved.styleSheet);
	});

	it('adds Object.groupBy with property-key grouping and a null prototype', () => {
		installMermaidPolyfills();
		const groups = readGroupBy()(['a', 'bb', 'cc', 'd'], (item, index) =>
			index === 0 ? 1 : item.length === 1 ? '1' : 2
		);

		expect(Object.getPrototypeOf(groups)).toBeNull();
		expect(groups['1']).toEqual(['a', 'd']);
		expect(groups['2']).toEqual(['bb', 'cc']);
	});

	it('adds URL.canParse', () => {
		installMermaidPolyfills();

		expect(URL.canParse('https://example.com/a')).toBe(true);
		expect(URL.canParse('/a', 'https://example.com')).toBe(true);
		expect(URL.canParse('not a url')).toBe(false);
	});

	it('keeps native implementations', () => {
		const nativeCanParse = (_url: string | URL, _base?: string | URL) => true;
		Object.defineProperty(URL, 'canParse', { value: nativeCanParse, configurable: true });

		installMermaidPolyfills();

		expect(Reflect.get(URL, 'canParse')).toBe(nativeCanParse);
	});

	it('constructs style sheets from a <style> element when the constructor is missing', async () => {
		const Native = globalThis.CSSStyleSheet;
		function IllegalConstructor() {
			throw new TypeError('Illegal constructor');
		}
		IllegalConstructor.prototype = Native.prototype;
		Object.defineProperty(globalThis, 'CSSStyleSheet', {
			value: IllegalConstructor,
			writable: true,
			configurable: true,
		});

		installMermaidPolyfills();
		const sheet = new CSSStyleSheet();
		sheet.insertRule(':root { --mermaid-font-family: inherit }', sheet.cssRules.length);

		expect(sheet.cssRules).toHaveLength(1);
		expect(sheet.cssRules[0]?.cssText).toContain('--mermaid-font-family');
		expect(document.head.querySelectorAll('style[media="not all"]')).toHaveLength(1);

		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.head.querySelectorAll('style[media="not all"]')).toHaveLength(0);
	});
});
