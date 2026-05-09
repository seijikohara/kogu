<script lang="ts">
	import { Calendar, Check, Clock, Sparkles, X } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { FormInput } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';
	import {
		buildExpression,
		CRON_FIELDS,
		CRON_PRESET_CATEGORIES,
		type CronParts,
		DEFAULT_CRON_PARTS,
		explainExpression,
		formatDateParts,
		nextExecutions,
		validateField,
	} from '$lib/services/cron.js';

	interface Props {
		onstatschange?: (info: { expression: string; valid: boolean }) => void;
	}

	let { onstatschange }: Props = $props();

	let parts = $state<CronParts>({ ...DEFAULT_CRON_PARTS });

	const expression = $derived(buildExpression(parts));
	const description = $derived(explainExpression(expression));
	const nextRuns = $derived(nextExecutions(expression, 8));

	const fieldValidations = $derived(
		Object.fromEntries(
			CRON_FIELDS.map((field) => [field.id, validateField(field.id, parts[field.id])])
		) as Record<keyof CronParts, ReturnType<typeof validateField>>
	);

	const allFieldsValid = $derived(
		(Object.values(fieldValidations) as ReturnType<typeof validateField>[]).every((v) => v.ok)
	);

	const isValid = $derived(allFieldsValid && description.ok && nextRuns.ok);

	const applyPreset = (value: string) => {
		const fields = value.split(/\s+/);
		if (fields.length !== 5) return;
		const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
		if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return;
		parts = { minute, hour, dayOfMonth, month, dayOfWeek };
	};

	const dayBadgeClass = (dayIndex: number, isWeekend: boolean): string => {
		if (isWeekend) return 'bg-warning/10 text-warning border-warning/30';
		if (dayIndex === 1) return 'bg-info/10 text-info border-info/30';
		return 'bg-success/10 text-success border-success/30';
	};

	const setPart = (id: keyof CronParts, value: string) => {
		parts = { ...parts, [id]: value };
	};

	$effect(() => {
		onstatschange?.({ expression, valid: isValid });
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<SectionHeader title="Build">
		{#snippet trailing()}
			<CopyButton text={expression} toastLabel="Expression" size="sm" class="h-7" />
		{/snippet}
	</SectionHeader>

	<div class="flex-1 overflow-auto p-4">
		<div class="mx-auto flex max-w-5xl flex-col gap-4">
			<Card.Root>
				<Card.Header class="pb-3">
					<Card.Title class="text-sm font-medium">Fields</Card.Title>
					<Card.Description class="text-xs">
						Cron syntax: <code class="rounded bg-muted px-1 font-mono">*</code> any,
						<code class="rounded bg-muted px-1 font-mono">*/n</code> step,
						<code class="rounded bg-muted px-1 font-mono">a-b</code> range,
						<code class="rounded bg-muted px-1 font-mono">a,b,c</code> list.
					</Card.Description>
				</Card.Header>
				<Card.Content class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
					{#each CRON_FIELDS as field (field.id)}
						{@const validation = fieldValidations[field.id]}
						<div class="space-y-1.5">
							<div class="flex items-center justify-between">
								<span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
									{field.label}
								</span>
								{#if validation.ok}
									<Check class="h-3 w-3 text-success" />
								{:else}
									<X class="h-3 w-3 text-destructive" />
								{/if}
							</div>
							<FormInput
								label=""
								value={parts[field.id]}
								onchange={(v) => setPart(field.id, v)}
								placeholder="*"
								hint={field.hint}
								size="compact"
								class={cn('font-mono', !validation.ok && 'border-destructive')}
							/>
						</div>
					{/each}
				</Card.Content>
			</Card.Root>

			<div class="grid gap-4 lg:grid-cols-2">
				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
						<div class="flex items-center gap-2">
							<Clock class="h-4 w-4 text-muted-foreground" />
							<Card.Title class="text-sm font-medium">Expression</Card.Title>
						</div>
						<CopyButton text={expression} toastLabel="Expression" size="sm" />
					</Card.Header>
					<Card.Content>
						<code class="block break-all rounded-md bg-muted p-3 font-mono text-base tabular-nums">
							{expression}
						</code>
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
			</div>

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
									<li class="flex items-center gap-3 rounded-md border bg-surface-3 px-3 py-2">
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
						Click any preset to load it into the fields above.
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
										onclick={() => applyPreset(preset.value)}
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
