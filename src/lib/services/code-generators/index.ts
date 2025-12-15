// ============================================================================
// Re-exports
// ============================================================================

export * from './types.js';
export * from './utils.js';

export { typeScriptGenerator, defaultTypeScriptOptions } from './typescript.js';
export { javaScriptGenerator, defaultJavaScriptOptions } from './javascript.js';
export { goGenerator, defaultGoOptions } from './go.js';
export { pythonGenerator, defaultPythonOptions } from './python.js';
export { rustGenerator, defaultRustOptions } from './rust.js';
export { javaGenerator, defaultJavaOptions } from './java.js';
export { csharpGenerator, defaultCSharpOptions } from './csharp.js';
export { kotlinGenerator, defaultKotlinOptions } from './kotlin.js';
export { swiftGenerator, defaultSwiftOptions } from './swift.js';
export { phpGenerator, defaultPhpOptions } from './php.js';

// ============================================================================
// Imports
// ============================================================================

import type {
	TargetLanguage,
	TypeScriptOptions,
	JavaScriptOptions,
	GoOptions,
	PythonOptions,
	RustOptions,
	JavaOptions,
	CSharpOptions,
	KotlinOptions,
	SwiftOptions,
	PhpOptions,
	CodeGenerator,
} from './types.js';

import { typeScriptGenerator, defaultTypeScriptOptions } from './typescript.js';
import { javaScriptGenerator, defaultJavaScriptOptions } from './javascript.js';
import { goGenerator, defaultGoOptions } from './go.js';
import { pythonGenerator, defaultPythonOptions } from './python.js';
import { rustGenerator, defaultRustOptions } from './rust.js';
import { javaGenerator, defaultJavaOptions } from './java.js';
import { csharpGenerator, defaultCSharpOptions } from './csharp.js';
import { kotlinGenerator, defaultKotlinOptions } from './kotlin.js';
import { swiftGenerator, defaultSwiftOptions } from './swift.js';
import { phpGenerator, defaultPhpOptions } from './php.js';

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
