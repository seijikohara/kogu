/**
 * Design tokens — single source of truth.
 *
 * Every CSS variable rendered into `:root` and `.dark` blocks of `app.css`
 * is generated from this file via `bun run build:tokens` (see
 * `scripts/build-tokens.ts`). Do NOT edit the generated CSS by hand — change
 * the value here and re-run the script.
 *
 * Why this exists:
 * - **Single source**: avoids CSS / TS drift when colors used in both
 *   stylesheets and React components (Monaco theme, chart libs, image
 *   exporters) need the same value.
 * - **Typed access**: callers `import { COLOR } from '@/lib/theme/tokens'`
 *   and get autocomplete plus compile-time guarantees the token exists.
 * - **`var()` form available**: theme-aware consumers prefer the
 *   `var(--token-name)` form so light/dark switching happens via the
 *   `.dark` class swap; non-theme contexts (one-shot canvas / image
 *   rendering) read the literal value directly from the constant.
 *
 * Naming convention:
 * - TS keys are camelCase (`mutedForeground`, `sidebarPrimary`).
 * - Generated CSS variables are kebab-case (`--muted-foreground`,
 *   `--sidebar-primary`). The build script handles the conversion.
 */

export const RADIUS = '0.625rem';

export const LAYOUT = {
	toolbarH: '3rem',
	railW: '18rem',
	railWWide: '24rem',
	railWCollapsed: '2.75rem',
	statusH: '1.75rem',
	editorHeaderH: '2rem',
} as const;

export const MOTION = {
	easeStandard: 'cubic-bezier(0.2, 0, 0, 1)',
	durationFast: '120ms',
	durationBase: '160ms',
	durationSlow: '220ms',
} as const;

/**
 * Mode-aware color tokens.
 * - `light` mirrors the `:root { ... }` block in `app.css` (also the
 *   default when no `.dark` ancestor is present).
 * - `dark` mirrors the `.dark { ... }` block.
 */
export const COLOR = {
	light: {
		background: 'oklch(1 0 0)',
		foreground: 'oklch(0.4 0 0)',
		card: 'oklch(1 0 0)',
		cardForeground: 'oklch(0.4 0 0)',
		popover: 'oklch(1 0 0)',
		popoverForeground: 'oklch(0.4 0 0)',
		primary: 'oklch(0.5 0.16 250)',
		primaryForeground: 'oklch(0.985 0 0)',
		secondary: 'oklch(0.92 0 0)',
		secondaryForeground: 'oklch(0.4 0 0)',
		muted: 'oklch(0.96 0 0)',
		mutedForeground: 'oklch(0.47 0 0)',
		accent: 'oklch(0.96 0 0)',
		accentForeground: 'oklch(0.27 0 0)',
		destructive: 'oklch(0.55 0.245 27)',
		destructiveForeground: 'oklch(0.98 0.01 27)',
		success: 'oklch(0.55 0.16 142)',
		successForeground: 'oklch(0.98 0.01 142)',
		warning: 'oklch(0.65 0.17 75)',
		warningForeground: 'oklch(0.98 0.02 75)',
		info: 'oklch(0.58 0.18 245)',
		infoForeground: 'oklch(0.98 0.01 250)',
		border: 'oklch(0.92 0 0)',
		input: 'oklch(0 0 0 / 14%)',
		ring: 'oklch(0.5 0.16 250)',
		chart1: 'oklch(0.58 0.18 245)',
		chart2: 'oklch(0.55 0.16 142)',
		chart3: 'oklch(0.65 0.17 75)',
		chart4: 'oklch(0.5 0.18 305)',
		chart5: 'oklch(0.55 0.245 27)',
		sidebar: 'oklch(0.96 0 0)',
		sidebarForeground: 'oklch(0.4 0 0)',
		sidebarPrimary: 'oklch(0.5 0.16 250)',
		sidebarPrimaryForeground: 'oklch(0.985 0 0)',
		sidebarAccent: 'oklch(0.93 0 0)',
		sidebarAccentForeground: 'oklch(0.27 0 0)',
		sidebarBorder: 'oklch(0.9 0 0)',
		sidebarRing: 'oklch(0.5 0.16 250)',
		surface0: 'oklch(1 0 0)',
		surface1: 'oklch(0.973 0 0)',
		surface2: 'oklch(0.973 0 0)',
		surface3: 'oklch(0.96 0 0)',
		surface4: 'oklch(0.92 0 0)',
		panel: 'oklch(0.973 0 0)',
		accentSoft: 'oklch(0.94 0.04 245)',
		accentBrand: 'oklch(0.5 0.16 250)',
		borderSubtle: 'oklch(0 0 0 / 5%)',
		borderStrong: 'oklch(0 0 0 / 12%)',
		syntaxString: 'oklch(0.55 0.16 152)',
		syntaxNumber: 'oklch(0.5 0.14 250)',
		syntaxBoolean: 'oklch(0.5 0.18 300)',
		syntaxNull: 'oklch(0.55 0.02 250)',
		syntaxObject: 'oklch(0.55 0.16 75)',
		syntaxArray: 'oklch(0.5 0.14 195)',
		syntaxKeyword: 'oklch(0.5 0.18 280)',
		syntaxProperty: 'oklch(0.5 0.14 220)',
		syntaxRoot: 'oklch(0.5 0.18 310)',
		syntaxStatement: 'oklch(0.55 0.18 10)',
		syntaxClause: 'oklch(0.5 0.18 260)',
		syntaxExpression: 'oklch(0.55 0.16 45)',
		syntaxIdentifier: 'oklch(0.5 0.14 175)',
		// Diff highlights (formerly hardcoded in `code-editor-wrapper.tsx`)
		diffAdded: 'hsl(142 76% 36%)',
		diffChanged: 'hsl(45 93% 47%)',
		diffRemoved: 'hsl(0 84% 60%)',
	},
	dark: {
		background: 'oklch(0.215 0 0)',
		foreground: 'oklch(0.84 0 0)',
		card: 'oklch(0.215 0 0)',
		cardForeground: 'oklch(0.84 0 0)',
		popover: 'oklch(0.295 0 0)',
		popoverForeground: 'oklch(0.84 0 0)',
		primary: 'oklch(0.58 0.18 245)',
		primaryForeground: 'oklch(1 0 0)',
		secondary: 'oklch(0.295 0 0)',
		secondaryForeground: 'oklch(0.84 0 0)',
		muted: 'oklch(0.27 0.003 220)',
		mutedForeground: 'oklch(0.68 0 0)',
		accent: 'oklch(0.31 0.005 280)',
		accentForeground: 'oklch(0.87 0 0)',
		destructive: 'oklch(0.704 0.191 22)',
		destructiveForeground: 'oklch(0.16 0.02 22)',
		success: 'oklch(0.72 0.19 149)',
		successForeground: 'oklch(0.16 0.02 149)',
		warning: 'oklch(0.78 0.17 75)',
		warningForeground: 'oklch(0.16 0.02 75)',
		info: 'oklch(0.7 0.18 250)',
		infoForeground: 'oklch(0.16 0.02 250)',
		border: 'oklch(0.27 0 0)',
		input: 'oklch(1 0 0 / 14%)',
		ring: 'oklch(0.58 0.18 245)',
		chart1: 'oklch(0.58 0.18 245)',
		chart2: 'oklch(0.72 0.19 149)',
		chart3: 'oklch(0.78 0.17 75)',
		chart4: 'oklch(0.6 0.2 305)',
		chart5: 'oklch(0.7 0.19 25)',
		sidebar: 'oklch(0.16 0 0)',
		sidebarForeground: 'oklch(0.84 0 0)',
		sidebarPrimary: 'oklch(0.58 0.18 245)',
		sidebarPrimaryForeground: 'oklch(1 0 0)',
		sidebarAccent: 'oklch(0.295 0.005 280)',
		sidebarAccentForeground: 'oklch(0.87 0 0)',
		sidebarBorder: 'oklch(0.2 0 0)',
		sidebarRing: 'oklch(0.58 0.18 245)',
		surface0: 'oklch(0.215 0 0)',
		surface1: 'oklch(0.17 0 0)',
		surface2: 'oklch(0.17 0 0)',
		surface3: 'oklch(0.13 0 0)',
		surface4: 'oklch(0.11 0 0)',
		panel: 'oklch(0.17 0 0)',
		accentSoft: 'oklch(0.34 0.12 245)',
		accentBrand: 'oklch(0.58 0.18 245)',
		borderSubtle: 'oklch(1 0 0 / 8%)',
		borderStrong: 'oklch(1 0 0 / 18%)',
		syntaxString: 'oklch(0.72 0.16 152)',
		syntaxNumber: 'oklch(0.68 0.14 250)',
		syntaxBoolean: 'oklch(0.68 0.18 300)',
		syntaxNull: 'oklch(0.62 0.02 250)',
		syntaxObject: 'oklch(0.72 0.16 75)',
		syntaxArray: 'oklch(0.68 0.14 195)',
		syntaxKeyword: 'oklch(0.68 0.18 280)',
		syntaxProperty: 'oklch(0.68 0.14 220)',
		syntaxRoot: 'oklch(0.68 0.18 310)',
		syntaxStatement: 'oklch(0.72 0.18 10)',
		syntaxClause: 'oklch(0.68 0.18 260)',
		syntaxExpression: 'oklch(0.72 0.16 45)',
		syntaxIdentifier: 'oklch(0.68 0.14 175)',
		diffAdded: 'hsl(142 76% 36%)',
		diffChanged: 'hsl(45 93% 47%)',
		diffRemoved: 'hsl(0 84% 60%)',
	},
} as const;

/**
 * Shadow strings carry per-mode alpha tweaks — separated from the static
 * sets above so the build script can emit them under the same `:root` /
 * `.dark` blocks alongside colors.
 */
export const SHADOW = {
	light: {
		xs: '0 1px 1px oklch(0% 0 0 / 0.03)',
		sm: '0 1px 2px oklch(0% 0 0 / 0.05)',
		md: '0 4px 12px oklch(0% 0 0 / 0.08), 0 1px 3px oklch(0% 0 0 / 0.04)',
		lg: '0 12px 32px oklch(0% 0 0 / 0.12), 0 4px 8px oklch(0% 0 0 / 0.06)',
	},
	dark: {
		xs: '0 1px 1px oklch(0% 0 0 / 0.08)',
		sm: '0 1px 2px oklch(0% 0 0 / 0.2)',
		md: '0 4px 12px oklch(0% 0 0 / 0.3), 0 1px 3px oklch(0% 0 0 / 0.15)',
		lg: '0 12px 32px oklch(0% 0 0 / 0.4), 0 4px 8px oklch(0% 0 0 / 0.2)',
	},
} as const;

/**
 * Interactive state colors — derived via `oklch(from var(--source) ...)` so
 * they can't live as static strings without losing the theme-time
 * computation. Build script emits them verbatim into both blocks.
 */
export const INTERACTIVE = {
	light: {
		hover: 'oklch(from var(--muted) l c h / 50%)',
		active: 'oklch(from var(--muted) l c h / 60%)',
		selected: 'oklch(from var(--primary) l c h / 10%)',
	},
	dark: {
		hover: 'oklch(from var(--muted) l c h / 40%)',
		active: 'oklch(from var(--muted) l c h / 50%)',
		selected: 'oklch(from var(--primary) l c h / 15%)',
	},
} as const;

export type ThemeMode = 'light' | 'dark';
export type ColorTokenName = keyof typeof COLOR.light;
export type ShadowTokenName = keyof typeof SHADOW.light;
export type InteractiveTokenName = keyof typeof INTERACTIVE.light;
export type LayoutTokenName = keyof typeof LAYOUT;
export type MotionTokenName = keyof typeof MOTION;

/**
 * Theme-aware accessor — returns the `var()` reference, e.g.
 * `cssVar('mutedForeground')` → `'var(--muted-foreground)'`.
 * Prefer this over reading the literal value when the consumer should
 * follow the active theme.
 */
export const cssVar = (name: ColorTokenName | LayoutTokenName | MotionTokenName): string =>
	`var(--${camelToKebab(name)})`;

// Insert a hyphen at letter→digit boundaries before lowercasing uppercase
// letters so digit-suffixed keys (`surface2`, `chart1`) render as kebab-case
// (`--surface-2`, `--chart-1`). `app.css` references the hyphenated form, so
// omitting the boundary leaves `--surface2` undefined and every `bg-surface-*`
// / `bg-chart-*` utility resolves to transparent.
const camelToKebab = (s: string): string =>
	s.replace(/([a-zA-Z])(\d)/g, '$1-$2').replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export { camelToKebab };
