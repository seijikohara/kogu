/**
 * Central registry for all pages and their tabs.
 * Update this file when adding new pages or tabs.
 */
import {
	Home,
	Braces,
	Play,
	Search,
	GitCompare,
	ArrowRightLeft,
	FileCheck,
	Code2,
	type Icon,
} from '@lucide/svelte';

export interface PageTab {
	readonly id: string;
	readonly label: string;
	readonly icon: typeof Icon;
}

export interface PageDefinition {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly icon: typeof Icon;
	readonly description: string;
	readonly color?: string;
	readonly tabs?: readonly PageTab[];
}

/**
 * All pages in the application.
 * Add new pages here to automatically include them in:
 * - Sidebar navigation
 * - Title bar search
 * - Dashboard tools grid
 */
export const PAGES: readonly PageDefinition[] = [
	{
		id: 'dashboard',
		title: 'Dashboard',
		url: '/',
		icon: Home,
		description: 'Home page',
	},
	{
		id: 'json-formatter',
		title: 'JSON Formatter',
		url: '/json-formatter',
		icon: Braces,
		description: 'Format, minify, query, compare, and convert JSON',
		color: 'text-yellow-500',
		tabs: [
			{ id: 'format', label: 'Format', icon: Play },
			{ id: 'query', label: 'Query', icon: Search },
			{ id: 'compare', label: 'Compare', icon: GitCompare },
			{ id: 'convert', label: 'Convert', icon: ArrowRightLeft },
			{ id: 'schema', label: 'Schema', icon: FileCheck },
			{ id: 'generate', label: 'Generate', icon: Code2 },
		],
	},
];

/**
 * Get a page by its ID.
 */
export const getPageById = (id: string): PageDefinition | undefined =>
	PAGES.find((page) => page.id === id);

/**
 * Get a page by its URL.
 */
export const getPageByUrl = (url: string): PageDefinition | undefined =>
	PAGES.find((page) => page.url === url);

/**
 * Get all tool pages (excluding dashboard).
 */
export const getToolPages = (): readonly PageDefinition[] =>
	PAGES.filter((page) => page.id !== 'dashboard');

/**
 * Search pages and tabs by query.
 */
export interface SearchResult {
	readonly type: 'page' | 'tab';
	readonly page: PageDefinition;
	readonly tab?: PageTab;
	readonly url: string;
	readonly title: string;
	readonly description: string;
	readonly icon: typeof Icon;
}

/**
 * Create a page search result.
 */
const createPageResult = (page: PageDefinition): SearchResult => ({
	type: 'page',
	page,
	url: page.url,
	title: page.title,
	description: page.description,
	icon: page.icon,
});

/**
 * Create a tab search result.
 */
const createTabResult = (page: PageDefinition, tab: PageTab): SearchResult => ({
	type: 'tab',
	page,
	tab,
	url: `${page.url}?tab=${tab.id}`,
	title: `${page.title} - ${tab.label}`,
	description: `${tab.label} tab in ${page.title}`,
	icon: tab.icon,
});

/**
 * Get all pages and tabs as search results.
 */
const getAllResults = (): readonly SearchResult[] =>
	PAGES.flatMap((page) => [
		createPageResult(page),
		...(page.tabs?.map((tab) => createTabResult(page, tab)) ?? []),
	]);

/**
 * Check if a page matches the query.
 */
const pageMatchesQuery = (page: PageDefinition, query: string): boolean =>
	page.title.toLowerCase().includes(query) || page.description.toLowerCase().includes(query);

/**
 * Check if a tab matches the query.
 */
const tabMatchesQuery = (page: PageDefinition, tab: PageTab, query: string): boolean =>
	tab.label.toLowerCase().includes(query) ||
	`${page.title} ${tab.label}`.toLowerCase().includes(query);

/**
 * Search pages and tabs by query.
 */
export const searchPages = (query: string): readonly SearchResult[] => {
	const normalizedQuery = query.toLowerCase().trim();

	if (!normalizedQuery) return getAllResults();

	return PAGES.flatMap((page) => {
		const pageResults = pageMatchesQuery(page, normalizedQuery) ? [createPageResult(page)] : [];

		const tabResults =
			page.tabs
				?.filter((tab) => tabMatchesQuery(page, tab, normalizedQuery))
				.map((tab) => createTabResult(page, tab)) ?? [];

		return [...pageResults, ...tabResults];
	});
};
