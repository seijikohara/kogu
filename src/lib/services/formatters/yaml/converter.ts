/**
 * YAML Converter - Convert YAML to Other Formats
 */

import * as yaml from 'yaml';

import { defaultJsonToXmlOptions } from '../constants.js';
import type { YamlToJsonOptions, YamlToXmlOptions } from '../types.js';
import { sortKeysDeep } from '../utils.js';
import { jsonToXml } from '../converters/json-to-xml.js';

/** Convert YAML to JSON string */
export const yamlToJson = (input: string, options: YamlToJsonOptions | number = {}): string => {
	const opts =
		typeof options === 'number' ? { indent: options, sortKeys: false } : { indent: 2, ...options };
	const data = yaml.parse(input);
	const sortedData = opts.sortKeys ? sortKeysDeep(data) : data;
	return JSON.stringify(sortedData, null, opts.indent);
};

/** Convert YAML to XML string */
export const yamlToXml = (input: string, options: YamlToXmlOptions | string = {}): string => {
	const opts =
		typeof options === 'string'
			? { ...defaultJsonToXmlOptions, rootName: options }
			: { ...defaultJsonToXmlOptions, ...options };

	const data = yaml.parse(input);
	const sortedData = opts.sortKeys ? sortKeysDeep(data) : data;
	const jsonStr = JSON.stringify(sortedData);
	return jsonToXml(jsonStr, opts);
};
