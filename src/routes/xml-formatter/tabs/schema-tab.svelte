<script lang="ts">
	
	import { FileCheck, Wand2 } from '@lucide/svelte';
import { toast } from 'svelte-sonner';
	import SplitPane from '$lib/components/layout/split-pane.svelte';
	import OptionCheckbox from '$lib/components/options/option-checkbox.svelte';
	import OptionsPanel from '$lib/components/options/options-panel.svelte';
	import OptionsSection from '$lib/components/options/options-section.svelte';
	import { EditorPane } from '$lib/components/tool/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { copyToClipboard, downloadTextFile, pasteFromClipboard } from '../utils.js';

	interface Props {
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { input, onInputChange, onStatsChange }: Props = $props();

	// State
	let schemaDefinition = $state('');
	let schemaValidationResult = $state<{ valid: boolean; errors: string[] } | null>(null);
	let schemaError = $state('');
	let showOptions = $state(true);

	// Options
	let validateNamespaces = $state(true);
	let validateDtd = $state(false);

	// Validation
	const inputValidation = $derived.by(() => {
		if (!input.trim()) return { valid: null as boolean | null };
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(input, 'application/xml');
			const parserError = doc.querySelector('parsererror');
			return { valid: parserError === null };
		} catch {
			return { valid: false };
		}
	});

	// Infer XSD schema from XML
	const inferXsdSchema = (xmlInput: string): string => {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(xmlInput, 'application/xml');
			const parserError = doc.querySelector('parsererror');
			if (parserError) {
				throw new Error('Invalid XML');
			}

			const rootElement = doc.documentElement;
			const elements = new Map<string, { attributes: Set<string>; children: Set<string> }>();

			// Recursively analyze elements
			const analyzeElement = (element: Element) => {
				const tagName = element.tagName;
				if (!elements.has(tagName)) {
					elements.set(tagName, { attributes: new Set(), children: new Set() });
				}
				const info = elements.get(tagName);
				if (!info) return;

				// Collect attributes
				Array.from(element.attributes).forEach((attr) => info.attributes.add(attr.name));

				// Collect child elements
				Array.from(element.children).forEach((child) => {
					info.children.add(child.tagName);
					analyzeElement(child);
				});
			};

			analyzeElement(rootElement);

			// Generate XSD
			const header = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">

`;

			// Generate element definitions
			const elementDefs = Array.from(elements.entries())
				.map(([tagName, info]) => {
					const childrenSeq =
						info.children.size > 0
							? [
									'      <xs:sequence>',
									...Array.from(info.children).map(
										(child) =>
											`        <xs:element ref="${child}" minOccurs="0" maxOccurs="unbounded"/>`
									),
									'      </xs:sequence>',
								].join('\n')
							: [
									'      <xs:simpleContent>',
									'        <xs:extension base="xs:string">',
									...Array.from(info.attributes).map(
										(attr) => `          <xs:attribute name="${attr}" type="xs:string"/>`
									),
									'        </xs:extension>',
									'      </xs:simpleContent>',
								].join('\n');

					const topLevelAttrs =
						info.children.size > 0 && info.attributes.size > 0
							? Array.from(info.attributes)
									.map((attr) => `      <xs:attribute name="${attr}" type="xs:string"/>`)
									.join('\n')
							: '';

					return [
						`  <xs:element name="${tagName}">`,
						'    <xs:complexType>',
						childrenSeq,
						topLevelAttrs,
						'    </xs:complexType>',
						'  </xs:element>',
					]
						.filter(Boolean)
						.join('\n');
				})
				.join('\n\n');

			const xsd = `${header}${elementDefs}\n\n</xs:schema>`;

			return xsd;
		} catch (e) {
			throw new Error(e instanceof Error ? e.message : 'Failed to infer schema');
		}
	};

	// Inferred schema
	const inferredSchema = $derived.by(() => {
		if (!input.trim()) {
			return '';
		}
		try {
			return inferXsdSchema(input);
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
		});
	});

	// Basic XML structure validation against schema
	const handleValidateSchema = () => {
		if (!input.trim() || !schemaDefinition.trim()) {
			schemaError = 'Please enter XML and a schema';
			return;
		}

		try {
			const parser = new DOMParser();

			// Parse XML
			const xmlDoc = parser.parseFromString(input, 'application/xml');
			const xmlError = xmlDoc.querySelector('parsererror');
			if (xmlError) {
				schemaError = `Invalid XML: ${xmlError.textContent}`;
				schemaValidationResult = null;
				return;
			}

			// Parse XSD
			const xsdDoc = parser.parseFromString(schemaDefinition, 'application/xml');
			const xsdError = xsdDoc.querySelector('parsererror');
			if (xsdError) {
				schemaError = `Invalid XSD schema: ${xsdError.textContent}`;
				schemaValidationResult = null;
				return;
			}

			// Basic structure validation
			const errors: string[] = [];

			// Check if root element is defined in schema
			const rootElement = xmlDoc.documentElement;
			const schemaElements = xsdDoc.querySelectorAll('element');
			const definedElements = new Set(
				Array.from(schemaElements)
					.map((el) => el.getAttribute('name'))
					.filter((name): name is string => name !== null)
			);

			// Validate elements exist in schema
			const checkElements = (element: Element, path: string) => {
				const tagName = element.tagName;
				if (!definedElements.has(tagName) && definedElements.size > 0) {
					errors.push(`${path}/${tagName}: Element not defined in schema`);
				}

				// Check namespace if enabled
				if (validateNamespaces && element.namespaceURI) {
					const schemaNamespace = xsdDoc.documentElement.getAttribute('targetNamespace');
					if (schemaNamespace && element.namespaceURI !== schemaNamespace) {
						errors.push(
							`${path}/${tagName}: Namespace mismatch (expected: ${schemaNamespace}, got: ${element.namespaceURI})`
						);
					}
				}

				Array.from(element.children).forEach((child) =>
					checkElements(child, `${path}/${tagName}`)
				);
			};

			checkElements(rootElement, '');

			if (errors.length === 0) {
				schemaValidationResult = { valid: true, errors: [] };
				toast.success('XML is valid against schema');
			} else {
				schemaValidationResult = { valid: false, errors };
				toast.error(`${errors.length} validation error(s) found`);
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
		onInputChange('');
		schemaDefinition = '';
		schemaValidationResult = null;
		schemaError = '';
	};

	const handleCopySchema = () => {
		const content = inferredSchema || schemaDefinition;
		copyToClipboard(content);
	};

	const handleDownload = () => {
		downloadTextFile(inferredSchema || schemaDefinition, 'schema.xsd');
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
				{#if !schemaValidationResult.valid && schemaValidationResult.errors.length > 0}
					<div class="mt-2 max-h-32 overflow-auto rounded-md bg-muted/50 p-2 text-[11px]">
						{#each schemaValidationResult.errors as error}
							<div class="text-destructive">{error}</div>
						{/each}
					</div>
				{/if}
			{/if}
		</OptionsSection>

		<OptionsSection title="Validation Options">
			<OptionCheckbox label="Validate namespaces" bind:checked={validateNamespaces} />
			<OptionCheckbox label="Validate DTD (if present)" bind:checked={validateDtd} />
		</OptionsSection>

		<OptionsSection title="Quick Help">
			<div class="space-y-1.5 rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
				<p><strong class="text-foreground">Validate:</strong> Check XML against XSD schema</p>
				<p><strong class="text-foreground">Infer:</strong> Generate XSD from XML structure</p>
				<p class="text-[10px] italic">
					Note: Full XSD validation requires a backend service. This provides basic structure
					validation.
				</p>
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
				editorMode="xml"
				placeholder="Enter XML here..."
				onpaste={handlePaste}
				onclear={handleClear}
			/>
		{/snippet}
		{#snippet right()}
			{#if inferredSchema && !schemaDefinition}
				<EditorPane
					title="Inferred Schema (XSD)"
					value={inferredSchema}
					mode="readonly"
					editorMode="xml"
					placeholder="Schema will appear here..."
					oncopy={handleCopySchema}
				/>
			{:else}
				<EditorPane
					title="XML Schema (XSD)"
					bind:value={schemaDefinition}
					mode="input"
					editorMode="xml"
					placeholder="Enter XSD schema here..."
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
