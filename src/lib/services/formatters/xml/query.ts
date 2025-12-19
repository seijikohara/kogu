/**
 * XML Query - XPath Query Execution
 */

// ============================================================================
// XPath Query
// ============================================================================

const iterateXPathResult = function* (result: XPathResult): Generator<Node> {
	let node = result.iterateNext();
	while (node !== null) {
		yield node;
		node = result.iterateNext();
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
