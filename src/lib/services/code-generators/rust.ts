import type { CodeGenerator, RustOptions, JsonValue, TypeInfo } from './types.js';
import { inferType, toSnakeCase, generateWithNestedTypes } from './utils.js';

// ============================================================================
// Constants
// ============================================================================

export const defaultRustOptions = {
	rootName: 'Root',
	optionalProperties: false,
	deriveSerde: true,
	deriveDebug: true,
	deriveClone: true,
	deriveDefault: false,
	useBox: false,
} as const satisfies RustOptions;

const RUST_TYPE_MAP: Record<string, string> = {
	string: 'String',
	number: 'f64',
	boolean: 'bool',
	null: 'Option<()>',
};

// ============================================================================
// Type Resolution
// ============================================================================

const resolveType = (typeInfo: TypeInfo, options: RustOptions): string => {
	if (typeInfo.isArray && typeInfo.arrayItemType) {
		return `Vec<${resolveType(typeInfo.arrayItemType, options)}>`;
	}

	if (typeInfo.isObject) {
		return options.useBox ? `Box<${typeInfo.name}>` : typeInfo.name;
	}

	return RUST_TYPE_MAP[typeInfo.name] ?? 'serde_json::Value';
};

// ============================================================================
// Code Generation
// ============================================================================

const buildDerives = (options: RustOptions): string[] =>
	[
		options.deriveSerde && ['Serialize', 'Deserialize'],
		options.deriveDebug && ['Debug'],
		options.deriveClone && ['Clone'],
		options.deriveDefault && ['Default'],
	]
		.filter(Boolean)
		.flat() as string[];

const generateField = (key: string, childType: TypeInfo, options: RustOptions): string => {
	const fieldName = toSnakeCase(key);
	const baseType = resolveType(childType, options);
	const fieldType = options.optionalProperties ? `Option<${baseType}>` : baseType;

	const renameAttr = fieldName !== key && options.deriveSerde
		? `    #[serde(rename = "${key}")]
`
		: '';
	const skipAttr = options.optionalProperties && options.deriveSerde
		? `    #[serde(skip_serializing_if = "Option::is_none")]
`
		: '';

	return `${renameAttr}${skipAttr}    pub ${fieldName}: ${fieldType},`;
};

const generateStructDefinition = (typeInfo: TypeInfo, options: RustOptions, derives: string[]): string => {
	if (!typeInfo.isObject || !typeInfo.children) return '';

	const fields = Object.entries(typeInfo.children)
		.map(([key, childType]) => generateField(key, childType, options))
		.join('\n');

	const deriveAttr = derives.length > 0 ? `#[derive(${derives.join(', ')})]
` : '';
	return `${deriveAttr}pub struct ${typeInfo.name} {
${fields}
}`;
};

// ============================================================================
// Generator Export
// ============================================================================

export const rustGenerator: CodeGenerator<RustOptions> = {
	generate(data: unknown, options: RustOptions): string {
		const derives = buildDerives(options);
		const imports = options.deriveSerde ? 'use serde::{Deserialize, Serialize};\n\n' : '';

		const definitions = generateWithNestedTypes(
			inferType(data as JsonValue, options.rootName),
			(typeInfo) => generateStructDefinition(typeInfo, options, derives)
		)
			.filter(Boolean)
			.join('\n\n');

		return `${imports}${definitions}`;
	},

	getDefaultOptions: () => ({ ...defaultRustOptions }),
};
