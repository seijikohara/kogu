/**
 * Formatters - Main Module Exports
 *
 * This file re-exports everything from submodules for backward compatibility.
 * Existing imports like `import { formatJson } from '$lib/services/formatters'` continue to work.
 */

// Constants
export {
	defaultJsonDiffOptions,
	defaultJsonFormatOptions,
	defaultJsonToXmlOptions,
	defaultJsonToYamlOptions,
	defaultSqlFormatOptions,
	defaultXmlFormatOptions,
	defaultYamlFormatOptions,
	JSON_FORMAT_INFO,
	JSON_FORMAT_OPTIONS,
	SQL_INDENT_STYLE_OPTIONS,
	SQL_KEYWORD_CASE_OPTIONS,
	SQL_LANGUAGE_OPTIONS,
	SQL_LANGUAGES,
	SQL_LOGICAL_OPERATOR_OPTIONS,
} from './constants.js';
// Converters
export { jsonToXml, jsonToYaml } from './converters/index.js';
// JSON
export {
	calculateJsonStats,
	convertJsonFormat,
	detectJsonFormat,
	findJsonDifferences,
	formatJson,
	inferJsonSchema,
	minifyJson,
	parseJson,
	parseJsonAuto,
	processJsonWithOptions,
	stringifyJson,
	validateJson,
} from './json/index.js';
export { executeJsonPath } from './json/query.js';
// Samples
export { SAMPLE_JSON, SAMPLE_SQL, SAMPLE_XML, SAMPLE_YAML } from './samples.js';
// SQL
export { calculateSqlStats, formatSql, minifySql, validateSql } from './sql/index.js';
// Types
export type {
	DiffItem,
	FormatOption,
	JsonDiffOptions,
	JsonFormatInfo,
	JsonFormatOptions,
	JsonInputFormat,
	JsonOutputFormat,
	JsonStats,
	JsonStringifyOptions,
	JsonToXmlOptions,
	JsonToYamlOptions,
	SqlFormatOptions,
	SqlStats,
	XmlFormatOptions,
	XmlStats,
	XmlToJsonOptions,
	XmlToYamlOptions,
	YamlFormatOptions,
	YamlStats,
	YamlToJsonOptions,
	YamlToXmlOptions,
} from './types.js';
// Utilities
export { sortKeysDeep } from './utils.js';
// XML
export {
	calculateXmlStats,
	executeXPath,
	formatXml,
	minifyXml,
	xmlToJson,
	xmlToJsonObject,
	xmlToYaml,
} from './xml/index.js';
// YAML
export {
	calculateYamlStats,
	formatYaml,
	minifyYaml,
	validateYaml,
	yamlToJson,
	yamlToXml,
} from './yaml/index.js';
