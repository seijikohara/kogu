import type { CodeGenerator, JavaScriptOptions, JsonValue, TypeInfo } from './types.js';
import { generateWithNestedTypes, inferType, toCamelCase } from './utils.js';

// ============================================================================
// Constants
// ============================================================================

export const defaultJavaScriptOptions = {
	rootName: 'Root',
	optionalProperties: false,
	useClass: true,
	useJSDoc: true,
	useES6: true,
	generateFactory: false,
	generateValidator: false,
} as const satisfies JavaScriptOptions;

const JSDOC_TYPE_MAP: Record<string, string> = {
	string: 'string',
	number: 'number',
	boolean: 'boolean',
	null: 'null',
};

const DEFAULT_VALUE_MAP: Record<string, string> = {
	string: "''",
	number: '0',
	boolean: 'false',
};

const VALIDATOR_TYPE_MAP: Record<string, (prop: string) => string> = {
	string: (prop) => `  if (typeof obj.${prop} !== 'string') return false;`,
	number: (prop) => `  if (typeof obj.${prop} !== 'number') return false;`,
	boolean: (prop) => `  if (typeof obj.${prop} !== 'boolean') return false;`,
};

// ============================================================================
// JSDoc Type Resolution
// ============================================================================

const resolveJSDocType = (typeInfo: TypeInfo): string => {
	if (typeInfo.isArray && typeInfo.arrayItemType) {
		return `Array<${resolveJSDocType(typeInfo.arrayItemType)}>`;
	}
	if (typeInfo.isObject) return typeInfo.name;
	return JSDOC_TYPE_MAP[typeInfo.name] ?? '*';
};

const getDefaultValue = (typeInfo: TypeInfo): string => {
	if (typeInfo.isArray) return '[]';
	if (typeInfo.isObject) return 'null';
	return DEFAULT_VALUE_MAP[typeInfo.name] ?? 'null';
};

// ============================================================================
// JSDoc Generation
// ============================================================================

const generateClassJSDoc = (name: string, entries: [string, TypeInfo][]): string[] => [
	'/**',
	` * @class ${name}`,
	...entries.map(
		([key, childType]) => ` * @property {${resolveJSDocType(childType)}} ${toCamelCase(key)}`
	),
	' */',
];

const generateTypedefJSDoc = (name: string, entries: [string, TypeInfo][]): string[] => [
	'/**',
	` * @typedef {Object} ${name}`,
	...entries.map(
		([key, childType]) => ` * @property {${resolveJSDocType(childType)}} ${toCamelCase(key)}`
	),
	' */',
];

// ============================================================================
// Validator Generation
// ============================================================================

const generateValidatorCheck = (key: string, childType: TypeInfo): string => {
	const propName = toCamelCase(key);

	if (childType.isArray) {
		return `  if (!Array.isArray(obj.${propName})) return false;`;
	}
	if (childType.isObject) {
		return `  if (typeof obj.${propName} !== 'object' || obj.${propName} === null) return false;`;
	}

	return VALIDATOR_TYPE_MAP[childType.name]?.(propName) ?? '';
};

const generateValidatorDoc = (name: string): string => `/**
 * Validate a ${name} object
 * @param {Object} obj
 * @returns {boolean}
 */
`;

const generateValidator = (
	name: string,
	entries: [string, TypeInfo][],
	useJSDoc: boolean
): string => {
	const validatorDoc = useJSDoc ? generateValidatorDoc(name) : '';
	const checks = entries
		.map(([key, childType]) => generateValidatorCheck(key, childType))
		.filter(Boolean)
		.join('\n');

	return `${validatorDoc}function is${name}(obj) {
  if (typeof obj !== 'object' || obj === null) return false;
${checks}
  return true;
}`;
};

// ============================================================================
// Class Generation
// ============================================================================

const generateFactoryDoc = (name: string): string => `/**
 * Create a new ${name} instance
 * @returns {${name}}
 */
`;

const generateClassDefinition = (typeInfo: TypeInfo, options: JavaScriptOptions): string[] => {
	if (!typeInfo.isObject || !typeInfo.children) return [];

	const entries = Object.entries(typeInfo.children);
	const { name } = typeInfo;

	const jsDoc = options.useJSDoc ? `${generateClassJSDoc(name, entries).join('\n')}\n` : '';
	const params = entries.map(([key]) => toCamelCase(key)).join(', ');
	const body = entries
		.map(([key]) => `    this.${toCamelCase(key)} = ${toCamelCase(key)};`)
		.join('\n');

	const classBody = options.useES6
		? `class ${name} {\n  constructor(${params}) {\n${body}\n  }\n}`
		: `function ${name}(${params}) {\n${body}\n}`;

	const factory = options.generateFactory
		? `${options.useJSDoc ? generateFactoryDoc(name) : ''}function create${name}(${params}) {\n  return new ${name}(${params});\n}`
		: null;

	const validator = options.generateValidator
		? generateValidator(name, entries, options.useJSDoc)
		: null;

	return [`${jsDoc}${classBody}`, factory, validator].filter((x): x is string => x !== null);
};

// ============================================================================
// Object Literal Generation
// ============================================================================

const generateObjectLiteral = (typeInfo: TypeInfo, options: JavaScriptOptions): string => {
	if (!typeInfo.isObject || !typeInfo.children) return '';

	const entries = Object.entries(typeInfo.children);
	const { name } = typeInfo;

	const jsDoc = options.useJSDoc
		? `${generateTypedefJSDoc(name, entries).join('\n')}
`
		: '';

	const props = entries
		.map(([key, childType]) => `  ${toCamelCase(key)}: ${getDefaultValue(childType)},`)
		.join('\n');

	const constKeyword = options.useES6 ? 'const' : 'var';
	return `${jsDoc}${constKeyword} ${name.toLowerCase()}Template = {
${props}
};`;
};

// ============================================================================
// Generator Export
// ============================================================================

const generateSingleType = (typeInfo: TypeInfo, options: JavaScriptOptions): string[] => {
	if (options.useClass) {
		return generateClassDefinition(typeInfo, options);
	}
	const literal = generateObjectLiteral(typeInfo, options);
	return literal ? [literal] : [];
};

export const javaScriptGenerator: CodeGenerator<JavaScriptOptions> = {
	generate(data: unknown, options: JavaScriptOptions): string {
		return generateWithNestedTypes(inferType(data as JsonValue, options.rootName), (typeInfo) =>
			generateSingleType(typeInfo, options)
		)
			.flat()
			.join('\n\n');
	},

	getDefaultOptions: () => ({ ...defaultJavaScriptOptions }),
};
