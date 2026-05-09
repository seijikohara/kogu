<script lang="ts">
	import { Calendar, Clock } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { FormInput, FormSelect } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { EmptyState } from '$lib/components/status';
	import {
		CRON_PRESETS,
		explainExpression,
		formatDate,
		nextExecutions,
		parseExpression,
	} from '$lib/services/cron.js';

	interface Props {
		onstatschange?: (info: { expression: string; valid: boolean }) => void;
	}

	let { onstatschange }: Props = $props();

	let expression = $state<string>('*/5 * * * *');
	let preset = $state<string>('');

	const parsed = $derived(parseExpression(expression));
	const description = $derived(explainExpression(expression));
	const nextRuns = $derived(nextExecutions(expression, 5));

	const presetOptions = [{ value: '', label: 'Custom' }].concat(
		CRON_PRESETS.map((p) => ({ value: p.value, label: p.label }))
	);

	const handlePresetChange = (value: string) => {
		preset = value;
		if (value !== '') expression = value;
	};

	$effect(() => {
		onstatschange?.({
			expression,
			valid: parsed.ok && description.ok && nextRuns.ok,
		});
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<SectionHeader title="Parse Cron Expression">
		{#snippet trailing()}
			<CopyButton text={expression} toastLabel="Expression" size="sm" class="h-7" />
		{/snippet}
	</SectionHeader>

	<div class="flex-1 overflow-auto p-4">
		<div class="space-y-4">
			<div class="rounded-lg border bg-surface-3 p-4">
				<div class="mb-3 max-w-sm">
					<FormSelect
						label="Quick presets"
						value={preset}
						options={presetOptions}
						onchange={handlePresetChange}
					/>
				</div>
				<FormInput
					label="Cron expression"
					bind:value={expression}
					placeholder="*/5 * * * *"
					hint="5 fields: minute hour day-of-month month day-of-week"
					class="font-mono"
				/>
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<div class="flex items-center gap-2">
					<Clock class="h-4 w-4 text-muted-foreground" />
					<span class="text-sm font-medium">Fields</span>
				</div>
				{#if parsed.ok}
					<div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
						<div class="rounded border bg-muted px-2 py-1.5 text-center">
							<div class="text-2xs text-muted-foreground">Minute</div>
							<div class="font-mono text-sm">{parsed.value.minute}</div>
						</div>
						<div class="rounded border bg-muted px-2 py-1.5 text-center">
							<div class="text-2xs text-muted-foreground">Hour</div>
							<div class="font-mono text-sm">{parsed.value.hour}</div>
						</div>
						<div class="rounded border bg-muted px-2 py-1.5 text-center">
							<div class="text-2xs text-muted-foreground">Day of month</div>
							<div class="font-mono text-sm">{parsed.value.dayOfMonth}</div>
						</div>
						<div class="rounded border bg-muted px-2 py-1.5 text-center">
							<div class="text-2xs text-muted-foreground">Month</div>
							<div class="font-mono text-sm">{parsed.value.month}</div>
						</div>
						<div class="rounded border bg-muted px-2 py-1.5 text-center">
							<div class="text-2xs text-muted-foreground">Day of week</div>
							<div class="font-mono text-sm">{parsed.value.dayOfWeek}</div>
						</div>
					</div>
				{:else}
					<p class="mt-2 text-sm text-destructive">{parsed.error}</p>
				{/if}
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<span class="mb-2 block text-sm font-medium">Description</span>
				{#if description.ok}
					<p class="text-sm text-foreground">{description.value}</p>
				{:else}
					<p class="text-sm text-destructive">{description.error}</p>
				{/if}
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<div class="mb-2 flex items-center gap-2">
					<Calendar class="h-4 w-4 text-muted-foreground" />
					<span class="text-sm font-medium">Next 5 executions</span>
				</div>
				{#if nextRuns.ok}
					{#if nextRuns.value.length > 0}
						<ul class="space-y-1 font-mono text-sm">
							{#each nextRuns.value as date, idx (idx)}
								<li class="flex items-center gap-3">
									<span class="text-xs text-muted-foreground tabular-nums">{idx + 1}.</span>
									<span>{formatDate(date)}</span>
								</li>
							{/each}
						</ul>
					{:else}
						<EmptyState icon={Calendar} title="No upcoming executions" />
					{/if}
				{:else}
					<p class="text-sm text-destructive">{nextRuns.error}</p>
				{/if}
			</div>
		</div>
	</div>
</div>
