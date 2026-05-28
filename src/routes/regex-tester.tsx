import { createFileRoute } from '@tanstack/react-router';
import { Eye, FlaskConical, GitBranch, Info, Search, Sparkles, Workflow } from 'lucide-react';

import { CopyButton } from '@/lib/components/action';
import { FormError, FormInfo, FormSection, FormTextarea } from '@/lib/components/form';
import { RelatedTools, SectionHeader, SplitPane } from '@/lib/components/layout';
import { PatternEditor, RailroadView } from '@/lib/components/regex';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem, ValidityBadge } from '@/lib/components/status';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/lib/components/ui/accordion';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/lib/components/ui/toggle-group';
import { IconTooltip } from '@/lib/components/ui/icon-tooltip';
import { useState } from 'react';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { groupColor, matchBackdropColor } from '@/lib/services/regex-design';
import {
	compileRegex,
	countCaptureGroups,
	DEFAULT_FLAGS,
	type FeatureUsage,
	FLAG_INFO,
	findFeatures,
	findMatches,
	flagsToString,
	type RegexFlags,
	type RegexMatch,
	replaceText,
	type Result,
	SAMPLE_PATTERN,
	SAMPLE_REPLACEMENT,
	SAMPLE_TEST_TEXT,
} from '@/lib/services/regex';
import { type VizNode, type VizNodeKind, visualizeRegex } from '@/lib/services/regex-viz';
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks';

interface Segment {
	readonly text: string;
	readonly matchIndex: number;
	readonly groupIndex: number;
}

const KIND_BADGE: Record<VizNodeKind, { readonly label: string; readonly className: string }> = {
	sequence: { label: 'Sequence', className: 'bg-info/10 text-info border-info/30' },
	alternation: { label: 'Alternation', className: 'bg-warning/10 text-warning border-warning/30' },
	group: { label: 'Group', className: 'bg-muted text-muted-foreground' },
	'capture-group': {
		label: 'Capture',
		className: 'bg-success/10 text-success border-success/30',
	},
	'named-group': { label: 'Named', className: 'bg-success/10 text-success border-success/30' },
	'non-capture-group': { label: 'Non-cap', className: 'bg-muted text-muted-foreground' },
	lookahead: { label: 'Lookahead', className: 'bg-info/10 text-info border-info/30' },
	lookbehind: { label: 'Lookbehind', className: 'bg-info/10 text-info border-info/30' },
	'negative-lookahead': {
		label: 'Neg LA',
		className: 'bg-destructive/10 text-destructive border-destructive/30',
	},
	'negative-lookbehind': {
		label: 'Neg LB',
		className: 'bg-destructive/10 text-destructive border-destructive/30',
	},
	repetition: { label: 'Repeat', className: 'bg-warning/10 text-warning border-warning/30' },
	char: { label: 'Char', className: 'bg-muted text-foreground' },
	'char-class': { label: 'Class', className: 'bg-muted text-foreground' },
	meta: { label: 'Meta', className: 'bg-info/10 text-info border-info/30' },
	anchor: { label: 'Anchor', className: 'bg-warning/10 text-warning border-warning/30' },
	backreference: {
		label: 'Backref',
		className: 'bg-success/10 text-success border-success/30',
	},
	unknown: { label: 'Unknown', className: 'bg-destructive/10 text-destructive' },
};

const FLAG_TOOLTIPS: Readonly<Record<string, string>> = {
	g: 'Global: find all matches',
	i: 'Case insensitive',
	m: 'Multiline: ^ and $ match line breaks',
	s: 'Dotall: . matches newlines',
	u: 'Unicode: enable full Unicode matching',
	y: 'Sticky: match from lastIndex',
};

interface RegexFlagsPrefs {
	readonly flags: RegexFlags;
}

const useRegexFlags = createToolOptionsStore<RegexFlagsPrefs>('regex-tester', {
	flags: { ...DEFAULT_FLAGS },
});

const buildSegments = (text: string, allMatches: readonly RegexMatch[]): readonly Segment[] => {
	if (allMatches.length === 0) {
		return [{ text, matchIndex: -1, groupIndex: 0 }];
	}
	const events = new Set<number>([0, text.length]);
	allMatches.forEach((m) => {
		events.add(m.index);
		events.add(m.endIndex);
		m.groups.forEach((g) => {
			if (g.start >= 0) {
				events.add(g.start);
				events.add(g.end);
			}
		});
	});
	const sorted = [...events].sort((a, b) => a - b);
	return sorted
		.slice(0, -1)
		.map((start, i): Segment | null => {
			const end = sorted[i + 1] ?? start;
			if (start >= end) return null;
			const slice = text.slice(start, end);
			const matchIdx = allMatches.findIndex((m) => m.index <= start && m.endIndex >= end);
			// Derive the innermost matching group index as a const expression so
			// the result never reassigns. Falls back to 0 if no group encloses
			// the current slice.
			const groupIdx = ((): number => {
				if (matchIdx < 0) return 0;
				const match = allMatches[matchIdx];
				if (!match) return 0;
				const inner = match.groups
					.map((g, gi) => ({ ...g, oneBased: gi + 1 }))
					.filter((g) => g.start >= 0 && g.start <= start && g.end >= end)
					.sort((a, b) => b.start - a.start || a.end - b.end)[0];
				return inner?.oneBased ?? 0;
			})();
			return { text: slice, matchIndex: matchIdx, groupIndex: groupIdx };
		})
		.filter((s): s is Segment => s !== null);
};

interface RenderNodeProps {
	readonly node: VizNode;
	readonly depth: number;
}

function RenderNode({ node, depth }: RenderNodeProps) {
	const meta = KIND_BADGE[node.kind];
	return (
		<Card density="compact" className={cn(depth > 0 && 'ml-3')}>
			<CardContent className="flex flex-col gap-1.5">
				<div className="flex items-center gap-2">
					<Badge className={cn('font-mono text-2xs', meta.className)}>{meta.label}</Badge>
					<code className="break-all font-mono text-xs">{node.label}</code>
					{node.detail ? (
						<span className="text-2xs text-muted-foreground">{node.detail}</span>
					) : null}
				</div>
				{node.children.length > 0 ? (
					<div
						className={cn(
							'flex flex-col gap-1.5 border-l-2 border-border pl-2',
							node.kind === 'alternation' && 'border-warning/50',
							node.kind === 'sequence' && 'border-info/40'
						)}
					>
						{node.children.map((child, idx) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: viz tree is immutable
							<RenderNode key={idx} node={child} depth={depth + 1} />
						))}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

interface MatchGroupListProps {
	readonly match: RegexMatch;
}

function MatchGroupList({ match }: MatchGroupListProps) {
	const hasPositional = match.groups.length > 0;
	const namedEntries = Object.entries(match.namedGroups);
	const hasNamed = namedEntries.length > 0;
	if (!hasPositional && !hasNamed) return null;
	return (
		<>
			{hasPositional ? (
				<div className="mt-1.5 space-y-1">
					{match.groups.map((group, gIdx) => {
						const color = groupColor(gIdx + 1);
						return (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: groups in stable order
								key={gIdx}
								className="flex items-baseline gap-2 text-2xs"
							>
								<Badge className={cn('font-mono', color.bgSoft, color.text, color.border)}>
									${gIdx + 1}
								</Badge>
								<code className="break-all font-mono text-muted-foreground">
									{group.value || '∅'}
								</code>
							</div>
						);
					})}
				</div>
			) : null}
			{hasNamed ? (
				<div className="mt-1.5 space-y-1">
					{namedEntries.map(([name, group], nIdx) => {
						const color = groupColor(nIdx + 1);
						return (
							<div key={name} className="flex items-baseline gap-2 text-2xs">
								<Badge className={cn('font-mono', color.bgSoft, color.text, color.border)}>
									{name}
								</Badge>
								<code className="break-all font-mono text-muted-foreground">
									{group.value || '∅'}
								</code>
							</div>
						);
					})}
				</div>
			) : null}
		</>
	);
}

interface MatchesAccordionProps {
	readonly matches: readonly RegexMatch[];
	readonly compiledOk: boolean;
}

function MatchesAccordion({ matches, compiledOk }: MatchesAccordionProps) {
	return (
		<AccordionItem value="matches">
			<AccordionTrigger>
				<div className="flex items-center gap-2">
					<Search className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium">Matches</span>
					<Badge variant="outline" className="font-mono text-2xs">
						{matches.length}
					</Badge>
				</div>
			</AccordionTrigger>
			<AccordionContent>
				{matches.length > 0 ? (
					<div className="space-y-2">
						{matches.map((match, mIdx) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: matches in stable order
							<Card key={mIdx} density="compact">
								<CardContent>
									<div className="flex items-center gap-2">
										<Badge variant="outline" className="font-mono text-2xs">
											@{match.index}
										</Badge>
										<code className="break-all font-mono text-xs">{match.fullMatch}</code>
									</div>
									<MatchGroupList match={match} />
								</CardContent>
							</Card>
						))}
					</div>
				) : (
					<EmbeddedEmptyState
						icon={Search}
						title="No matches"
						description={
							compiledOk
								? 'The pattern compiled but found no matches.'
								: 'Fix the pattern error above to see matches.'
						}
					/>
				)}
			</AccordionContent>
		</AccordionItem>
	);
}

interface StructureAccordionProps {
	readonly visualization: Result<VizNode>;
}

function StructureAccordion({ visualization }: StructureAccordionProps) {
	return (
		<AccordionItem value="structure">
			<AccordionTrigger>
				<div className="flex items-center gap-2">
					<GitBranch className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium">Structure</span>
				</div>
			</AccordionTrigger>
			<AccordionContent>
				{visualization.ok ? (
					<RenderNode node={visualization.value} depth={0} />
				) : (
					<p className="text-xs text-destructive">{visualization.error}</p>
				)}
			</AccordionContent>
		</AccordionItem>
	);
}

interface ExplainAccordionProps {
	readonly flags: RegexFlags;
	readonly flagString: string;
	readonly captureGroupCount: number;
	readonly features: readonly FeatureUsage[];
}

function ExplainAccordion({
	flags,
	flagString,
	captureGroupCount,
	features,
}: ExplainAccordionProps) {
	const activeFlags = FLAG_INFO.filter((info) => flags[info.id]);
	return (
		<AccordionItem value="explain">
			<AccordionTrigger>
				<div className="flex items-center gap-2">
					<Info className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium">Explain</span>
				</div>
			</AccordionTrigger>
			<AccordionContent>
				<div className="space-y-3">
					<Card density="compact">
						<CardContent>
							<div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
								Active flags
							</div>
							<div className="mt-1 flex flex-wrap gap-1">
								{activeFlags.map((info) => (
									<Badge key={info.id} variant="outline" className="font-mono text-2xs">
										{info.char} {info.label}
									</Badge>
								))}
								{flagString === '' ? (
									<span className="text-2xs text-muted-foreground">None enabled</span>
								) : null}
							</div>
						</CardContent>
					</Card>
					<Card density="compact">
						<CardContent>
							<div className="flex items-center justify-between">
								<span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
									Capture groups
								</span>
								<Badge variant="outline" className="font-mono text-2xs">
									{captureGroupCount}
								</Badge>
							</div>
						</CardContent>
					</Card>
					<Card density="compact">
						<CardContent>
							<div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
								Detected features
							</div>
							{features.length > 0 ? (
								<ul className="mt-1.5 space-y-1">
									{features.map((feature) => (
										<li key={feature.token} className="flex items-baseline gap-2 text-2xs">
											<code className="rounded bg-muted px-1 py-0.5 font-mono">
												{feature.token}
											</code>
											<span className="text-muted-foreground">{feature.description}</span>
										</li>
									))}
								</ul>
							) : (
								<p className="mt-1 text-2xs text-muted-foreground">Plain text pattern.</p>
							)}
						</CardContent>
					</Card>
				</div>
			</AccordionContent>
		</AccordionItem>
	);
}

interface InlinePreviewProps {
	readonly segments: readonly Segment[];
}

function InlinePreview({ segments }: InlinePreviewProps) {
	return (
		<div>
			<div className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
				Inline preview
			</div>
			<pre className="whitespace-pre-wrap break-all rounded-md border bg-muted p-3 font-mono text-sm">
				{segments.map((seg, idx) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: segments are stable
					<PreviewSegment key={idx} seg={seg} />
				))}
			</pre>
		</div>
	);
}

interface PreviewSegmentProps {
	readonly seg: Segment;
}

function PreviewSegment({ seg }: PreviewSegmentProps) {
	if (seg.matchIndex >= 0 && seg.groupIndex > 0) {
		return <span className={cn('rounded px-0.5', groupColor(seg.groupIndex).bg)}>{seg.text}</span>;
	}
	if (seg.matchIndex >= 0) {
		return <span className={cn('rounded px-0.5', matchBackdropColor)}>{seg.text}</span>;
	}
	return <span>{seg.text}</span>;
}

interface ReplaceCardProps {
	readonly replaceEnabled: boolean;
	readonly onToggle: () => void;
	readonly replacement: string;
	readonly onReplacementChange: (value: string) => void;
	readonly replaceResult: Result<string>;
	readonly replaceSegments: readonly Segment[];
}

function ReplaceCard({
	replaceEnabled,
	onToggle,
	replacement,
	onReplacementChange,
	replaceResult,
	replaceSegments,
}: ReplaceCardProps) {
	return (
		<Card density="compact">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
				<div className="flex items-center gap-2">
					<Sparkles className="h-4 w-4 text-muted-foreground" />
					<CardTitle className="text-sm font-medium">Replace</CardTitle>
				</div>
				<Button
					variant={replaceEnabled ? 'default' : 'outline'}
					size="sm"
					className="h-7"
					onClick={onToggle}
				>
					{replaceEnabled ? 'On' : 'Off'}
				</Button>
			</CardHeader>
			<CardContent className="space-y-3">
				{replaceEnabled ? (
					<ReplaceCardBody
						replacement={replacement}
						onReplacementChange={onReplacementChange}
						replaceResult={replaceResult}
						replaceSegments={replaceSegments}
					/>
				) : (
					<p className="text-sm text-muted-foreground">
						Toggle the switch above to apply a replacement to the test text.
					</p>
				)}
			</CardContent>
		</Card>
	);
}

interface ReplaceCardBodyProps {
	readonly replacement: string;
	readonly onReplacementChange: (value: string) => void;
	readonly replaceResult: Result<string>;
	readonly replaceSegments: readonly Segment[];
}

function ReplaceCardBody({
	replacement,
	onReplacementChange,
	replaceResult,
	replaceSegments,
}: ReplaceCardBodyProps) {
	return (
		<>
			<FormTextarea
				label="Replacement"
				value={replacement}
				onValueChange={onReplacementChange}
				placeholder="$1 [at] $2"
				hint="Use $1, $2... for positional groups; $<name> for named groups; $& for the full match."
				rows={2}
				className="font-mono text-sm"
			/>
			{replaceResult.ok ? (
				<>
					<div>
						<div className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
							Result
						</div>
						<pre className="overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted p-3 font-mono text-sm">
							{replaceSegments.map((seg, idx) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: segments are stable
								<span key={idx}>{seg.text}</span>
							))}
						</pre>
					</div>
					<div className="flex justify-end">
						<CopyButton text={replaceResult.value} toastLabel="Result" size="sm" />
					</div>
				</>
			) : (
				<p className="text-sm text-destructive">{replaceResult.error}</p>
			)}
		</>
	);
}

export const Route = createFileRoute('/regex-tester')({
	component: RegexTesterPage,
});

function RegexTesterPage() {
	const { value: prefs, patch } = useRegexFlags();
	const flags = prefs.flags;

	const [pattern, setPattern] = useState('');
	const [testText, setTestText] = useState('');
	const [replaceEnabled, setReplaceEnabled] = useState(false);
	const [replacement, setReplacement] = useState('');
	const [showOptions, setShowOptions] = usePersistedRail('regex-tester');

	useDocumentTitle('Regex Tester');

	const loadSample = () => {
		setPattern(SAMPLE_PATTERN);
		setTestText(SAMPLE_TEST_TEXT);
		setReplacement(SAMPLE_REPLACEMENT);
	};

	// Debounce expensive inputs at 250ms so regexp-tree AST and railroad
	// generation do not fire on every keystroke. compileRegex stays on the
	// raw pattern for the validity badge — `new RegExp()` is cheap enough.
	const debouncedPattern = useDebouncedValue(pattern, 250);
	const debouncedTestText = useDebouncedValue(testText, 250);
	const debouncedReplacement = useDebouncedValue(replacement, 250);

	const flagString = flagsToString(flags);
	const compiled = compileRegex(pattern, flags);
	const matchesResult = findMatches(debouncedPattern, flags, debouncedTestText);
	const matches: readonly RegexMatch[] = matchesResult.ok ? matchesResult.value : [];
	const replaceResult = replaceText(
		debouncedPattern,
		flags,
		debouncedTestText,
		debouncedReplacement
	);
	const visualization = visualizeRegex(debouncedPattern, flagString);
	const features = findFeatures(debouncedPattern);
	const captureGroupCount = countCaptureGroups(debouncedPattern);

	const validity: 'empty' | 'valid' | 'invalid' =
		pattern.length === 0 ? 'empty' : compiled.ok ? 'valid' : 'invalid';

	const segments = buildSegments(testText, matches);
	const replaceSegments = replaceResult.ok ? buildSegments(replaceResult.value, []) : [];

	const activeFlagIds = FLAG_INFO.filter((info) => flags[info.id]).map((info) => info.id);

	const handleFlagsChange = (selected: string[]) => {
		patch({
			flags: {
				global: selected.includes('global'),
				ignoreCase: selected.includes('ignoreCase'),
				multiline: selected.includes('multiline'),
				dotAll: selected.includes('dotAll'),
				unicode: selected.includes('unicode'),
				sticky: selected.includes('sticky'),
			},
		});
	};

	const errorMessage = validity === 'invalid' && !compiled.ok ? compiled.error : undefined;

	return (
		<ToolShell
			valid={validity === 'empty' ? null : validity === 'valid'}
			error={errorMessage}
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			statusContent={
				<>
					<StatItem label="Matches" value={matches.length} />
					<StatItem label="Groups" value={captureGroupCount} />
					<StatItem label="Flags" value={flagString || '—'} />
				</>
			}
			rail={
				<>
					<FormSection title="Pattern">
						<FormInfo>
							Regex literal in JavaScript syntax. Forward slashes don't need escaping.
						</FormInfo>
					</FormSection>

					<FormSection title="Railroad">
						<FormInfo>
							The diagram below the pattern bar is read left-to-right. Branches stack vertically;
							dashed loops mark quantifiers. Each capture group is boxed with a unique color shared
							across the pattern bar, test text, and match list.
						</FormInfo>
					</FormSection>

					<FormSection title="Replace mode">
						<FormInfo>
							Toggle the button in the Replace card to apply a substitution. Use{' '}
							<code className="rounded bg-muted px-1 font-mono">$1</code>,{' '}
							<code className="rounded bg-muted px-1 font-mono">{'$<name>'}</code>, or{' '}
							<code className="rounded bg-muted px-1 font-mono">$&amp;</code> placeholders.
						</FormInfo>
					</FormSection>

					<FormSection title="Flags">
						<FormInfo>
							<ul className="list-inside list-disc space-y-0.5">
								<li>
									<code className="font-mono">g</code> — find all matches, not just the first
								</li>
								<li>
									<code className="font-mono">i</code> — case-insensitive matching
								</li>
								<li>
									<code className="font-mono">m</code> — ^ and $ match line boundaries
								</li>
								<li>
									<code className="font-mono">s</code> — . matches newline characters
								</li>
								<li>
									<code className="font-mono">u</code> — Unicode code point parsing
								</li>
								<li>
									<code className="font-mono">y</code> — sticky, match only at lastIndex
								</li>
							</ul>
						</FormInfo>
					</FormSection>

					<FormSection title="Related">
						<RelatedTools
							items={[
								{ id: 'string-case-converter', reason: 'Normalize text before matching' },
								{ id: 'list-comparer', reason: 'Compare sets of matched strings' },
								{ id: 'diff-viewer', reason: 'Diff the replacement output' },
							]}
						/>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							Tests JavaScript regular expressions against arbitrary input. The railroad diagram
							visualizes the pattern; matches, capture groups, and replacement previews are computed
							locally on every keystroke.
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="border-b bg-surface-2 px-4 py-3">
					<div className="mx-auto flex max-w-6xl flex-col gap-2">
						<div className="flex items-start gap-3">
							<div className="flex-1">
								<PatternEditor value={pattern} onValueChange={setPattern} placeholder="\d+" />
							</div>
							<ToggleGroup
								type="multiple"
								variant="outline"
								value={activeFlagIds}
								onValueChange={handleFlagsChange}
							>
								{FLAG_INFO.map((info) => {
									const flagTooltip = FLAG_TOOLTIPS[info.char] ?? info.label;
									return (
										<IconTooltip key={info.id} label={flagTooltip}>
											<ToggleGroupItem
												value={info.id}
												aria-label={info.label}
												className="h-9 w-9 font-mono aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
											>
												{info.char}
											</ToggleGroupItem>
										</IconTooltip>
									);
								})}
							</ToggleGroup>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-xs">
							<output aria-live="polite" aria-atomic="true" className="contents">
								<ValidityBadge state={validity} error={errorMessage} />
							</output>
							<Badge variant="outline">
								{captureGroupCount} capture group{captureGroupCount === 1 ? '' : 's'}
							</Badge>
							<Badge variant="outline">
								{features.length} feature{features.length === 1 ? '' : 's'}
							</Badge>
							<div className="ml-auto flex items-center gap-1">
								<Button variant="outline" size="sm" className="h-7" onClick={loadSample}>
									<FlaskConical className="h-3.5 w-3.5" />
									Sample
								</Button>
								<CopyButton
									text={`/${pattern}/${flagString}`}
									toastLabel="Pattern"
									variant="outline"
									size="sm"
								/>
							</div>
						</div>
					</div>
				</div>

				<div className="shrink-0 border-b bg-background px-4 py-3">
					<div className="mx-auto max-w-6xl">
						<Card density="compact">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
								<div className="flex items-center gap-2">
									<Workflow className="h-4 w-4 text-muted-foreground" />
									<CardTitle className="text-sm font-medium">Railroad</CardTitle>
									{captureGroupCount > 0 ? (
										<Badge variant="outline" className="font-mono text-2xs">
											{captureGroupCount} group{captureGroupCount === 1 ? '' : 's'}
										</Badge>
									) : null}
								</div>
							</CardHeader>
							<CardContent className="max-h-80 overflow-auto">
								{pattern.length === 0 ? (
									<EmbeddedEmptyState
										icon={Workflow}
										title="Enter a pattern"
										description="The railroad diagram appears here once you type a regex."
									/>
								) : visualization.ok ? (
									<RailroadView node={visualization.value} />
								) : (
									<FormError message={visualization.error} className="text-sm" />
								)}
							</CardContent>
						</Card>
					</div>
				</div>

				<SplitPane
					direction="horizontal"
					defaultSizes={[55, 45]}
					minSizes={[30, 30]}
					left={
						<div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
							<Card density="compact">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
									<div className="flex items-center gap-2">
										<Eye className="h-4 w-4 text-muted-foreground" />
										<CardTitle className="text-sm font-medium">Test text</CardTitle>
										<output aria-live="polite" aria-atomic="true" className="contents">
											<Badge variant="outline" className="font-mono text-2xs">
												{matches.length} match{matches.length === 1 ? '' : 'es'}
											</Badge>
										</output>
									</div>
								</CardHeader>
								<CardContent className="space-y-3">
									<FormTextarea
										label=""
										value={testText}
										onValueChange={setTestText}
										placeholder="Paste text to test against the pattern..."
										rows={6}
										className="font-mono text-sm"
									/>
									{matches.length > 0 || testText ? <InlinePreview segments={segments} /> : null}
								</CardContent>
							</Card>

							<ReplaceCard
								replaceEnabled={replaceEnabled}
								onToggle={() => setReplaceEnabled((v) => !v)}
								replacement={replacement}
								onReplacementChange={setReplacement}
								replaceResult={replaceResult}
								replaceSegments={replaceSegments}
							/>
						</div>
					}
					right={
						<div className="flex h-full min-h-0 flex-col border-l">
							<SectionHeader title="Inspection" />
							<div className="flex-1 overflow-auto px-3 pb-3">
								<Accordion type="multiple" defaultValue={['matches', 'explain']} className="w-full">
									<MatchesAccordion matches={matches} compiledOk={compiled.ok} />
									<StructureAccordion visualization={visualization} />
									<ExplainAccordion
										flags={flags}
										flagString={flagString}
										captureGroupCount={captureGroupCount}
										features={features}
									/>
								</Accordion>
							</div>
						</div>
					}
				/>
			</div>
		</ToolShell>
	);
}
