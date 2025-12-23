/**
 * String case conversion utilities.
 * Provides pure functions for converting between various case formats.
 */

// Types
export type CaseType =
	| 'lowercase'
	| 'uppercase'
	| 'capitalize'
	| 'titleCase'
	| 'sentenceCase'
	| 'camelCase'
	| 'pascalCase'
	| 'snakeCase'
	| 'kebabCase'
	| 'constantCase'
	| 'dotCase'
	| 'pathCase'
	| 'trainCase'
	| 'cobolCase'
	| 'invertCase'
	| 'alternatingCase'
	| 'spongeCase';

export interface CaseInfo {
	readonly type: CaseType;
	readonly label: string;
	readonly description: string;
	readonly example: string;
}

export interface CaseResult {
	readonly type: CaseType;
	readonly label: string;
	readonly value: string;
}

// Constants
export const CASE_DEFINITIONS: readonly CaseInfo[] = [
	{
		type: 'lowercase',
		label: 'lowercase',
		description: 'All characters in lower case',
		example: 'hello world',
	},
	{
		type: 'uppercase',
		label: 'UPPERCASE',
		description: 'All characters in upper case',
		example: 'HELLO WORLD',
	},
	{
		type: 'capitalize',
		label: 'Capitalize',
		description: 'First character capitalized',
		example: 'Hello world',
	},
	{
		type: 'titleCase',
		label: 'Title Case',
		description: 'First letter of each word capitalized',
		example: 'Hello World',
	},
	{
		type: 'sentenceCase',
		label: 'Sentence case',
		description: 'First letter of sentence capitalized',
		example: 'Hello world. This is a test.',
	},
	{
		type: 'camelCase',
		label: 'camelCase',
		description: 'First word lowercase, subsequent words capitalized',
		example: 'helloWorld',
	},
	{
		type: 'pascalCase',
		label: 'PascalCase',
		description: 'All words capitalized, no separator',
		example: 'HelloWorld',
	},
	{
		type: 'snakeCase',
		label: 'snake_case',
		description: 'Words separated by underscores, lowercase',
		example: 'hello_world',
	},
	{
		type: 'kebabCase',
		label: 'kebab-case',
		description: 'Words separated by hyphens, lowercase',
		example: 'hello-world',
	},
	{
		type: 'constantCase',
		label: 'CONSTANT_CASE',
		description: 'Words separated by underscores, uppercase',
		example: 'HELLO_WORLD',
	},
	{
		type: 'dotCase',
		label: 'dot.case',
		description: 'Words separated by dots, lowercase',
		example: 'hello.world',
	},
	{
		type: 'pathCase',
		label: 'path/case',
		description: 'Words separated by forward slashes',
		example: 'hello/world',
	},
	{
		type: 'trainCase',
		label: 'Train-Case',
		description: 'Words capitalized and separated by hyphens',
		example: 'Hello-World',
	},
	{
		type: 'cobolCase',
		label: 'COBOL-CASE',
		description: 'Words uppercase and separated by hyphens',
		example: 'HELLO-WORLD',
	},
	{
		type: 'invertCase',
		label: 'iNVERT cASE',
		description: 'Swap upper and lower case',
		example: 'hELLO wORLD',
	},
	{
		type: 'alternatingCase',
		label: 'aLtErNaTiNg',
		description: 'Alternating lower and upper case',
		example: 'hElLo WoRlD',
	},
	{
		type: 'spongeCase',
		label: 'SpOnGe CaSe',
		description: 'Random-like alternating case (mocking SpongeBob)',
		example: 'hElLo WoRlD',
	},
] as const;

// Sample text for demonstration
export const SAMPLE_TEXT_FOR_CASE = 'The quick brown fox jumps over the lazy dog';

// Pure helper functions

/**
 * Split text into words, handling various separators and case boundaries.
 */
const splitIntoWords = (text: string): readonly string[] => {
	if (!text.trim()) return [];

	return (
		text
			// Insert space before uppercase letters (for camelCase/PascalCase)
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			// Insert space before sequences of uppercase followed by lowercase (for abbreviations)
			.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
			// Replace separators with spaces
			.replace(/[_\-./\\]+/g, ' ')
			// Split on whitespace and filter empty strings
			.split(/\s+/)
			.filter((word) => word.length > 0)
	);
};

/**
 * Capitalize first letter of a word.
 */
const capitalizeWord = (word: string): string =>
	word.length === 0 ? '' : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/**
 * Join words with separator.
 */
const joinWords = (words: readonly string[], separator: string): string => words.join(separator);

/**
 * Process text line by line, applying a conversion function to each line.
 */
const processLineByLine = (text: string, converter: (line: string) => string): string =>
	text.split('\n').map(converter).join('\n');

// Case conversion functions

export const toLowerCase = (text: string): string => text.toLowerCase();

export const toUpperCase = (text: string): string => text.toUpperCase();

export const toCapitalize = (text: string): string =>
	processLineByLine(text, (line) =>
		line.length === 0 ? '' : line.charAt(0).toUpperCase() + line.slice(1).toLowerCase()
	);

export const toTitleCase = (text: string): string =>
	processLineByLine(text, (line) =>
		line
			.toLowerCase()
			.split(/[ \t]+/)
			.map((word) => capitalizeWord(word))
			.join(' ')
	);

export const toSentenceCase = (text: string): string =>
	processLineByLine(text, (line) =>
		line.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (match) => match.toUpperCase())
	);

export const toCamelCase = (text: string): string =>
	processLineByLine(text, (line) => {
		const words = splitIntoWords(line);
		const first = words[0];
		if (!first) return '';
		const rest = words.slice(1);
		return first.toLowerCase() + rest.map((w) => capitalizeWord(w)).join('');
	});

export const toPascalCase = (text: string): string =>
	processLineByLine(text, (line) =>
		splitIntoWords(line)
			.map((word) => capitalizeWord(word))
			.join('')
	);

export const toSnakeCase = (text: string): string =>
	processLineByLine(text, (line) =>
		joinWords(
			splitIntoWords(line).map((w) => w.toLowerCase()),
			'_'
		)
	);

export const toKebabCase = (text: string): string =>
	processLineByLine(text, (line) =>
		joinWords(
			splitIntoWords(line).map((w) => w.toLowerCase()),
			'-'
		)
	);

export const toConstantCase = (text: string): string =>
	processLineByLine(text, (line) =>
		joinWords(
			splitIntoWords(line).map((w) => w.toUpperCase()),
			'_'
		)
	);

export const toDotCase = (text: string): string =>
	processLineByLine(text, (line) =>
		joinWords(
			splitIntoWords(line).map((w) => w.toLowerCase()),
			'.'
		)
	);

export const toPathCase = (text: string): string =>
	processLineByLine(text, (line) =>
		joinWords(
			splitIntoWords(line).map((w) => w.toLowerCase()),
			'/'
		)
	);

export const toTrainCase = (text: string): string =>
	processLineByLine(text, (line) =>
		joinWords(
			splitIntoWords(line).map((w) => capitalizeWord(w)),
			'-'
		)
	);

export const toCobolCase = (text: string): string =>
	processLineByLine(text, (line) =>
		joinWords(
			splitIntoWords(line).map((w) => w.toUpperCase()),
			'-'
		)
	);

export const toInvertCase = (text: string): string =>
	text
		.split('')
		.map((char) => {
			if (char === char.toUpperCase()) return char.toLowerCase();
			if (char === char.toLowerCase()) return char.toUpperCase();
			return char;
		})
		.join('');

export const toAlternatingCase = (text: string): string => {
	let index = 0;
	return text
		.split('')
		.map((char) => {
			if (/[a-zA-Z]/.test(char)) {
				const result = index % 2 === 0 ? char.toLowerCase() : char.toUpperCase();
				index++;
				return result;
			}
			return char;
		})
		.join('');
};

export const toSpongeCase = (text: string): string => {
	// Use a seeded pseudo-random approach for consistency
	let seed = text.length;
	const pseudoRandom = (): boolean => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed % 2 === 0;
	};

	return text
		.split('')
		.map((char) => {
			if (/[a-zA-Z]/.test(char)) {
				return pseudoRandom() ? char.toUpperCase() : char.toLowerCase();
			}
			return char;
		})
		.join('');
};

// Converter map
const CASE_CONVERTERS: Record<CaseType, (text: string) => string> = {
	lowercase: toLowerCase,
	uppercase: toUpperCase,
	capitalize: toCapitalize,
	titleCase: toTitleCase,
	sentenceCase: toSentenceCase,
	camelCase: toCamelCase,
	pascalCase: toPascalCase,
	snakeCase: toSnakeCase,
	kebabCase: toKebabCase,
	constantCase: toConstantCase,
	dotCase: toDotCase,
	pathCase: toPathCase,
	trainCase: toTrainCase,
	cobolCase: toCobolCase,
	invertCase: toInvertCase,
	alternatingCase: toAlternatingCase,
	spongeCase: toSpongeCase,
};

/**
 * Convert text to specified case.
 */
export const convertCase = (text: string, caseType: CaseType): string => {
	const converter = CASE_CONVERTERS[caseType];
	return converter(text);
};

/**
 * Convert text to all cases.
 */
export const convertToAllCases = (text: string): readonly CaseResult[] =>
	CASE_DEFINITIONS.map((def) => ({
		type: def.type,
		label: def.label,
		value: convertCase(text, def.type),
	}));

/**
 * Get statistics for input text.
 */
export interface TextStats {
	readonly chars: number;
	readonly words: number;
	readonly lines: number;
}

export const getTextStats = (text: string): TextStats => ({
	chars: text.length,
	words: text.trim() ? text.trim().split(/\s+/).length : 0,
	lines: text ? text.split('\n').length : 0,
});
