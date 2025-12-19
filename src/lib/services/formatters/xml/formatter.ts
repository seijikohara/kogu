/**
 * XML Formatter - Format and Minify Functions
 */

import xmlFormatter from 'xml-formatter';

import { defaultXmlFormatOptions } from '../constants.js';
import type { XmlFormatOptions, XmlStats } from '../types.js';
import { formatBytes } from '../utils.js';

/** Format XML with options */
export const formatXml = (input: string, options: Partial<XmlFormatOptions> = {}): string => {
	const opts = { ...defaultXmlFormatOptions, ...options };
	return xmlFormatter(input, {
		indentation: opts.indentType === 'tabs' ? '\t' : ' '.repeat(opts.indentSize),
		collapseContent: opts.collapseContent,
		whiteSpaceAtEndOfSelfclosingTag: opts.whiteSpaceAtEndOfSelfclosingTag,
		filter: (node) => !opts.excludeComments || node.type !== 'Comment',
	});
};

/** Minify XML */
export const minifyXml = (input: string): string =>
	xmlFormatter(input, { indentation: '', collapseContent: true, lineSeparator: '' });

// ============================================================================
// Stats
// ============================================================================

type XmlNodeStats = { elements: number; attributes: number; maxDepth: number };

const calculateXmlNodeStats = (node: Node, depth: number): XmlNodeStats => {
	const isElement = node.nodeType === Node.ELEMENT_NODE;
	const elementStats: XmlNodeStats = isElement
		? { elements: 1, attributes: (node as Element).attributes.length, maxDepth: depth }
		: { elements: 0, attributes: 0, maxDepth: depth };

	const childStats = Array.from(node.childNodes).reduce<XmlNodeStats>(
		(acc, child) => {
			const stats = calculateXmlNodeStats(child, depth + 1);
			return {
				elements: acc.elements + stats.elements,
				attributes: acc.attributes + stats.attributes,
				maxDepth: Math.max(acc.maxDepth, stats.maxDepth),
			};
		},
		{ elements: 0, attributes: 0, maxDepth: depth }
	);

	return {
		elements: elementStats.elements + childStats.elements,
		attributes: elementStats.attributes + childStats.attributes,
		maxDepth: childStats.maxDepth,
	};
};

/** Calculate XML statistics */
export const calculateXmlStats = (input: string): XmlStats => {
	const doc = new DOMParser().parseFromString(input, 'application/xml');
	const stats = calculateXmlNodeStats(doc.documentElement, 0);
	return {
		elements: stats.elements,
		attributes: stats.attributes,
		depth: stats.maxDepth,
		size: formatBytes(new Blob([input]).size),
	};
};
