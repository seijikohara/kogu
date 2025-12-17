import type { CodeGenerator, JsonValue, TypeInfo, TypeScriptOptions } from './types.js';
import { generateWithNestedTypes, inferType } from './utils.js';

// ============================================================================
// Constants
// ============================================================================

export const defaultTypeScriptOptions = {
	rootName: 'Root',
	optionalProperties: false,
	useInterface: true,
	useExport: true,
	useReadonly: false,
	strictNullChecks: true,
} as const satisfies TypeScriptOptions;

const PRIMITIVE_TYPE_MAP: Record<string, string> = {
	string: 'string',
	number: 'number',
	boolean: 'boolean',
};

// ============================================================================
// Type Resolution
// ============================================================================

const resolveType = (typeInfo: TypeInfo, options: TypeScriptOptions): string => {
	// Early return: array type
	if (typeInfo.isArray && typeInfo.arrayItemType) {
		return `${resolveType(typeInfo.arrayItemType, options)}[]`;
	}

	// Early return: object type
	if (typeInfo.isObject) return typeInfo.name;

	// Early return: null handling
	if (typeInfo.name === 'null') {
		return options.strictNullChecks ? 'null' : 'any';
	}

	// Primitive types
	return PRIMITIVE_TYPE_MAP[typeInfo.name] ?? 'unknown';
};

// ============================================================================
// Code Generation
// ============================================================================

const isValidIdentifier = (key: string): boolean => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);

const formatPropertyName = (key: string): string => (isValidIdentifier(key) ? key : `'${key}'`);

const generateProperty = (key: string, childType: TypeInfo, options: TypeScriptOptions): string => {
	const baseType = resolveType(childType, options);
	const propType =
		options.optionalProperties && options.strictNullChecks ? `${baseType} | undefined` : baseType;
	const readonly = options.useReadonly ? 'readonly ' : '';
	const optional = options.optionalProperties ? '?' : '';

	return `  ${readonly}${formatPropertyName(key)}${optional}: ${propType};`;
};

const generateTypeDefinition = (typeInfo: TypeInfo, options: TypeScriptOptions): string => {
	// Early return: not an object type
	if (!typeInfo.isObject || !typeInfo.children) return '';

	const properties = Object.entries(typeInfo.children)
		.map(([key, childType]) => generateProperty(key, childType, options))
		.join('\n');

	const exportKeyword = options.useExport ? 'export ' : '';
	const keyword = options.useInterface ? 'interface' : 'type';
	const assignment = options.useInterface ? '' : ' =';

	return `${exportKeyword}${keyword} ${typeInfo.name}${assignment} {
${properties}
}`;
};

// ============================================================================
// Generator Export
// ============================================================================

export const typeScriptGenerator: CodeGenerator<TypeScriptOptions> = {
	generate(data: unknown, options: TypeScriptOptions): string {
		return generateWithNestedTypes(inferType(data as JsonValue, options.rootName), (typeInfo) =>
			generateTypeDefinition(typeInfo, options)
		)
			.filter(Boolean)
			.join('\n\n');
	},

	getDefaultOptions: () => ({ ...defaultTypeScriptOptions }),
};
