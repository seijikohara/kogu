<script lang="ts">
	import { Download, QrCode } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { ActionButton, CopyButton } from '$lib/components/action';
	import { FormInfo, FormInput, FormSection, FormSelect, FormSlider } from '$lib/components/form';
	import { Button } from '$lib/components/ui/button';
	import { SectionHeader } from '$lib/components/layout';
	import { ToolShell } from '$lib/components/shell';
	import { EmptyState, StatItem } from '$lib/components/status';
	import {
		DEFAULT_QR_OPTIONS,
		ERROR_CORRECTION_LEVELS,
		type ErrorCorrectionLevel,
		generateQrCode,
		isErrorCorrectionLevel,
		MAX_MARGIN,
		MAX_WIDTH,
		MIN_MARGIN,
		MIN_WIDTH,
		type QrOptions,
		type QrResult,
	} from '$lib/services/qr-code.js';

	// State
	let options = $state<QrOptions>({ ...DEFAULT_QR_OPTIONS });
	let result = $state<QrResult | null>(null);
	let isGenerating = $state(false);
	let error = $state<string | null>(null);
	let showOptions = $state(true);

	// Derived
	const canGenerate = $derived(options.text.length > 0);

	const levelOptions = ERROR_CORRECTION_LEVELS.map((info) => ({
		value: info.level,
		label: `${info.label} (${info.recovery})`,
	}));

	// Handlers
	const handleLevelChange = (value: string) => {
		if (isErrorCorrectionLevel(value)) {
			options = { ...options, errorCorrectionLevel: value };
		}
	};

	const handleGenerate = async () => {
		if (!canGenerate) return;
		error = null;
		isGenerating = true;
		try {
			result = await generateQrCode(options);
			toast.success('QR code generated');
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			error = message;
			result = null;
			toast.error('Failed to generate QR code', { description: message });
		} finally {
			isGenerating = false;
		}
	};

	const handleClear = () => {
		options = { ...options, text: '' };
		result = null;
		error = null;
	};

	const handleDownloadSvg = () => {
		if (!result) return;
		const blob = new Blob([result.svg], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'qrcode.svg';
		link.click();
		URL.revokeObjectURL(url);
		toast.success('SVG downloaded');
	};

	const handleDownloadPng = () => {
		if (!result) return;
		const link = document.createElement('a');
		link.href = result.dataUrl;
		link.download = 'qrcode.png';
		link.click();
		toast.success('PNG downloaded');
	};
</script>

<svelte:head>
	<title>QR Code Generator - Kogu</title>
</svelte:head>

<ToolShell valid={result ? true : null} error={error ?? undefined} bind:showRail={showOptions}>
	{#snippet statusContent()}
		{#if result}
			<StatItem label="Size" value={`${options.width}×${options.width}`} />
			<StatItem label="Level" value={options.errorCorrectionLevel} />
		{/if}
	{/snippet}

	{#snippet rail()}
		<FormSection title="Content">
			<FormInput label="Text or URL" bind:value={options.text} placeholder="https://example.com" />
		</FormSection>

		<FormSection title="Error Correction">
			<FormSelect
				label="Level"
				value={options.errorCorrectionLevel}
				options={levelOptions}
				onchange={handleLevelChange}
			/>
		</FormSection>

		<FormSection title="Size">
			<FormSlider
				label="Width"
				bind:value={options.width}
				min={MIN_WIDTH}
				max={MAX_WIDTH}
				step={32}
				valueLabel={`${options.width}px`}
			/>
			<FormSlider
				label="Margin"
				bind:value={options.margin}
				min={MIN_MARGIN}
				max={MAX_MARGIN}
				step={1}
				valueLabel={`${options.margin}`}
			/>
		</FormSection>

		<FormSection title="Colors">
			<FormInput
				label="Foreground"
				bind:value={options.foregroundColor}
				placeholder="#000000"
				size="compact"
				class="font-mono"
			/>
			<FormInput
				label="Background"
				bind:value={options.backgroundColor}
				placeholder="#ffffff"
				size="compact"
				class="font-mono"
			/>
		</FormSection>

		<FormSection title="Actions">
			<div class="space-y-2">
				<ActionButton
					label="Generate"
					icon={QrCode}
					loading={isGenerating}
					loadingLabel="Generating..."
					disabled={!canGenerate}
					shortcut
					onclick={handleGenerate}
				/>
				{#if result || options.text}
					<ActionButton label="Clear" variant="outline" onclick={handleClear} />
				{/if}
			</div>
		</FormSection>

		<FormSection title="About">
			<FormInfo>
				<ul class="list-inside list-disc space-y-0.5">
					<li>Higher error correction tolerates damage but enlarges the matrix</li>
					<li>Capacity drops as correction level rises</li>
					<li>Margin (quiet zone) of 4 modules is the spec minimum</li>
				</ul>
			</FormInfo>
		</FormSection>
	{/snippet}

	<!-- Result Panel -->
	<div class="flex h-full flex-col overflow-hidden">
		<SectionHeader title="QR Code Preview">
			{#snippet trailing()}
				{#if result}
					<div class="flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							class="h-7 gap-1 px-2 text-xs"
							onclick={handleDownloadSvg}
						>
							<Download class="h-3 w-3" />
							SVG
						</Button>
						<Button
							variant="ghost"
							size="sm"
							class="h-7 gap-1 px-2 text-xs"
							onclick={handleDownloadPng}
						>
							<Download class="h-3 w-3" />
							PNG
						</Button>
						<CopyButton
							text={result.dataUrl}
							label="Data URL"
							toastLabel="Data URL"
							size="sm"
							class="h-7"
						/>
					</div>
				{/if}
			{/snippet}
		</SectionHeader>

		<div class="flex-1 overflow-auto p-4">
			{#if result}
				<div class="flex flex-col items-center gap-6">
					<div
						class="flex items-center justify-center rounded-lg border bg-surface-3 p-6"
						style:max-width="100%"
					>
						{@html result.svg}
					</div>
					<div class="w-full max-w-2xl">
						<div class="rounded-lg border bg-surface-3 p-4">
							<div class="mb-2 flex items-center justify-between">
								<span class="text-sm font-medium">Encoded Text</span>
							</div>
							<code class="block break-all rounded bg-muted p-3 font-mono text-sm">
								{options.text}
							</code>
						</div>
					</div>
				</div>
			{:else}
				<EmptyState icon={QrCode} title="Enter text and click Generate" />
			{/if}
		</div>
	</div>
</ToolShell>
