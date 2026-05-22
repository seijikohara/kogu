/**
 * Generates `src/lib/theme/tokens.generated.css` from `src/lib/theme/tokens.ts`.
 *
 * Run via `bun run build:tokens`. The generated file is imported from
 * `src/app.css` so the CSS variable layer always matches the TypeScript
 * source of truth.
 *
 * Run as part of `bun run check` to fail CI when the committed CSS is out
 * of sync with the tokens definition.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
	camelToKebab,
	COLOR,
	INTERACTIVE,
	LAYOUT,
	MOTION,
	RADIUS,
	SHADOW,
} from '../src/lib/theme/tokens.ts';

const renderColorBlock = (mode: 'light' | 'dark'): string => {
	const palette = COLOR[mode];
	return Object.entries(palette)
		.map(([key, value]) => `\t--${camelToKebab(key)}: ${value};`)
		.join('\n');
};

const renderShadowBlock = (mode: 'light' | 'dark'): string => {
	const shadows = SHADOW[mode];
	return Object.entries(shadows)
		.map(([key, value]) => `\t--shadow-${key}: ${value};`)
		.join('\n');
};

const renderInteractiveBlock = (mode: 'light' | 'dark'): string => {
	const set = INTERACTIVE[mode];
	return Object.entries(set)
		.map(([key, value]) => `\t--interactive-${key}: ${value};`)
		.join('\n');
};

const renderLayoutBlock = (): string =>
	Object.entries(LAYOUT)
		.map(([key, value]) => `\t--${camelToKebab(key)}: ${value};`)
		.join('\n');

const renderMotionBlock = (): string =>
	Object.entries(MOTION)
		.map(([key, value]) => `\t--${camelToKebab(key)}: ${value};`)
		.join('\n');

const HEADER = `/*
 * GENERATED FILE — do not edit by hand.
 * Source: src/lib/theme/tokens.ts
 * Regenerate via: bun run build:tokens
 */
`;

const lightBlock = [
	`:root {`,
	`\t--radius: ${RADIUS};`,
	renderLayoutBlock(),
	renderMotionBlock(),
	renderColorBlock('light'),
	renderShadowBlock('light'),
	renderInteractiveBlock('light'),
	`}`,
].join('\n');

const darkBlock = [
	`.dark {`,
	renderColorBlock('dark'),
	renderShadowBlock('dark'),
	renderInteractiveBlock('dark'),
	`}`,
].join('\n');

const css = `${HEADER}\n${lightBlock}\n\n${darkBlock}\n`;

const outPath = join(import.meta.dir, '..', 'src', 'lib', 'theme', 'tokens.generated.css');
writeFileSync(outPath, css);

console.log(`✅ wrote ${outPath} (${css.length} bytes)`);
