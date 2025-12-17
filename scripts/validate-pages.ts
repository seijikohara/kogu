/**
 * Validates that pages.ts is in sync with actual tab files in the routes directory.
 *
 * This script ensures that:
 * 1. All tab files in routes/{page}/tabs/ are registered in pages.ts
 * 2. All tabs registered in pages.ts have corresponding files
 *
 * Run with: bun run scripts/validate-pages.ts
 */

import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Types
interface PageDefinition {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly tabs?: readonly { readonly id: string; readonly label: string }[];
}

interface ValidationError {
	readonly type:
		| 'missing-in-pages'
		| 'missing-file'
		| 'page-not-found'
		| 'tabs-not-defined'
		| 'missing-route';
	readonly pageId: string;
	readonly tabId?: string;
	readonly message: string;
}

// Constants
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES_DIR = join(PROJECT_ROOT, 'src', 'routes');

// Import pages definition
const pagesModule = await import('../src/lib/services/pages.js');
const PAGES = pagesModule.PAGES as readonly PageDefinition[];

// Pure functions

/** Extract tab ID from filename (e.g., "format-tab.svelte" -> "format") */
const extractTabId = (filename: string): string | null =>
	filename.match(/^(.+)-tab\.svelte$/)?.[1] ?? null;

/** Get tabs directory path for a page */
const getTabsDir = (pageId: string): string => join(ROUTES_DIR, pageId, 'tabs');

/** Get all tab IDs from a page's tabs directory */
const getActualTabIds = (pageId: string): readonly string[] => {
	const tabsDir = getTabsDir(pageId);
	return existsSync(tabsDir)
		? readdirSync(tabsDir)
				.filter((f) => f.endsWith('-tab.svelte'))
				.map(extractTabId)
				.filter((id): id is string => id !== null)
		: [];
};

/** Get registered tab IDs from a page definition */
const getRegisteredTabIds = (page: PageDefinition): readonly string[] =>
	page.tabs?.map((t) => t.id) ?? [];

/** Get pages that have tabs defined */
const getPagesWithTabs = (pages: readonly PageDefinition[]): readonly PageDefinition[] =>
	pages.filter((page) => page.tabs && page.tabs.length > 0);

/** Get directories that have a tabs/ subdirectory */
const getDirectoriesWithTabs = (): readonly string[] =>
	readdirSync(ROUTES_DIR).filter((dir) => existsSync(join(ROUTES_DIR, dir, 'tabs')));

/** Find tabs that exist as files but are not registered in pages.ts */
const findMissingInPages = (page: PageDefinition): readonly ValidationError[] => {
	const registeredIds = new Set(getRegisteredTabIds(page));
	return getActualTabIds(page.id)
		.filter((tabId) => !registeredIds.has(tabId))
		.map((tabId) => ({
			type: 'missing-in-pages' as const,
			pageId: page.id,
			tabId,
			message: `Tab "${tabId}" exists as file but is not registered in pages.ts for "${page.title}"`,
		}));
};

/** Find tabs that are registered in pages.ts but have no file */
const findMissingFiles = (page: PageDefinition): readonly ValidationError[] => {
	const actualIds = new Set(getActualTabIds(page.id));
	return getRegisteredTabIds(page)
		.filter((tabId) => !actualIds.has(tabId))
		.map((tabId) => ({
			type: 'missing-file' as const,
			pageId: page.id,
			tabId,
			message: `Tab "${tabId}" is registered in pages.ts for "${page.title}" but file "${tabId}-tab.svelte" does not exist`,
		}));
};

/** Find directories with tabs/ that are not registered in pages.ts */
const findUnregisteredPages = (pages: readonly PageDefinition[]): readonly ValidationError[] => {
	const registeredIds = new Set(pages.map((p) => p.id));
	return getDirectoriesWithTabs()
		.filter((dir) => !registeredIds.has(dir))
		.map((pageId) => ({
			type: 'page-not-found' as const,
			pageId,
			message: `Directory "${pageId}" has tabs/ but is not registered in pages.ts`,
		}));
};

/** Find pages that have tabs/ directory but no tabs property in pages.ts */
const findTabsNotDefined = (pages: readonly PageDefinition[]): readonly ValidationError[] => {
	const pagesWithTabsProperty = new Set(pages.filter((p) => p.tabs).map((p) => p.id));
	return getDirectoriesWithTabs()
		.filter((dir) => {
			const actualTabs = getActualTabIds(dir);
			const isRegistered = pages.some((p) => p.id === dir);
			return isRegistered && actualTabs.length > 0 && !pagesWithTabsProperty.has(dir);
		})
		.map((pageId) => {
			const page = pages.find((p) => p.id === pageId);
			const actualTabs = getActualTabIds(pageId);
			return {
				type: 'tabs-not-defined' as const,
				pageId,
				message: `Page "${page?.title ?? pageId}" has ${actualTabs.length} tab files but no tabs property in pages.ts`,
			};
		});
};

/** Check if a page route exists (+page.svelte file) */
const routeExists = (pageId: string): boolean => {
	const routePath = join(ROUTES_DIR, pageId, '+page.svelte');
	return existsSync(routePath);
};

/** Find pages registered in pages.ts that don't have corresponding route files */
const findMissingRoutes = (pages: readonly PageDefinition[]): readonly ValidationError[] =>
	pages
		.filter((page) => page.url !== '/' && !routeExists(page.id))
		.map((page) => ({
			type: 'missing-route' as const,
			pageId: page.id,
			message: `Page "${page.title}" is registered in pages.ts but route file "src/routes/${page.id}/+page.svelte" does not exist`,
		}));

/** Collect all validation errors */
const collectErrors = (pages: readonly PageDefinition[]): readonly ValidationError[] => {
	const pagesWithTabs = getPagesWithTabs(pages);
	return [
		...pagesWithTabs.flatMap(findMissingInPages),
		...pagesWithTabs.flatMap(findMissingFiles),
		...findUnregisteredPages(pages),
		...findTabsNotDefined(pages),
		...findMissingRoutes(pages),
	];
};

/** Group errors by type */
const groupErrorsByType = (errors: readonly ValidationError[]) => ({
	missingInPages: errors.filter((e) => e.type === 'missing-in-pages'),
	missingFiles: errors.filter((e) => e.type === 'missing-file'),
	pageNotFound: errors.filter((e) => e.type === 'page-not-found'),
	tabsNotDefined: errors.filter((e) => e.type === 'tabs-not-defined'),
	missingRoutes: errors.filter((e) => e.type === 'missing-route'),
});

/** Print error section if not empty */
const printErrorSection = (
	errors: readonly ValidationError[],
	icon: string,
	title: string,
	formatLine: (e: ValidationError) => string
): void => {
	if (errors.length > 0) {
		console.error(`${icon} ${title}:`);
		errors.forEach((e) => console.error(`   - ${formatLine(e)}`));
		console.error('');
	}
};

/** Print failure report */
const printFailureReport = (errors: readonly ValidationError[]): void => {
	console.error('\n❌ Page/Tab validation failed!\n');

	const { missingInPages, missingFiles, pageNotFound, tabsNotDefined, missingRoutes } =
		groupErrorsByType(errors);

	printErrorSection(
		missingRoutes,
		'🚫',
		'Route files missing (create these files or remove from pages.ts)',
		(e) => `src/routes/${e.pageId}/+page.svelte`
	);

	printErrorSection(
		missingInPages,
		'📝',
		'Tabs missing in pages.ts (add these to pages.ts)',
		(e) => `${e.pageId}: "${e.tabId}" tab`
	);

	printErrorSection(
		missingFiles,
		'📁',
		'Tab files missing (create these files or remove from pages.ts)',
		(e) => `src/routes/${e.pageId}/tabs/${e.tabId}-tab.svelte`
	);

	printErrorSection(
		pageNotFound,
		'🔍',
		'Pages not registered (add these to pages.ts)',
		(e) => e.pageId
	);

	printErrorSection(
		tabsNotDefined,
		'⚠️',
		'Pages with tabs/ directory but no tabs property (add tabs array to pages.ts)',
		(e) => e.message
	);

	console.error(`Total: ${errors.length} error(s)\n`);
};

/** Get summary of all pages */
const getPagesSummary = (
	pages: readonly PageDefinition[]
): readonly { title: string; tabCount: number }[] =>
	pages
		.filter((p) => p.id !== 'dashboard')
		.map((page) => ({
			title: page.title,
			tabCount: getActualTabIds(page.id).length,
		}))
		.sort((a, b) => a.title.localeCompare(b.title));

/** Print success report */
const printSuccessReport = (pages: readonly PageDefinition[]): void => {
	console.log('\n✅ Page/Tab validation passed! All tabs are properly registered.\n');
	console.log('Summary:');
	getPagesSummary(pages).forEach(({ title, tabCount }) => {
		const tabInfo = tabCount > 0 ? `${tabCount} tabs` : 'no tabs';
		console.log(`  ${title}: ${tabInfo}`);
	});
	console.log('');
};

// Main
const errors = collectErrors(PAGES);

if (errors.length > 0) {
	printFailureReport(errors);
	process.exit(1);
} else {
	printSuccessReport(PAGES);
	process.exit(0);
}
