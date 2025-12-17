import type { CodeGenerator, JsonValue, KotlinOptions, TypeInfo } from './types.js';
import { generateWithNestedTypes, inferType, toCamelCase } from './utils.js';

// ============================================================================
// Constants
// ============================================================================

export const defaultKotlinOptions = {
	rootName: 'Root',
	optionalProperties: false,
	useDataClass: true,
	serializationLibrary: 'none',
	useDefaultValues: false,
} as const satisfies KotlinOptions;

const KOTLIN_TYPE_MAP: Record<string, string> = {
	string: 'String',
	number: 'Double',
	boolean: 'Boolean',
	null: 'Any',
};

const DEFAULT_VALUE_MAP: Record<string, string> = {
	string: '""',
	number: '0.0',
	boolean: 'false',
};

const SERIALIZATION_ANNOTATION_MAP: Record<string, (key: string) => string> = {
	kotlinx: (key) => `@SerialName("${key}")`,
	gson: (key) => `@SerializedName("${key}")`,
	moshi: (key) => `@Json(name = "${key}")`,
	jackson: (key) => `@JsonProperty("${key}")`,
};

const SERIALIZATION_IMPORTS: Record<string, string[]> = {
	kotlinx: ['import kotlinx.serialization.Serializable', 'import kotlinx.serialization.SerialName'],
	gson: ['import com.google.gson.annotations.SerializedName'],
	moshi: ['import com.squareup.moshi.Json'],
	jackson: ['import com.fasterxml.jackson.annotation.JsonProperty'],
};

// ============================================================================
// Type Resolution
// ============================================================================

const resolveType = (typeInfo: TypeInfo): string => {
	if (typeInfo.isArray && typeInfo.arrayItemType) {
		return `List<${resolveType(typeInfo.arrayItemType)}>`;
	}
	if (typeInfo.isObject) return typeInfo.name;
	return KOTLIN_TYPE_MAP[typeInfo.name] ?? 'Any';
};

const getDefaultValue = (typeInfo: TypeInfo): string => {
	if (typeInfo.isArray) return 'emptyList()';
	return DEFAULT_VALUE_MAP[typeInfo.name] ?? 'null';
};

// ============================================================================
// Code Generation
// ============================================================================

const getSerializationAnnotation = (
	key: string,
	propName: string,
	library: KotlinOptions['serializationLibrary']
): string | null =>
	propName === key ? null : (SERIALIZATION_ANNOTATION_MAP[library]?.(key) ?? null);

const generateClassDefinitionKotlin = (typeInfo: TypeInfo, options: KotlinOptions): string => {
	if (!typeInfo.isObject || !typeInfo.children) return '';

	const properties = Object.entries(typeInfo.children)
		.map(([key, childType]) => {
			const propName = toCamelCase(key);
			const baseType = resolveType(childType);
			const propType = options.optionalProperties ? `${baseType}?` : baseType;

			const annotation = getSerializationAnnotation(key, propName, options.serializationLibrary);
			const annotationStr = annotation
				? `${annotation}
    `
				: '';
			const defaultValue = options.useDefaultValues ? ` = ${getDefaultValue(childType)}` : '';

			return `${annotationStr}val ${propName}: ${propType}${defaultValue}`;
		})
		.join(',\n    ');

	const classAnnotations =
		options.serializationLibrary === 'kotlinx'
			? `@Serializable
`
			: '';
	const classKeyword = options.useDataClass ? 'data class' : 'class';

	return `${classAnnotations}${classKeyword} ${typeInfo.name}(
    ${properties}
)`;
};

// ============================================================================
// Generator Export
// ============================================================================

export const kotlinGenerator: CodeGenerator<KotlinOptions> = {
	generate(data: unknown, options: KotlinOptions): string {
		const classes = generateWithNestedTypes(
			inferType(data as JsonValue, options.rootName),
			(typeInfo) => generateClassDefinitionKotlin(typeInfo, options)
		)
			.filter(Boolean)
			.join('\n\n');

		const imports = SERIALIZATION_IMPORTS[options.serializationLibrary] ?? [];
		const importStr =
			imports.length > 0
				? `${imports.join('\n')}

`
				: '';

		return `${importStr}${classes}`;
	},

	getDefaultOptions: () => ({ ...defaultKotlinOptions }),
};
