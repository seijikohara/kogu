/**
 * Shared design tokens for the regex tester.
 * Capture-group colors are reused across the pattern editor's syntax
 * highlight, inline match highlighting in the test text, the match
 * list badges, and the structural visualization. Keeping the palette
 * here ensures a single capture group renders with the same color in
 * every panel.
 */

export interface GroupColor {
	readonly text: string;
	readonly bg: string;
	readonly bgSoft: string;
	readonly border: string;
	readonly ring: string;
}

const PALETTE: readonly GroupColor[] = [
	{
		text: 'text-blue-500',
		bg: 'bg-blue-500/20',
		bgSoft: 'bg-blue-500/10',
		border: 'border-blue-500/40',
		ring: 'ring-blue-500/40',
	},
	{
		text: 'text-emerald-500',
		bg: 'bg-emerald-500/20',
		bgSoft: 'bg-emerald-500/10',
		border: 'border-emerald-500/40',
		ring: 'ring-emerald-500/40',
	},
	{
		text: 'text-fuchsia-500',
		bg: 'bg-fuchsia-500/20',
		bgSoft: 'bg-fuchsia-500/10',
		border: 'border-fuchsia-500/40',
		ring: 'ring-fuchsia-500/40',
	},
	{
		text: 'text-amber-500',
		bg: 'bg-amber-500/20',
		bgSoft: 'bg-amber-500/10',
		border: 'border-amber-500/40',
		ring: 'ring-amber-500/40',
	},
	{
		text: 'text-rose-500',
		bg: 'bg-rose-500/20',
		bgSoft: 'bg-rose-500/10',
		border: 'border-rose-500/40',
		ring: 'ring-rose-500/40',
	},
	{
		text: 'text-cyan-500',
		bg: 'bg-cyan-500/20',
		bgSoft: 'bg-cyan-500/10',
		border: 'border-cyan-500/40',
		ring: 'ring-cyan-500/40',
	},
	{
		text: 'text-violet-500',
		bg: 'bg-violet-500/20',
		bgSoft: 'bg-violet-500/10',
		border: 'border-violet-500/40',
		ring: 'ring-violet-500/40',
	},
	{
		text: 'text-lime-500',
		bg: 'bg-lime-500/20',
		bgSoft: 'bg-lime-500/10',
		border: 'border-lime-500/40',
		ring: 'ring-lime-500/40',
	},
];

export const GROUP_COLOR_COUNT = PALETTE.length;

const FALLBACK_COLOR: GroupColor = {
	text: 'text-foreground',
	bg: 'bg-muted',
	bgSoft: 'bg-muted',
	border: 'border-border',
	ring: 'ring-ring',
};

// Capture-group indices start at 1 (group 0 is the full match), so the
// helpers accept a one-based index and wrap modulo the palette size.
export const groupColor = (oneBasedIndex: number): GroupColor => {
	const safe = Math.max(1, oneBasedIndex);
	const idx = (safe - 1) % PALETTE.length;
	return PALETTE[idx] ?? FALLBACK_COLOR;
};

export const matchBackdropColor = 'bg-warning/20';
