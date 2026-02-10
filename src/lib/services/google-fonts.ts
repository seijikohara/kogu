/**
 * Google Fonts catalog and dynamic loader.
 *
 * Provides a curated list of popular Google Fonts and functions to
 * dynamically load/unload them via `<link>` elements.
 */

// =============================================================================
// Types & Catalog
// =============================================================================

export interface GoogleFont {
	readonly name: string;
	readonly category: 'sans-serif' | 'serif' | 'monospace';
}

/** Curated list of popular Google Fonts */
export const GOOGLE_FONTS: readonly GoogleFont[] = [
	// Sans-serif (UI)
	{ name: 'DM Sans', category: 'sans-serif' },
	{ name: 'Inter', category: 'sans-serif' },
	{ name: 'Lato', category: 'sans-serif' },
	{ name: 'Noto Sans', category: 'sans-serif' },
	{ name: 'Noto Sans JP', category: 'sans-serif' },
	{ name: 'Open Sans', category: 'sans-serif' },
	{ name: 'Plus Jakarta Sans', category: 'sans-serif' },
	{ name: 'Poppins', category: 'sans-serif' },
	{ name: 'Roboto', category: 'sans-serif' },
	{ name: 'Work Sans', category: 'sans-serif' },
	// Monospace (Code)
	{ name: 'DM Mono', category: 'monospace' },
	{ name: 'Fira Code', category: 'monospace' },
	{ name: 'IBM Plex Mono', category: 'monospace' },
	{ name: 'Inconsolata', category: 'monospace' },
	{ name: 'JetBrains Mono', category: 'monospace' },
	{ name: 'Noto Sans Mono', category: 'monospace' },
	{ name: 'Roboto Mono', category: 'monospace' },
	{ name: 'Source Code Pro', category: 'monospace' },
	{ name: 'Space Mono', category: 'monospace' },
	{ name: 'Ubuntu Mono', category: 'monospace' },
] as const;

// =============================================================================
// Helpers
// =============================================================================

/** Get Google Fonts filtered by category */
export const getGoogleFontsByCategory = (category: GoogleFont['category']): readonly GoogleFont[] =>
	GOOGLE_FONTS.filter((f) => f.category === category);

/** Check if a font name is in the Google Fonts catalog */
export const isGoogleFont = (name: string): boolean => GOOGLE_FONTS.some((f) => f.name === name);

// =============================================================================
// Dynamic Loading
// =============================================================================

const LINK_ID_PREFIX = 'google-font-';

/** Build the link element ID for a font family */
const buildLinkId = (family: string): string =>
	`${LINK_ID_PREFIX}${family.replace(/\s+/g, '-').toLowerCase()}`;

/** Load a Google Font via a `<link>` element. No-op if already loaded. */
export const loadGoogleFont = (family: string, weights: number[] = [400, 500, 600, 700]): void => {
	const id = buildLinkId(family);
	if (document.getElementById(id)) return;

	const encoded = family.replace(/\s+/g, '+');
	const weightStr = weights.join(';');
	const url = `https://fonts.googleapis.com/css2?family=${encoded}:wght@${weightStr}&display=swap`;

	const link = document.createElement('link');
	link.id = id;
	link.rel = 'stylesheet';
	link.href = url;
	document.head.appendChild(link);
};

/** Unload all dynamically loaded Google Font `<link>` elements */
export const unloadAllGoogleFonts = (): void => {
	document.querySelectorAll(`link[id^="${LINK_ID_PREFIX}"]`).forEach((el) => el.remove());
};
