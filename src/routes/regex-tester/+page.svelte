<script lang="ts">
	import { Eye, GitBranch, Info, Search, Sparkles, Workflow } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { FormInfo, FormSection, FormTextarea } from '$lib/components/form';
	import { PatternEditor, RailroadView } from '$lib/components/regex';
	import { ToolShell } from '$lib/components/shell';
	import { EmbeddedEmptyState, StatItem } from '$lib/components/status';
	import * as Accordion from '$lib/components/ui/accordion';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { cn } from '$lib/utils';
	import { groupColor, matchBackdropColor } from '$lib/services/regex-design.js';
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
	} from '$lib/services/regex.js';
	import { type VizNode, type VizNodeKind, visualizeRegex } from '$lib/services/regex-viz.js';

	// State
	let pattern = $state<string>(
		'(?<protocol>https?)://(?<host>[\\w.-]+)(?::(?<port>\\d+))?(?<path>/[^?#\\s]*)?'
	);
	let flags = $state<RegexFlags>({ ...DEFAULT_FLAGS });
	let testText = $state<string>(
		`Visit https://example.com and http://example.org:8080/path?query=1.
Also see https://kogu.io/docs and http://test.local:3000/.`
	);
	let replaceEnabled = $state<boolean>(false);
	let replacement = $state<string>('[$<host>]');
	let showOptions = $state<boolean>(true);

	// Derived
	const flagString = $derived(flagsToString(flags));
	const compiled = $derived(compileRegex(pattern, flags));
	const matchesResult = $derived(findMatches(pattern, flags, testText));
	const matches = $derived<readonly RegexMatch[]>(matchesResult.ok ? matchesResult.value : []);
	const replaceResult = $derived(replaceText(pattern, flags, testText, replacement));
	const visualization = $derived(visualizeRegex(pattern, flagString));
	const features = $derived(findFeatures(pattern));
	const captureGroupCount = $derived(countCaptureGroups(pattern));

	const validity = $derived(compiled.ok ? 'valid' : 'invalid');

	// Build inline-highlight segments for the test text.
	interface Segment {
		readonly text: string;
		readonly matchIndex: number; // -1 if not inside a match
		readonly groupIndex: number; // 0 = no group, 1+ = capture group
	}

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
			.map((start, i) => {
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

	const segments = $derived(buildSegments(testText, matches));
	const replaceSegments = $derived(replaceResult.ok ? buildSegments(replaceResult.value, []) : []);

	// Visualization color mapping
	const KIND_BADGE: Record<VizNodeKind, { readonly label: string; readonly className: string }> = {
		sequence: { label: 'Sequence', className: 'bg-info/10 text-info border-info/30' },
		alternation: {
			label: 'Alternation',
			className: 'bg-warning/10 text-warning border-warning/30',
		},
		group: { label: 'Group', className: 'bg-muted text-muted-foreground' },
		'capture-group': {
			label: 'Capture',
			className: 'bg-success/10 text-success border-success/30',
		},
		'named-group': {
			label: 'Named',
			className: 'bg-success/10 text-success border-success/30',
		},
		'non-capture-group': {
			label: 'Non-cap',
			className: 'bg-muted text-muted-foreground',
		},
		lookahead: { label: 'Lookahead', className: 'bg-info/10 text-info border-info/30' },
		lookbehind: {
			label: 'Lookbehind',
			className: 'bg-info/10 text-info border-info/30',
		},
		'negative-lookahead': {
			label: 'Neg LA',
			className: 'bg-destructive/10 text-destructive border-destructive/30',
		},
		'negative-lookbehind': {
			label: 'Neg LB',
			className: 'bg-destructive/10 text-destructive border-destructive/30',
		},
		repetition: {
			label: 'Repeat',
			className: 'bg-warning/10 text-warning border-warning/30',
		},
		char: { label: 'Char', className: 'bg-muted text-foreground' },
		'char-class': { label: 'Class', className: 'bg-muted text-foreground' },
		meta: { label: 'Meta', className: 'bg-info/10 text-info border-info/30' },
		anchor: {
			label: 'Anchor',
			className: 'bg-warning/10 text-warning border-warning/30',
		},
		backreference: {
			label: 'Backref',
			className: 'bg-success/10 text-success border-success/30',
		},
		unknown: { label: 'Unknown', className: 'bg-destructive/10 text-destructive' },
	};

	const activeFlagIds = $derived(FLAG_INFO.filter((info) => flags[info.id]).map((info) => info.id));

	const handleFlagsChange = (selected: string[]) => {
		flags = {
			global: selected.includes('global'),
			ignoreCase: selected.includes('ignoreCase'),
			multiline: selected.includes('multiline'),
			dotAll: selected.includes('dotAll'),
			unicode: selected.includes('unicode'),
			sticky: selected.includes('sticky'),
		};
	};

	const errorMessage = $derived(compiled.ok ? undefined : compiled.error);
</script>

<svelte:head>
	<title>Regex Tester - Kogu</title>
</svelte:head>

{#snippet renderNode(node: VizNode, depth: number)}
	{@const meta = KIND_BADGE[node.kind]}
	<div class={cn('flex flex-col gap-1.5 rounded-md border bg-card p-2', depth > 0 && 'ml-3')}>
		<div class="flex items-center gap-2">
			<Badge class={cn('font-mono text-2xs', meta.className)}>{meta.label}</Badge>
			<code class="break-all font-mono text-xs">{node.label}</code>
			{#if node.detail}
				<span class="text-2xs text-muted-foreground">{node.detail}</span>
			{/if}
		</div>
		{#if node.children.length > 0}
			<div
				class={cn(
					'flex flex-col gap-1.5 border-l-2 border-border pl-2',
					node.kind === 'alternation' && 'border-warning/50',
					node.kind === 'sequence' && 'border-info/40'
				)}
			>
				{#each node.children as child, idx (idx)}
					{@render renderNode(child, depth + 1)}
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<ToolShell valid={validity === 'valid'} error={errorMessage} bind:showRail={showOptions}>
	{#snippet statusContent()}
		<StatItem label="Matches" value={matches.length} />
		<StatItem label="Groups" value={captureGroupCount} />
		<StatItem label="Flags" value={flagString || '—'} />
	{/snippet}

	{#snippet rail()}
		<FormSection title="Pattern">
			<FormInfo>Regex literal in JavaScript syntax. Forward slashes don't need escaping.</FormInfo>
		</FormSection>

		<FormSection title="Railroad">
			<FormInfo>
				The diagram below the pattern bar is read left-to-right. Branches stack vertically; dashed
				loops mark quantifiers. Each capture group is boxed with a unique color shared across the
				pattern bar, test text, and match list.
			</FormInfo>
		</FormSection>

		<FormSection title="Replace mode">
			<FormInfo>
				Toggle the button in the Replace card to apply a substitution. Use
				<code class="rounded bg-muted px-1 font-mono">$1</code>,
				<code class="rounded bg-muted px-1 font-mono">$&lt;name&gt;</code>, or
				<code class="rounded bg-muted px-1 font-mono">$&amp;</code> placeholders.
			</FormInfo>
		</FormSection>

		<FormSection title="Flags">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li><code class="font-mono">g</code> — find all matches, not just the first</li>
					<li><code class="font-mono">i</code> — case-insensitive matching</li>
					<li><code class="font-mono">m</code> — ^ and $ match line boundaries</li>
					<li><code class="font-mono">s</code> — . matches newline characters</li>
					<li><code class="font-mono">u</code> — Unicode code point parsing</li>
					<li><code class="font-mono">y</code> — sticky, match only at lastIndex</li>
				</ul>
			</FormInfo>
		</FormSection>
	{/snippet}

	<div class="flex h-full flex-col overflow-hidden">
		<!-- Pattern bar -->
		<div class="border-b bg-surface-2 px-4 py-3">
			<div class="mx-auto flex max-w-6xl flex-col gap-2">
				<div class="flex items-start gap-3">
					<div class="flex-1">
						<PatternEditor bind:value={pattern} placeholder="\\d+" />
					</div>
					<ToggleGroup.Root
						type="multiple"
						variant="outline"
						value={activeFlagIds}
						onValueChange={handleFlagsChange}
					>
						{#each FLAG_INFO as info (info.id)}
							<ToggleGroup.Item
								value={info.id}
								aria-label={info.label}
								title={`${info.label} — ${info.description}`}
								class="h-9 w-9 font-mono"
							>
								{info.char}
							</ToggleGroup.Item>
						{/each}
					</ToggleGroup.Root>
				</div>
				<div class="flex flex-wrap items-center gap-2 text-xs">
					{#if compiled.ok}
						<Badge variant="outline" class="bg-success/10 text-success">✓ valid</Badge>
					{:else}
						<Badge variant="outline" class="bg-destructive/10 text-destructive">
							✕ {compiled.error}
						</Badge>
					{/if}
					<Badge variant="outline"
						>{captureGroupCount} capture group{captureGroupCount === 1 ? '' : 's'}</Badge
					>
					<Badge variant="outline"
						>{features.length} feature{features.length === 1 ? '' : 's'}</Badge
					>
					<div class="ml-auto">
						<CopyButton text={`/${pattern}/${flagString}`} toastLabel="Pattern" size="sm" />
					</div>
				</div>
			</div>
		</div>

		<!-- Hero Railroad -->
		<div class="shrink-0 border-b bg-background px-4 py-3">
			<div class="mx-auto max-w-6xl">
				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
						<div class="flex items-center gap-2">
							<Workflow class="h-4 w-4 text-muted-foreground" />
							<Card.Title class="text-sm font-medium">Railroad</Card.Title>
							{#if captureGroupCount > 0}
								<Badge variant="outline" class="font-mono text-2xs">
									{captureGroupCount} group{captureGroupCount === 1 ? '' : 's'}
								</Badge>
							{/if}
						</div>
					</Card.Header>
					<Card.Content class="max-h-80 overflow-auto p-3">
						{#if pattern.length === 0}
							<EmbeddedEmptyState
								icon={Workflow}
								title="Enter a pattern"
								description="The railroad diagram appears here once you type a regex."
							/>
						{:else if visualization.ok}
							<RailroadView node={visualization.value} />
						{:else}
							<p class="text-sm text-destructive">{visualization.error}</p>
						{/if}
					</Card.Content>
				</Card.Root>
			</div>
		</div>

		<!-- Body: left = test text + replace, right = accordion -->
		<div class="flex flex-1 overflow-hidden">
			<!-- Left column -->
			<div class="flex flex-1 flex-col gap-4 overflow-auto p-4">
				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
						<div class="flex items-center gap-2">
							<Eye class="h-4 w-4 text-muted-foreground" />
							<Card.Title class="text-sm font-medium">Test text</Card.Title>
							<Badge variant="outline" class="font-mono text-2xs">
								{matches.length} match{matches.length === 1 ? '' : 'es'}
							</Badge>
						</div>
					</Card.Header>
					<Card.Content class="space-y-3">
						<FormTextarea
							label=""
							bind:value={testText}
							placeholder="Paste text to test against the pattern..."
							rows={6}
							class="font-mono text-sm"
						/>
						{#if matches.length > 0 || testText}
							<div>
								<div
									class="mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground"
								>
									Inline preview
								</div>
								<pre
									class="whitespace-pre-wrap break-all rounded-md border bg-muted p-3 font-mono text-sm">{#each segments as seg, idx (idx)}{#if seg.matchIndex >= 0 && seg.groupIndex > 0}<span
												class={cn('rounded px-0.5', groupColor(seg.groupIndex).bg)}>{seg.text}</span
											>{:else if seg.matchIndex >= 0}<span
												class={cn('rounded px-0.5', matchBackdropColor)}>{seg.text}</span
											>{:else}<span>{seg.text}</span>{/if}{/each}</pre>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
						<div class="flex items-center gap-2">
							<Sparkles class="h-4 w-4 text-muted-foreground" />
							<Card.Title class="text-sm font-medium">Replace</Card.Title>
						</div>
						<Button
							variant={replaceEnabled ? 'default' : 'outline'}
							size="sm"
							class="h-7"
							onclick={() => (replaceEnabled = !replaceEnabled)}
						>
							{replaceEnabled ? 'On' : 'Off'}
						</Button>
					</Card.Header>
					<Card.Content class="space-y-3">
						{#if replaceEnabled}
							<FormTextarea
								label="Replacement"
								bind:value={replacement}
								placeholder="$1 [at] $2"
								hint="Use $1, $2... for positional groups; $<name> for named groups; $& for the full match."
								rows={2}
								class="font-mono text-sm"
							/>
							{#if replaceResult.ok}
								<div>
									<div
										class="mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground"
									>
										Result
									</div>
									<pre
										class="overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted p-3 font-mono text-sm">{#each replaceSegments as seg, idx (idx)}{seg.text}{/each}</pre>
								</div>
								<div class="flex justify-end">
									<CopyButton text={replaceResult.value} toastLabel="Result" size="sm" />
								</div>
							{:else}
								<p class="text-sm text-destructive">{replaceResult.error}</p>
							{/if}
						{:else}
							<p class="text-sm text-muted-foreground">
								Toggle the switch above to apply a replacement to the test text.
							</p>
						{/if}
					</Card.Content>
				</Card.Root>
			</div>

			<!-- Right column: accordion -->
			<div class="w-96 shrink-0 overflow-auto border-l bg-surface-2 p-4">
				<Accordion.Root type="multiple" value={['matches', 'explain']} class="w-full">
					<Accordion.Item value="matches">
						<Accordion.Trigger>
							<div class="flex items-center gap-2">
								<Search class="h-4 w-4 text-muted-foreground" />
								<span class="text-sm font-medium">Matches</span>
								<Badge variant="outline" class="font-mono text-2xs">{matches.length}</Badge>
							</div>
						</Accordion.Trigger>
						<Accordion.Content>
							{#if matches.length > 0}
								<div class="space-y-2">
									{#each matches as match, mIdx (mIdx)}
										<div class="rounded-md border bg-card p-2">
											<div class="flex items-center gap-2">
												<Badge variant="outline" class="font-mono text-2xs">@{match.index}</Badge>
												<code class="break-all font-mono text-xs">{match.fullMatch}</code>
											</div>
											{#if match.groups.length > 0}
												<div class="mt-1.5 space-y-1">
													{#each match.groups as group, gIdx (gIdx)}
														{@const color = groupColor(gIdx + 1)}
														<div class="flex items-baseline gap-2 text-2xs">
															<Badge
																class={cn('font-mono', color.bgSoft, color.text, color.border)}
															>
																${gIdx + 1}
															</Badge>
															<code class="break-all font-mono text-muted-foreground">
																{group.value || '∅'}
															</code>
														</div>
													{/each}
												</div>
											{/if}
											{#if Object.keys(match.namedGroups).length > 0}
												<div class="mt-1.5 space-y-1">
													{#each Object.entries(match.namedGroups) as [name, group], nIdx (name)}
														{@const color = groupColor(nIdx + 1)}
														<div class="flex items-baseline gap-2 text-2xs">
															<Badge
																class={cn('font-mono', color.bgSoft, color.text, color.border)}
															>
																{name}
															</Badge>
															<code class="break-all font-mono text-muted-foreground">
																{group.value || '∅'}
															</code>
														</div>
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<EmbeddedEmptyState
									icon={Search}
									title="No matches"
									description={compiled.ok
										? 'The pattern compiled but found no matches.'
										: 'Fix the pattern error above to see matches.'}
								/>
							{/if}
						</Accordion.Content>
					</Accordion.Item>

					<Accordion.Item value="structure">
						<Accordion.Trigger>
							<div class="flex items-center gap-2">
								<GitBranch class="h-4 w-4 text-muted-foreground" />
								<span class="text-sm font-medium">Structure</span>
							</div>
						</Accordion.Trigger>
						<Accordion.Content>
							{#if visualization.ok}
								{@render renderNode(visualization.value, 0)}
							{:else}
								<p class="text-xs text-destructive">{visualization.error}</p>
							{/if}
						</Accordion.Content>
					</Accordion.Item>

					<Accordion.Item value="explain">
						<Accordion.Trigger>
							<div class="flex items-center gap-2">
								<Info class="h-4 w-4 text-muted-foreground" />
								<span class="text-sm font-medium">Explain</span>
							</div>
						</Accordion.Trigger>
						<Accordion.Content>
							<div class="space-y-3">
								<div class="rounded-md border bg-card p-2">
									<div class="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
										Active flags
									</div>
									<div class="mt-1 flex flex-wrap gap-1">
										{#each FLAG_INFO.filter((info) => flags[info.id]) as info (info.id)}
											<Badge variant="outline" class="font-mono text-2xs">
												{info.char}
												{info.label}
											</Badge>
										{/each}
										{#if flagString === ''}
											<span class="text-2xs text-muted-foreground">None enabled</span>
										{/if}
									</div>
								</div>
								<div class="rounded-md border bg-card p-2">
									<div class="flex items-center justify-between">
										<span
											class="text-2xs font-medium uppercase tracking-wide text-muted-foreground"
										>
											Capture groups
										</span>
										<Badge variant="outline" class="font-mono text-2xs">{captureGroupCount}</Badge>
									</div>
								</div>
								<div class="rounded-md border bg-card p-2">
									<div class="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
										Detected features
									</div>
									{#if features.length > 0}
										<ul class="mt-1.5 space-y-1">
											{#each features as feature (feature.token)}
												<li class="flex items-baseline gap-2 text-2xs">
													<code class="rounded bg-muted px-1 py-0.5 font-mono">{feature.token}</code
													>
													<span class="text-muted-foreground">{feature.description}</span>
												</li>
											{/each}
										</ul>
									{:else}
										<p class="mt-1 text-2xs text-muted-foreground">Plain text pattern.</p>
									{/if}
								</div>
							</div>
						</Accordion.Content>
					</Accordion.Item>
				</Accordion.Root>
			</div>
		</div>
	</div>
</ToolShell>
