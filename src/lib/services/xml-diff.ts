import type { GenericDiffItem, DiffType } from '$lib/constants/diff.js';

export interface XmlDiffOptions {
	ignoreWhitespace?: boolean;
	ignoreComments?: boolean;
	ignoreAttributeOrder?: boolean;
	ignoreCase?: boolean;
	ignoreNamespaces?: boolean;
	ignoreAttributes?: string[];
}

export const defaultXmlDiffOptions: XmlDiffOptions = {
	ignoreWhitespace: true,
	ignoreComments: false,
	ignoreAttributeOrder: true,
	ignoreCase: false,
	ignoreNamespaces: false,
	ignoreAttributes: [],
};

/**
 * Parse XML string using DOMParser.
 */
export const parseXml = (xmlString: string): Document | null => {
	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(xmlString, 'application/xml');
		const parserError = doc.querySelector('parsererror');
		if (parserError) return null;
		return doc;
	} catch {
		return null;
	}
};

/**
 * Get element name (with or without namespace).
 */
const getElementName = (element: Element, ignoreNamespaces: boolean): string => {
	if (ignoreNamespaces) {
		return element.localName;
	}
	return element.tagName;
};

/**
 * Normalize text content based on options.
 */
const normalizeText = (text: string | null, options: XmlDiffOptions): string => {
	if (!text) return '';
	let normalized = text;
	if (options.ignoreWhitespace) {
		normalized = normalized.replace(/\s+/g, ' ').trim();
	}
	if (options.ignoreCase) {
		normalized = normalized.toLowerCase();
	}
	return normalized;
};

/**
 * Compare attributes of two elements.
 */
const compareAttributes = (
	elem1: Element,
	elem2: Element,
	path: string,
	options: XmlDiffOptions
): GenericDiffItem[] => {
	const diffs: GenericDiffItem[] = [];
	const attrs1 = Array.from(elem1.attributes);
	const attrs2 = Array.from(elem2.attributes);
	const ignoreSet = new Set(options.ignoreAttributes || []);

	const filterAttr = (attr: Attr) => {
		if (ignoreSet.has(attr.name)) return false;
		if (options.ignoreNamespaces && attr.name.startsWith('xmlns')) return false;
		return true;
	};

	const filteredAttrs1 = attrs1.filter(filterAttr);
	const filteredAttrs2 = attrs2.filter(filterAttr);

	const attrMap1 = new Map(filteredAttrs1.map((a) => [a.name, a.value]));
	const attrMap2 = new Map(filteredAttrs2.map((a) => [a.name, a.value]));

	for (const [name, value] of attrMap1) {
		const attrPath = `${path}/@${name}`;
		if (!attrMap2.has(name)) {
			diffs.push({ path: attrPath, type: 'removed', oldValue: value });
		} else {
			const value2 = attrMap2.get(name)!;
			const norm1 = options.ignoreCase ? value.toLowerCase() : value;
			const norm2 = options.ignoreCase ? value2.toLowerCase() : value2;
			if (norm1 !== norm2) {
				diffs.push({ path: attrPath, type: 'changed', oldValue: value, newValue: value2 });
			}
		}
	}

	for (const [name, value] of attrMap2) {
		if (!attrMap1.has(name)) {
			diffs.push({ path: `${path}/@${name}`, type: 'added', newValue: value });
		}
	}

	return diffs;
};

/**
 * Get child elements (optionally filter comments).
 */
const getChildElements = (element: Element, options: XmlDiffOptions): Node[] => {
	const children: Node[] = [];
	for (const child of element.childNodes) {
		if (child.nodeType === Node.ELEMENT_NODE) {
			children.push(child);
		} else if (child.nodeType === Node.TEXT_NODE) {
			const text = child.textContent || '';
			if (!options.ignoreWhitespace || text.trim()) {
				children.push(child);
			}
		} else if (child.nodeType === Node.COMMENT_NODE && !options.ignoreComments) {
			children.push(child);
		}
	}
	return children;
};

/**
 * Compare two XML nodes.
 */
const compareNodes = (
	node1: Node,
	node2: Node,
	path: string,
	options: XmlDiffOptions
): GenericDiffItem[] => {
	const diffs: GenericDiffItem[] = [];

	if (node1.nodeType !== node2.nodeType) {
		diffs.push({
			path,
			type: 'changed',
			oldValue: `[${node1.nodeName}]`,
			newValue: `[${node2.nodeName}]`,
		});
		return diffs;
	}

	if (node1.nodeType === Node.TEXT_NODE) {
		const text1 = normalizeText(node1.textContent, options);
		const text2 = normalizeText(node2.textContent, options);
		if (text1 !== text2) {
			diffs.push({ path, type: 'changed', oldValue: text1, newValue: text2 });
		}
		return diffs;
	}

	if (node1.nodeType === Node.COMMENT_NODE) {
		const comment1 = node1.textContent || '';
		const comment2 = node2.textContent || '';
		if (comment1 !== comment2) {
			diffs.push({
				path: `${path}/comment()`,
				type: 'changed',
				oldValue: comment1,
				newValue: comment2,
			});
		}
		return diffs;
	}

	if (node1.nodeType === Node.ELEMENT_NODE) {
		const elem1 = node1 as Element;
		const elem2 = node2 as Element;

		const name1 = getElementName(elem1, options.ignoreNamespaces ?? false);
		const name2 = getElementName(elem2, options.ignoreNamespaces ?? false);

		if (name1 !== name2) {
			diffs.push({ path, type: 'changed', oldValue: `<${name1}>`, newValue: `<${name2}>` });
			return diffs;
		}

		diffs.push(...compareAttributes(elem1, elem2, path, options));

		const children1 = getChildElements(elem1, options);
		const children2 = getChildElements(elem2, options);

		const maxLen = Math.max(children1.length, children2.length);
		const elementCounts: Record<string, number> = {};

		for (let i = 0; i < maxLen; i++) {
			const child1 = children1[i];
			const child2 = children2[i];

			if (!child1 && child2) {
				const childName =
					child2.nodeType === Node.ELEMENT_NODE
						? getElementName(child2 as Element, options.ignoreNamespaces ?? false)
						: child2.nodeType === Node.TEXT_NODE
							? 'text()'
							: 'comment()';
				diffs.push({
					path: `${path}/${childName}`,
					type: 'added',
					newValue:
						child2.nodeType === Node.ELEMENT_NODE
							? `<${childName}>`
							: (child2.textContent || '').substring(0, 50),
				});
			} else if (child1 && !child2) {
				const childName =
					child1.nodeType === Node.ELEMENT_NODE
						? getElementName(child1 as Element, options.ignoreNamespaces ?? false)
						: child1.nodeType === Node.TEXT_NODE
							? 'text()'
							: 'comment()';
				diffs.push({
					path: `${path}/${childName}`,
					type: 'removed',
					oldValue:
						child1.nodeType === Node.ELEMENT_NODE
							? `<${childName}>`
							: (child1.textContent || '').substring(0, 50),
				});
			} else if (child1 && child2) {
				let childPath = path;
				if (child1.nodeType === Node.ELEMENT_NODE) {
					const childName = getElementName(child1 as Element, options.ignoreNamespaces ?? false);
					elementCounts[childName] = (elementCounts[childName] || 0) + 1;
					childPath = `${path}/${childName}[${elementCounts[childName]}]`;
				} else if (child1.nodeType === Node.TEXT_NODE) {
					childPath = `${path}/text()`;
				} else {
					childPath = `${path}/comment()`;
				}
				diffs.push(...compareNodes(child1, child2, childPath, options));
			}
		}
	}

	return diffs;
};

/**
 * Find differences between two XML strings.
 */
export const findXmlDifferences = (
	xml1: string,
	xml2: string,
	options: XmlDiffOptions = defaultXmlDiffOptions
): GenericDiffItem[] => {
	const doc1 = parseXml(xml1);
	const doc2 = parseXml(xml2);

	if (!doc1 || !doc2) {
		throw new Error('Invalid XML');
	}

	const root1 = doc1.documentElement;
	const root2 = doc2.documentElement;

	const rootPath = `/${getElementName(root1, options.ignoreNamespaces ?? false)}`;
	return compareNodes(root1, root2, rootPath, options);
};
