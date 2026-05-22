import { Code } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import * as yaml from 'yaml';

import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInput,
	FormMode,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { InputOutputSplit } from '@/lib/components/layout';
import { OptionsPanel } from '@/lib/components/panel';
import { useClipboardActions } from '@/lib/hooks';
import {
	type CSharpOptions,
	generateCode,
	type GoOptions,
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
} from '@/lib/services/code-generators';

type JavaClassStyle = 'record' | 'pojo' | 'lombok' | 'immutables';
type JavaSerialization = 'none' | 'jackson' | 'gson' | 'moshi';
type KotlinSerialization = 'none' | 'kotlinx' | 'gson' | 'moshi' | 'jackson';
type PythonStyle = 'dataclass' | 'typeddict';

interface TabStats {
	readonly input: string;
	readonly valid: boolean | null;
	readonly error: string;
}

interface GenerateTabProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly onStatsChange?: (stats: TabStats) => void;
}

export function GenerateTab({ input, onInputChange, onStatsChange }: GenerateTabProps) {
	const [generateLanguage, setGenerateLanguage] = useState<TargetLanguage>('typescript');
	const [showOptions, setShowOptions] = useState(true);

	// TypeScript options.
	const [tsRootName, setTsRootName] = useState<string>('Root');
	const [tsOptionalProperties, setTsOptionalProperties] = useState<boolean>(false);
	const [tsUseInterface, setTsUseInterface] = useState<boolean>(true);
	const [tsUseExport, setTsUseExport] = useState<boolean>(true);
	const [tsUseReadonly, setTsUseReadonly] = useState<boolean>(false);
	const [tsStrictNullChecks, setTsStrictNullChecks] = useState<boolean>(true);

	// JavaScript options.
	const [jsRootName, setJsRootName] = useState<string>('Root');
	const [jsOptionalProperties, setJsOptionalProperties] = useState<boolean>(false);
	const [jsUseClass, setJsUseClass] = useState<boolean>(true);
	const [jsUseJSDoc, setJsUseJSDoc] = useState<boolean>(true);
	const [jsUseES6, setJsUseES6] = useState<boolean>(true);
	const [jsGenerateFactory, setJsGenerateFactory] = useState<boolean>(false);
	const [jsGenerateValidator, setJsGenerateValidator] = useState<boolean>(false);

	// Go options.
	const [goRootName, setGoRootName] = useState<string>('Root');
	const [goOptionalProperties, setGoOptionalProperties] = useState<boolean>(false);
	const [goUsePointers, setGoUsePointers] = useState<boolean>(false);
	const [goOmitEmpty, setGoOmitEmpty] = useState<boolean>(true);
	const [goUseJsonTag, setGoUseJsonTag] = useState<boolean>(true);

	// Python options.
	const [pyRootName, setPyRootName] = useState<string>('Root');
	const [pyOptionalProperties, setPyOptionalProperties] = useState<boolean>(false);
	const [pyStyle, setPyStyle] = useState<PythonStyle>('dataclass');
	const [pyUseFrozen, setPyUseFrozen] = useState<boolean>(false);
	const [pyUseSlots, setPyUseSlots] = useState<boolean>(false);
	const [pyUseKwOnly, setPyUseKwOnly] = useState<boolean>(false);
	const [pyUseTotal, setPyUseTotal] = useState<boolean>(true);

	// Rust options.
	const [rsRootName, setRsRootName] = useState<string>('Root');
	const [rsOptionalProperties, setRsOptionalProperties] = useState<boolean>(false);
	const [rsDeriveSerde, setRsDeriveSerde] = useState<boolean>(true);
	const [rsDeriveDebug, setRsDeriveDebug] = useState<boolean>(true);
	const [rsDeriveClone, setRsDeriveClone] = useState<boolean>(true);
	const [rsDeriveDefault, setRsDeriveDefault] = useState<boolean>(false);
	const [rsUseBox, setRsUseBox] = useState<boolean>(false);

	// Java options.
	const [javaRootName, setJavaRootName] = useState<string>('Root');
	const [javaOptionalProperties, setJavaOptionalProperties] = useState<boolean>(false);
	const [javaPackageName, setJavaPackageName] = useState<string>('com.example');
	const [javaClassStyle, setJavaClassStyle] = useState<JavaClassStyle>('record');
	const [javaSerializationLibrary, setJavaSerializationLibrary] =
		useState<JavaSerialization>('none');
	const [javaUseValidation, setJavaUseValidation] = useState<boolean>(false);
	const [javaGenerateBuilder, setJavaGenerateBuilder] = useState<boolean>(false);
	const [javaGenerateEquals, setJavaGenerateEquals] = useState<boolean>(true);
	const [javaUseOptional, setJavaUseOptional] = useState<boolean>(false);

	// C# options.
	const [csRootName, setCsRootName] = useState<string>('Root');
	const [csOptionalProperties, setCsOptionalProperties] = useState<boolean>(false);
	const [csUseRecords, setCsUseRecords] = useState<boolean>(true);
	const [csUseNullableReferenceTypes, setCsUseNullableReferenceTypes] = useState<boolean>(true);
	const [csUseSystemTextJson, setCsUseSystemTextJson] = useState<boolean>(true);
	const [csUseNewtonsoft, setCsUseNewtonsoft] = useState<boolean>(false);
	const [csGenerateDataContract, setCsGenerateDataContract] = useState<boolean>(false);

	// Kotlin options.
	const [ktRootName, setKtRootName] = useState<string>('Root');
	const [ktOptionalProperties, setKtOptionalProperties] = useState<boolean>(false);
	const [ktUseDataClass, setKtUseDataClass] = useState<boolean>(true);
	const [ktSerializationLibrary, setKtSerializationLibrary] = useState<KotlinSerialization>('none');
	const [ktUseDefaultValues, setKtUseDefaultValues] = useState<boolean>(false);

	// Swift options.
	const [swiftRootName, setSwiftRootName] = useState<string>('Root');
	const [swiftOptionalProperties, setSwiftOptionalProperties] = useState<boolean>(false);
	const [swiftUseStruct, setSwiftUseStruct] = useState<boolean>(true);
	const [swiftUseCodingKeys, setSwiftUseCodingKeys] = useState<boolean>(true);
	const [swiftUseOptionalProperties, setSwiftUseOptionalProperties] = useState<boolean>(false);

	// PHP options.
	const [phpRootName, setPhpRootName] = useState<string>('Root');
	const [phpOptionalProperties, setPhpOptionalProperties] = useState<boolean>(false);
	const [phpUseStrictTypes, setPhpUseStrictTypes] = useState<boolean>(true);
	const [phpUseReadonlyProperties, setPhpUseReadonlyProperties] = useState<boolean>(false);
	const [phpUseConstructorPromotion, setPhpUseConstructorPromotion] = useState<boolean>(true);
	const [phpNamespace, setPhpNamespace] = useState<string>('');

	const inputValidation = useMemo<{ valid: boolean | null }>(() => {
		if (!input.trim()) return { valid: null };
		try {
			yaml.parse(input);
			return { valid: true };
		} catch {
			return { valid: false };
		}
	}, [input]);

	const buildLanguageOptions = ():
		| TypeScriptOptions
		| JavaScriptOptions
		| GoOptions
		| PythonOptions
		| RustOptions
		| JavaOptions
		| CSharpOptions
		| KotlinOptions
		| SwiftOptions
		| PhpOptions => {
		switch (generateLanguage) {
			case 'typescript':
				return {
					rootName: tsRootName,
					optionalProperties: tsOptionalProperties,
					useInterface: tsUseInterface,
					useExport: tsUseExport,
					useReadonly: tsUseReadonly,
					strictNullChecks: tsStrictNullChecks,
				} satisfies TypeScriptOptions;
			case 'javascript':
				return {
					rootName: jsRootName,
					optionalProperties: jsOptionalProperties,
					useClass: jsUseClass,
					useJSDoc: jsUseJSDoc,
					useES6: jsUseES6,
					generateFactory: jsGenerateFactory,
					generateValidator: jsGenerateValidator,
				} satisfies JavaScriptOptions;
			case 'go':
				return {
					rootName: goRootName,
					optionalProperties: goOptionalProperties,
					usePointers: goUsePointers,
					omitEmpty: goOmitEmpty,
					useJsonTag: goUseJsonTag,
				} satisfies GoOptions;
			case 'python':
				return {
					rootName: pyRootName,
					optionalProperties: pyOptionalProperties,
					style: pyStyle,
					useFrozen: pyUseFrozen,
					useSlots: pyUseSlots,
					useKwOnly: pyUseKwOnly,
					useTotal: pyUseTotal,
				} satisfies PythonOptions;
			case 'rust':
				return {
					rootName: rsRootName,
					optionalProperties: rsOptionalProperties,
					deriveSerde: rsDeriveSerde,
					deriveDebug: rsDeriveDebug,
					deriveClone: rsDeriveClone,
					deriveDefault: rsDeriveDefault,
					useBox: rsUseBox,
				} satisfies RustOptions;
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
				} satisfies JavaOptions;
			case 'csharp':
				return {
					rootName: csRootName,
					optionalProperties: csOptionalProperties,
					useRecords: csUseRecords,
					useNullableReferenceTypes: csUseNullableReferenceTypes,
					useSystemTextJson: csUseSystemTextJson,
					useNewtonsoft: csUseNewtonsoft,
					generateDataContract: csGenerateDataContract,
				} satisfies CSharpOptions;
			case 'kotlin':
				return {
					rootName: ktRootName,
					optionalProperties: ktOptionalProperties,
					useDataClass: ktUseDataClass,
					serializationLibrary: ktSerializationLibrary,
					useDefaultValues: ktUseDefaultValues,
				} satisfies KotlinOptions;
			case 'swift':
				return {
					rootName: swiftRootName,
					optionalProperties: swiftOptionalProperties,
					useStruct: swiftUseStruct,
					useCodingKeys: swiftUseCodingKeys,
					useOptionalProperties: swiftUseOptionalProperties,
				} satisfies SwiftOptions;
			case 'php':
				return {
					rootName: phpRootName,
					optionalProperties: phpOptionalProperties,
					useStrictTypes: phpUseStrictTypes,
					useReadonlyProperties: phpUseReadonlyProperties,
					useConstructorPromotion: phpUseConstructorPromotion,
					namespace: phpNamespace,
				} satisfies PhpOptions;
		}
	};

	const { code: generatedCode, error: generateError } = ((): {
		code: string;
		error: string;
	} => {
		if (!input.trim()) return { code: '', error: '' };
		try {
			const data = yaml.parse(input);
			const options = buildLanguageOptions();
			// generateCode has multiple overloads keyed by language literal; branch
			// per language to satisfy the discriminated overload set.
			switch (generateLanguage) {
				case 'typescript':
					return {
						code: generateCode(data, 'typescript', options as TypeScriptOptions),
						error: '',
					};
				case 'javascript':
					return {
						code: generateCode(data, 'javascript', options as JavaScriptOptions),
						error: '',
					};
				case 'go':
					return { code: generateCode(data, 'go', options as GoOptions), error: '' };
				case 'python':
					return { code: generateCode(data, 'python', options as PythonOptions), error: '' };
				case 'rust':
					return { code: generateCode(data, 'rust', options as RustOptions), error: '' };
				case 'java':
					return { code: generateCode(data, 'java', options as JavaOptions), error: '' };
				case 'csharp':
					return { code: generateCode(data, 'csharp', options as CSharpOptions), error: '' };
				case 'kotlin':
					return { code: generateCode(data, 'kotlin', options as KotlinOptions), error: '' };
				case 'swift':
					return { code: generateCode(data, 'swift', options as SwiftOptions), error: '' };
				case 'php':
					return { code: generateCode(data, 'php', options as PhpOptions), error: '' };
			}
		} catch (e) {
			return { code: '', error: e instanceof Error ? e.message : 'Failed to generate code' };
		}
	})();

	const generateEditorMode = LANGUAGE_INFO[generateLanguage].editorMode;

	useEffect(() => {
		onStatsChange?.({
			input,
			valid: inputValidation.valid,
			error: generateError,
		});
	}, [input, inputValidation.valid, generateError, onStatsChange]);

	const { handlePaste, handleClear, handleCopy } = useClipboardActions({
		onInputChange,
		output: generatedCode,
	});

	return (
		<div className="flex flex-1 overflow-hidden">
			<OptionsPanel
				show={showOptions}
				onClose={() => setShowOptions(false)}
				onOpen={() => setShowOptions(true)}
			>
				<FormSection title="Target Language">
					<FormMode
						value={generateLanguage}
						onValueChange={setGenerateLanguage}
						options={LANGUAGE_OPTIONS.map((lang) => ({ value: lang.value, label: lang.label }))}
					/>
				</FormSection>

				{generateLanguage === 'typescript' ? (
					<FormSection title="TypeScript Options">
						<FormInput
							label="Root Type Name"
							value={tsRootName}
							onValueChange={setTsRootName}
							placeholder="Root"
							size="compact"
						/>
						<FormCheckboxGroup className="pt-1">
							<FormCheckbox
								label="Use interface (vs type)"
								checked={tsUseInterface}
								onCheckedChange={setTsUseInterface}
								size="compact"
							/>
							<FormCheckbox
								label="Export types"
								checked={tsUseExport}
								onCheckedChange={setTsUseExport}
								size="compact"
							/>
							<FormCheckbox
								label="Readonly properties"
								checked={tsUseReadonly}
								onCheckedChange={setTsUseReadonly}
								size="compact"
							/>
							<FormCheckbox
								label="Strict null checks"
								checked={tsStrictNullChecks}
								onCheckedChange={setTsStrictNullChecks}
								size="compact"
							/>
							<FormCheckbox
								label="Optional properties"
								checked={tsOptionalProperties}
								onCheckedChange={setTsOptionalProperties}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>
				) : null}

				{generateLanguage === 'javascript' ? (
					<FormSection title="JavaScript Options">
						<FormInput
							label="Root Type Name"
							value={jsRootName}
							onValueChange={setJsRootName}
							placeholder="Root"
							size="compact"
						/>
						<FormCheckboxGroup className="pt-1">
							<FormCheckbox
								label="Use ES6 class"
								checked={jsUseClass}
								onCheckedChange={setJsUseClass}
								size="compact"
							/>
							<FormCheckbox
								label="Generate JSDoc"
								checked={jsUseJSDoc}
								onCheckedChange={setJsUseJSDoc}
								size="compact"
							/>
							<FormCheckbox
								label="ES6 syntax"
								checked={jsUseES6}
								onCheckedChange={setJsUseES6}
								size="compact"
							/>
							<FormCheckbox
								label="Generate factory function"
								checked={jsGenerateFactory}
								onCheckedChange={setJsGenerateFactory}
								size="compact"
							/>
							<FormCheckbox
								label="Generate validator"
								checked={jsGenerateValidator}
								onCheckedChange={setJsGenerateValidator}
								size="compact"
							/>
							<FormCheckbox
								label="Optional properties"
								checked={jsOptionalProperties}
								onCheckedChange={setJsOptionalProperties}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>
				) : null}

				{generateLanguage === 'go' ? (
					<FormSection title="Go Options">
						<FormInput
							label="Root Type Name"
							value={goRootName}
							onValueChange={setGoRootName}
							placeholder="Root"
							size="compact"
						/>
						<FormCheckboxGroup className="pt-1">
							<FormCheckbox
								label="Use pointers for nested types"
								checked={goUsePointers}
								onCheckedChange={setGoUsePointers}
								size="compact"
							/>
							<FormCheckbox
								label="Add json tags"
								checked={goUseJsonTag}
								onCheckedChange={setGoUseJsonTag}
								size="compact"
							/>
							<FormCheckbox
								label="Add omitempty"
								checked={goOmitEmpty}
								onCheckedChange={setGoOmitEmpty}
								size="compact"
							/>
							<FormCheckbox
								label="Optional properties"
								checked={goOptionalProperties}
								onCheckedChange={setGoOptionalProperties}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>
				) : null}

				{generateLanguage === 'python' ? (
					<FormSection title="Python Options">
						<FormInput
							label="Root Type Name"
							value={pyRootName}
							onValueChange={setPyRootName}
							placeholder="Root"
							size="compact"
						/>
						<FormSelect
							label="Style"
							value={pyStyle}
							onValueChange={(v) => setPyStyle(v as PythonStyle)}
							options={PYTHON_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
							size="compact"
						/>
						{pyStyle === 'dataclass' ? (
							<FormCheckboxGroup className="pt-1">
								<FormCheckbox
									label="Frozen (immutable)"
									checked={pyUseFrozen}
									onCheckedChange={setPyUseFrozen}
									size="compact"
								/>
								<FormCheckbox
									label="Use __slots__"
									checked={pyUseSlots}
									onCheckedChange={setPyUseSlots}
									size="compact"
								/>
								<FormCheckbox
									label="Keyword-only args"
									checked={pyUseKwOnly}
									onCheckedChange={setPyUseKwOnly}
									size="compact"
								/>
							</FormCheckboxGroup>
						) : (
							<FormCheckboxGroup className="pt-1">
								<FormCheckbox
									label="Total (all keys required)"
									checked={pyUseTotal}
									onCheckedChange={setPyUseTotal}
									size="compact"
								/>
							</FormCheckboxGroup>
						)}
						<FormCheckbox
							label="Optional properties"
							checked={pyOptionalProperties}
							onCheckedChange={setPyOptionalProperties}
							size="compact"
						/>
					</FormSection>
				) : null}

				{generateLanguage === 'rust' ? (
					<FormSection title="Rust Options">
						<FormInput
							label="Root Type Name"
							value={rsRootName}
							onValueChange={setRsRootName}
							placeholder="Root"
							size="compact"
						/>
						<FormCheckboxGroup className="pt-1">
							<FormCheckbox
								label="Derive Serialize/Deserialize"
								checked={rsDeriveSerde}
								onCheckedChange={setRsDeriveSerde}
								size="compact"
							/>
							<FormCheckbox
								label="Derive Debug"
								checked={rsDeriveDebug}
								onCheckedChange={setRsDeriveDebug}
								size="compact"
							/>
							<FormCheckbox
								label="Derive Clone"
								checked={rsDeriveClone}
								onCheckedChange={setRsDeriveClone}
								size="compact"
							/>
							<FormCheckbox
								label="Derive Default"
								checked={rsDeriveDefault}
								onCheckedChange={setRsDeriveDefault}
								size="compact"
							/>
							<FormCheckbox
								label="Use Box for nested types"
								checked={rsUseBox}
								onCheckedChange={setRsUseBox}
								size="compact"
							/>
							<FormCheckbox
								label="Optional properties"
								checked={rsOptionalProperties}
								onCheckedChange={setRsOptionalProperties}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>
				) : null}

				{generateLanguage === 'java' ? (
					<FormSection title="Java Options">
						<FormInput
							label="Root Type Name"
							value={javaRootName}
							onValueChange={setJavaRootName}
							placeholder="Root"
							size="compact"
						/>
						<FormInput
							label="Package Name"
							value={javaPackageName}
							onValueChange={setJavaPackageName}
							placeholder="com.example"
							size="compact"
						/>
						<FormSelect
							label="Class Style"
							value={javaClassStyle}
							onValueChange={(v) => setJavaClassStyle(v as JavaClassStyle)}
							options={JAVA_CLASS_STYLE_OPTIONS.map((o) => ({
								value: o.value,
								label: o.label,
							}))}
							size="compact"
						/>
						<FormSelect
							label="Serialization"
							value={javaSerializationLibrary}
							onValueChange={(v) => setJavaSerializationLibrary(v as JavaSerialization)}
							options={JAVA_SERIALIZATION_OPTIONS.map((o) => ({
								value: o.value,
								label: o.label,
							}))}
							size="compact"
						/>
						<FormCheckboxGroup className="pt-1">
							<FormCheckbox
								label="Bean validation"
								checked={javaUseValidation}
								onCheckedChange={setJavaUseValidation}
								size="compact"
							/>
							{javaClassStyle === 'lombok' ? (
								<FormCheckbox
									label="Generate builder"
									checked={javaGenerateBuilder}
									onCheckedChange={setJavaGenerateBuilder}
									size="compact"
								/>
							) : null}
							{javaClassStyle === 'pojo' ? (
								<FormCheckbox
									label="Generate equals/hashCode"
									checked={javaGenerateEquals}
									onCheckedChange={setJavaGenerateEquals}
									size="compact"
								/>
							) : null}
							<FormCheckbox
								label="Use Optional for nullable"
								checked={javaUseOptional}
								onCheckedChange={setJavaUseOptional}
								size="compact"
							/>
							<FormCheckbox
								label="Optional properties"
								checked={javaOptionalProperties}
								onCheckedChange={setJavaOptionalProperties}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>
				) : null}

				{generateLanguage === 'csharp' ? (
					<FormSection title="C# Options">
						<FormInput
							label="Root Type Name"
							value={csRootName}
							onValueChange={setCsRootName}
							placeholder="Root"
							size="compact"
						/>
						<FormCheckboxGroup className="pt-1">
							<FormCheckbox
								label="Use records (vs class)"
								checked={csUseRecords}
								onCheckedChange={setCsUseRecords}
								size="compact"
							/>
							<FormCheckbox
								label="Nullable reference types"
								checked={csUseNullableReferenceTypes}
								onCheckedChange={setCsUseNullableReferenceTypes}
								size="compact"
							/>
							<FormCheckbox
								label="System.Text.Json attributes"
								checked={csUseSystemTextJson}
								onCheckedChange={setCsUseSystemTextJson}
								size="compact"
							/>
							<FormCheckbox
								label="Newtonsoft.Json attributes"
								checked={csUseNewtonsoft}
								onCheckedChange={setCsUseNewtonsoft}
								size="compact"
							/>
							<FormCheckbox
								label="DataContract attributes"
								checked={csGenerateDataContract}
								onCheckedChange={setCsGenerateDataContract}
								size="compact"
							/>
							<FormCheckbox
								label="Optional properties"
								checked={csOptionalProperties}
								onCheckedChange={setCsOptionalProperties}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>
				) : null}

				{generateLanguage === 'kotlin' ? (
					<FormSection title="Kotlin Options">
						<FormInput
							label="Root Type Name"
							value={ktRootName}
							onValueChange={setKtRootName}
							placeholder="Root"
							size="compact"
						/>
						<FormSelect
							label="Serialization"
							value={ktSerializationLibrary}
							onValueChange={(v) => setKtSerializationLibrary(v as KotlinSerialization)}
							options={KOTLIN_SERIALIZATION_OPTIONS.map((o) => ({
								value: o.value,
								label: o.label,
							}))}
							size="compact"
						/>
						<FormCheckboxGroup className="pt-1">
							<FormCheckbox
								label="Use data class"
								checked={ktUseDataClass}
								onCheckedChange={setKtUseDataClass}
								size="compact"
							/>
							<FormCheckbox
								label="Default values"
								checked={ktUseDefaultValues}
								onCheckedChange={setKtUseDefaultValues}
								size="compact"
							/>
							<FormCheckbox
								label="Optional properties"
								checked={ktOptionalProperties}
								onCheckedChange={setKtOptionalProperties}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>
				) : null}

				{generateLanguage === 'swift' ? (
					<FormSection title="Swift Options">
						<FormInput
							label="Root Type Name"
							value={swiftRootName}
							onValueChange={setSwiftRootName}
							placeholder="Root"
							size="compact"
						/>
						<FormCheckboxGroup className="pt-1">
							<FormCheckbox
								label="Use struct (vs class)"
								checked={swiftUseStruct}
								onCheckedChange={setSwiftUseStruct}
								size="compact"
							/>
							<FormCheckbox
								label="Generate CodingKeys"
								checked={swiftUseCodingKeys}
								onCheckedChange={setSwiftUseCodingKeys}
								size="compact"
							/>
							<FormCheckbox
								label="Optional properties"
								checked={swiftUseOptionalProperties}
								onCheckedChange={setSwiftUseOptionalProperties}
								size="compact"
							/>
							<FormCheckbox
								label="All properties optional"
								checked={swiftOptionalProperties}
								onCheckedChange={setSwiftOptionalProperties}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>
				) : null}

				{generateLanguage === 'php' ? (
					<FormSection title="PHP Options">
						<FormInput
							label="Root Type Name"
							value={phpRootName}
							onValueChange={setPhpRootName}
							placeholder="Root"
							size="compact"
						/>
						<FormInput
							label="Namespace"
							value={phpNamespace}
							onValueChange={setPhpNamespace}
							placeholder="App\\Models"
							size="compact"
						/>
						<FormCheckboxGroup className="pt-1">
							<FormCheckbox
								label="Strict types"
								checked={phpUseStrictTypes}
								onCheckedChange={setPhpUseStrictTypes}
								size="compact"
							/>
							<FormCheckbox
								label="Constructor promotion"
								checked={phpUseConstructorPromotion}
								onCheckedChange={setPhpUseConstructorPromotion}
								size="compact"
							/>
							<FormCheckbox
								label="Readonly properties"
								checked={phpUseReadonlyProperties}
								onCheckedChange={setPhpUseReadonlyProperties}
								size="compact"
							/>
							<FormCheckbox
								label="Optional properties"
								checked={phpOptionalProperties}
								onCheckedChange={setPhpOptionalProperties}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>
				) : null}
			</OptionsPanel>

			<InputOutputSplit
				className="flex-1"
				input={input}
				onInputChange={onInputChange}
				editorMode="yaml"
				inputTitle="Input YAML"
				inputPlaceholder="Enter YAML here..."
				onPaste={handlePaste}
				onClear={handleClear}
				output={generatedCode}
				outputEditorMode={generateEditorMode}
				outputTitle={`Generated Code (${LANGUAGE_INFO[generateLanguage].label})`}
				outputPlaceholder="Generated code will appear here..."
				onCopy={handleCopy}
				emptyIcon={Code}
				emptyTitle="Enter YAML to generate code"
				emptyDescription={`The ${LANGUAGE_INFO[generateLanguage].label} class definitions will appear here.`}
			/>
		</div>
	);
}

export type { GenerateTabProps };
