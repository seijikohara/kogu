/**
 * XML Query - XPath Query Execution
 */

// ============================================================================
// XPath Query
// ============================================================================

const iterateXPathResult = function* (result: XPathResult): Generator<Node> {
	// Pull nodes lazily from the XPathResult iterator until it returns null.
	// The cursor lives in a const holder so the generator avoids `let`.
	const cursor: { node: Node | null } = { node: result.iterateNext() };
	while (cursor.node !== null) {
		yield cursor.node;
		cursor.node = result.iterateNext();
	}
};

const collectXPathResults = (result: XPathResult): string[] =>
	Array.from(iterateXPathResult(result))
		.map((node) =>
			node.nodeType === Node.ELEMENT_NODE
				? new XMLSerializer().serializeToString(node)
				: node.nodeType === Node.ATTRIBUTE_NODE
					? (node as Attr).value
					: node.nodeType === Node.TEXT_NODE
						? (node.textContent ?? '')
						: null
		)
		.filter((content): content is string => content !== null);

/** Execute XPath query */
export const executeXPath = (input: string, xpath: string): string[] => {
	const doc = new DOMParser().parseFromString(input, 'application/xml');
	return collectXPathResults(
		new XPathEvaluator().evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null)
	);
};
