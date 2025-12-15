import type { CodeGenerator, JavaOptions, JsonValue, TypeInfo } from './types.js';
import { inferType, toPascalCase, toCamelCase, generateWithNestedTypes } from './utils.js';

// ============================================================================
// Constants
// ============================================================================

export const defaultJavaOptions = {
	rootName: 'Root',
	optionalProperties: false,
	packageName: 'com.example',
	classStyle: 'record',
	serializationLibrary: 'none',
	useValidation: false,
	generateBuilder: false,
	generateEquals: true,
	useOptional: false,
} as const satisfies JavaOptions;

const JAVA_TYPE_MAP: Record<string, string> = {
	string: 'String',
	number: 'double',
	boolean: 'boolean',
	null: 'Object',
};

const BOXED_TYPE_MAP: Record<string, string> = {
	int: 'Integer',
	long: 'Long',
	double: 'Double',
	float: 'Float',
	boolean: 'Boolean',
	byte: 'Byte',
	short: 'Short',
	char: 'Character',
};

const ANNOTATION_MAP: Record<string, (key: string) => string> = {
	jackson: (key) => `    @JsonProperty("${key}")\n`,
	gson: (key) => `    @SerializedName("${key}")\n`,
	moshi: (key) => `    @Json(name = "${key}")\n`,
};

// ============================================================================
// Type Resolution
// ============================================================================

const resolveType = (typeInfo: TypeInfo, options: JavaOptions): string => {
	if (typeInfo.isArray && typeInfo.arrayItemType) {
		return `List<${resolveBoxedType(typeInfo.arrayItemType, options)}>`;
	}
	if (typeInfo.isObject) return typeInfo.name;
	return JAVA_TYPE_MAP[typeInfo.name] ?? 'Object';
};

const resolveBoxedType = (typeInfo: TypeInfo, options: JavaOptions): string => {
	const type = resolveType(typeInfo, options);
	return BOXED_TYPE_MAP[type] ?? type;
};

const buildFieldType = (childType: TypeInfo, options: JavaOptions): string => {
	const baseType = resolveType(childType, options);
	return options.useOptional && options.optionalProperties
		? `Optional<${resolveBoxedType(childType, options)}>`
		: baseType;
};

// ============================================================================
// Annotation Helpers
// ============================================================================

const getFieldAnnotation = (key: string, fieldName: string, library: JavaOptions['serializationLibrary']): string =>
	key === fieldName ? '' : ANNOTATION_MAP[library]?.(key) ?? '';

const getValidationAnnotation = (typeInfo: TypeInfo, useValidation: boolean): string => {
	if (!useValidation) return '';
	if (typeInfo.name === 'string') return `    @NotBlank
`;
	if (!typeInfo.isPrimitive) return `    @NotNull
`;
	return '';
};

// ============================================================================
// Class Generation
// ============================================================================

const generateRecordDefinition = (typeInfo: TypeInfo, options: JavaOptions): string => {
	if (!typeInfo.children) return '';

	const fields = Object.entries(typeInfo.children)
		.map(([key, childType]) => {
			const fieldName = toCamelCase(key);
			const annotation = getFieldAnnotation(key, fieldName, options.serializationLibrary);
			return `${annotation}    ${buildFieldType(childType, options)} ${fieldName}`;
		})
		.join(',\n');

	return `public record ${typeInfo.name}(
${fields}
) {}`;
};

const generateLombokDefinition = (typeInfo: TypeInfo, options: JavaOptions): string => {
	if (!typeInfo.children) return '';

	const fields = Object.entries(typeInfo.children)
		.map(([key, childType]) => {
			const fieldName = toCamelCase(key);
			const serializationAnnotation = getFieldAnnotation(key, fieldName, options.serializationLibrary);
			const validationAnnotation = getValidationAnnotation(childType, options.useValidation);
			return `${serializationAnnotation}${validationAnnotation}    private ${buildFieldType(childType, options)} ${fieldName};`;
		})
		.join('\n\n');

	const annotations = [
		'@Data',
		...(options.generateBuilder ? ['@Builder'] : []),
		'@NoArgsConstructor',
		'@AllArgsConstructor',
	].join('\n');

	return `${annotations}
public class ${typeInfo.name} {
${fields}
}`;
};

const generateImmutablesDefinition = (typeInfo: TypeInfo, options: JavaOptions): string => {
	if (!typeInfo.children) return '';

	const methods = Object.entries(typeInfo.children)
		.map(([key, childType]) => {
			const fieldName = toCamelCase(key);
			const annotation = getFieldAnnotation(key, fieldName, options.serializationLibrary);
			return `${annotation}    ${buildFieldType(childType, options)} ${fieldName}();`;
		})
		.join('\n\n');

	return `@Value.Immutable
public interface ${typeInfo.name} {
${methods}
}`;
};

const generateEqualsHashCode = (typeName: string, fieldNames: string[]): string[] => {
	const equalsMethod = `    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ${typeName} that = (${typeName}) o;
        return ${fieldNames.map((f) => `Objects.equals(${f}, that.${f})`).join(` &&
               `)};
    }`;
	const hashCodeMethod = `    @Override
    public int hashCode() {
        return Objects.hash(${fieldNames.join(', ')});
    }`;
	return ['', equalsMethod, hashCodeMethod];
};

const generatePojoDefinition = (typeInfo: TypeInfo, options: JavaOptions): string => {
	if (!typeInfo.children) return '';

	const entries = Object.entries(typeInfo.children);

	const fields = entries.map(([key, childType]) => {
		const fieldName = toCamelCase(key);
		const serializationAnnotation = getFieldAnnotation(key, fieldName, options.serializationLibrary);
		const validationAnnotation = getValidationAnnotation(childType, options.useValidation);
		return `${serializationAnnotation}${validationAnnotation}    private ${buildFieldType(childType, options)} ${fieldName};`;
	});

	const gettersSetters = entries.flatMap(([key, childType]) => {
		const fieldName = toCamelCase(key);
		const fieldType = buildFieldType(childType, options);
		const capitalizedName = toPascalCase(fieldName);
		return [
			`    public ${fieldType} get${capitalizedName}() {
        return ${fieldName};
    }`,
			`    public void set${capitalizedName}(${fieldType} ${fieldName}) {
        this.${fieldName} = ${fieldName};
    }`,
		];
	});

	const fieldNames = entries.map(([key]) => toCamelCase(key));
	const equalsHashCode = options.generateEquals ? generateEqualsHashCode(typeInfo.name, fieldNames) : [];

	return `public class ${typeInfo.name} {
${[...fields, '', ...gettersSetters, ...equalsHashCode].join('\n')}
}`;
};

const generateClassDefinition = (typeInfo: TypeInfo, options: JavaOptions): string => {
	if (!typeInfo.isObject || !typeInfo.children) return '';

	const generators: Record<JavaOptions['classStyle'], () => string> = {
		record: () => generateRecordDefinition(typeInfo, options),
		lombok: () => generateLombokDefinition(typeInfo, options),
		immutables: () => generateImmutablesDefinition(typeInfo, options),
		pojo: () => generatePojoDefinition(typeInfo, options),
	};

	return generators[options.classStyle]();
};

// ============================================================================
// Import Generation
// ============================================================================

const generateImports = (options: JavaOptions): string[] => {
	const imports: string[] = [];

	if (options.packageName) imports.push(`package ${options.packageName};`, '');

	imports.push('import java.util.List;');

	if (options.useOptional && options.optionalProperties) imports.push('import java.util.Optional;');
	if (options.generateEquals && options.classStyle === 'pojo') imports.push('import java.util.Objects;');

	const serializationImports: Record<string, string> = {
		jackson: 'import com.fasterxml.jackson.annotation.JsonProperty;',
		gson: 'import com.google.gson.annotations.SerializedName;',
		moshi: 'import com.squareup.moshi.Json;',
	};
	if (serializationImports[options.serializationLibrary]) {
		imports.push(serializationImports[options.serializationLibrary]);
	}

	if (options.classStyle === 'lombok') {
		imports.push('import lombok.Data;', 'import lombok.NoArgsConstructor;', 'import lombok.AllArgsConstructor;');
		if (options.generateBuilder) imports.push('import lombok.Builder;');
	}

	if (options.classStyle === 'immutables') imports.push('import org.immutables.value.Value;');

	if (options.useValidation) {
		imports.push('import javax.validation.constraints.NotNull;', 'import javax.validation.constraints.NotBlank;');
	}

	return imports;
};

// ============================================================================
// Generator Export
// ============================================================================

export const javaGenerator: CodeGenerator<JavaOptions> = {
	generate(data: unknown, options: JavaOptions): string {
		const classes = generateWithNestedTypes(
			inferType(data as JsonValue, options.rootName),
			(typeInfo) => generateClassDefinition(typeInfo, options)
		)
			.filter(Boolean)
			.join('\n\n');

		return `${generateImports(options).join('\n')}

${classes}`;
	},

	getDefaultOptions: () => ({ ...defaultJavaOptions }),
};
