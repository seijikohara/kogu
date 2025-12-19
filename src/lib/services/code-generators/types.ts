import type { EditorMode } from '$lib/components/editor';

export type { EditorMode };

// ============================================================================
// Core Types
// ============================================================================

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export interface TypeInfo {
	name: string;
	isArray: boolean;
	isObject: boolean;
	isPrimitive: boolean;
	children?: Record<string, TypeInfo>;
	arrayItemType?: TypeInfo;
}

// ============================================================================
// Base Options
// ============================================================================

export interface BaseGeneratorOptions {
	rootName: string;
	optionalProperties: boolean;
}

// ============================================================================
// Language-Specific Options
// ============================================================================

export interface TypeScriptOptions extends BaseGeneratorOptions {
	useInterface: boolean;
	useExport: boolean;
	useReadonly: boolean;
	strictNullChecks: boolean;
}

export interface JavaScriptOptions extends BaseGeneratorOptions {
	useClass: boolean;
	useJSDoc: boolean;
	useES6: boolean;
	generateFactory: boolean;
	generateValidator: boolean;
}

export interface GoOptions extends BaseGeneratorOptions {
	usePointers: boolean;
	omitEmpty: boolean;
	useJsonTag: boolean;
}

export type PythonStyle = 'dataclass' | 'typeddict';

export interface PythonOptions extends BaseGeneratorOptions {
	style: PythonStyle;
	useFrozen: boolean;
	useSlots: boolean;
	useKwOnly: boolean;
	useTotal: boolean;
}

export interface RustOptions extends BaseGeneratorOptions {
	deriveSerde: boolean;
	deriveDebug: boolean;
	deriveClone: boolean;
	deriveDefault: boolean;
	useBox: boolean;
}

export type JavaSerializationLibrary = 'none' | 'jackson' | 'gson' | 'moshi';
export type JavaClassStyle = 'record' | 'pojo' | 'lombok' | 'immutables';

export interface JavaOptions extends BaseGeneratorOptions {
	packageName: string;
	classStyle: JavaClassStyle;
	serializationLibrary: JavaSerializationLibrary;
	useValidation: boolean;
	generateBuilder: boolean;
	generateEquals: boolean;
	useOptional: boolean;
}

export interface CSharpOptions extends BaseGeneratorOptions {
	useRecords: boolean;
	useNullableReferenceTypes: boolean;
	useSystemTextJson: boolean;
	useNewtonsoft: boolean;
	generateDataContract: boolean;
}

export type KotlinSerializationLibrary = 'none' | 'kotlinx' | 'gson' | 'moshi' | 'jackson';

export interface KotlinOptions extends BaseGeneratorOptions {
	useDataClass: boolean;
	serializationLibrary: KotlinSerializationLibrary;
	useDefaultValues: boolean;
}

export interface SwiftOptions extends BaseGeneratorOptions {
	useStruct: boolean;
	useCodingKeys: boolean;
	useOptionalProperties: boolean;
}

export interface PhpOptions extends BaseGeneratorOptions {
	useStrictTypes: boolean;
	useReadonlyProperties: boolean;
	useConstructorPromotion: boolean;
	namespace: string;
}

// ============================================================================
// Language Union Types
// ============================================================================

export type LanguageOptions =
	| { language: 'typescript'; options: TypeScriptOptions }
	| { language: 'javascript'; options: JavaScriptOptions }
	| { language: 'go'; options: GoOptions }
	| { language: 'python'; options: PythonOptions }
	| { language: 'rust'; options: RustOptions }
	| { language: 'java'; options: JavaOptions }
	| { language: 'csharp'; options: CSharpOptions }
	| { language: 'kotlin'; options: KotlinOptions }
	| { language: 'swift'; options: SwiftOptions }
	| { language: 'php'; options: PhpOptions };

export type TargetLanguage = LanguageOptions['language'];

// ============================================================================
// Language Metadata
// ============================================================================

export interface LanguageInfo {
	value: TargetLanguage;
	label: string;
	extension: string;
	editorMode: EditorMode;
}

export interface CodeGenerator<T extends BaseGeneratorOptions> {
	generate(data: unknown, options: T): string;
	getDefaultOptions(): T;
}

// ============================================================================
// Constants
// ============================================================================

export const LANGUAGE_INFO = {
	typescript: {
		value: 'typescript',
		label: 'TypeScript',
		extension: 'ts',
		editorMode: 'typescript',
	},
	javascript: {
		value: 'javascript',
		label: 'JavaScript',
		extension: 'js',
		editorMode: 'javascript',
	},
	go: { value: 'go', label: 'Go', extension: 'go', editorMode: 'go' },
	python: { value: 'python', label: 'Python', extension: 'py', editorMode: 'python' },
	rust: { value: 'rust', label: 'Rust', extension: 'rs', editorMode: 'rust' },
	java: { value: 'java', label: 'Java', extension: 'java', editorMode: 'java' },
	csharp: { value: 'csharp', label: 'C#', extension: 'cs', editorMode: 'csharp' },
	kotlin: { value: 'kotlin', label: 'Kotlin', extension: 'kt', editorMode: 'kotlin' },
	swift: { value: 'swift', label: 'Swift', extension: 'swift', editorMode: 'swift' },
	php: { value: 'php', label: 'PHP', extension: 'php', editorMode: 'php' },
} as const satisfies Record<TargetLanguage, LanguageInfo>;

export const LANGUAGE_OPTIONS: readonly LanguageInfo[] = Object.values(LANGUAGE_INFO);

export const PYTHON_STYLE_OPTIONS = [
	{ value: 'dataclass', label: 'dataclass', description: '@dataclass decorator' },
	{ value: 'typeddict', label: 'TypedDict', description: 'TypedDict class' },
] as const satisfies ReadonlyArray<{ value: PythonStyle; label: string; description: string }>;

export const JAVA_CLASS_STYLE_OPTIONS = [
	{ value: 'record', label: 'Record (Java 16+)', description: 'Immutable data class' },
	{ value: 'pojo', label: 'POJO', description: 'Traditional JavaBean' },
	{ value: 'lombok', label: 'Lombok', description: 'With @Data annotation' },
	{ value: 'immutables', label: 'Immutables', description: 'With @Value.Immutable' },
] as const satisfies ReadonlyArray<{ value: JavaClassStyle; label: string; description: string }>;

export const JAVA_SERIALIZATION_OPTIONS = [
	{ value: 'none', label: 'None', description: 'No serialization annotations' },
	{ value: 'jackson', label: 'Jackson', description: '@JsonProperty annotations' },
	{ value: 'gson', label: 'Gson', description: '@SerializedName annotations' },
	{ value: 'moshi', label: 'Moshi', description: '@Json annotations' },
] as const satisfies ReadonlyArray<{
	value: JavaSerializationLibrary;
	label: string;
	description: string;
}>;

export const KOTLIN_SERIALIZATION_OPTIONS = [
	{ value: 'none', label: 'None', description: 'No serialization annotations' },
	{ value: 'kotlinx', label: 'Kotlinx Serialization', description: '@Serializable annotations' },
	{ value: 'gson', label: 'Gson', description: '@SerializedName annotations' },
	{ value: 'moshi', label: 'Moshi', description: '@Json annotations' },
	{ value: 'jackson', label: 'Jackson', description: '@JsonProperty annotations' },
] as const satisfies ReadonlyArray<{
	value: KotlinSerializationLibrary;
	label: string;
	description: string;
}>;
