import type { CodeGenerator, GoOptions, JsonValue, TypeInfo } from './types.js';
import { inferType, toPascalCase, generateWithNestedTypes } from './utils.js';

// ============================================================================
// Constants
// ============================================================================

export const defaultGoOptions = {
	rootName: 'Root',
	optionalProperties: false,
	usePointers: false,
	omitEmpty: true,
	useJsonTag: true,
} as const satisfies GoOptions;

const GO_TYPE_MAP: Record<string, string> = {
	string: 'string',
	number: 'float64',
	boolean: 'bool',
	null: 'interface{}',
};

// ============================================================================
// Type Resolution
// ============================================================================

const resolveType = (typeInfo: TypeInfo, options: GoOptions): string => {
	if (typeInfo.isArray && typeInfo.arrayItemType) {
		return `[]${resolveType(typeInfo.arrayItemType, options)}`;
	}

	if (typeInfo.isObject) {
		return options.usePointers ? `*${typeInfo.name}` : typeInfo.name;
	}

	return GO_TYPE_MAP[typeInfo.name] ?? 'interface{}';
};

// ============================================================================
// Code Generation
// ============================================================================

const buildJsonTag = (key: string, options: GoOptions): string => {
	if (!options.useJsonTag) return '';
	const tagValue = options.omitEmpty ? `${key},omitempty` : key;
	return ` \`json:"${tagValue}"\``;
};

const generateStructDefinition = (typeInfo: TypeInfo, options: GoOptions): string => {
	if (!typeInfo.isObject || !typeInfo.children) return '';

	const fields = Object.entries(typeInfo.children)
		.map(([key, childType]) => {
			const fieldName = toPascalCase(key);
			const fieldType = resolveType(childType, options);
			const jsonTag = buildJsonTag(key, options);
			return `\t${fieldName} ${fieldType}${jsonTag}`;
		})
		.join('\n');

	return `type ${typeInfo.name} struct {
${fields}
}`;
};

// ============================================================================
// Generator Export
// ============================================================================

export const goGenerator: CodeGenerator<GoOptions> = {
	generate(data: unknown, options: GoOptions): string {
		return generateWithNestedTypes(inferType(data as JsonValue, options.rootName), (typeInfo) =>
			generateStructDefinition(typeInfo, options)
		)
			.filter(Boolean)
			.join('\n\n');
	},

	getDefaultOptions: () => ({ ...defaultGoOptions }),
};
