import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/lib/components/ui/badge';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'warning' | 'info' | 'destructive';

interface ToneBadgeProps {
	// Semantic tone — maps to one of the four sRGB-coordinated palette pairs
	// declared in `app.css` (`--success`, `--warning`, `--info`, `--destructive`).
	readonly tone: Tone;
	// Optional leading icon (e.g. `ShieldCheck` for "Secure", `ShieldAlert` for
	// "Weak"). Renders at 12px on the left of the label.
	readonly icon?: LucideIcon;
	readonly className?: string;
	readonly children: ReactNode;
}

const TONE_CLASS: Record<Tone, string> = {
	success: 'bg-success/10 text-success',
	warning: 'bg-warning/10 text-warning',
	info: 'bg-info/10 text-info',
	destructive: 'bg-destructive/10 text-destructive',
};

// Tone-colored pill that pairs the semantic `bg-{tone}/10` + `text-{tone}`
// surface convention used across the app. Replaces the inline pattern
// `<Badge variant="outline" className="gap-1 bg-success/10 text-success">…`
// that appeared verbatim across the hash / ssh / gpg result panes — a single
// place to evolve tone treatment going forward.
export function ToneBadge({ tone, icon: Icon, className, children }: ToneBadgeProps) {
	return (
		<Badge variant="outline" className={cn('gap-1', TONE_CLASS[tone], className)}>
			{Icon ? <Icon className="h-3 w-3" /> : null}
			{children}
		</Badge>
	);
}

export type { ToneBadgeProps, Tone as ToneBadgeTone };
