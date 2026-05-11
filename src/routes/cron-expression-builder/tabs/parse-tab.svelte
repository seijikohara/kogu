<script lang="ts">
	import { Calendar, Clock, Sparkles } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { FormInput } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';
	import {
		CRON_FIELDS,
		CRON_PRESET_CATEGORIES,
		explainExpression,
		formatDateParts,
		nextExecutions,
		parseExpression,
	} from '$lib/services/cron.js';

	interface Props {
		onstatschange?: (info: { expression: string; valid: boolean }) => void;
	}

	let { onstatschange }: Props = $props();

	let expression = $state<string>('*/5 * * * *');

	const parsed = $derived(parseExpression(expression));
	const description = $derived(explainExpression(expression));
	const nextRuns = $derived(nextExecutions(expression, 8));

	const isValid = $derived(parsed.ok && description.ok && nextRuns.ok);

	const dayBadgeClass = (dayIndex: number, isWeekend: boolean): string => {
		if (isWeekend) return 'bg-warning/10 text-warning border-warning/30';
		if (dayIndex === 1) return 'bg-info/10 text-info border-info/30';
		return 'bg-success/10 text-success border-success/30';
	};

	$effect(() => {
		onstatschange?.({ expression, valid: isValid });
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<SectionHeader title="Parse">
		{#snippet trailing()}
			<CopyButton text={expression} toastLabel="Expression" size="sm" class="h-7" />
		{/snippet}
	</SectionHeader>

	<div class="flex-1 overflow-auto p-4">
		<div class="mx-auto flex max-w-5xl flex-col gap-4">
			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">Expression</Card.Title>
					<Card.Description class="text-xs">
						Paste a 5-field cron expression — minute, hour, day-of-month, month, day-of-week.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<FormInput label="" bind:value={expression} placeholder="*/5 * * * *" class="font-mono" />
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-3">
					<div class="flex items-center gap-2">
						<Clock class="h-4 w-4 text-muted-foreground" />
						<Card.Title class="text-sm font-medium">Fields</Card.Title>
					</div>
				</Card.Header>
				<Card.Content>
					{#if parsed.ok}
						<div class="grid gap-2 sm:grid-cols-5">
							{#each CRON_FIELDS as field, idx (field.id)}
								{@const value = [
									parsed.value.minute,
									parsed.value.hour,
									parsed.value.dayOfMonth,
									parsed.value.month,
									parsed.value.dayOfWeek,
								][idx]}
								<div class="rounded-md border bg-card p-3">
									<div class="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
										{field.label}
									</div>
									<div class="mt-1 font-mono text-sm">{value}</div>
									<div class="mt-0.5 text-2xs text-muted-foreground">{field.hint}</div>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-destructive">{parsed.error}</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-3">
					<div class="flex items-center gap-2">
						<Sparkles class="h-4 w-4 text-muted-foreground" />
						<Card.Title class="text-sm font-medium">Description</Card.Title>
					</div>
				</Card.Header>
				<Card.Content>
					{#if description.ok}
						<p class="text-sm">{description.value}</p>
					{:else}
						<p class="text-sm text-destructive">{description.error}</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-3">
					<div class="flex items-center gap-2">
						<Calendar class="h-4 w-4 text-muted-foreground" />
						<Card.Title class="text-sm font-medium">Next 8 executions</Card.Title>
					</div>
				</Card.Header>
				<Card.Content>
					{#if nextRuns.ok}
						{#if nextRuns.value.length > 0}
							<ul class="space-y-1.5">
								{#each nextRuns.value as date, idx (idx)}
									{@const fmt = formatDateParts(date)}
									<li class="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
										<span class="w-6 text-xs tabular-nums text-muted-foreground">{idx + 1}.</span>
										<Badge
											class={cn('text-2xs font-mono', dayBadgeClass(fmt.dayIndex, fmt.isWeekend))}
										>
											{fmt.dayLabel}
										</Badge>
										<span class="font-mono text-sm tabular-nums">{fmt.date}</span>
										<span class="font-mono text-sm tabular-nums text-muted-foreground">
											{fmt.time}
										</span>
										<span class="ml-auto text-xs text-muted-foreground">{fmt.relative}</span>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="text-sm text-muted-foreground">No upcoming executions.</p>
						{/if}
					{:else}
						<p class="text-sm text-destructive">{nextRuns.error}</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">Presets</Card.Title>
					<Card.Description class="text-xs">
						Click any preset to load it into the expression input.
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#each CRON_PRESET_CATEGORIES as category (category.label)}
						<div>
							<h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								{category.label}
							</h4>
							<div class="flex flex-wrap gap-2">
								{#each category.presets as preset (preset.value)}
									<Button
										variant="outline"
										size="sm"
										class={cn(
											'h-auto justify-start gap-2 px-3 py-1.5 text-xs',
											expression === preset.value && 'border-primary bg-primary/5'
										)}
										onclick={() => (expression = preset.value)}
									>
										<span>{preset.label}</span>
										<code class="font-mono text-2xs text-muted-foreground">{preset.value}</code>
									</Button>
								{/each}
							</div>
						</div>
					{/each}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
