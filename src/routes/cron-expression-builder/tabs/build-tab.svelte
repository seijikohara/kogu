<script lang="ts">
	import { Calendar, Clock } from '@lucide/svelte';
	import { CopyButton } from '$lib/components/action';
	import { FormInput, FormSelect } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { EmptyState } from '$lib/components/status';
	import {
		buildExpression,
		CRON_FIELDS,
		CRON_PRESETS,
		type CronParts,
		DEFAULT_CRON_PARTS,
		explainExpression,
		formatDate,
		nextExecutions,
	} from '$lib/services/cron.js';

	interface Props {
		onstatschange?: (info: { expression: string; valid: boolean }) => void;
	}

	let { onstatschange }: Props = $props();

	let parts = $state<CronParts>({ ...DEFAULT_CRON_PARTS });
	let preset = $state<string>('');

	const expression = $derived(buildExpression(parts));
	const description = $derived(explainExpression(expression));
	const nextRuns = $derived(nextExecutions(expression, 5));

	const presetOptions = [{ value: '', label: 'Custom' }].concat(
		CRON_PRESETS.map((p) => ({ value: p.value, label: p.label }))
	);

	const handlePresetChange = (value: string) => {
		preset = value;
		if (value === '') return;
		const fields = value.split(/\s+/);
		if (fields.length !== 5) return;
		const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
		if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return;
		parts = { minute, hour, dayOfMonth, month, dayOfWeek };
	};

	$effect(() => {
		onstatschange?.({ expression, valid: description.ok && nextRuns.ok });
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<SectionHeader title="Build Cron Expression">
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
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
					{#each CRON_FIELDS as field (field.id)}
						<FormInput
							label={field.label}
							bind:value={parts[field.id]}
							placeholder="*"
							hint={field.hint}
							size="compact"
							class="font-mono"
						/>
					{/each}
				</div>
			</div>

			<div class="rounded-lg border bg-surface-3 p-4">
				<div class="flex items-center gap-2">
					<Clock class="h-4 w-4 text-muted-foreground" />
					<span class="text-sm font-medium">Expression</span>
				</div>
				<code class="mt-2 block break-all rounded bg-muted p-3 font-mono text-base">
					{expression}
				</code>
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
