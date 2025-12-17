<script lang="ts">
	import { PageHeader } from '$lib/components/layout/index.js';
	import { calculateSqlStats, type SqlStats } from '$lib/services/formatters.js';
	import { FormatTab } from './tabs/index.js';

	// Shared state
	let input = $state('');
	let valid = $state<boolean | null>(null);
	let error = $state('');

	// Stats calculation
	const stats = $derived.by((): SqlStats | null => {
		if (!input.trim()) return null;
		try {
			return calculateSqlStats(input);
		} catch {
			return null;
		}
	});

	// Stats handler
	const handleStatsChange = (newStats: { input: string; valid: boolean | null; error: string }) => {
		valid = newStats.valid;
		error = newStats.error;
	};
</script>

<svelte:head>
	<title>SQL Formatter - Kogu</title>
</svelte:head>

<div class="flex h-full flex-col overflow-hidden">
	<PageHeader {valid} {error}>
		{#snippet statusContent()}
			{#if stats}
				<span class="text-muted-foreground"
					>Statements: <strong class="text-foreground">{stats.statements}</strong></span
				>
				<span class="text-muted-foreground"
					>Size: <strong class="text-foreground">{stats.size}</strong></span
				>
			{/if}
		{/snippet}
	</PageHeader>

	<!-- Content -->
	<div class="flex flex-1 overflow-hidden">
		<FormatTab {input} onInputChange={(v) => (input = v)} onStatsChange={handleStatsChange} />
	</div>
</div>
