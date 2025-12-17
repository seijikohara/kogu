import type { GenericDiffItem } from '$lib/constants/diff.js';

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

	// Find removed and changed attributes
	const removedAndChanged: GenericDiffItem[] = Array.from(attrMap1.entries()).flatMap(
		([name, value]): GenericDiffItem[] => {
			const attrPath = `${path}/@${name}`;
			const value2 = attrMap2.get(name);
			if (value2 === undefined) {
				return [{ path: attrPath, type: 'removed', oldValue: value }];
			}
			const norm1 = options.ignoreCase ? value.toLowerCase() : value;
			const norm2 = options.ignoreCase ? value2.toLowerCase() : value2;
			if (norm1 !== norm2) {
				return [{ path: attrPath, type: 'changed', oldValue: value, newValue: value2 }];
			}
			return [];
		}
	);

	// Find added attributes
	const added: GenericDiffItem[] = Array.from(attrMap2.entries())
		.filter(([name]) => !attrMap1.has(name))
		.map(([name, value]) => ({
			path: `${path}/@${name}`,
			type: 'added' as const,
			newValue: value,
		}));

	return [...diffs, ...removedAndChanged, ...added];
};

/**
 * Get child elements (optionally filter comments).
 */
const getChildElements = (element: Element, options: XmlDiffOptions): Node[] =>
	Array.from(element.childNodes).filter((child) => {
		if (child.nodeType === Node.ELEMENT_NODE) return true;
		if (child.nodeType === Node.TEXT_NODE) {
			const text = child.textContent || '';
			return !options.ignoreWhitespace || text.trim() !== '';
		}
		if (child.nodeType === Node.COMMENT_NODE) return !options.ignoreComments;
		return false;
	});

/** Get child node name for diff path */
const getChildName = (child: Node, ignoreNamespaces: boolean): string => {
	if (child.nodeType === Node.ELEMENT_NODE)
		return getElementName(child as Element, ignoreNamespaces);
	if (child.nodeType === Node.TEXT_NODE) return 'text()';
	return 'comment()';
};

/** Get child node value for diff display */
const getChildValue = (child: Node, name: string): string =>
	child.nodeType === Node.ELEMENT_NODE ? `<${name}>` : (child.textContent || '').substring(0, 50);

/** Compare text nodes */
const compareTextNodes = (
	node1: Node,
	node2: Node,
	path: string,
	options: XmlDiffOptions
): GenericDiffItem[] => {
	const text1 = normalizeText(node1.textContent, options);
	const text2 = normalizeText(node2.textContent, options);
	return text1 !== text2 ? [{ path, type: 'changed', oldValue: text1, newValue: text2 }] : [];
};

/** Compare comment nodes */
const compareCommentNodes = (node1: Node, node2: Node, path: string): GenericDiffItem[] => {
	const comment1 = node1.textContent || '';
	const comment2 = node2.textContent || '';
	return comment1 !== comment2
		? [{ path: `${path}/comment()`, type: 'changed', oldValue: comment1, newValue: comment2 }]
		: [];
};

/** Build child path with index tracking */
const buildChildPath = (
	child: Node,
	basePath: string,
	counts: Record<string, number>,
	ignoreNamespaces: boolean
): string => {
	if (child.nodeType === Node.ELEMENT_NODE) {
		const childName = getElementName(child as Element, ignoreNamespaces);
		counts[childName] = (counts[childName] ?? 0) + 1;
		return `${basePath}/${childName}[${counts[childName]}]`;
	}
	if (child.nodeType === Node.TEXT_NODE) return `${basePath}/text()`;
	return `${basePath}/comment()`;
};

/** Process a pair of children at the same index */
const processChildPair = (
	child1: Node | undefined,
	child2: Node | undefined,
	path: string,
	options: XmlDiffOptions,
	counts: Record<string, number>,
	compareFn: (n1: Node, n2: Node, p: string, o: XmlDiffOptions) => GenericDiffItem[]
): GenericDiffItem[] => {
	const ignoreNs = options.ignoreNamespaces ?? false;
	if (!child1 && child2) {
		const childName = getChildName(child2, ignoreNs);
		return [
			{ path: `${path}/${childName}`, type: 'added', newValue: getChildValue(child2, childName) },
		];
	}
	if (child1 && !child2) {
		const childName = getChildName(child1, ignoreNs);
		return [
			{ path: `${path}/${childName}`, type: 'removed', oldValue: getChildValue(child1, childName) },
		];
	}
	if (child1 && child2) {
		const childPath = buildChildPath(child1, path, counts, ignoreNs);
		return compareFn(child1, child2, childPath, options);
	}
	return [];
};

/** Compare element children */
const compareElementChildren = (
	elem1: Element,
	elem2: Element,
	path: string,
	options: XmlDiffOptions,
	compareFn: (n1: Node, n2: Node, p: string, o: XmlDiffOptions) => GenericDiffItem[]
): GenericDiffItem[] => {
	const children1 = getChildElements(elem1, options);
	const children2 = getChildElements(elem2, options);
	const maxLen = Math.max(children1.length, children2.length);
	const counts: Record<string, number> = {};

	return Array.from({ length: maxLen }).flatMap((_, i) =>
		processChildPair(children1[i], children2[i], path, options, counts, compareFn)
	);
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
	if (node1.nodeType !== node2.nodeType) {
		return [
			{ path, type: 'changed', oldValue: `[${node1.nodeName}]`, newValue: `[${node2.nodeName}]` },
		];
	}

	if (node1.nodeType === Node.TEXT_NODE) return compareTextNodes(node1, node2, path, options);
	if (node1.nodeType === Node.COMMENT_NODE) return compareCommentNodes(node1, node2, path);

	if (node1.nodeType === Node.ELEMENT_NODE) {
		const elem1 = node1 as Element;
		const elem2 = node2 as Element;

		const name1 = getElementName(elem1, options.ignoreNamespaces ?? false);
		const name2 = getElementName(elem2, options.ignoreNamespaces ?? false);

		if (name1 !== name2) {
			return [{ path, type: 'changed', oldValue: `<${name1}>`, newValue: `<${name2}>` }];
		}

		return [
			...compareAttributes(elem1, elem2, path, options),
			...compareElementChildren(elem1, elem2, path, options, compareNodes),
		];
	}

	return [];
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
