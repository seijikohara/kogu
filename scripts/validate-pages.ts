/**
 * Validates that pages.ts is in sync with actual tab files in the routes directory.
 *
 * This script ensures that:
 * 1. All tab files in routes/*-formatter/tabs/ are registered in pages.ts
 * 2. All tabs registered in pages.ts have corresponding files
 *
 * Run with: bun run scripts/validate-pages.ts
 */

import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Import pages definition
const pagesModule = await import('../src/lib/services/pages.js');
const PAGES = pagesModule.PAGES as readonly {
	id: string;
	title: string;
	url: string;
	tabs?: readonly { id: string; label: string }[];
}[];

interface ValidationError {
	type: 'missing-in-pages' | 'missing-file' | 'page-not-found';
	pageId: string;
	tabId?: string;
	message: string;
}

const errors: ValidationError[] = [];

/**
 * Extract tab ID from filename (e.g., "format-tab.svelte" -> "format")
 */
function getTabIdFromFilename(filename: string): string | null {
	const match = filename.match(/^(.+)-tab\.svelte$/);
	return match ? match[1] : null;
}

/**
 * Get all tab files from a formatter's tabs directory
 */
function getTabFilesForPage(pageId: string): string[] {
	const tabsDir = join(projectRoot, 'src', 'routes', pageId, 'tabs');

	if (!existsSync(tabsDir)) {
		return [];
	}

	const files = readdirSync(tabsDir);
	return files
		.filter((f) => f.endsWith('-tab.svelte'))
		.map((f) => getTabIdFromFilename(f))
		.filter((id): id is string => id !== null);
}

/**
 * Get pages that have tabs (formatters)
 */
function getPagesWithTabs(): typeof PAGES {
	return PAGES.filter((page) => page.tabs && page.tabs.length > 0);
}

// Validate each page with tabs
for (const page of getPagesWithTabs()) {
	const registeredTabs = new Set(page.tabs?.map((t) => t.id) ?? []);
	const actualTabs = new Set(getTabFilesForPage(page.id));

	// Check for tabs in files but not in pages.ts
	for (const tabId of actualTabs) {
		if (!registeredTabs.has(tabId)) {
			errors.push({
				type: 'missing-in-pages',
				pageId: page.id,
				tabId,
				message: `Tab "${tabId}" exists as file but is not registered in pages.ts for "${page.title}"`,
			});
		}
	}

	// Check for tabs in pages.ts but no file exists
	for (const tabId of registeredTabs) {
		if (!actualTabs.has(tabId)) {
			errors.push({
				type: 'missing-file',
				pageId: page.id,
				tabId,
				message: `Tab "${tabId}" is registered in pages.ts for "${page.title}" but file "${tabId}-tab.svelte" does not exist`,
			});
		}
	}
}

// Also check for formatter directories that might not be in pages.ts
const routesDir = join(projectRoot, 'src', 'routes');
const formatterDirs = readdirSync(routesDir).filter(
	(dir) => dir.endsWith('-formatter') && existsSync(join(routesDir, dir, 'tabs'))
);

for (const dir of formatterDirs) {
	const pageId = dir;
	const pageExists = PAGES.some((p) => p.id === pageId);

	if (!pageExists) {
		errors.push({
			type: 'page-not-found',
			pageId,
			message: `Formatter directory "${dir}" exists but is not registered in pages.ts`,
		});
	}
}

// Output results
if (errors.length > 0) {
	console.error('\n❌ Page/Tab validation failed!\n');

	const missingInPages = errors.filter((e) => e.type === 'missing-in-pages');
	const missingFiles = errors.filter((e) => e.type === 'missing-file');
	const pageNotFound = errors.filter((e) => e.type === 'page-not-found');

	if (missingInPages.length > 0) {
		console.error('📝 Tabs missing in pages.ts (add these to pages.ts):');
		for (const error of missingInPages) {
			console.error(`   - ${error.pageId}: "${error.tabId}" tab`);
		}
		console.error('');
	}

	if (missingFiles.length > 0) {
		console.error('📁 Tab files missing (create these files or remove from pages.ts):');
		for (const error of missingFiles) {
			console.error(`   - src/routes/${error.pageId}/tabs/${error.tabId}-tab.svelte`);
		}
		console.error('');
	}

	if (pageNotFound.length > 0) {
		console.error('🔍 Formatter pages not registered (add these to pages.ts):');
		for (const error of pageNotFound) {
			console.error(`   - ${error.pageId}`);
		}
		console.error('');
	}

	console.error(`Total: ${errors.length} error(s)\n`);
	process.exit(1);
} else {
	console.log('\n✅ Page/Tab validation passed! All tabs are properly registered.\n');

	// Show summary
	const pagesWithTabs = getPagesWithTabs();
	console.log('Summary:');
	for (const page of pagesWithTabs) {
		const tabCount = page.tabs?.length ?? 0;
		console.log(`  ${page.title}: ${tabCount} tabs`);
	}
	console.log('');

	process.exit(0);
}
