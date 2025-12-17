import type { CodeGenerator, JsonValue, PhpOptions, TypeInfo } from './types.js';
import { generateWithNestedTypes, inferType, toCamelCase } from './utils.js';

// ============================================================================
// Constants
// ============================================================================

export const defaultPhpOptions = {
	rootName: 'Root',
	optionalProperties: false,
	useStrictTypes: true,
	useReadonlyProperties: false,
	useConstructorPromotion: true,
	namespace: '',
} as const satisfies PhpOptions;

const PHP_TYPE_MAP: Record<string, string> = {
	string: 'string',
	number: 'float',
	boolean: 'bool',
	null: 'mixed',
};

// ============================================================================
// Type Resolution
// ============================================================================

const resolveType = (typeInfo: TypeInfo): string => {
	if (typeInfo.isArray) return 'array';
	if (typeInfo.isObject) return typeInfo.name;
	return PHP_TYPE_MAP[typeInfo.name] ?? 'mixed';
};

const buildPhpPropType = (childType: TypeInfo, options: PhpOptions): string => {
	const baseType = resolveType(childType);
	return options.optionalProperties ? `?${baseType}` : baseType;
};

// ============================================================================
// Class Generation
// ============================================================================

const generatePromotedClassPhp = (typeInfo: TypeInfo, options: PhpOptions): string => {
	if (!typeInfo.children) return '';

	const entries = Object.entries(typeInfo.children);
	const readonly = options.useReadonlyProperties ? 'readonly ' : '';

	const properties = entries
		.map(([key, childType], index) => {
			const propName = toCamelCase(key);
			const propType = buildPhpPropType(childType, options);
			const trailing = index === entries.length - 1 ? '' : ',';
			return `        public ${readonly}${propType} $${propName}${trailing}`;
		})
		.join('\n');

	return `class ${typeInfo.name}
{
    public function __construct(
${properties}
    ) {}
}`;
};

const generateTraditionalClassPhp = (typeInfo: TypeInfo, options: PhpOptions): string => {
	if (!typeInfo.children) return '';

	const entries = Object.entries(typeInfo.children);
	const readonly = options.useReadonlyProperties ? 'readonly ' : '';

	const properties = entries
		.map(([key, childType]) => {
			const propName = toCamelCase(key);
			return `    public ${readonly}${buildPhpPropType(childType, options)} $${propName};`;
		})
		.join('\n');

	const constructorParams = entries
		.map(([key, childType]) => `${buildPhpPropType(childType, options)} $${toCamelCase(key)}`)
		.join(',\n        ');

	const constructorAssignments = entries
		.map(([key]) => `        $this->${toCamelCase(key)} = $${toCamelCase(key)};`)
		.join('\n');

	const constructorMethod = `    public function __construct(
        ${constructorParams}
    ) {
${constructorAssignments}
    }`;

	return `class ${typeInfo.name}
{
${properties}

${constructorMethod}
}`;
};

const generateClassDefinitionPhp = (typeInfo: TypeInfo, options: PhpOptions): string => {
	if (!typeInfo.isObject || !typeInfo.children) return '';

	return options.useConstructorPromotion
		? generatePromotedClassPhp(typeInfo, options)
		: generateTraditionalClassPhp(typeInfo, options);
};

// ============================================================================
// Generator Export
// ============================================================================

export const phpGenerator: CodeGenerator<PhpOptions> = {
	generate(data: unknown, options: PhpOptions): string {
		const classes = generateWithNestedTypes(
			inferType(data as JsonValue, options.rootName),
			(typeInfo) => generateClassDefinitionPhp(typeInfo, options)
		)
			.filter(Boolean)
			.join('\n\n');

		const header = [
			'<?php',
			...(options.useStrictTypes ? ['', 'declare(strict_types=1);'] : []),
			...(options.namespace ? ['', `namespace ${options.namespace};`] : []),
		].join('\n');

		return `${header}

${classes}`;
	},

	getDefaultOptions: () => ({ ...defaultPhpOptions }),
};
