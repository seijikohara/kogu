// ============================================================================
// Re-exports
// ============================================================================

export { csharpGenerator, defaultCSharpOptions } from './csharp.js';
export { defaultGoOptions, goGenerator } from './go.js';
export { defaultJavaOptions, javaGenerator } from './java.js';
export { defaultJavaScriptOptions, javaScriptGenerator } from './javascript.js';
export { defaultKotlinOptions, kotlinGenerator } from './kotlin.js';
export { defaultPhpOptions, phpGenerator } from './php.js';
export { defaultPythonOptions, pythonGenerator } from './python.js';
export { defaultRustOptions, rustGenerator } from './rust.js';
export { defaultSwiftOptions, swiftGenerator } from './swift.js';
export * from './types.js';
export { defaultTypeScriptOptions, typeScriptGenerator } from './typescript.js';
export * from './utils.js';

// ============================================================================
// Imports
// ============================================================================

import { csharpGenerator, defaultCSharpOptions } from './csharp.js';
import { defaultGoOptions, goGenerator } from './go.js';
import { defaultJavaOptions, javaGenerator } from './java.js';
import { defaultJavaScriptOptions, javaScriptGenerator } from './javascript.js';
import { defaultKotlinOptions, kotlinGenerator } from './kotlin.js';
import { defaultPhpOptions, phpGenerator } from './php.js';
import { defaultPythonOptions, pythonGenerator } from './python.js';
import { defaultRustOptions, rustGenerator } from './rust.js';
import { defaultSwiftOptions, swiftGenerator } from './swift.js';
import type {
	CodeGenerator,
	CSharpOptions,
	GoOptions,
	JavaOptions,
	JavaScriptOptions,
	KotlinOptions,
	PhpOptions,
	PythonOptions,
	RustOptions,
	SwiftOptions,
	TargetLanguage,
	TypeScriptOptions,
} from './types.js';
import { defaultTypeScriptOptions, typeScriptGenerator } from './typescript.js';

// ============================================================================
// Types
// ============================================================================

export type AllLanguageOptions =
	| TypeScriptOptions
	| JavaScriptOptions
	| GoOptions
	| PythonOptions
	| RustOptions
	| JavaOptions
	| CSharpOptions
	| KotlinOptions
	| SwiftOptions
	| PhpOptions;

export type LanguageConfig =
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

export type OptionsForLanguage<L extends TargetLanguage> = Extract<
	LanguageConfig,
	{ language: L }
>['options'];

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS_MAP = {
	typescript: () => ({ ...defaultTypeScriptOptions }),
	javascript: () => ({ ...defaultJavaScriptOptions }),
	go: () => ({ ...defaultGoOptions }),
	python: () => ({ ...defaultPythonOptions }),
	rust: () => ({ ...defaultRustOptions }),
	java: () => ({ ...defaultJavaOptions }),
	csharp: () => ({ ...defaultCSharpOptions }),
	kotlin: () => ({ ...defaultKotlinOptions }),
	swift: () => ({ ...defaultSwiftOptions }),
	php: () => ({ ...defaultPhpOptions }),
} as const satisfies Record<TargetLanguage, () => AllLanguageOptions>;

const GENERATOR_MAP = {
	typescript: typeScriptGenerator as CodeGenerator<AllLanguageOptions>,
	javascript: javaScriptGenerator as CodeGenerator<AllLanguageOptions>,
	go: goGenerator as CodeGenerator<AllLanguageOptions>,
	python: pythonGenerator as CodeGenerator<AllLanguageOptions>,
	rust: rustGenerator as CodeGenerator<AllLanguageOptions>,
	java: javaGenerator as CodeGenerator<AllLanguageOptions>,
	csharp: csharpGenerator as CodeGenerator<AllLanguageOptions>,
	kotlin: kotlinGenerator as CodeGenerator<AllLanguageOptions>,
	swift: swiftGenerator as CodeGenerator<AllLanguageOptions>,
	php: phpGenerator as CodeGenerator<AllLanguageOptions>,
} as const satisfies Record<TargetLanguage, CodeGenerator<AllLanguageOptions>>;

// ============================================================================
// Public API
// ============================================================================

export function getDefaultOptions(language: 'typescript'): TypeScriptOptions;
export function getDefaultOptions(language: 'javascript'): JavaScriptOptions;
export function getDefaultOptions(language: 'go'): GoOptions;
export function getDefaultOptions(language: 'python'): PythonOptions;
export function getDefaultOptions(language: 'rust'): RustOptions;
export function getDefaultOptions(language: 'java'): JavaOptions;
export function getDefaultOptions(language: 'csharp'): CSharpOptions;
export function getDefaultOptions(language: 'kotlin'): KotlinOptions;
export function getDefaultOptions(language: 'swift'): SwiftOptions;
export function getDefaultOptions(language: 'php'): PhpOptions;
export function getDefaultOptions(language: TargetLanguage): AllLanguageOptions;
export function getDefaultOptions(language: TargetLanguage): AllLanguageOptions {
	return DEFAULT_OPTIONS_MAP[language]();
}

export function generateCode(
	data: unknown,
	language: 'typescript',
	options: TypeScriptOptions
): string;
export function generateCode(
	data: unknown,
	language: 'javascript',
	options: JavaScriptOptions
): string;
export function generateCode(data: unknown, language: 'go', options: GoOptions): string;
export function generateCode(data: unknown, language: 'python', options: PythonOptions): string;
export function generateCode(data: unknown, language: 'rust', options: RustOptions): string;
export function generateCode(data: unknown, language: 'java', options: JavaOptions): string;
export function generateCode(data: unknown, language: 'csharp', options: CSharpOptions): string;
export function generateCode(data: unknown, language: 'kotlin', options: KotlinOptions): string;
export function generateCode(data: unknown, language: 'swift', options: SwiftOptions): string;
export function generateCode(data: unknown, language: 'php', options: PhpOptions): string;
export function generateCode(
	data: unknown,
	language: TargetLanguage,
	options: AllLanguageOptions
): string;
export function generateCode(
	data: unknown,
	language: TargetLanguage,
	options: AllLanguageOptions
): string {
	return GENERATOR_MAP[language].generate(data, options);
}

export const downloadCodeAsFile = (code: string, rootName: string, extension: string): void => {
	if (!code) return;

	const blob = new Blob([code], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const link = Object.assign(document.createElement('a'), {
		href: url,
		download: `${rootName.toLowerCase()}.${extension}`,
	});
	link.click();
	URL.revokeObjectURL(url);
};
