<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CodeEditor } from '$lib/components/editor';
	import { FormCheckbox, FormInput, FormMode, FormSection, FormSelect } from '$lib/components/form';
	import SplitPane from '$lib/components/layout/split-pane.svelte';
	import { OptionsPanel } from '$lib/components/panel';
	import {
		type CSharpOptions,
		type GoOptions,
		generateCode,
		JAVA_CLASS_STYLE_OPTIONS,
		JAVA_SERIALIZATION_OPTIONS,
		type JavaOptions,
		type JavaScriptOptions,
		KOTLIN_SERIALIZATION_OPTIONS,
		type KotlinOptions,
		LANGUAGE_INFO,
		LANGUAGE_OPTIONS,
		type PhpOptions,
		PYTHON_STYLE_OPTIONS,
		type PythonOptions,
		type RustOptions,
		type SwiftOptions,
		type TargetLanguage,
		type TypeScriptOptions,
	} from '$lib/services/code-generators/index.js';
	import { type JsonInputFormat, parseJson, validateJson } from '$lib/services/formatters';
	import { copyToClipboard, downloadTextFile, pasteFromClipboard } from '../utils.js';

	interface Props {
		readonly formatSection?: Snippet<[boolean?]>;
		readonly inputFormat: JsonInputFormat;
		input: string;
		onInputChange: (value: string) => void;
		onStatsChange?: (stats: { input: string; valid: boolean | null; error: string }) => void;
	}

	let { formatSection, inputFormat, input, onInputChange, onStatsChange }: Props = $props();

	// State
	let generateLanguage = $state<TargetLanguage>('typescript');
	let showOptions = $state(true);

	// TypeScript options
	let tsRootName = $state('Root');
	let tsOptionalProperties = $state(false);
	let tsUseInterface = $state(true);
	let tsUseExport = $state(true);
	let tsUseReadonly = $state(false);
	let tsStrictNullChecks = $state(true);

	// JavaScript options
	let jsRootName = $state('Root');
	let jsOptionalProperties = $state(false);
	let jsUseClass = $state(true);
	let jsUseJSDoc = $state(true);
	let jsUseES6 = $state(true);
	let jsGenerateFactory = $state(false);
	let jsGenerateValidator = $state(false);

	// Go options
	let goRootName = $state('Root');
	let goOptionalProperties = $state(false);
	let goUsePointers = $state(false);
	let goOmitEmpty = $state(true);
	let goUseJsonTag = $state(true);

	// Python options
	let pyRootName = $state('Root');
	let pyOptionalProperties = $state(false);
	let pyStyle = $state<'dataclass' | 'typeddict'>('dataclass');
	let pyUseFrozen = $state(false);
	let pyUseSlots = $state(false);
	let pyUseKwOnly = $state(false);
	let pyUseTotal = $state(true);

	// Rust options
	let rsRootName = $state('Root');
	let rsOptionalProperties = $state(false);
	let rsDeriveSerde = $state(true);
	let rsDeriveDebug = $state(true);
	let rsDeriveClone = $state(true);
	let rsDeriveDefault = $state(false);
	let rsUseBox = $state(false);

	// Java options
	let javaRootName = $state('Root');
	let javaOptionalProperties = $state(false);
	let javaPackageName = $state('com.example');
	let javaClassStyle = $state<'record' | 'pojo' | 'lombok' | 'immutables'>('record');
	let javaSerializationLibrary = $state<'none' | 'jackson' | 'gson' | 'moshi'>('none');
	let javaUseValidation = $state(false);
	let javaGenerateBuilder = $state(false);
	let javaGenerateEquals = $state(true);
	let javaUseOptional = $state(false);

	// C# options
	let csRootName = $state('Root');
	let csOptionalProperties = $state(false);
	let csUseRecords = $state(true);
	let csUseNullableReferenceTypes = $state(true);
	let csUseSystemTextJson = $state(true);
	let csUseNewtonsoft = $state(false);
	let csGenerateDataContract = $state(false);

	// Kotlin options
	let ktRootName = $state('Root');
	let ktOptionalProperties = $state(false);
	let ktUseDataClass = $state(true);
	let ktSerializationLibrary = $state<'none' | 'kotlinx' | 'gson' | 'moshi' | 'jackson'>('none');
	let ktUseDefaultValues = $state(false);

	// Swift options
	let swiftRootName = $state('Root');
	let swiftOptionalProperties = $state(false);
	let swiftUseStruct = $state(true);
	let swiftUseCodingKeys = $state(true);
	let swiftUseOptionalProperties = $state(false);

	// PHP options
	let phpRootName = $state('Root');
	let phpOptionalProperties = $state(false);
	let phpUseStrictTypes = $state(true);
	let phpUseReadonlyProperties = $state(false);
	let phpUseConstructorPromotion = $state(true);
	let phpNamespace = $state('');

	// Validation
	const inputValidation = $derived.by(() => {
		if (!input.trim()) return { valid: null as boolean | null };
		const result = validateJson(input, inputFormat);
		return { valid: result.valid };
	});

	// Get current language options
	const getCurrentLanguageOptions = () => {
		switch (generateLanguage) {
			case 'typescript':
				return {
					rootName: tsRootName,
					optionalProperties: tsOptionalProperties,
					useInterface: tsUseInterface,
					useExport: tsUseExport,
					useReadonly: tsUseReadonly,
					strictNullChecks: tsStrictNullChecks,
				} as TypeScriptOptions;
			case 'javascript':
				return {
					rootName: jsRootName,
					optionalProperties: jsOptionalProperties,
					useClass: jsUseClass,
					useJSDoc: jsUseJSDoc,
					useES6: jsUseES6,
					generateFactory: jsGenerateFactory,
					generateValidator: jsGenerateValidator,
				} as JavaScriptOptions;
			case 'go':
				return {
					rootName: goRootName,
					optionalProperties: goOptionalProperties,
					usePointers: goUsePointers,
					omitEmpty: goOmitEmpty,
					useJsonTag: goUseJsonTag,
				} as GoOptions;
			case 'python':
				return {
					rootName: pyRootName,
					optionalProperties: pyOptionalProperties,
					style: pyStyle,
					useFrozen: pyUseFrozen,
					useSlots: pyUseSlots,
					useKwOnly: pyUseKwOnly,
					useTotal: pyUseTotal,
				} as PythonOptions;
			case 'rust':
				return {
					rootName: rsRootName,
					optionalProperties: rsOptionalProperties,
					deriveSerde: rsDeriveSerde,
					deriveDebug: rsDeriveDebug,
					deriveClone: rsDeriveClone,
					deriveDefault: rsDeriveDefault,
					useBox: rsUseBox,
				} as RustOptions;
			case 'java':
				return {
					rootName: javaRootName,
					optionalProperties: javaOptionalProperties,
					packageName: javaPackageName,
					classStyle: javaClassStyle,
					serializationLibrary: javaSerializationLibrary,
					useValidation: javaUseValidation,
					generateBuilder: javaGenerateBuilder,
					generateEquals: javaGenerateEquals,
					useOptional: javaUseOptional,
				} as JavaOptions;
			case 'csharp':
				return {
					rootName: csRootName,
					optionalProperties: csOptionalProperties,
					useRecords: csUseRecords,
					useNullableReferenceTypes: csUseNullableReferenceTypes,
					useSystemTextJson: csUseSystemTextJson,
					useNewtonsoft: csUseNewtonsoft,
					generateDataContract: csGenerateDataContract,
				} as CSharpOptions;
			case 'kotlin':
				return {
					rootName: ktRootName,
					optionalProperties: ktOptionalProperties,
					useDataClass: ktUseDataClass,
					serializationLibrary: ktSerializationLibrary,
					useDefaultValues: ktUseDefaultValues,
				} as KotlinOptions;
			case 'swift':
				return {
					rootName: swiftRootName,
					optionalProperties: swiftOptionalProperties,
					useStruct: swiftUseStruct,
					useCodingKeys: swiftUseCodingKeys,
					useOptionalProperties: swiftUseOptionalProperties,
				} as SwiftOptions;
			case 'php':
				return {
					rootName: phpRootName,
					optionalProperties: phpOptionalProperties,
					useStrictTypes: phpUseStrictTypes,
					useReadonlyProperties: phpUseReadonlyProperties,
					useConstructorPromotion: phpUseConstructorPromotion,
					namespace: phpNamespace,
				} as PhpOptions;
		}
	};

	// Get current root name based on language
	const getCurrentRootName = () => {
		switch (generateLanguage) {
			case 'typescript':
				return tsRootName;
			case 'javascript':
				return jsRootName;
			case 'go':
				return goRootName;
			case 'python':
				return pyRootName;
			case 'rust':
				return rsRootName;
			case 'java':
				return javaRootName;
			case 'csharp':
				return csRootName;
			case 'kotlin':
				return ktRootName;
			case 'swift':
				return swiftRootName;
			case 'php':
				return phpRootName;
		}
	};

	// Generated code
	const generateResult = $derived.by(() => {
		if (!input.trim()) return { code: '', error: '' };
		try {
			const data = parseJson(input, inputFormat);
			const options = getCurrentLanguageOptions();
			return { code: generateCode(data, generateLanguage, options), error: '' };
		} catch (e) {
			return { code: '', error: e instanceof Error ? e.message : 'Failed to generate code' };
		}
	});

	const generatedCode = $derived(generateResult.code);
	const generateError = $derived(generateResult.error);
	const generateEditorMode = $derived(LANGUAGE_INFO[generateLanguage].editorMode);

	// Report stats to parent
	$effect(() => {
		onStatsChange?.({
			input,
			valid: inputValidation.valid,
			error: generateError,
		});
	});

	// Handlers
	const handlePaste = async () => {
		const text = await pasteFromClipboard();
		if (text) onInputChange(text);
	};

	const handleClear = () => {
		onInputChange('{}');
	};

	const handleCopy = () => copyToClipboard(generatedCode);

	const handleDownload = () => {
		const info = LANGUAGE_INFO[generateLanguage];
		const filename = `${getCurrentRootName().toLowerCase()}.${info.extension}`;
		downloadTextFile(generatedCode, filename);
	};
</script>

<div class="flex flex-1 overflow-hidden">
	<OptionsPanel
		show={showOptions}
		onclose={() => (showOptions = false)}
		onopen={() => (showOptions = true)}
	>
		{@render formatSection?.()}
		<FormSection title="Target Language">
			<FormMode
				bind:value={generateLanguage}
				options={LANGUAGE_OPTIONS.map((lang) => ({ value: lang.value, label: lang.label }))}
			/>
		</FormSection>

		{#if generateLanguage === 'typescript'}
			<FormSection title="TypeScript Options">
				<FormInput
					label="Root Type Name"
					bind:value={tsRootName}
					placeholder="Root"
					size="compact"
				/>
				<div class="space-y-1.5 pt-1">
					<FormCheckbox label="Use interface (vs type)" bind:checked={tsUseInterface} />
					<FormCheckbox label="Export types" bind:checked={tsUseExport} />
					<FormCheckbox label="Readonly properties" bind:checked={tsUseReadonly} />
					<FormCheckbox label="Strict null checks" bind:checked={tsStrictNullChecks} />
					<FormCheckbox label="Optional properties" bind:checked={tsOptionalProperties} />
				</div>
			</FormSection>
		{:else if generateLanguage === 'javascript'}
			<FormSection title="JavaScript Options">
				<FormInput
					label="Root Type Name"
					bind:value={jsRootName}
					placeholder="Root"
					size="compact"
				/>
				<div class="space-y-1.5 pt-1">
					<FormCheckbox label="Use ES6 class" bind:checked={jsUseClass} />
					<FormCheckbox label="Generate JSDoc" bind:checked={jsUseJSDoc} />
					<FormCheckbox label="ES6 syntax" bind:checked={jsUseES6} />
					<FormCheckbox label="Generate factory function" bind:checked={jsGenerateFactory} />
					<FormCheckbox label="Generate validator" bind:checked={jsGenerateValidator} />
					<FormCheckbox label="Optional properties" bind:checked={jsOptionalProperties} />
				</div>
			</FormSection>
		{:else if generateLanguage === 'go'}
			<FormSection title="Go Options">
				<FormInput
					label="Root Type Name"
					bind:value={goRootName}
					placeholder="Root"
					size="compact"
				/>
				<div class="space-y-1.5 pt-1">
					<FormCheckbox label="Use pointers for nested types" bind:checked={goUsePointers} />
					<FormCheckbox label="Add json tags" bind:checked={goUseJsonTag} />
					<FormCheckbox label="Add omitempty" bind:checked={goOmitEmpty} />
					<FormCheckbox label="Optional properties" bind:checked={goOptionalProperties} />
				</div>
			</FormSection>
		{:else if generateLanguage === 'python'}
			<FormSection title="Python Options">
				<FormInput
					label="Root Type Name"
					bind:value={pyRootName}
					placeholder="Root"
					size="compact"
				/>
				<FormSelect
					label="Style"
					bind:value={pyStyle}
					options={PYTHON_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
				/>
				{#if pyStyle === 'dataclass'}
					<div class="space-y-1.5 pt-1">
						<FormCheckbox label="Frozen (immutable)" bind:checked={pyUseFrozen} />
						<FormCheckbox label="Use __slots__" bind:checked={pyUseSlots} />
						<FormCheckbox label="Keyword-only args" bind:checked={pyUseKwOnly} />
					</div>
				{:else}
					<div class="space-y-1.5 pt-1">
						<FormCheckbox label="Total (all keys required)" bind:checked={pyUseTotal} />
					</div>
				{/if}
				<FormCheckbox label="Optional properties" bind:checked={pyOptionalProperties} />
			</FormSection>
		{:else if generateLanguage === 'rust'}
			<FormSection title="Rust Options">
				<FormInput
					label="Root Type Name"
					bind:value={rsRootName}
					placeholder="Root"
					size="compact"
				/>
				<div class="space-y-1.5 pt-1">
					<FormCheckbox label="Derive Serialize/Deserialize" bind:checked={rsDeriveSerde} />
					<FormCheckbox label="Derive Debug" bind:checked={rsDeriveDebug} />
					<FormCheckbox label="Derive Clone" bind:checked={rsDeriveClone} />
					<FormCheckbox label="Derive Default" bind:checked={rsDeriveDefault} />
					<FormCheckbox label="Use Box for nested types" bind:checked={rsUseBox} />
					<FormCheckbox label="Optional properties" bind:checked={rsOptionalProperties} />
				</div>
			</FormSection>
		{:else if generateLanguage === 'java'}
			<FormSection title="Java Options">
				<FormInput
					label="Root Type Name"
					bind:value={javaRootName}
					placeholder="Root"
					size="compact"
				/>
				<FormInput
					label="Package Name"
					bind:value={javaPackageName}
					placeholder="com.example"
					size="compact"
				/>
				<FormSelect
					label="Class Style"
					bind:value={javaClassStyle}
					options={JAVA_CLASS_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
				/>
				<FormSelect
					label="Serialization"
					bind:value={javaSerializationLibrary}
					options={JAVA_SERIALIZATION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
				/>
				<div class="space-y-1.5 pt-1">
					<FormCheckbox label="Bean validation" bind:checked={javaUseValidation} />
					{#if javaClassStyle === 'lombok'}
						<FormCheckbox label="Generate builder" bind:checked={javaGenerateBuilder} />
					{/if}
					{#if javaClassStyle === 'pojo'}
						<FormCheckbox label="Generate equals/hashCode" bind:checked={javaGenerateEquals} />
					{/if}
					<FormCheckbox label="Use Optional for nullable" bind:checked={javaUseOptional} />
					<FormCheckbox label="Optional properties" bind:checked={javaOptionalProperties} />
				</div>
			</FormSection>
		{:else if generateLanguage === 'csharp'}
			<FormSection title="C# Options">
				<FormInput
					label="Root Type Name"
					bind:value={csRootName}
					placeholder="Root"
					size="compact"
				/>
				<div class="space-y-1.5 pt-1">
					<FormCheckbox label="Use records (vs class)" bind:checked={csUseRecords} />
					<FormCheckbox
						label="Nullable reference types"
						bind:checked={csUseNullableReferenceTypes}
					/>
					<FormCheckbox label="System.Text.Json attributes" bind:checked={csUseSystemTextJson} />
					<FormCheckbox label="Newtonsoft.Json attributes" bind:checked={csUseNewtonsoft} />
					<FormCheckbox label="DataContract attributes" bind:checked={csGenerateDataContract} />
					<FormCheckbox label="Optional properties" bind:checked={csOptionalProperties} />
				</div>
			</FormSection>
		{:else if generateLanguage === 'kotlin'}
			<FormSection title="Kotlin Options">
				<FormInput
					label="Root Type Name"
					bind:value={ktRootName}
					placeholder="Root"
					size="compact"
				/>
				<FormSelect
					label="Serialization"
					bind:value={ktSerializationLibrary}
					options={KOTLIN_SERIALIZATION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
				/>
				<div class="space-y-1.5 pt-1">
					<FormCheckbox label="Use data class" bind:checked={ktUseDataClass} />
					<FormCheckbox label="Default values" bind:checked={ktUseDefaultValues} />
					<FormCheckbox label="Optional properties" bind:checked={ktOptionalProperties} />
				</div>
			</FormSection>
		{:else if generateLanguage === 'swift'}
			<FormSection title="Swift Options">
				<FormInput
					label="Root Type Name"
					bind:value={swiftRootName}
					placeholder="Root"
					size="compact"
				/>
				<div class="space-y-1.5 pt-1">
					<FormCheckbox label="Use struct (vs class)" bind:checked={swiftUseStruct} />
					<FormCheckbox label="Generate CodingKeys" bind:checked={swiftUseCodingKeys} />
					<FormCheckbox label="Optional properties" bind:checked={swiftUseOptionalProperties} />
					<FormCheckbox label="All properties optional" bind:checked={swiftOptionalProperties} />
				</div>
			</FormSection>
		{:else if generateLanguage === 'php'}
			<FormSection title="PHP Options">
				<FormInput
					label="Root Type Name"
					bind:value={phpRootName}
					placeholder="Root"
					size="compact"
				/>
				<FormInput
					label="Namespace"
					bind:value={phpNamespace}
					placeholder="App\\Models"
					size="compact"
				/>
				<div class="space-y-1.5 pt-1">
					<FormCheckbox label="Strict types" bind:checked={phpUseStrictTypes} />
					<FormCheckbox label="Constructor promotion" bind:checked={phpUseConstructorPromotion} />
					<FormCheckbox label="Readonly properties" bind:checked={phpUseReadonlyProperties} />
					<FormCheckbox label="Optional properties" bind:checked={phpOptionalProperties} />
				</div>
			</FormSection>
		{/if}
	</OptionsPanel>

	<SplitPane class="flex-1">
		{#snippet left()}
			<CodeEditor
				title="Input JSON"
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
			<CodeEditor
				title="Generated Code ({LANGUAGE_INFO[generateLanguage].label})"
				value={generatedCode}
				mode="readonly"
				editorMode={generateEditorMode}
				placeholder="Generated code will appear here..."
				oncopy={handleCopy}
			/>
		{/snippet}
	</SplitPane>
</div>
