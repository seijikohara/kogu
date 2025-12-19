/**
 * XML Converter - Convert XML to Other Formats
 */

import * as yaml from 'yaml';

import { defaultJsonToYamlOptions } from '../constants.js';
import type { XmlToJsonOptions, XmlToYamlOptions } from '../types.js';
import { sortKeysDeep } from '../utils.js';

// ============================================================================
// XML to Object Conversion
// ============================================================================

const convertXmlElementToObject = (node: Element): unknown => {
	const children = Array.from(node.childNodes);
	const elementChildren = children.filter((c) => c.nodeType === Node.ELEMENT_NODE);
	const textContent = children
		.filter((c) => c.nodeType === Node.TEXT_NODE)
		.map((c) => c.textContent?.trim())
		.filter(Boolean)
		.join('');

	const attrs = Object.fromEntries(
		Array.from(node.attributes).map((attr) => [`@${attr.name}`, attr.value])
	);

	// Text-only element
	if (textContent && elementChildren.length === 0) {
		return Object.keys(attrs).length === 0 ? textContent : { ...attrs, '#text': textContent };
	}

	// Process element children
	const childrenObj = elementChildren.reduce<Record<string, unknown>>((acc, child) => {
		const childObj = convertXmlElementToObject(child as Element);
		const childName = child.nodeName;

		if (childName in acc) {
			acc[childName] = Array.isArray(acc[childName])
				? [...(acc[childName] as unknown[]), childObj]
				: [acc[childName], childObj];
		} else {
			acc[childName] = childObj;
		}

		return acc;
	}, {});

	return { ...attrs, ...childrenObj };
};

// ============================================================================
// Export Functions
// ============================================================================

/** Convert XML to JSON string */
export const xmlToJson = (input: string, options: XmlToJsonOptions = {}): string => {
	const doc = new DOMParser().parseFromString(input, 'application/xml');
	const parserError = doc.querySelector('parsererror');
	if (parserError) {
		throw new Error(`Invalid XML: ${parserError.textContent}`);
	}
	const data = { [doc.documentElement.nodeName]: convertXmlElementToObject(doc.documentElement) };
	const sortedData = options.sortKeys ? sortKeysDeep(data) : data;
	return JSON.stringify(sortedData, null, options.indent ?? 2);
};

/** Convert XML to JSON object */
export const xmlToJsonObject = (input: string): unknown => {
	const doc = new DOMParser().parseFromString(input, 'application/xml');
	const parserError = doc.querySelector('parsererror');
	if (parserError) {
		throw new Error(`Invalid XML: ${parserError.textContent}`);
	}
	return { [doc.documentElement.nodeName]: convertXmlElementToObject(doc.documentElement) };
};

/** Convert XML to YAML */
export const xmlToYaml = (input: string, options: XmlToYamlOptions | number = {}): string => {
	const opts =
		typeof options === 'number'
			? { ...defaultJsonToYamlOptions, indent: options }
			: { ...defaultJsonToYamlOptions, ...options };

	const doc = new DOMParser().parseFromString(input, 'application/xml');
	const parserError = doc.querySelector('parsererror');
	if (parserError) {
		throw new Error(`Invalid XML: ${parserError.textContent}`);
	}

	const data = { [doc.documentElement.nodeName]: convertXmlElementToObject(doc.documentElement) };
	const sortedData = opts.sortKeys ? sortKeysDeep(data) : data;

	// Determine string type
	const stringType = opts.singleQuote
		? 'QUOTE_SINGLE'
		: opts.forceQuotes && opts.defaultStringType === 'PLAIN'
			? 'QUOTE_DOUBLE'
			: (opts.defaultStringType ?? 'PLAIN');

	return yaml.stringify(sortedData, {
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
