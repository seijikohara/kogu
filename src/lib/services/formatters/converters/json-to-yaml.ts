/**
 * JSON to YAML Converter
 */

import * as yaml from 'yaml';

import { defaultJsonToYamlOptions } from '../constants.js';
import { parseJson, parseJsonAuto } from '../json/parser.js';
import type { JsonInputFormat, JsonToYamlOptions } from '../types.js';
import { sortKeysDeep } from '../utils.js';

/** Convert JSON to YAML */
export const jsonToYaml = (
	input: string,
	options: JsonToYamlOptions | number = {},
	format?: JsonInputFormat
): string => {
	const opts =
		typeof options === 'number'
			? { ...defaultJsonToYamlOptions, indent: options }
			: { ...defaultJsonToYamlOptions, ...options };

	const parsed = format ? parseJson(input, format) : parseJsonAuto(input).data;
	const data = opts.sortKeys ? sortKeysDeep(parsed) : parsed;

	// Determine string type
	const stringType = opts.singleQuote
		? 'QUOTE_SINGLE'
		: opts.forceQuotes && opts.defaultStringType === 'PLAIN'
			? 'QUOTE_DOUBLE'
			: (opts.defaultStringType ?? 'PLAIN');

	return yaml.stringify(data, {
		indent: opts.indent,
		lineWidth: opts.lineWidth === 0 ? 0 : opts.lineWidth,
		minContentWidth: opts.minContentWidth,
		defaultStringType: stringType,
		doubleQuotedAsJSON: opts.doubleQuotedAsJSON,
		doubleQuotedMinMultiLineLength: opts.doubleQuotedMinMultiLineLength,
		collectionStyle: opts.collectionStyle,
		flowCollectionPadding: opts.flowCollectionPadding,
		indentSeq: opts.indentSeq,
		simpleKeys: opts.simpleKeys,
		defaultKeyType: opts.defaultKeyType,
		aliasDuplicateObjects: !opts.noRefs,
		anchorPrefix: opts.anchorPrefix,
		nullStr: opts.nullStr,
		trueStr: opts.trueStr,
		falseStr: opts.falseStr,
	});
};
