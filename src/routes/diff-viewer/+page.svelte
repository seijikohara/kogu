<script lang="ts">
	import { Equal, GitCompare, Layers, Minus, Plus, SplitSquareHorizontal } from '@lucide/svelte';
	import { readText } from '@tauri-apps/plugin-clipboard-manager';
	import { CodeEditor } from '$lib/components/editor';
	import { FormCheckbox, FormInfo, FormMode, FormSection, FormSlider } from '$lib/components/form';
	import { PageLayout } from '$lib/components/layout';
	import {
		areTextsIdentical,
		computeEnhancedDiff,
		type DiffOptions,
		type DiffSegment,
		type DiffSide,
		defaultDiffOptions,
		type EnhancedDiffResult,
		formatHunkHeader,
		getDiffLeftLineBgClass,
		getDiffPrefixClass,
		getDiffRightLineBgClass,
		getDiffSegmentClass,
		getDiffUnifiedLineClass,
		getDiffUnifiedSegmentClass,
		SAMPLE_LEFT_TEXT,
		SAMPLE_RIGHT_TEXT,
	} from '$lib/services/text-diff.js';

	type ViewMode = 'split' | 'unified';

	// State
	let leftInput = $state('');
	let rightInput = $state('');
	let viewMode = $state<ViewMode>('split');
	let showOptions = $state(true);

	// Diff options
	let ignoreWhitespace = $state(defaultDiffOptions.ignoreWhitespace);
	let ignoreCase = $state(defaultDiffOptions.ignoreCase);
	let trimLines = $state(defaultDiffOptions.trimLines);
	let contextLines = $state(3);
	let showInlineDiff = $state(true);

	// Derived options object
	const diffOptions = $derived<Partial<DiffOptions>>({
		ignoreWhitespace,
		ignoreCase,
		trimLines,
	});

	// Computed enhanced diff
	const enhancedDiff = $derived.by((): EnhancedDiffResult | null => {
		if (!leftInput && !rightInput) return null;
		return computeEnhancedDiff(leftInput, rightInput, diffOptions, contextLines);
	});

	// Unified diff line with optional inline segments (git diff style)
	interface UnifiedLineWithSegments {
		readonly kind: 'hunk-header' | 'line';
		readonly prefix?: '+' | '-' | ' ';
		readonly content: string;
		readonly type: 'equal' | 'insert' | 'delete' | 'header';
		readonly segments?: readonly DiffSegment[];
		readonly leftLineNumber?: number | null;
		readonly rightLineNumber?: number | null;
		readonly hunkHeader?: string;
	}

	// Transform enhanced diff to git diff style unified format
	// Git diff shows all deletes before inserts within a change block
	const unifiedWithSegments = $derived.by((): readonly UnifiedLineWithSegments[] => {
		if (!enhancedDiff) return [];

		const lines: UnifiedLineWithSegments[] = [];

		// Helper to flush a change block (all deletes first, then all inserts)
		const flushChangeBlock = (
			deletes: UnifiedLineWithSegments[],
			inserts: UnifiedLineWithSegments[]
		) => {
			deletes.forEach((d) => lines.push(d));
			inserts.forEach((i) => lines.push(i));
		};

		enhancedDiff.hunks.forEach((hunk) => {
			// Add hunk header (like @@ -1,4 +1,5 @@)
			lines.push({
				kind: 'hunk-header',
				content: formatHunkHeader(hunk),
				type: 'header',
				hunkHeader: formatHunkHeader(hunk),
			});

			// Accumulate consecutive changes, then flush when we hit an equal line
			let pendingDeletes: UnifiedLineWithSegments[] = [];
			let pendingInserts: UnifiedLineWithSegments[] = [];

			hunk.lines.forEach((line) => {
				if (line.type === 'equal') {
					// Flush any pending changes before the equal line
					flushChangeBlock(pendingDeletes, pendingInserts);
					pendingDeletes = [];
					pendingInserts = [];

					// Add the equal line
					lines.push({
						kind: 'line',
						prefix: ' ',
						content: line.leftContent,
						type: 'equal',
						leftLineNumber: line.leftLineNumber,
						rightLineNumber: line.rightLineNumber,
					});
				} else if (line.type === 'modified') {
					// Accumulate delete and insert for this modified line
					pendingDeletes.push({
						kind: 'line',
						prefix: '-',
						content: line.leftContent,
						type: 'delete',
						segments: line.leftSegments,
						leftLineNumber: line.leftLineNumber,
						rightLineNumber: null,
					});
					pendingInserts.push({
						kind: 'line',
						prefix: '+',
						content: line.rightContent,
						type: 'insert',
						segments: line.rightSegments,
						leftLineNumber: null,
						rightLineNumber: line.rightLineNumber,
					});
				} else if (line.type === 'delete') {
					pendingDeletes.push({
						kind: 'line',
						prefix: '-',
						content: line.leftContent,
						type: 'delete',
						leftLineNumber: line.leftLineNumber,
						rightLineNumber: null,
					});
				} else if (line.type === 'insert') {
					pendingInserts.push({
						kind: 'line',
						prefix: '+',
						content: line.rightContent,
						type: 'insert',
						leftLineNumber: null,
						rightLineNumber: line.rightLineNumber,
					});
				}
			});

			// Flush any remaining changes at the end of the hunk
			flushChangeBlock(pendingDeletes, pendingInserts);
		});

		return lines;
	});

	const isIdentical = $derived.by((): boolean | null => {
		if (!leftInput && !rightInput) return null;
		return areTextsIdentical(leftInput, rightInput, diffOptions);
	});

	// Stats
	const stats = $derived.by(() => enhancedDiff?.stats ?? null);

	// Validation state
	const valid = $derived.by((): boolean | null => {
		if (!leftInput && !rightInput) return null;
		return isIdentical === true;
	});

	// Handlers
	const handleLeftPaste = async () => {
		try {
			const text = await readText();
			if (text) leftInput = text;
		} catch {
			// Clipboard access denied
		}
	};

	const handleRightPaste = async () => {
		try {
			const text = await readText();
			if (text) rightInput = text;
		} catch {
			// Clipboard access denied
		}
	};

	const handleLeftClear = () => {
		leftInput = '';
	};

	const handleRightClear = () => {
		rightInput = '';
	};

	const handleSample = () => {
		leftInput = SAMPLE_LEFT_TEXT;
		rightInput = SAMPLE_RIGHT_TEXT;
	};

	const handleModeChange = (newMode: string) => {
		viewMode = newMode as ViewMode;
	};
</script>

<svelte:head>
	<title>Diff Viewer - Kogu</title>
</svelte:head>

<PageLayout {valid} bind:showOptions>
	{#snippet statusContent()}
		{#if stats}
			<span class="flex items-center gap-1 text-green-600 dark:text-green-400">
				<Plus class="h-3 w-3" />
				<strong>{stats.addedLines}</strong>
			</span>
			<span class="flex items-center gap-1 text-red-600 dark:text-red-400">
				<Minus class="h-3 w-3" />
				<strong>{stats.removedLines}</strong>
			</span>
			{#if stats.modifiedLines > 0}
				<span class="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
					<GitCompare class="h-3 w-3" />
					<strong>{stats.modifiedLines}</strong>
				</span>
			{/if}
			<span class="flex items-center gap-1 text-muted-foreground">
				<Equal class="h-3 w-3" />
				<strong class="text-foreground">{stats.unchangedLines}</strong>
			</span>
			{#if stats.hunkCount > 0}
				<span class="flex items-center gap-1 text-muted-foreground">
					<Layers class="h-3 w-3" />
					<strong class="text-foreground">{stats.hunkCount}</strong>
					<span class="text-xs">chunks</span>
				</span>
			{/if}
			{#if isIdentical}
				<span
					class="rounded bg-green-500/20 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300"
				>
					Identical
				</span>
			{/if}
		{/if}
	{/snippet}

	{#snippet options()}
		<FormSection title="View">
			<FormMode
				value={viewMode}
				onchange={handleModeChange}
				options={[
					{ value: 'split', label: 'Split' },
					{ value: 'unified', label: 'Unified' },
				]}
			/>
		</FormSection>

		<FormSection title="Display">
			<FormCheckbox label="Inline character diff" bind:checked={showInlineDiff} />
			<FormSlider
				label="Context lines"
				bind:value={contextLines}
				min={0}
				max={10}
				step={1}
				showValue
			/>
		</FormSection>

		<FormSection title="Comparison">
			<FormCheckbox label="Ignore whitespace" bind:checked={ignoreWhitespace} />
			<FormCheckbox label="Ignore case" bind:checked={ignoreCase} />
			<FormCheckbox label="Trim lines" bind:checked={trimLines} />
		</FormSection>

		<FormSection title="Legend">
			<FormInfo showIcon={false}>
				<div class="space-y-1.5 text-xs">
					<div class="flex items-center gap-2">
						<span class="inline-block h-3 w-3 rounded-sm bg-red-500/30"></span>
						<span>Removed lines</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="inline-block h-3 w-3 rounded-sm bg-green-500/30"></span>
						<span>Added lines</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="inline-block h-3 w-3 rounded-sm bg-yellow-500/20"></span>
						<span>Modified lines</span>
					</div>
					{#if showInlineDiff}
						<div class="mt-2 border-t pt-2">
							<div class="flex items-center gap-2">
								<span class="inline-block rounded-sm bg-red-500/40 px-1 text-[10px]">abc</span>
								<span>Deleted chars</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="inline-block rounded-sm bg-green-500/40 px-1 text-[10px]">xyz</span>
								<span>Added chars</span>
							</div>
						</div>
					{/if}
				</div>
			</FormInfo>
		</FormSection>

		<FormSection title="About">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li>LCS algorithm for line diff</li>
					<li>Character-level inline diff</li>
					<li>Git-style hunk grouping</li>
				</ul>
			</FormInfo>
		</FormSection>
	{/snippet}

	{#if viewMode === 'split'}
		<!-- Split View -->
		<div class="flex h-full flex-col overflow-hidden">
			<!-- Input Section -->
			<div class="flex h-1/4 min-h-32 shrink-0 border-b">
				<div class="flex-1 border-r">
					<CodeEditor
						title="Original"
						value={leftInput}
						onchange={(v) => (leftInput = v)}
						mode="input"
						editorMode="plain"
						placeholder="Original text..."
						onsample={handleSample}
						onpaste={handleLeftPaste}
						onclear={handleLeftClear}
						showViewToggle={false}
					/>
				</div>
				<div class="flex-1">
					<CodeEditor
						title="Modified"
						value={rightInput}
						onchange={(v) => (rightInput = v)}
						mode="input"
						editorMode="plain"
						placeholder="Modified text..."
						onpaste={handleRightPaste}
						onclear={handleRightClear}
						showViewToggle={false}
					/>
				</div>
			</div>

			<!-- Split Diff Output (GitHub-style) -->
			<div class="flex flex-1 flex-col overflow-hidden">
				<div class="flex h-9 shrink-0 items-center justify-between border-b bg-muted/30 px-3">
					<span class="text-xs font-medium text-muted-foreground">Side-by-Side Diff</span>
					{#if stats && stats.hunkCount > 0}
						<span class="text-xs text-muted-foreground">
							{stats.addedChars} chars added, {stats.removedChars} chars removed
						</span>
					{/if}
				</div>
				<div class="flex-1 overflow-auto">
					{#if enhancedDiff && enhancedDiff.hunks.length > 0 && (leftInput || rightInput)}
						<div class="font-mono text-sm">
							{#each enhancedDiff.hunks as hunk, hunkIdx}
								<!-- Hunk Header (spans both sides) -->
								<div
									class="sticky top-0 z-10 flex min-h-7 items-center border-y bg-blue-500/10 px-3 text-xs font-semibold text-blue-600 dark:text-blue-400"
								>
									<span class="font-mono">{formatHunkHeader(hunk)}</span>
								</div>
								<!-- Lines (left and right side by side) -->
								{#each hunk.lines as line}
									<div class="flex min-h-6">
										<!-- Left Side -->
										<div
											class={`flex flex-1 border-r ${line.type === 'insert' ? 'bg-muted/20' : getDiffLeftLineBgClass(line.type)}`}
										>
											<!-- Line number -->
											<span
												class="w-12 shrink-0 select-none border-r bg-muted/50 px-2 text-right text-xs text-muted-foreground"
											>
												{line.type !== 'insert' ? (line.leftLineNumber ?? '') : ''}
											</span>
											<!-- Symbol -->
											<span
												class={`w-6 shrink-0 select-none text-center text-xs font-bold ${line.type === 'delete' || line.type === 'modified' ? 'text-red-600 dark:text-red-400' : 'text-transparent'}`}
											>
												{line.type === 'delete' || line.type === 'modified' ? '−' : ''}
											</span>
											<!-- Content -->
											<span class="flex-1 whitespace-pre px-2">
												{#if line.type === 'insert'}
													<!-- Empty placeholder for insert lines -->
												{:else if showInlineDiff && line.leftSegments && line.leftSegments.length > 0}
													{#each line.leftSegments as seg}
														<span class={getDiffSegmentClass(seg.type, 'left')}>{seg.value}</span>
													{/each}
												{:else}
													<span
														class={line.type === 'delete' || line.type === 'modified'
															? 'text-red-700 dark:text-red-300'
															: ''}
													>
														{line.leftContent}
													</span>
												{/if}
											</span>
										</div>
										<!-- Right Side -->
										<div
											class={`flex flex-1 ${line.type === 'delete' ? 'bg-muted/20' : getDiffRightLineBgClass(line.type)}`}
										>
											<!-- Line number -->
											<span
												class="w-12 shrink-0 select-none border-r bg-muted/50 px-2 text-right text-xs text-muted-foreground"
											>
												{line.type !== 'delete' ? (line.rightLineNumber ?? '') : ''}
											</span>
											<!-- Symbol -->
											<span
												class={`w-6 shrink-0 select-none text-center text-xs font-bold ${line.type === 'insert' || line.type === 'modified' ? 'text-green-600 dark:text-green-400' : 'text-transparent'}`}
											>
												{line.type === 'insert' || line.type === 'modified' ? '+' : ''}
											</span>
											<!-- Content -->
											<span class="flex-1 whitespace-pre px-2">
												{#if line.type === 'delete'}
													<!-- Empty placeholder for delete lines -->
												{:else if showInlineDiff && line.rightSegments && line.rightSegments.length > 0}
													{#each line.rightSegments as seg}
														<span class={getDiffSegmentClass(seg.type, 'right')}>{seg.value}</span>
													{/each}
												{:else}
													<span
														class={line.type === 'insert' || line.type === 'modified'
															? 'text-green-700 dark:text-green-300'
															: ''}
													>
														{line.rightContent}
													</span>
												{/if}
											</span>
										</div>
									</div>
								{/each}
								{#if hunkIdx < enhancedDiff.hunks.length - 1}
									<div class="h-2 border-b bg-muted/20"></div>
								{/if}
							{/each}
						</div>
					{:else if !leftInput && !rightInput}
						<div class="flex flex-1 items-center justify-center text-muted-foreground">
							<div class="text-center">
								<SplitSquareHorizontal class="mx-auto mb-2 h-12 w-12 opacity-50" />
								<p class="text-sm">Enter text on both sides to compare</p>
							</div>
						</div>
					{:else if isIdentical}
						<div class="flex flex-1 items-center justify-center text-muted-foreground">
							<div class="text-center">
								<div
									class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20"
								>
									<Equal class="h-8 w-8 text-green-600 dark:text-green-400" />
								</div>
								<p class="text-lg font-medium text-green-600 dark:text-green-400">
									Files are identical
								</p>
								<p class="mt-1 text-xs text-muted-foreground">No differences found</p>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<!-- Unified View -->
		<div class="flex h-full flex-col overflow-hidden">
			<!-- Input Section -->
			<div class="flex h-1/4 min-h-32 shrink-0 border-b">
				<div class="flex-1 border-r">
					<CodeEditor
						title="Original"
						value={leftInput}
						onchange={(v) => (leftInput = v)}
						mode="input"
						editorMode="plain"
						placeholder="Original text..."
						onsample={handleSample}
						onpaste={handleLeftPaste}
						onclear={handleLeftClear}
						showViewToggle={false}
					/>
				</div>
				<div class="flex-1">
					<CodeEditor
						title="Modified"
						value={rightInput}
						onchange={(v) => (rightInput = v)}
						mode="input"
						editorMode="plain"
						placeholder="Modified text..."
						onpaste={handleRightPaste}
						onclear={handleRightClear}
						showViewToggle={false}
					/>
				</div>
			</div>

			<!-- Unified Diff Output -->
			<div class="flex flex-1 flex-col overflow-hidden">
				<div class="flex h-9 shrink-0 items-center justify-between border-b bg-muted/30 px-3">
					<span class="text-xs font-medium text-muted-foreground">Unified Diff</span>
					{#if stats && stats.hunkCount > 0}
						<span class="text-xs text-muted-foreground">
							{stats.addedChars} chars added, {stats.removedChars} chars removed
						</span>
					{/if}
				</div>
				<div class="flex-1 overflow-auto">
					{#if unifiedWithSegments.length > 0}
						<div class="font-mono text-sm">
							{#each unifiedWithSegments as line}
								{#if line.kind === 'hunk-header'}
									<!-- Hunk header (like @@ -1,4 +1,5 @@) -->
									<div
										class="sticky top-0 z-10 flex min-h-7 items-center border-y bg-blue-500/10 px-3 text-xs font-semibold text-blue-600 dark:text-blue-400"
									>
										<span class="font-mono">{line.content}</span>
									</div>
								{:else}
									<!-- Regular diff line -->
									{@const lineType = line.type as 'equal' | 'insert' | 'delete'}
									<div class={`flex min-h-6 ${getDiffUnifiedLineClass(lineType)}`}>
										<!-- Left line number -->
										<span
											class="w-10 shrink-0 select-none border-r bg-muted/50 px-1 text-right text-xs text-muted-foreground"
										>
											{line.leftLineNumber ?? ''}
										</span>
										<!-- Right line number -->
										<span
											class="w-10 shrink-0 select-none border-r bg-muted/50 px-1 text-right text-xs text-muted-foreground"
										>
											{line.rightLineNumber ?? ''}
										</span>
										<!-- Prefix (+/-/space) -->
										<span
											class={`w-6 shrink-0 select-none text-center font-bold ${getDiffPrefixClass(lineType)}`}
										>
											{line.prefix}
										</span>
										<!-- Content with inline highlighting -->
										<span
											class={`flex-1 whitespace-pre px-2 ${lineType === 'insert' ? 'text-green-700 dark:text-green-300' : lineType === 'delete' ? 'text-red-700 dark:text-red-300' : ''}`}
										>
											{#if showInlineDiff && line.segments && line.segments.length > 0 && lineType !== 'equal'}
												{#each line.segments as seg}
													<span class={getDiffUnifiedSegmentClass(seg.type, lineType)}
														>{seg.value}</span
													>
												{/each}
											{:else}
												{line.content}
											{/if}
										</span>
									</div>
								{/if}
							{/each}
						</div>
					{:else if !leftInput && !rightInput}
						<div class="flex h-full items-center justify-center text-muted-foreground">
							<div class="text-center">
								<SplitSquareHorizontal class="mx-auto mb-2 h-12 w-12 opacity-50" />
								<p class="text-sm">Enter text on both sides to compare</p>
							</div>
						</div>
					{:else if isIdentical}
						<div class="flex h-full items-center justify-center text-muted-foreground">
							<div class="text-center">
								<div
									class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20"
								>
									<Equal class="h-8 w-8 text-green-600 dark:text-green-400" />
								</div>
								<p class="text-lg font-medium text-green-600 dark:text-green-400">
									Files are identical
								</p>
								<p class="mt-1 text-xs text-muted-foreground">No differences found</p>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</PageLayout>
