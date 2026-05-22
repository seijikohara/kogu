import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

interface CodeBlockProps extends Omit<ComponentProps<'div'>, 'children'> {
	// `code` (default) renders `<code className="block break-all">` for inline-y
	// values (hashes, single-line keys, URLs). `pre` renders `<pre>` for
	// preserved-format multi-line text (decoded JWT payload, key body).
	readonly as?: 'code' | 'pre';
	// Padding ladder: `sm` → `p-2`, `md` → `p-3`. Default `sm`.
	readonly padding?: 'sm' | 'md';
	// Text size: `xs` → `text-xs`, `sm` → `text-sm`. Default `xs`.
	readonly size?: 'xs' | 'sm';
	// Scrollable height clamp for `pre` variant: `sm` → `max-h-32`, `md` →
	// `max-h-48`. Ignored on `code`.
	readonly maxHeight?: 'sm' | 'md';
	// Enable `whitespace-pre-wrap break-all` on `pre` variant for soft-wrap
	// of long lines. Ignored on `code` (always wraps via `break-all`).
	readonly wrap?: boolean;
	readonly className?: string;
	readonly children?: React.ReactNode;
}

const PADDING_CLASS = { sm: 'p-2', md: 'p-3' } as const;
const SIZE_CLASS = { xs: 'text-xs', sm: 'text-sm' } as const;
const MAX_HEIGHT_CLASS = { sm: 'max-h-32', md: 'max-h-48' } as const;

// Single source of truth for the `rounded bg-muted ... font-mono ...`
// code-display block that every generator / decoder / formatter route
// used to spell out inline. Replaces 14 hand-rolled `<code>` / `<pre>`
// blocks across hash-generator, bcrypt-generator, ssh-key-generator,
// gpg-key-generator, jwt-decoder, url-encoder, and others. The variant
// props cover the three observed shapes:
//
//   - `<code className="block break-all rounded bg-muted p-N font-mono text-X">…</code>`
//   - `<pre className="overflow-auto rounded bg-muted p-N font-mono text-X">…</pre>`
//   - `<pre className="max-h-N overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-N font-mono text-X">…</pre>`
export function CodeBlock({
	as = 'code',
	padding = 'sm',
	size = 'xs',
	maxHeight,
	wrap = false,
	className,
	children,
	...props
}: CodeBlockProps) {
	const base = cn('rounded bg-muted font-mono', PADDING_CLASS[padding], SIZE_CLASS[size]);

	if (as === 'pre') {
		return (
			<pre
				className={cn(
					base,
					'overflow-auto',
					wrap && 'whitespace-pre-wrap break-all',
					maxHeight && MAX_HEIGHT_CLASS[maxHeight],
					className
				)}
				{...(props as ComponentProps<'pre'>)}
			>
				{children}
			</pre>
		);
	}

	return (
		<code className={cn(base, 'block break-all', className)} {...(props as ComponentProps<'code'>)}>
			{children}
		</code>
	);
}

export type { CodeBlockProps };
