/**
 * Central registry for all pages and their tabs.
 * Update this file when adding new pages or tabs.
 */
import {
	Aperture,
	ArchiveRestore,
	ArrowRightLeft,
	BadgeCheck,
	Binary,
	BookOpen,
	Braces,
	Cable,
	Calculator,
	CalendarClock,
	CaseSensitive,
	Clock,
	CodeXml,
	Database,
	EthernetPort,
	FileCheck,
	FileCode,
	FileDiff,
	FileJson2,
	FileText,
	FileType,
	Fingerprint,
	GitBranch,
	GitCompare,
	Globe,
	Globe2,
	Hash,
	House,
	Key,
	KeyRound,
	KeySquare,
	Link,
	ListChecks,
	Lock,
	type LucideIcon,
	Network,
	Pencil,
	Play,
	QrCode,
	Quote,
	Radar,
	Regex,
	Search,
	Settings,
	Shield,
	ShieldCheck,
	Sparkles,
	Table,
	Target,
	Terminal,
	TextQuote,
	TrendingUp,
} from 'lucide-react';

/**
 * Page categories for sidebar grouping.
 */
export type PageCategory = 'formatters' | 'encoders' | 'generators' | 'text' | 'network';

export interface PageTab {
	readonly id: string;
	readonly label: string;
	readonly icon: LucideIcon;
}

export interface PageDefinition {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly icon: LucideIcon;
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
		id: 'x509-decoder',
		title: 'X.509 Certificate Decoder',
		url: '/x509-decoder',
		icon: BadgeCheck,
		description: 'Decode X.509 / PEM certificates with chain visualization and fingerprints',
		color: 'text-teal-600',
		category: 'encoders',
	},
	{
		id: 'escape-tool',
		title: 'Escape / Unescape',
		url: '/escape-tool',
		icon: Quote,
		description: 'Multi-flavor escape and unescape for JSON / JS / HTML / XML / CSV / Shell',
		color: 'text-rose-600',
		category: 'encoders',
		tabs: [
			{ id: 'json', label: 'JSON', icon: Braces },
			{ id: 'javascript', label: 'JS', icon: FileCode },
			{ id: 'html', label: 'HTML', icon: Globe },
			{ id: 'xml', label: 'XML', icon: FileCode },
			{ id: 'csv', label: 'CSV', icon: Table },
			{ id: 'shell', label: 'Shell', icon: Terminal },
		],
	},
	{
		id: 'rsa-tools',
		title: 'RSA Toolkit',
		url: '/rsa-tools',
		icon: KeySquare,
		description: 'RSA encrypt / decrypt / sign / verify with PEM key input',
		color: 'text-indigo-700',
		category: 'encoders',
		tabs: [
			{ id: 'encrypt', label: 'Encrypt', icon: Lock },
			{ id: 'decrypt', label: 'Decrypt', icon: KeyRound },
			{ id: 'sign', label: 'Sign', icon: Pencil },
			{ id: 'verify', label: 'Verify', icon: ShieldCheck },
		],
	},
	{
		id: 'string-compressor',
		title: 'String Compressor',
		url: '/string-compressor',
		icon: ArchiveRestore,
		description:
			'Compress and decompress text with GZIP and Brotli, with live compression-ratio visualization',
		color: 'text-emerald-600',
		category: 'encoders',
	},
	{
		id: 'uuid-generator',
		title: 'UUID Generator',
		url: '/uuid-generator',
		icon: Fingerprint,
		description: 'Generate UUIDs (v1, v3, v4, v5, v7) with formatting options',
		color: 'text-fuchsia-500',
		category: 'generators',
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
	},
	{
		id: 'password-generator',
		title: 'Password Generator',
		url: '/password-generator',
		icon: Lock,
		description: 'Generate cryptographically secure passwords with entropy estimation',
		color: 'text-lime-500',
		category: 'generators',
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
	{
		id: 'qr-code-generator',
		title: 'QR Code Generator',
		url: '/qr-code-generator',
		icon: QrCode,
		description: 'Generate QR codes with adjustable error correction, size, and colors',
		color: 'text-green-500',
		category: 'generators',
	},
	{
		id: 'cron-expression-builder',
		title: 'Cron Expression Builder',
		url: '/cron-expression-builder',
		icon: Clock,
		description: 'Build and parse cron expressions with next-execution preview',
		color: 'text-stone-500',
		category: 'generators',
		tabs: [
			{ id: 'build', label: 'Build', icon: Pencil },
			{ id: 'parse', label: 'Parse', icon: Search },
		],
	},
	{
		id: 'date-timestamp-converter',
		title: 'Date / Timestamp Converter',
		url: '/date-timestamp-converter',
		icon: CalendarClock,
		description: 'Convert between Unix, ISO, RFC formats with multi-timezone support',
		color: 'text-amber-600',
		category: 'generators',
	},
	{
		id: 'number-base-converter',
		title: 'Number Base Converter',
		url: '/number-base-converter',
		icon: Calculator,
		description:
			'Convert between binary, octal, decimal, and hex with bitwise operations and IEEE 754 view',
		color: 'text-orange-600',
		category: 'generators',
	},
	{
		id: 'image-converter',
		title: 'Image Converter',
		url: '/image-converter',
		icon: Aperture,
		description: 'Convert and compress images (PNG / JPEG / WebP) with resize and rotation',
		color: 'text-pink-600',
		category: 'generators',
	},
	{
		id: 'lorem-ipsum',
		title: 'Lorem Ipsum',
		url: '/lorem-ipsum',
		icon: TextQuote,
		description: 'Generate placeholder text in multiple flavors with structure and format controls',
		color: 'text-amber-700',
		category: 'generators',
	},
	{
		id: 'curl-builder',
		title: 'cURL Builder',
		url: '/curl-builder',
		icon: Terminal,
		description: 'Build and parse cURL commands; emit fetch / Python / Go snippets',
		color: 'text-zinc-500',
		category: 'generators',
		tabs: [
			{ id: 'build', label: 'Build', icon: Pencil },
			{ id: 'parse', label: 'Parse', icon: Search },
			{ id: 'code', label: 'Code', icon: CodeXml },
		],
	},
	{
		id: 'semver-tools',
		title: 'SemVer Tools',
		url: '/semver-tools',
		icon: GitBranch,
		description: 'Parse, compare, test ranges, and bump semantic versions',
		color: 'text-green-700',
		category: 'generators',
		tabs: [
			{ id: 'parse', label: 'Parse', icon: Search },
			{ id: 'compare', label: 'Compare', icon: GitCompare },
			{ id: 'range', label: 'Range', icon: Target },
			{ id: 'bump', label: 'Bump', icon: TrendingUp },
		],
	},
	{
		id: 'markdown-editor',
		title: 'Markdown Editor',
		url: '/markdown-editor',
		icon: FileText,
		description: 'Edit markdown with live preview and TeX/LaTeX support',
		color: 'text-slate-500',
		category: 'text',
	},
	{
		id: 'diff-viewer',
		title: 'Diff Viewer',
		url: '/diff-viewer',
		icon: FileDiff,
		description: 'Compare and visualize differences between two texts',
		color: 'text-amber-500',
		category: 'text',
	},
	{
		id: 'string-case-converter',
		title: 'String Case Converter',
		url: '/string-case-converter',
		icon: CaseSensitive,
		description: 'Convert text between camelCase, snake_case, and more',
		color: 'text-teal-500',
		category: 'text',
	},
	{
		id: 'regex-tester',
		title: 'Regex Tester',
		url: '/regex-tester',
		icon: Regex,
		description: 'Test, replace, visualize, and explain regular expressions',
		color: 'text-neutral-500',
		category: 'text',
	},
	{
		id: 'list-comparer',
		title: 'List Comparer',
		url: '/list-comparer',
		icon: ListChecks,
		description: 'Set operations and Venn diagram on two newline-separated lists',
		color: 'text-cyan-600',
		category: 'text',
	},
	{
		id: 'cidr-calculator',
		title: 'CIDR Calculator',
		url: '/cidr-calculator',
		icon: Globe2,
		description:
			'Parse IPv4 / IPv6 CIDR notation with bit visualization, subnetting, and aggregation',
		color: 'text-sky-700',
		category: 'network',
	},
	{
		id: 'ip-converter',
		title: 'IP Address Converter',
		url: '/ip-converter',
		icon: Globe,
		description:
			'Convert between IPv4 and IPv6 with IPv4-mapped / 6to4 / Teredo embeddings and notation normalizer',
		color: 'text-sky-600',
		category: 'network',
	},
	{
		id: 'mac-lookup',
		title: 'MAC Address Lookup',
		url: '/mac-lookup',
		icon: Cable,
		description: 'Identify MAC address vendor (OUI) and convert between notations',
		color: 'text-stone-700',
		category: 'network',
	},
	{
		id: 'network-interfaces',
		title: 'Network Interfaces',
		url: '/network-interfaces',
		icon: EthernetPort,
		description: 'View detailed network interface information',
		color: 'text-rose-500',
		category: 'network',
	},
	{
		id: 'network-scanner',
		title: 'Network Scanner',
		url: '/network-scanner',
		icon: Radar,
		description: 'Scan networks for open ports and services',
		color: 'text-rose-500',
		category: 'network',
	},
	{
		id: 'mime-types',
		title: 'MIME Type Explorer',
		url: '/mime-types',
		icon: FileType,
		description: 'Bidirectional MIME type / extension lookup with magic bytes and charset info',
		color: 'text-emerald-700',
		category: 'network',
	},
	{
		id: 'http-status-codes',
		title: 'HTTP Status Codes',
		url: '/http-status-codes',
		icon: BookOpen,
		description:
			'Searchable HTTP status code reference with RFC citations and misuse warnings',
		color: 'text-violet-600',
		category: 'network',
	},
	{
		id: 'settings',
		title: 'Settings',
		url: '/settings',
		icon: Settings,
		description: 'Configure application preferences',
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
	PAGES.filter((page) => page.id !== 'dashboard' && page.id !== 'settings');

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
	readonly icon: LucideIcon;
	readonly defaultOpen: boolean;
	readonly borderClass: string;
	readonly iconClass: string;
}

/**
 * All categories with display info.
 */
export const CATEGORIES: readonly CategoryInfo[] = [
	{
		id: 'formatters',
		label: 'Formatters',
		icon: FileText,
		defaultOpen: true,
		borderClass: 'border-accent-brand/40',
		iconClass: 'text-accent-brand',
	},
	{
		id: 'encoders',
		label: 'Encoders',
		icon: Lock,
		defaultOpen: true,
		borderClass: 'border-success/40',
		iconClass: 'text-success',
	},
	{
		id: 'generators',
		label: 'Generators',
		icon: Sparkles,
		defaultOpen: true,
		borderClass: 'border-warning/40',
		iconClass: 'text-warning',
	},
	{
		id: 'text',
		label: 'Text',
		icon: CaseSensitive,
		defaultOpen: true,
		borderClass: 'border-info/40',
		iconClass: 'text-info',
	},
	{
		id: 'network',
		label: 'Network',
		icon: Network,
		defaultOpen: true,
		borderClass: 'border-destructive/40',
		iconClass: 'text-destructive',
	},
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
	readonly icon: LucideIcon;
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
