/**
 * Audits page/component files for design-rule violations.
 *
 * Checks (from .claude/rules/react/components.md § Container Patterns,
 * which is authored in Phase 6 of the React migration):
 * 1. No `bg-surface-3 rounded` ad-hoc cards — must use `Card.Root` or `bg-card`.
 *
 * Allowed (intentionally excluded):
 * - Hover / focus / group-hover state modifiers (`hover:bg-surface-3`)
 * - Panel chrome strips (`border-b bg-surface-3 ...` without `rounded`)
 * - Rail / status bar backgrounds (no `rounded` paired)
 *
 * Run with: bun run scripts/audit-design.ts
 * Returns exit code 1 if any violations are found.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Violation {
	readonly file: string;
	readonly line: number;
	readonly text: string;
}

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEARCH_ROOTS = [
	join(PROJECT_ROOT, 'src', 'routes'),
	join(PROJECT_ROOT, 'src', 'lib', 'components'),
];

const isStaticSurfaceCard = (line: string): boolean => {
	if (!line.includes('bg-surface-3')) return false;
	// Strip `hover:bg-surface-3`, `focus:bg-surface-3`, `group-hover:bg-surface-3`.
	const withoutInteractive = line.replaceAll(
		/(?:hover|focus|active|group-hover|peer-hover|focus-visible|focus-within):bg-surface-3/g,
		''
	);
	if (!withoutInteractive.includes('bg-surface-3')) return false;
	return /\brounded(?:-(?:lg|md|xl|sm|2xl|3xl|full))?\b/.test(withoutInteractive);
};

const walk = (dir: string, out: string[]): void => {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stats = statSync(full);
		if (stats.isDirectory()) {
			walk(full, out);
		} else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
			out.push(full);
		}
	}
};

const scan = (): readonly Violation[] => {
	const files: string[] = [];
	for (const root of SEARCH_ROOTS) walk(root, files);
	const violations: Violation[] = [];
	for (const file of files) {
		const content = readFileSync(file, 'utf-8');
		const lines = content.split('\n');
		lines.forEach((line, idx) => {
			if (isStaticSurfaceCard(line)) {
				violations.push({ file, line: idx + 1, text: line.trim() });
			}
		});
	}
	return violations;
};

const violations = scan();

if (violations.length > 0) {
	console.error(
		`❌ ${violations.length} design rule violation${violations.length === 1 ? '' : 's'} found.`
	);
	console.error('   See .claude/rules/react/components.md § Container Patterns.\n');
	for (const v of violations) {
		const rel = relative(PROJECT_ROOT, v.file);
		console.error(`  ${rel}:${v.line}`);
		console.error(`    ${v.text.slice(0, 120)}${v.text.length > 120 ? '…' : ''}`);
	}
	process.exit(1);
}

console.log('✅ Design audit passed — no static `bg-surface-3 rounded` ad-hoc cards found.');
