/**
 * JSON to XML Converter
 */

import xmlFormatter from 'xml-formatter';

import { defaultJsonToXmlOptions } from '../constants.js';
import { parseJson, parseJsonAuto } from '../json/parser.js';
import type { JsonInputFormat, JsonToXmlOptions } from '../types.js';
import { sortKeysDeep } from '../utils.js';

// ============================================================================
// Helper Functions
// ============================================================================

const escapeXmlText = (text: string): string =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');

/** Create empty XML element */
const createEmptyXmlElement = (name: string, options: JsonToXmlOptions): string => {
	const selfCloseEnd = options.whiteSpaceAtEndOfSelfclosingTag ? ' />' : '/>';
	return options.selfClosing ? `<${name}${selfCloseEnd}` : `<${name}></${name}>`;
};

/** Convert object to XML element */
const convertObjectToXml = (
	data: Record<string, unknown>,
	name: string,
	options: JsonToXmlOptions,
	convertFn: (d: unknown, n: string, o: JsonToXmlOptions) => string
): string => {
	const attributePrefix = options.attributePrefix ?? '@';
	const textNodeName = options.textNodeName ?? '#text';
	const selfCloseEnd = options.whiteSpaceAtEndOfSelfclosingTag ? ' />' : '/>';

	const entries = options.sortKeys
		? Object.entries(data).sort(([a], [b]) => a.localeCompare(b))
		: Object.entries(data);

	const attributeEntries = entries.filter(([key]) => key.startsWith(attributePrefix));
	const sortedAttrEntries = options.sortAttributes
		? [...attributeEntries].sort(([a], [b]) => a.localeCompare(b))
		: attributeEntries;

	const attributes = sortedAttrEntries
		.map(([key, value]) => ` ${key.slice(attributePrefix.length)}="${value}"`)
		.join('');

	const textEntry = entries.find(([key]) => key === textNodeName);
	const textContent = textEntry ? String(textEntry[1]) : '';

	const children = entries
		.filter(([key]) => !key.startsWith(attributePrefix) && key !== textNodeName)
		.map(([key, value]) => convertFn(value, key, options))
		.join('');

	if (!children && !textContent) {
		return options.selfClosing
			? `<${name}${attributes}${selfCloseEnd}`
			: `<${name}${attributes}></${name}>`;
	}

	return `<${name}${attributes}>${textContent}${children}</${name}>`;
};

/** Convert primitive to XML element */
const convertPrimitiveToXml = (data: unknown, name: string, options: JsonToXmlOptions): string => {
	const rawContent = typeof data === 'string' ? data : JSON.stringify(data);
	const cdataThreshold = options.cdataThreshold ?? 0;
	const shouldUseCdata =
		options.cdata &&
		typeof data === 'string' &&
		(cdataThreshold === 0 || rawContent.length >= cdataThreshold);

	if (shouldUseCdata) {
		return `<${name}><![CDATA[${rawContent}]]></${name}>`;
	}

	const textContent =
		options.escapeText && typeof data === 'string' ? escapeXmlText(rawContent) : rawContent;
	return `<${name}>${textContent}</${name}>`;
};

const convertToXmlElement = (data: unknown, name: string, options: JsonToXmlOptions): string => {
	if (data === null || data === undefined) {
		return createEmptyXmlElement(name, options);
	}

	if (Array.isArray(data)) {
		const itemName = options.arrayItemName ?? 'item';
		const elementName = name === options.rootName ? itemName : name;
		return data.map((item) => convertToXmlElement(item, elementName, options)).join('');
	}

	if (typeof data === 'object') {
		return convertObjectToXml(data as Record<string, unknown>, name, options, convertToXmlElement);
	}

	return convertPrimitiveToXml(data, name, options);
};

/** Build XML declaration string */
const buildXmlDeclaration = (opts: JsonToXmlOptions, lineSep: string): string => {
	if (!opts.declaration) return '';
	const version = opts.declarationVersion ?? '1.0';
	const encoding = opts.declarationEncoding ?? 'UTF-8';
	const standalone = opts.declarationStandalone
		? ` standalone="${opts.declarationStandalone}"`
		: '';
	return `<?xml version="${version}" encoding="${encoding}"${standalone}?>${lineSep}`;
};

/** Determine XML content and root name */
const determineXmlContent = (
	parsed: unknown,
	opts: JsonToXmlOptions
): { content: string; rootName: string } => {
	const parsedObj =
		typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
	const parsedObjKeys = parsedObj !== null ? Object.keys(parsedObj) : [];
	const singleKey = parsedObjKeys.length === 1 ? parsedObjKeys[0] : undefined;
	const actualRootName = singleKey ?? opts.rootName ?? 'root';

	const content =
		singleKey && parsedObj
			? convertToXmlElement(parsedObj[singleKey], actualRootName, opts)
			: convertToXmlElement(parsed, opts.rootName ?? 'root', opts);

	return { content, rootName: actualRootName };
};

// ============================================================================
// Export Function
// ============================================================================

/** Convert JSON to XML */
export const jsonToXml = (
	input: string,
	options: JsonToXmlOptions | string = {},
	format?: JsonInputFormat
): string => {
	const opts =
		typeof options === 'string'
			? { ...defaultJsonToXmlOptions, rootName: options }
			: { ...defaultJsonToXmlOptions, ...options };

	const rawData = format ? parseJson(input, format) : parseJsonAuto(input).data;
	const parsed = opts.sortKeys ? sortKeysDeep(rawData) : rawData;

	const { content } = determineXmlContent(parsed, opts);
	const lineSep = opts.lineSeparator ?? '\n';
	const indentation =
		opts.indent === 0 ? '' : opts.indentType === 'tabs' ? '\t' : ' '.repeat(opts.indent ?? 2);

	const declaration = buildXmlDeclaration(opts, lineSep);
	const headerComment = opts.headerComment ? `<!-- ${opts.headerComment} -->${lineSep}` : '';

	const formattedXml = xmlFormatter(content, {
		indentation,
		collapseContent: opts.collapseContent,
		whiteSpaceAtEndOfSelfclosingTag: opts.whiteSpaceAtEndOfSelfclosingTag,
		lineSeparator: lineSep,
	});

	return `${declaration}${headerComment}${formattedXml}`;
};
