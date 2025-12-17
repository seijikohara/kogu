<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button/index.js';
	import OptionsPanel from '$lib/components/options/options-panel.svelte';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import SplitPane from '$lib/components/layout/split-pane.svelte';
	import { EditorPane } from '$lib/components/tool/index.js';
	import { FileCheck, Wand2 } from '@lucide/svelte';
	import { inferJsonSchema, validateJson, type JsonInputFormat } from '$lib/services/formatters.js';
	import { downloadTextFile, copyToClipboard, pasteFromClipboard } from '../utils.js';
	import Ajv from 'ajv';
	import addFormats from 'ajv-formats';

	interface Props {
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: {
			input: string;
			valid: boolean | null;
			error: string;
			format: JsonInputFormat | null;
		}) => void;
	}

	let { input, onInputChange, onStatsChange }: Props = $props();

	// State
	let schemaDefinition = $state('');
	let schemaValidationResult = $state<{ valid: boolean; errors: string[] } | null>(null);
	let schemaError = $state('');
	let showOptions = $state(true);

	// Options
	let schemaStrictMode = $state(false);
	let schemaAllErrors = $state(true);
	let schemaCoerceTypes = $state(false);
	let schemaUseDefaults = $state(false);
	let schemaRemoveAdditional = $state(false);
	let schemaValidateFormats = $state(true);
	let schemaVerboseErrors = $state(false);

	// Validation
	const inputValidation = $derived.by(() => {
		if (!input.trim())
			return { valid: null as boolean | null, format: null as JsonInputFormat | null };
		const result = validateJson(input);
		return { valid: result.valid, format: result.detectedFormat };
	});

	// Inferred schema
	const inferredSchema = $derived.by(() => {
		if (!input.trim() || input.trim() === '{}') {
			return '';
		}
		try {
			return JSON.stringify(inferJsonSchema(input), null, 2);
		} catch {
			return '';
		}
	});

	// Combined error
	const combinedError = $derived(
		schemaError ||
			(schemaValidationResult && !schemaValidationResult.valid
				? `${schemaValidationResult.errors.length} validation error(s)`
				: '')
	);

	// Report stats to parent
	$effect(() => {
		onStatsChange?.({
			input,
			valid: inputValidation.valid,
			error: combinedError,
			format: inputValidation.format,
		});
	});

	// Handlers
	const handleValidateSchema = () => {
		if (!input.trim() || !schemaDefinition.trim()) {
			schemaError = 'Please enter JSON and a schema';
			return;
		}
		try {
			const data = JSON.parse(input);
			const schema = JSON.parse(schemaDefinition);
			const ajv = new Ajv({
				allErrors: schemaAllErrors,
				strict: schemaStrictMode,
				coerceTypes: schemaCoerceTypes,
				useDefaults: schemaUseDefaults,
				removeAdditional: schemaRemoveAdditional,
				verbose: schemaVerboseErrors,
			});
			if (schemaValidateFormats) {
				addFormats(ajv);
			}
			const validate = ajv.compile(schema);
			const valid = validate(data);
			if (valid) {
				schemaValidationResult = { valid: true, errors: [] };
				toast.success('Valid');
			} else {
				const errors =
					validate.errors?.map((err) => {
						if (schemaVerboseErrors && err.data !== undefined) {
							return `${err.instancePath || '/'}: ${err.message} (value: ${JSON.stringify(err.data)})`;
						}
						return `${err.instancePath || '/'}: ${err.message}`;
					}) || [];
				schemaValidationResult = { valid: false, errors };
				toast.error(`${errors.length} error(s)`);
			}
			schemaError = '';
		} catch (e) {
			schemaError = e instanceof Error ? e.message : 'Validation failed';
			schemaValidationResult = null;
		}
	};

	const handleUseInferredSchema = () => {
		if (inferredSchema) {
			schemaDefinition = inferredSchema;
			toast.success('Schema applied');
		}
	};

	const handlePaste = async () => {
		const text = await pasteFromClipboard();
		if (text) onInputChange(text);
	};

	const handleClear = () => {
		onInputChange('{}');
		schemaDefinition = '';
		schemaValidationResult = null;
		schemaError = '';
	};

	const handleCopySchema = () => {
		const content = inferredSchema || schemaDefinition;
		copyToClipboard(content);
	};

	const handleDownload = () => {
		downloadTextFile(inferredSchema, 'schema.json');
	};
</script>

<div class="flex flex-1 overflow-hidden">
	<OptionsPanel
		show={showOptions}
		onclose={() => (showOptions = false)}
		onopen={() => (showOptions = true)}
	>
		<OptionsSection title="Actions">
			<div class="flex flex-col gap-1.5">
				<Button
					variant="secondary"
					size="sm"
					class="w-full gap-1.5 text-xs"
					onclick={handleValidateSchema}
				>
					<FileCheck class="h-3.5 w-3.5" />
					Validate against Schema
				</Button>
				{#if inferredSchema}
					<Button
						variant="outline"
						size="sm"
						class="w-full gap-1.5 text-xs"
						onclick={handleUseInferredSchema}
					>
						<Wand2 class="h-3.5 w-3.5" />
						Use Inferred Schema
					</Button>
				{/if}
			</div>
			{#if schemaValidationResult}
				<div
					class="mt-2 rounded-md p-2 text-xs {schemaValidationResult.valid
						? 'bg-green-500/10 text-green-600 dark:text-green-400'
						: 'bg-destructive/10 text-destructive'}"
				>
					{schemaValidationResult.valid
						? 'Schema validation passed'
						: `${schemaValidationResult.errors.length} error(s) found`}
				</div>
			{/if}
		</OptionsSection>

		<OptionsSection title="Validation">
			<OptionCheckbox label="Report all errors" bind:checked={schemaAllErrors} />
			<OptionCheckbox label="Strict mode" bind:checked={schemaStrictMode} />
			<OptionCheckbox label="Coerce types" bind:checked={schemaCoerceTypes} />
			<OptionCheckbox label="Validate formats" bind:checked={schemaValidateFormats} />
		</OptionsSection>

		<OptionsSection title="Advanced">
			<OptionCheckbox label="Use defaults" bind:checked={schemaUseDefaults} />
			<OptionCheckbox label="Remove additional properties" bind:checked={schemaRemoveAdditional} />
			<OptionCheckbox label="Verbose errors" bind:checked={schemaVerboseErrors} />
		</OptionsSection>

		<OptionsSection title="Quick Help">
			<div class="space-y-1.5 rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
				<p><strong class="text-foreground">Validate:</strong> Check JSON against schema</p>
				<p><strong class="text-foreground">Infer:</strong> Generate schema from JSON</p>
				<p><strong class="text-foreground">Strict:</strong> Enforce JSON Schema draft rules</p>
				<p><strong class="text-foreground">Coerce:</strong> Auto-convert types (string→number)</p>
			</div>
		</OptionsSection>
	</OptionsPanel>

	<SplitPane class="flex-1">
		{#snippet left()}
			<EditorPane
				title="Input"
				value={input}
				onchange={onInputChange}
				mode="input"
				editorMode="json"
				placeholder="Enter JSON here..."
				onpaste={handlePaste}
				onclear={handleClear}
			/>
		{/snippet}
		{#snippet right()}
			{#if inferredSchema}
				<EditorPane
					title="Inferred Schema"
					value={inferredSchema}
					mode="readonly"
					editorMode="json"
					placeholder="Schema will appear here..."
					oncopy={handleCopySchema}
				/>
			{:else}
				<EditorPane
					title="JSON Schema"
					bind:value={schemaDefinition}
					mode="input"
					editorMode="json"
					placeholder="Enter JSON Schema here..."
					onpaste={async () => {
						schemaDefinition = await navigator.clipboard.readText();
						toast.success('Pasted');
					}}
					onclear={() => (schemaDefinition = '')}
				/>
			{/if}
		{/snippet}
	</SplitPane>
</div>
