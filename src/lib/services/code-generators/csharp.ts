import type { CodeGenerator, CSharpOptions, JsonValue, TypeInfo } from './types.js';
import { inferType, toPascalCase, generateWithNestedTypes } from './utils.js';

// ============================================================================
// Constants
// ============================================================================

export const defaultCSharpOptions = {
	rootName: 'Root',
	optionalProperties: false,
	useRecords: true,
	useNullableReferenceTypes: true,
	useSystemTextJson: true,
	useNewtonsoft: false,
	generateDataContract: false,
} as const satisfies CSharpOptions;

const CSHARP_TYPE_MAP: Record<string, string> = {
	string: 'string',
	number: 'double',
	boolean: 'bool',
	null: 'object',
};

// ============================================================================
// Type Resolution
// ============================================================================

const resolveType = (typeInfo: TypeInfo, options: CSharpOptions): string => {
	if (typeInfo.isArray && typeInfo.arrayItemType) {
		return `List<${resolveType(typeInfo.arrayItemType, options)}>`;
	}
	if (typeInfo.isObject) return typeInfo.name;
	return CSHARP_TYPE_MAP[typeInfo.name] ?? 'object';
};

const buildPropType = (childType: TypeInfo, options: CSharpOptions): string => {
	const baseType = resolveType(childType, options);
	return options.optionalProperties && options.useNullableReferenceTypes ? `${baseType}?` : baseType;
};

// ============================================================================
// Annotation Helpers
// ============================================================================

const buildAnnotations = (key: string, propName: string, options: CSharpOptions, indent = ''): string[] =>
	[
		options.useSystemTextJson && propName !== key && `${indent}[JsonPropertyName("${key}")]`,
		options.useNewtonsoft && propName !== key && `${indent}[JsonProperty("${key}")]`,
		options.generateDataContract && `${indent}[DataMember(Name = "${key}")]`,
	].filter(Boolean) as string[];

// ============================================================================
// Class Generation
// ============================================================================

const generateRecordDefinition = (typeInfo: TypeInfo, options: CSharpOptions): string => {
	if (!typeInfo.children) return '';

	const properties = Object.entries(typeInfo.children)
		.map(([key, childType]) => {
			const propName = toPascalCase(key);
			const annotations = buildAnnotations(key, propName, options);
			const annotationStr = annotations.length > 0 ? `${annotations.join(' ')} ` : '';
			return `    ${annotationStr}${buildPropType(childType, options)} ${propName}`;
		})
		.join(',\n');

	const dataContractAttr = options.generateDataContract ? `[DataContract]
` : '';
	return `${dataContractAttr}public record ${typeInfo.name}(
${properties}
);`;
};

const generateClassDefinitionCSharp = (typeInfo: TypeInfo, options: CSharpOptions): string => {
	if (!typeInfo.children) return '';

	const properties = Object.entries(typeInfo.children)
		.map(([key, childType]) => {
			const propName = toPascalCase(key);
			const annotations = buildAnnotations(key, propName, options, '    ');
			const annotationStr = annotations.length > 0 ? `${annotations.join('\n')}
` : '';
			return `${annotationStr}    public ${buildPropType(childType, options)} ${propName} { get; set; }`;
		})
		.join('\n\n');

	const dataContractAttr = options.generateDataContract ? `[DataContract]
` : '';
	return `${dataContractAttr}public class ${typeInfo.name}
{
${properties}
}`;
};

const generateTypeDefinitionCSharp = (typeInfo: TypeInfo, options: CSharpOptions): string => {
	if (!typeInfo.isObject || !typeInfo.children) return '';
	return options.useRecords
		? generateRecordDefinition(typeInfo, options)
		: generateClassDefinitionCSharp(typeInfo, options);
};

// ============================================================================
// Import Generation
// ============================================================================

const generateImports = (options: CSharpOptions): string[] =>
	[
		'using System.Collections.Generic;',
		options.useSystemTextJson && 'using System.Text.Json.Serialization;',
		options.useNewtonsoft && 'using Newtonsoft.Json;',
		options.generateDataContract && 'using System.Runtime.Serialization;',
		options.useNullableReferenceTypes && '',
		options.useNullableReferenceTypes && '#nullable enable',
	].filter((item): item is string => item !== false);

// ============================================================================
// Generator Export
// ============================================================================

export const csharpGenerator: CodeGenerator<CSharpOptions> = {
	generate(data: unknown, options: CSharpOptions): string {
		const classes = generateWithNestedTypes(
			inferType(data as JsonValue, options.rootName),
			(typeInfo) => generateTypeDefinitionCSharp(typeInfo, options)
		)
			.filter(Boolean)
			.join('\n\n');

		return `${generateImports(options).join('\n')}

${classes}`;
	},

	getDefaultOptions: () => ({ ...defaultCSharpOptions }),
};
