<script lang="ts">
	import { CaseSensitive } from '@lucide/svelte';
	import { readText } from '@tauri-apps/plugin-clipboard-manager';
	import { CopyButton } from '$lib/components/action';
	import { CodeEditor } from '$lib/components/editor';
	import { FormCheckbox, FormInfo, FormSection, FormSelect } from '$lib/components/form';
	import { SectionHeader } from '$lib/components/layout';
	import { ToolShell } from '$lib/components/shell';
	import { EmptyState, StatItem } from '$lib/components/status';
	import {
		CASE_DEFINITIONS,
		type CaseResult,
		convertToAllCases,
		getTextStats,
		SAMPLE_TEXT_FOR_CASE,
		type TextStats,
	} from '$lib/services/string-case.js';

	// State
	let input = $state('');
	let showOptions = $state(true);

	// Line processing options
	type SortOrder = 'none' | 'asc' | 'desc';
	let sortLines = $state<SortOrder>('none');
	let removeDuplicates = $state(false);
	let trimLines = $state(false);
	let removeEmptyLines = $state(false);
	let reverseLines = $state(false);

	// Process input text with options
	const processedInput = $derived.by((): string => {
		if (!input.trim()) return '';

		let lines = input.split('\n');

		// Trim whitespace from each line
		if (trimLines) {
			lines = lines.map((line) => line.trim());
		}

		// Remove empty lines
		if (removeEmptyLines) {
			lines = lines.filter((line) => line.length > 0);
		}

		// Remove duplicates (preserve first occurrence)
		if (removeDuplicates) {
			lines = [...new Set(lines)];
		}

		// Sort lines
		if (sortLines === 'asc') {
			lines = [...lines].sort((a, b) => a.localeCompare(b));
		} else if (sortLines === 'desc') {
			lines = [...lines].sort((a, b) => b.localeCompare(a));
		}

		// Reverse line order
		if (reverseLines) {
			lines = [...lines].reverse();
		}

		return lines.join('\n');
	});

	// Computed case conversions
	const caseResults = $derived.by((): readonly CaseResult[] => {
		if (!processedInput.trim()) return [];
		return convertToAllCases(processedInput);
	});

	// Stats (based on processed input)
	const stats = $derived.by((): TextStats => getTextStats(processedInput));

	// Handlers
	const handlePaste = async () => {
		try {
			const text = await readText();
			if (text) input = text;
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => {
		input = '';
	};

	const handleSample = () => {
		input = SAMPLE_TEXT_FOR_CASE;
	};
</script>

<svelte:head>
	<title>String Case Converter - Kogu</title>
</svelte:head>

<ToolShell valid={input.trim() ? true : null} bind:showRail={showOptions}>
	{#snippet statusContent()}
		{#if input.trim()}
			<StatItem label="lines" value={stats.lines} />
			<StatItem label="words" value={stats.words} />
			<StatItem label="chars" value={stats.chars} />
		{/if}
	{/snippet}

	{#snippet rail()}
		<FormSection title="Line Processing">
			<FormSelect
				label="Sort Lines"
				value={sortLines}
				onchange={(v) => (sortLines = v as SortOrder)}
				options={[
					{ value: 'none', label: 'No sorting' },
					{ value: 'asc', label: 'A → Z' },
					{ value: 'desc', label: 'Z → A' },
				]}
			/>
			<div class="space-y-1.5 pt-1">
				<FormCheckbox label="Remove duplicate lines" bind:checked={removeDuplicates} />
				<FormCheckbox label="Trim whitespace" bind:checked={trimLines} />
				<FormCheckbox label="Remove empty lines" bind:checked={removeEmptyLines} />
				<FormCheckbox label="Reverse line order" bind:checked={reverseLines} />
			</div>
		</FormSection>

		<FormSection title="About">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li>Converts text to 17+ case formats</li>
					<li>Handles camelCase, PascalCase, snake_case</li>
					<li>Supports kebab-case, CONSTANT_CASE, Title Case</li>
					<li>Automatically detects word boundaries</li>
				</ul>
			</FormInfo>
		</FormSection>

		<FormSection title="Supported Formats">
			<FormInfo showIcon={false}>
				<div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
					{#each CASE_DEFINITIONS.slice(0, 10) as def}
						<div class="truncate" title={def.description}>{def.label}</div>
					{/each}
					<div class="text-muted-foreground">+{CASE_DEFINITIONS.length - 10} more</div>
				</div>
			</FormInfo>
		</FormSection>
	{/snippet}

	<!-- Main Content: Input + Results -->
	<div class="flex h-full flex-col overflow-hidden">
		<!-- Input Editor -->
		<div class="h-1/3 shrink-0 border-b">
			<CodeEditor
				title="Input Text"
				bind:value={input}
				mode="input"
				editorMode="plain"
				placeholder="Enter text to convert..."
				showViewToggle={false}
				onpaste={handlePaste}
				onclear={handleClear}
				onsample={handleSample}
			/>
		</div>

		<!-- Case Results -->
		<div class="flex flex-1 flex-col overflow-hidden">
			<SectionHeader title="Converted Results" />
			<div class="flex-1 overflow-auto p-4">
				{#if caseResults.length > 0}
					<div class="space-y-2">
						{#each caseResults as result}
							<div class="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-2">
								<span class="w-32 shrink-0 pt-0.5 font-mono text-xs font-medium"
									>{result.label}</span
								>
								<code
									class="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground"
								>
									{result.value}
								</code>
								<CopyButton
									text={result.value}
									toastLabel={result.label}
									size="sm"
									class="h-6 shrink-0"
								/>
							</div>
						{/each}
					</div>
				{:else}
					<EmptyState icon={CaseSensitive} title="Enter text to see case conversions" />
				{/if}
			</div>
		</div>
	</div>
</ToolShell>
