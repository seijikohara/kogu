/**
 * Central registry for all pages and their tabs.
 * Update this file when adding new pages or tabs.
 */
import {
	ArrowRightLeft,
	Binary,
	Braces,
	CodeXml,
	Database,
	FileCheck,
	FileCode,
	FileJson2,
	FileText,
	GitCompare,
	Hash,
	House,
	type Icon,
	Key,
	KeyRound,
	Link,
	Lock,
	Play,
	Search,
	Shield,
	ShieldCheck,
	Sparkles,
} from '@lucide/svelte';

/**
 * Page categories for sidebar grouping.
 */
export type PageCategory = 'formatters' | 'encoders' | 'generators';

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
	readonly category?: PageCategory;
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
		icon: House,
		description: 'Home page',
	},
	{
		id: 'json-formatter',
		title: 'JSON Formatter',
		url: '/json-formatter',
		icon: Braces,
		description: 'Format, minify, query, compare, and convert JSON',
		color: 'text-yellow-500',
		category: 'formatters',
		tabs: [
			{ id: 'format', label: 'Format', icon: Play },
			{ id: 'query', label: 'Query', icon: Search },
			{ id: 'compare', label: 'Compare', icon: GitCompare },
			{ id: 'convert', label: 'Convert', icon: ArrowRightLeft },
			{ id: 'schema', label: 'Schema', icon: FileCheck },
			{ id: 'generate', label: 'Generate', icon: CodeXml },
		],
	},
	{
		id: 'yaml-formatter',
		title: 'YAML Formatter',
		url: '/yaml-formatter',
		icon: FileJson2,
		description: 'Format, validate, compare, and convert YAML',
		color: 'text-red-500',
		category: 'formatters',
		tabs: [
			{ id: 'format', label: 'Format', icon: Play },
			{ id: 'query', label: 'Query', icon: Search },
			{ id: 'compare', label: 'Compare', icon: GitCompare },
			{ id: 'convert', label: 'Convert', icon: ArrowRightLeft },
			{ id: 'schema', label: 'Schema', icon: FileCheck },
			{ id: 'generate', label: 'Generate', icon: CodeXml },
		],
	},
	{
		id: 'xml-formatter',
		title: 'XML Formatter',
		url: '/xml-formatter',
		icon: FileCode,
		description: 'Format, validate, query, compare, and convert XML',
		color: 'text-orange-500',
		category: 'formatters',
		tabs: [
			{ id: 'format', label: 'Format', icon: Play },
			{ id: 'query', label: 'Query', icon: Search },
			{ id: 'compare', label: 'Compare', icon: GitCompare },
			{ id: 'convert', label: 'Convert', icon: ArrowRightLeft },
			{ id: 'schema', label: 'Schema', icon: FileCheck },
			{ id: 'generate', label: 'Generate', icon: CodeXml },
		],
	},
	{
		id: 'sql-formatter',
		title: 'SQL Formatter',
		url: '/sql-formatter',
		icon: Database,
		description: 'Format and beautify SQL queries with support for 18+ dialects',
		color: 'text-blue-500',
		category: 'formatters',
	},
	{
		id: 'base64-encoder',
		title: 'Base64 Encoder',
		url: '/base64-encoder',
		icon: Binary,
		description: 'Encode and decode Base64 text with UTF-8 support',
		color: 'text-emerald-500',
		category: 'encoders',
	},
	{
		id: 'url-encoder',
		title: 'URL Encoder',
		url: '/url-encoder',
		icon: Link,
		description: 'Encode, decode, parse, and build URLs',
		color: 'text-sky-500',
		category: 'encoders',
	},
	{
		id: 'jwt-decoder',
		title: 'JWT Decoder',
		url: '/jwt-decoder',
		icon: Key,
		description: 'Decode and inspect JWT tokens',
		color: 'text-purple-500',
		category: 'encoders',
	},
	{
		id: 'hash-generator',
		title: 'Hash Generator',
		url: '/hash-generator',
		icon: Hash,
		description: 'Generate MD5, SHA1, SHA256, SHA512 hashes for text and files',
		color: 'text-pink-500',
		category: 'generators',
	},
	{
		id: 'bcrypt-generator',
		title: 'BCrypt Generator',
		url: '/bcrypt-generator',
		icon: ShieldCheck,
		description: 'Generate and verify BCrypt password hashes',
		color: 'text-cyan-500',
		category: 'generators',
		tabs: [
			{ id: 'generate', label: 'Generate', icon: Hash },
			{ id: 'verify', label: 'Verify', icon: ShieldCheck },
		],
	},
	{
		id: 'ssh-key-generator',
		title: 'SSH Key Generator',
		url: '/ssh-key-generator',
		icon: KeyRound,
		description: 'Generate SSH key pairs (Ed25519, ECDSA, RSA)',
		color: 'text-violet-500',
		category: 'generators',
	},
	{
		id: 'gpg-key-generator',
		title: 'GPG Key Generator',
		url: '/gpg-key-generator',
		icon: Shield,
		description: 'Generate GPG/PGP key pairs for encryption and signing',
		color: 'text-indigo-500',
		category: 'generators',
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
 * Get pages by category.
 */
export const getPagesByCategory = (category: PageCategory): readonly PageDefinition[] =>
	PAGES.filter((page) => page.category === category);

/**
 * Category display information.
 */
export interface CategoryInfo {
	readonly id: PageCategory;
	readonly label: string;
	readonly icon: typeof Icon;
	readonly defaultOpen: boolean;
}

/**
 * All categories with display info.
 */
export const CATEGORIES: readonly CategoryInfo[] = [
	{ id: 'formatters', label: 'Formatters', icon: FileText, defaultOpen: true },
	{ id: 'encoders', label: 'Encoders', icon: Lock, defaultOpen: true },
	{ id: 'generators', label: 'Generators', icon: Sparkles, defaultOpen: true },
];

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
