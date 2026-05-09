<script lang="ts">
	import { GitBranch, Hash, Repeat, Type } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { FormCheckbox, FormCheckboxGroup, FormInput } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';
	import { DEFAULT_FLAGS, FLAG_INFO, flagsToString, type RegexFlags } from '$lib/services/regex.js';
	import { type VizNode, type VizNodeKind, visualizeRegex } from '$lib/services/regex-viz.js';

	interface Props {
		onstatschange?: (info: { valid: boolean }) => void;
	}

	let { onstatschange }: Props = $props();

	let pattern = $state<string>(
		'^(?<protocol>https?)://(?<host>[\\w.-]+)(?::(?<port>\\d+))?(?<path>/[^?#]*)?'
	);
	let flags = $state<RegexFlags>({ ...DEFAULT_FLAGS });

	const flagString = $derived(flagsToString(flags));
	const result = $derived(visualizeRegex(pattern, flagString));

	const KIND_BADGE: Record<
		VizNodeKind,
		{ readonly label: string; readonly className: string; readonly icon: typeof GitBranch }
	> = {
		sequence: { label: 'Sequence', className: 'bg-info/10 text-info border-info/30', icon: Type },
		alternation: {
			label: 'Alternation',
			className: 'bg-warning/10 text-warning border-warning/30',
			icon: GitBranch,
		},
		group: { label: 'Group', className: 'bg-muted text-muted-foreground', icon: Hash },
		'capture-group': {
			label: 'Capture group',
			className: 'bg-success/10 text-success border-success/30',
			icon: Hash,
		},
		'named-group': {
			label: 'Named group',
			className: 'bg-success/10 text-success border-success/30',
			icon: Hash,
		},
		'non-capture-group': {
			label: 'Non-capturing',
			className: 'bg-muted text-muted-foreground',
			icon: Hash,
		},
		lookahead: {
			label: 'Lookahead',
			className: 'bg-info/10 text-info border-info/30',
			icon: GitBranch,
		},
		lookbehind: {
			label: 'Lookbehind',
			className: 'bg-info/10 text-info border-info/30',
			icon: GitBranch,
		},
		'negative-lookahead': {
			label: 'Neg lookahead',
			className: 'bg-destructive/10 text-destructive border-destructive/30',
			icon: GitBranch,
		},
		'negative-lookbehind': {
			label: 'Neg lookbehind',
			className: 'bg-destructive/10 text-destructive border-destructive/30',
			icon: GitBranch,
		},
		repetition: {
			label: 'Repetition',
			className: 'bg-warning/10 text-warning border-warning/30',
			icon: Repeat,
		},
		char: { label: 'Char', className: 'bg-muted text-foreground', icon: Type },
		'char-class': { label: 'Char class', className: 'bg-muted text-foreground', icon: Type },
		meta: { label: 'Meta', className: 'bg-info/10 text-info border-info/30', icon: Type },
		anchor: {
			label: 'Anchor',
			className: 'bg-warning/10 text-warning border-warning/30',
			icon: Hash,
		},
		backreference: {
			label: 'Backref',
			className: 'bg-success/10 text-success border-success/30',
			icon: Hash,
		},
		unknown: { label: 'Unknown', className: 'bg-destructive/10 text-destructive', icon: Hash },
	};

	$effect(() => {
		onstatschange?.({ valid: result.ok });
	});
</script>

<!-- Recursive node rendering via snippet -->
{#snippet renderNode(node: VizNode, depth: number)}
	{@const meta = KIND_BADGE[node.kind]}
	<div
		class={cn(
			'relative flex flex-col gap-2 rounded-md border bg-surface-3 p-3',
			depth > 0 && 'ml-4'
		)}
	>
		<div class="flex items-center gap-2">
			<Badge class={cn('font-mono text-2xs', meta.className)}>{meta.label}</Badge>
			<code class="font-mono text-sm">{node.label}</code>
			{#if node.detail}
				<span class="text-2xs text-muted-foreground">{node.detail}</span>
			{/if}
		</div>
		{#if node.children.length > 0}
			<div
				class={cn(
					'flex flex-col gap-2 border-l-2 border-border pl-3',
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

<div class="flex h-full flex-col overflow-hidden">
	<SectionHeader title="Visualize">
		{#snippet trailing()}
			<CopyButton text={`/${pattern}/${flagString}`} toastLabel="Pattern" size="sm" class="h-7" />
		{/snippet}
	</SectionHeader>

	<div class="flex-1 overflow-auto p-4">
		<div class="mx-auto flex max-w-5xl flex-col gap-4">
			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">Pattern</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-3">
					<FormInput label="" bind:value={pattern} placeholder="\\d+" class="font-mono" />
					<FormCheckboxGroup>
						{#each FLAG_INFO as info (info.id)}
							<FormCheckbox
								label={`${info.char} - ${info.label}`}
								hint={info.description}
								bind:checked={flags[info.id]}
							/>
						{/each}
					</FormCheckboxGroup>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">Structure</Card.Title>
					<Card.Description class="text-xs">
						AST decomposition of the pattern. Each node is colored by role: sequences and groups
						stack horizontally, alternations branch, repetitions wrap their inner expression.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if result.ok}
						{@render renderNode(result.value, 0)}
					{:else}
						<p class="text-sm text-destructive">{result.error}</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">Legend</Card.Title>
				</Card.Header>
				<Card.Content class="flex flex-wrap gap-2 text-2xs">
					{#each Object.entries(KIND_BADGE) as [kind, info] (kind)}
						<Badge class={cn('font-mono', info.className)}>{info.label}</Badge>
					{/each}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
