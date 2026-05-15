<script lang="ts">
	import { Pencil, Search } from '@lucide/svelte';
	import { FormInfo, FormSection } from '$lib/components/form';
	import { ToolShell } from '$lib/components/shell';
	import { StatItem } from '$lib/components/status';
	import { persisted } from '$lib/services/persisted.svelte.js';
	import { BuildTab, ParseTab } from './tabs/index.js';

	type CronTab = 'build' | 'parse';

	const TABS = [
		{ id: 'build' as const, label: 'Build', icon: Pencil },
		{ id: 'parse' as const, label: 'Parse', icon: Search },
	] as const;

	// Persist the active tab so restarts open the panel the user last used.
	const activeTab = persisted<CronTab>('tab:cron-expression-builder', 'build');
	let buildStats = $state<{ expression: string; valid: boolean }>({
		expression: '* * * * *',
		valid: true,
	});
	let parseStats = $state<{ expression: string; valid: boolean }>({
		expression: '*/5 * * * *',
		valid: true,
	});

	const currentStats = $derived(activeTab.current === 'build' ? buildStats : parseStats);

	const handleTabChange = (tab: string) => {
		if (tab === 'build' || tab === 'parse') activeTab.current = tab;
	};
</script>

<svelte:head>
	<title>Cron Expression Builder - Kogu</title>
</svelte:head>

<ToolShell
	layout="tabbed"
	tabs={TABS}
	activeTab={activeTab.current}
	ontabchange={handleTabChange}
	valid={currentStats.valid}
>
	{#snippet statusContent()}
		<StatItem label="Expression" value={currentStats.expression} />
	{/snippet}

	{#snippet rail()}
		<FormSection title="Cron syntax">
			<FormInfo>
				A cron expression has five space-separated fields. From left to right:
				<ul class="mt-1 list-inside list-disc space-y-0.5">
					<li><code class="font-mono">minute</code> — 0–59</li>
					<li><code class="font-mono">hour</code> — 0–23</li>
					<li><code class="font-mono">day of month</code> — 1–31</li>
					<li><code class="font-mono">month</code> — 1–12 or JAN–DEC</li>
					<li><code class="font-mono">day of week</code> — 0–6 or SUN–SAT</li>
				</ul>
			</FormInfo>
		</FormSection>

		<FormSection title="Special characters">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li><code class="font-mono">*</code> — any value</li>
					<li><code class="font-mono">,</code> — value list (e.g., <code>1,15</code>)</li>
					<li><code class="font-mono">-</code> — range (e.g., <code>9-17</code>)</li>
					<li><code class="font-mono">/</code> — step (e.g., <code>*/5</code>)</li>
					<li><code class="font-mono">?</code> — no specific value (day fields)</li>
				</ul>
			</FormInfo>
		</FormSection>

		<FormSection title="Common patterns">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li><code class="font-mono">* * * * *</code> — every minute</li>
					<li><code class="font-mono">*/5 * * * *</code> — every 5 minutes</li>
					<li><code class="font-mono">0 * * * *</code> — top of every hour</li>
					<li><code class="font-mono">0 0 * * *</code> — daily at midnight</li>
					<li><code class="font-mono">0 9 * * 1-5</code> — weekdays at 9 AM</li>
				</ul>
			</FormInfo>
		</FormSection>

		<FormSection title="Tips">
			<FormInfo>
				When both <code class="font-mono">day of month</code> and
				<code class="font-mono">day of week</code> are restricted, most engines run on either match, not
				both. Schedules are evaluated in UTC unless your runtime says otherwise.
			</FormInfo>
		</FormSection>
	{/snippet}

	{#snippet tabContent(tab)}
		{#if tab === 'build'}
			<BuildTab onstatschange={(info) => (buildStats = info)} />
		{:else if tab === 'parse'}
			<ParseTab onstatschange={(info) => (parseStats = info)} />
		{/if}
	{/snippet}
</ToolShell>
