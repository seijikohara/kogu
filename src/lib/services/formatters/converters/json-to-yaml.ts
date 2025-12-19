/**
 * JSON to YAML Converter
 */

import * as yaml from 'yaml';

import { defaultJsonToYamlOptions } from '../constants.js';
import { parseJsonAuto } from '../json/parser.js';
import type { JsonToYamlOptions } from '../types.js';
import { sortKeysDeep } from '../utils.js';

/** Convert JSON to YAML */
export const jsonToYaml = (input: string, options: JsonToYamlOptions | number = {}): string => {
	const opts =
		typeof options === 'number'
			? { ...defaultJsonToYamlOptions, indent: options }
			: { ...defaultJsonToYamlOptions, ...options };

	const data = opts.sortKeys ? sortKeysDeep(parseJsonAuto(input).data) : parseJsonAuto(input).data;

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
