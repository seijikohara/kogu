import type { CodeGenerator, JsonValue, PythonOptions, TypeInfo } from './types.js';
import { generateWithNestedTypes, inferType, toSnakeCase } from './utils.js';

// ============================================================================
// Constants
// ============================================================================

export const defaultPythonOptions = {
	rootName: 'Root',
	optionalProperties: false,
	style: 'dataclass',
	useFrozen: false,
	useSlots: false,
	useKwOnly: false,
	useTotal: true,
} as const satisfies PythonOptions;

const PYTHON_TYPE_MAP: Record<string, string> = {
	string: 'str',
	number: 'float',
	boolean: 'bool',
	null: 'None',
};

// ============================================================================
// Type Resolution
// ============================================================================

const resolveType = (typeInfo: TypeInfo, useOptional: boolean): string => {
	const baseType =
		typeInfo.isArray && typeInfo.arrayItemType
			? `list[${resolveType(typeInfo.arrayItemType, false)}]`
			: typeInfo.isObject
				? `'${typeInfo.name}'`
				: (PYTHON_TYPE_MAP[typeInfo.name] ?? 'Any');

	return useOptional ? `${baseType} | None` : baseType;
};

// ============================================================================
// Dataclass Generation
// ============================================================================

const buildDataclassDecorator = (options: PythonOptions): string => {
	const parts = [
		options.useFrozen && 'frozen=True',
		options.useSlots && 'slots=True',
		options.useKwOnly && 'kw_only=True',
	].filter(Boolean);

	return parts.length > 0 ? `@dataclass(${parts.join(', ')})` : '@dataclass';
};

const generateDataclassDefinition = (typeInfo: TypeInfo, options: PythonOptions): string => {
	if (!typeInfo.isObject || !typeInfo.children) return '';

	const fields = Object.entries(typeInfo.children)
		.map(([key, childType]) => {
			const fieldName = toSnakeCase(key);
			const fieldType = resolveType(childType, options.optionalProperties);
			const defaultValue = options.optionalProperties ? ' = None' : '';
			return `    ${fieldName}: ${fieldType}${defaultValue}`;
		})
		.join('\n');

	return `${buildDataclassDecorator(options)}
class ${typeInfo.name}:
${fields}`;
};

// ============================================================================
// TypedDict Generation
// ============================================================================

const generateTypedDictDefinition = (typeInfo: TypeInfo, options: PythonOptions): string => {
	if (!typeInfo.isObject || !typeInfo.children) return '';

	const fields = Object.entries(typeInfo.children)
		.map(([key, childType]) => {
			const baseType = resolveType(childType, false);
			const fieldType = options.optionalProperties ? `NotRequired[${baseType}]` : baseType;
			return `    ${key}: ${fieldType}`;
		})
		.join('\n');

	const totalArg = options.useTotal ? '' : ', total=False';
	return `class ${typeInfo.name}(TypedDict${totalArg}):
${fields}`;
};

// ============================================================================
// Generator Export
// ============================================================================

const generateDataclassOutput = (rootType: TypeInfo, options: PythonOptions): string => {
	const definitions = generateWithNestedTypes(rootType, (typeInfo) =>
		generateDataclassDefinition(typeInfo, options)
	)
		.filter(Boolean)
		.join('\n\n');

	return `from dataclasses import dataclass\n\n${definitions}`;
};

const generateTypedDictOutput = (rootType: TypeInfo, options: PythonOptions): string => {
	const imports = options.optionalProperties
		? 'from typing import TypedDict\nfrom typing import NotRequired'
		: 'from typing import TypedDict';

	const definitions = generateWithNestedTypes(rootType, (typeInfo) =>
		generateTypedDictDefinition(typeInfo, options)
	)
		.filter(Boolean)
		.join('\n\n');

	return `${imports}\n\n${definitions}`;
};

export const pythonGenerator: CodeGenerator<PythonOptions> = {
	generate(data: unknown, options: PythonOptions): string {
		const rootType = inferType(data as JsonValue, options.rootName);

		return options.style === 'dataclass'
			? generateDataclassOutput(rootType, options)
			: generateTypedDictOutput(rootType, options);
	},

	getDefaultOptions: () => ({ ...defaultPythonOptions }),
};
