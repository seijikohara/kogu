/**
 * Validates that every design token referenced from the `@theme inline` block
 * of `src/app.css` resolves to a custom property defined in
 * `src/lib/theme/tokens.generated.css` (or in `app.css` itself).
 *
 * Why this exists:
 * `app.css` maps Tailwind color tokens to project tokens with the kebab-case
 * form, e.g. `--color-surface-2: var(--surface-2)`. The generator
 * (`build-tokens.ts`) derives the variable names from `tokens.ts` keys via
 * `camelToKebab`. A naming drift between the two — for example a generator that
 * emits `--surface2` while `app.css` references `var(--surface-2)` — leaves the
 * referenced variable undefined, so the Tailwind utility (`bg-surface-2`)
 * silently resolves to transparent. `tsc` cannot see this, and regenerating the
 * CSS does not catch it because the generated file is internally consistent.
 *
 * This check fails when a `@theme inline` reference points to an undefined
 * variable, surfacing the drift in CI instead of as a blank surface in the app.
 *
 * Run with: bun run scripts/validate-tokens.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_CSS = join(ROOT, 'src', 'app.css');
const GENERATED_CSS = join(ROOT, 'src', 'lib', 'theme', 'tokens.generated.css');

// Collect every `--name` defined as a custom property (`--name:`) in a stylesheet.
const collectDefinedNames = (css: string): ReadonlySet<string> =>
	new Set(
		Array.from(css.matchAll(/(--[a-z0-9-]+)\s*:/gi), (match) => match[1] ?? '').filter(Boolean)
	);

// Extract the body of the `@theme inline { ... }` block by brace balancing.
const extractThemeInlineBlock = (css: string): string => {
	const start = css.indexOf('@theme inline');
	if (start === -1) return '';
	const open = css.indexOf('{', start);
	if (open === -1) return '';
	const depthScan = Array.from(css.slice(open)).reduce<{
		depth: number;
		end: number;
	}>(
		(state, char, index) => {
			if (state.end !== -1) return state;
			if (char === '{') return { ...state, depth: state.depth + 1 };
			if (char === '}') {
				const depth = state.depth - 1;
				return depth === 0 ? { depth, end: index } : { ...state, depth };
			}
			return state;
		},
		{ depth: 0, end: -1 }
	);
	return depthScan.end === -1 ? '' : css.slice(open + 1, open + depthScan.end);
};

// Collect every `var(--name)` reference inside a CSS fragment.
const collectReferencedNames = (css: string): readonly string[] =>
	Array.from(css.matchAll(/var\(\s*(--[a-z0-9-]+)/gi), (match) => match[1] ?? '').filter(Boolean);

const appCss = readFileSync(APP_CSS, 'utf8');
const generatedCss = readFileSync(GENERATED_CSS, 'utf8');

const defined = new Set<string>([
	...collectDefinedNames(generatedCss),
	...collectDefinedNames(appCss),
]);

const referenced = collectReferencedNames(extractThemeInlineBlock(appCss));
const missing = [...new Set(referenced.filter((name) => !defined.has(name)))].sort();

if (missing.length > 0) {
	console.error('❌ Token validation failed — `@theme inline` references undefined variables:');
	missing.forEach((name) => {
		console.error(`   var(${name}) is referenced in src/app.css but never defined.`);
	});
	console.error(
		'\nThese map to transparent / unset Tailwind utilities. Check that tokens.ts keys and the\n' +
			'`camelToKebab` output in tokens.generated.css match the kebab-case names used in app.css.'
	);
	process.exit(1);
}

console.log(
	`✅ Token validation passed — all ${referenced.length} @theme inline references resolve.`
);
