import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import {
	Check,
	Eye,
	FlaskConical,
	GitBranch,
	Info,
	Search,
	Sparkles,
	Workflow,
	X,
} from 'lucide-react';

import { CopyButton } from '@/lib/components/action';
import { FormError, FormInfo, FormSection, FormTextarea } from '@/lib/components/form';
import { PatternEditor, RailroadView } from '@/lib/components/regex';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/lib/components/ui/tooltip';
import { useState } from 'react';
import { createToolOptionsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { groupColor, matchBackdropColor } from '@/lib/services/regex-design';
import {
	compileRegex,
	countCaptureGroups,
	DEFAULT_FLAGS,
	FLAG_INFO,
	findFeatures,
	findMatches,
	flagsToString,
	type RegexFlags,
	type RegexMatch,
	replaceText,
	SAMPLE_PATTERN,
	SAMPLE_REPLACEMENT,
	SAMPLE_TEST_TEXT,
} from '@/lib/services/regex';
import { type VizNode, type VizNodeKind, visualizeRegex } from '@/lib/services/regex-viz';

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
			let groupIdx = 0;
			if (matchIdx >= 0) {
				const match = allMatches[matchIdx];
				if (match) {
					const inner = match.groups
						.map((g, gi) => ({ ...g, oneBased: gi + 1 }))
						.filter((g) => g.start >= 0 && g.start <= start && g.end >= end)
						.sort((a, b) => b.start - a.start || a.end - b.end)[0];
					if (inner) groupIdx = inner.oneBased;
				}
			}
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
	const [showOptions, setShowOptions] = useState(true);

	useEffect(() => {
		document.title = 'Regex Tester — Kogu';
	}, []);

	const loadSample = () => {
		setPattern(SAMPLE_PATTERN);
		setTestText(SAMPLE_TEST_TEXT);
		setReplacement(SAMPLE_REPLACEMENT);
	};

	const flagString = flagsToString(flags);
	const compiled = compileRegex(pattern, flags);
	const matchesResult = findMatches(pattern, flags, testText);
	const matches: readonly RegexMatch[] = matchesResult.ok ? matchesResult.value : [];
	const replaceResult = replaceText(pattern, flags, testText, replacement);
	const visualization = visualizeRegex(pattern, flagString);
	const features = findFeatures(pattern);
	const captureGroupCount = countCaptureGroups(pattern);

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
										<Tooltip key={info.id}>
											<TooltipTrigger asChild>
												<ToggleGroupItem
													value={info.id}
													aria-label={info.label}
													className="h-9 w-9 font-mono aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
												>
													{info.char}
												</ToggleGroupItem>
											</TooltipTrigger>
											<TooltipContent>{flagTooltip}</TooltipContent>
										</Tooltip>
									);
								})}
							</ToggleGroup>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-xs">
							<output aria-live="polite" aria-atomic="true" className="contents">
								{validity === 'empty' ? (
									<Badge variant="outline" className="text-muted-foreground">
										empty
									</Badge>
								) : compiled.ok ? (
									<Badge variant="outline" className="bg-success/10 text-success">
										<Check className="mr-1 h-3 w-3" aria-hidden="true" /> valid
									</Badge>
								) : (
									<Badge variant="outline" className="bg-destructive/10 text-destructive">
										<X className="mr-1 h-3 w-3" aria-hidden="true" />
										{compiled.error}
									</Badge>
								)}
							</output>
							<Badge variant="outline">
								{captureGroupCount} capture group{captureGroupCount === 1 ? '' : 's'}
							</Badge>
							<Badge variant="outline">
								{features.length} feature{features.length === 1 ? '' : 's'}
							</Badge>
							<div className="ml-auto flex items-center gap-1">
								<Button variant="ghost" size="sm" className="h-7" onClick={loadSample}>
									<FlaskConical className="mr-1.5 h-3.5 w-3.5" />
									Sample
								</Button>
								<CopyButton text={`/${pattern}/${flagString}`} toastLabel="Pattern" size="sm" />
							</div>
						</div>
					</div>
				</div>

				<div className="shrink-0 border-b bg-background px-4 py-3">
					<div className="mx-auto max-w-6xl">
						<Card density="compact">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
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

				<div className="flex flex-1 overflow-hidden">
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
								{matches.length > 0 || testText ? (
									<div>
										<div className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
											Inline preview
										</div>
										<pre className="whitespace-pre-wrap break-all rounded-md border bg-muted p-3 font-mono text-sm">
											{segments.map((seg, idx) =>
												seg.matchIndex >= 0 && seg.groupIndex > 0 ? (
													<span
														// biome-ignore lint/suspicious/noArrayIndexKey: segments are stable
														key={idx}
														className={cn('rounded px-0.5', groupColor(seg.groupIndex).bg)}
													>
														{seg.text}
													</span>
												) : seg.matchIndex >= 0 ? (
													<span
														// biome-ignore lint/suspicious/noArrayIndexKey: segments are stable
														key={idx}
														className={cn('rounded px-0.5', matchBackdropColor)}
													>
														{seg.text}
													</span>
												) : (
													// biome-ignore lint/suspicious/noArrayIndexKey: segments are stable
													<span key={idx}>{seg.text}</span>
												)
											)}
										</pre>
									</div>
								) : null}
							</CardContent>
						</Card>

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
									onClick={() => setReplaceEnabled((v) => !v)}
								>
									{replaceEnabled ? 'On' : 'Off'}
								</Button>
							</CardHeader>
							<CardContent className="space-y-3">
								{replaceEnabled ? (
									<>
										<FormTextarea
											label="Replacement"
											value={replacement}
											onValueChange={setReplacement}
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
								) : (
									<p className="text-sm text-muted-foreground">
										Toggle the switch above to apply a replacement to the test text.
									</p>
								)}
							</CardContent>
						</Card>
					</div>

					<div className="w-[var(--rail-w-wide)] shrink-0 overflow-auto border-l bg-surface-2 p-4">
						<Accordion type="multiple" defaultValue={['matches', 'explain']} className="w-full">
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
														{match.groups.length > 0 ? (
															<div className="mt-1.5 space-y-1">
																{match.groups.map((group, gIdx) => {
																	const color = groupColor(gIdx + 1);
																	return (
																		<div
																			// biome-ignore lint/suspicious/noArrayIndexKey: groups in stable order
																			key={gIdx}
																			className="flex items-baseline gap-2 text-2xs"
																		>
																			<Badge
																				className={cn(
																					'font-mono',
																					color.bgSoft,
																					color.text,
																					color.border
																				)}
																			>
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
														{Object.keys(match.namedGroups).length > 0 ? (
															<div className="mt-1.5 space-y-1">
																{Object.entries(match.namedGroups).map(([name, group], nIdx) => {
																	const color = groupColor(nIdx + 1);
																	return (
																		<div key={name} className="flex items-baseline gap-2 text-2xs">
																			<Badge
																				className={cn(
																					'font-mono',
																					color.bgSoft,
																					color.text,
																					color.border
																				)}
																			>
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
													</CardContent>
												</Card>
											))}
										</div>
									) : (
										<EmbeddedEmptyState
											icon={Search}
											title="No matches"
											description={
												compiled.ok
													? 'The pattern compiled but found no matches.'
													: 'Fix the pattern error above to see matches.'
											}
										/>
									)}
								</AccordionContent>
							</AccordionItem>

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
													{FLAG_INFO.filter((info) => flags[info.id]).map((info) => (
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
															<li
																key={feature.token}
																className="flex items-baseline gap-2 text-2xs"
															>
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
						</Accordion>
					</div>
				</div>
			</div>
		</ToolShell>
	);
}
