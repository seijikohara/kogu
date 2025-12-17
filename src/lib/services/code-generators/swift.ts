import type { CodeGenerator, JsonValue, SwiftOptions, TypeInfo } from './types.js';
import { generateWithNestedTypes, inferType, toCamelCase } from './utils.js';

// ============================================================================
// Constants
// ============================================================================

export const defaultSwiftOptions = {
	rootName: 'Root',
	optionalProperties: false,
	useStruct: true,
	useCodingKeys: true,
	useOptionalProperties: false,
} as const satisfies SwiftOptions;

const SWIFT_TYPE_MAP: Record<string, string> = {
	string: 'String',
	number: 'Double',
	boolean: 'Bool',
	null: 'Any',
};

// ============================================================================
// Type Resolution
// ============================================================================

const resolveType = (typeInfo: TypeInfo): string => {
	if (typeInfo.isArray && typeInfo.arrayItemType) {
		return `[${resolveType(typeInfo.arrayItemType)}]`;
	}
	if (typeInfo.isObject) return typeInfo.name;
	return SWIFT_TYPE_MAP[typeInfo.name] ?? 'Any';
};

const buildSwiftPropType = (childType: TypeInfo, options: SwiftOptions): string => {
	const baseType = resolveType(childType);
	return options.optionalProperties || options.useOptionalProperties ? `${baseType}?` : baseType;
};

// ============================================================================
// Code Generation
// ============================================================================

const generateCodingKey = (key: string, propName: string): string =>
	propName !== key ? `        case ${propName} = "${key}"` : `        case ${propName}`;

const generateStructDefinitionSwift = (typeInfo: TypeInfo, options: SwiftOptions): string => {
	if (!typeInfo.isObject || !typeInfo.children) return '';

	const entries = Object.entries(typeInfo.children);

	const properties = entries
		.map(([key, childType]) => {
			const propName = toCamelCase(key);
			return `    let ${propName}: ${buildSwiftPropType(childType, options)}`;
		})
		.join('\n');

	const needsCodingKeys = entries.some(([key]) => toCamelCase(key) !== key);
	const codingKeysSection =
		options.useCodingKeys && needsCodingKeys
			? `

    enum CodingKeys: String, CodingKey {
${entries.map(([key]) => generateCodingKey(key, toCamelCase(key))).join('\n')}
    }`
			: '';

	const keyword = options.useStruct ? 'struct' : 'class';
	const codable = options.useStruct ? 'Codable' : 'Codable, Equatable';

	return `${keyword} ${typeInfo.name}: ${codable} {
${properties}${codingKeysSection}
}`;
};

// ============================================================================
// Generator Export
// ============================================================================

export const swiftGenerator: CodeGenerator<SwiftOptions> = {
	generate(data: unknown, options: SwiftOptions): string {
		return generateWithNestedTypes(inferType(data as JsonValue, options.rootName), (typeInfo) =>
			generateStructDefinitionSwift(typeInfo, options)
		)
			.filter(Boolean)
			.join('\n\n');
	},

	getDefaultOptions: () => ({ ...defaultSwiftOptions }),
};
