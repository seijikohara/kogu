import { useRef } from 'react';

import { groupColor } from '@/lib/services/regex-design.js';
import { type Token, type TokenKind, tokenizeRegex } from '@/lib/services/regex-highlight.js';
import { cn } from '@/lib/utils';

interface PatternEditorProps {
	readonly value: string;
	readonly onValueChange: (value: string) => void;
	readonly placeholder?: string;
	readonly className?: string;
}

const KIND_CLASS: Record<TokenKind, string> = {
	'group-open': '',
	'group-close': '',
	'group-meta': 'text-muted-foreground',
	'char-class': 'text-amber-500',
	quantifier: 'text-violet-500',
	anchor: 'text-yellow-500 font-semibold',
	escape: 'text-cyan-500',
	alternation: 'text-yellow-500 font-semibold',
	literal: '',
};

const tokenClass = (token: Token): string => {
	if (token.kind === 'literal') return '';
	if (token.kind === 'group-open' || token.kind === 'group-close') {
		if (token.groupIndex && token.groupIndex > 0) {
			return `font-bold ${groupColor(token.groupIndex).text}`;
		}
		return 'text-muted-foreground';
	}
	return KIND_CLASS[token.kind];
};

export function PatternEditor({
	value,
	onValueChange,
	placeholder = '',
	className,
}: PatternEditorProps) {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const preRef = useRef<HTMLPreElement | null>(null);

	const tokens = tokenizeRegex(value);
	// Build per-token character offsets so we can derive a stable React key from
	// the token's position in the original pattern (Biome forbids array index as key).
	// A const cursor object threads the running offset without a `let` accumulator.
	const offsetCursor = { value: 0 };
	const keyedTokens = tokens.map((token) => {
		const offset = offsetCursor.value;
		offsetCursor.value += token.text.length;
		return { token, offset };
	});

	const syncScroll = () => {
		const textarea = textareaRef.current;
		const pre = preRef.current;
		if (!textarea || !pre) return;
		pre.scrollTop = textarea.scrollTop;
		pre.scrollLeft = textarea.scrollLeft;
	};

	return (
		<div className={cn('relative font-mono text-sm leading-6', className)}>
			<pre
				ref={preRef}
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-all rounded-md border bg-background px-3 py-2 text-sm leading-6"
			>
				{keyedTokens.length > 0 ? (
					keyedTokens.map(({ token, offset }) => (
						<span key={`${offset}-${token.kind}`} className={tokenClass(token)}>
							{token.text}
						</span>
					))
				) : (
					<span className="text-muted-foreground" />
				)}
				<br />
			</pre>
			<textarea
				ref={textareaRef}
				value={value}
				onChange={(e) => onValueChange(e.target.value)}
				placeholder={placeholder}
				spellCheck={false}
				autoCapitalize="off"
				autoComplete="off"
				onScroll={syncScroll}
				rows={2}
				className="relative w-full resize-none overflow-auto whitespace-pre-wrap break-all rounded-md border border-transparent bg-transparent px-3 py-2 text-sm leading-6 text-transparent caret-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
			/>
		</div>
	);
}

export type { PatternEditorProps };
