import type { JsonValue, TypeInfo } from './types.js';

// ============================================================================
// Case Conversion Utilities
// ============================================================================

const normalizeWordBoundaries = (str: string): string =>
	str.replace(/[-_](.)/g, (_, char: string) => char.toUpperCase());

export const toPascalCase = (str: string): string =>
	normalizeWordBoundaries(str).replace(/^(.)/, (_, char: string) => char.toUpperCase());

export const toCamelCase = (str: string): string =>
	normalizeWordBoundaries(str).replace(/^(.)/, (_, char: string) => char.toLowerCase());

export const toSnakeCase = (str: string): string =>
	str
		.replace(/([A-Z])/g, '_$1')
		.toLowerCase()
		.replace(/^_/, '')
		.replace(/-/g, '_');

// ============================================================================
// Type Inference
// ============================================================================

const createPrimitiveType = (name: string): TypeInfo => ({
	name,
	isArray: false,
	isObject: false,
	isPrimitive: true,
});

const createArrayType = (name: string, itemType: TypeInfo): TypeInfo => ({
	name,
	isArray: true,
	isObject: false,
	isPrimitive: false,
	arrayItemType: itemType,
});

const createObjectType = (name: string, children: Record<string, TypeInfo>): TypeInfo => ({
	name,
	isArray: false,
	isObject: true,
	isPrimitive: false,
	children,
});

export const inferType = (value: JsonValue, name: string): TypeInfo => {
	if (value === null) return createPrimitiveType('null');

	if (Array.isArray(value)) {
		const [firstItem] = value;
		const itemType =
			firstItem !== undefined
				? inferType(firstItem, `${name}Item`)
				: createPrimitiveType('any');
		return createArrayType(name, itemType);
	}

	if (typeof value === 'object') {
		const children = Object.fromEntries(
			Object.entries(value).map(([key, val]) => [key, inferType(val, toPascalCase(key))])
		);
		return createObjectType(name, children);
	}

	return createPrimitiveType(typeof value);
};

// ============================================================================
// Nested Type Collection
// ============================================================================

const collectChildTypes = (info: TypeInfo): TypeInfo[] => {
	if (!info.isObject || !info.children) return [];

	return Object.values(info.children).flatMap((childType): TypeInfo[] => {
		if (childType.isObject) return [...collectChildTypes(childType), childType];
		if (childType.isArray && childType.arrayItemType?.isObject) {
			return [...collectChildTypes(childType.arrayItemType), childType.arrayItemType];
		}
		return [];
	});
};

export const collectNestedTypes = (typeInfo: TypeInfo): TypeInfo[] => collectChildTypes(typeInfo);

// ============================================================================
// Utility Functions
// ============================================================================

const uniqueBy = <T>(items: T[], keyFn: (item: T) => string): T[] =>
	items.reduce<{ seen: Set<string>; result: T[] }>(
		({ seen, result }, item) => {
			const key = keyFn(item);
			return seen.has(key) ? { seen, result } : { seen: seen.add(key), result: [...result, item] };
		},
		{ seen: new Set<string>(), result: [] }
	).result;

export const generateWithNestedTypes = <T>(
	rootType: TypeInfo,
	generateSingle: (typeInfo: TypeInfo) => T
): T[] => uniqueBy([...collectNestedTypes(rootType), rootType], (t) => t.name).map(generateSingle);
