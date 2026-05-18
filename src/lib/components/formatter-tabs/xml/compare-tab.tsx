import { useCallback, useState } from 'react';

import { FormCheckbox, FormInput } from '@/lib/components/form';
import { CompareTab as CompareTabTemplate } from '@/lib/components/template';
import type { GenericDiffItem } from '@/lib/constants/diff';
import { findXmlDifferences, parseXml, type XmlDiffOptions } from '@/lib/services/xml-diff';
import { pasteFromClipboard } from '@/lib/utils/file-operations';

interface TabStats {
	readonly input: string;
	readonly valid: boolean | null;
	readonly error: string;
}

interface CompareTabProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly onStatsChange?: (stats: TabStats) => void;
}

export function CompareTab({ input, onInputChange, onStatsChange }: CompareTabProps) {
	const [compareIgnoreWhitespace, setCompareIgnoreWhitespace] = useState<boolean>(true);
	const [compareIgnoreComments, setCompareIgnoreComments] = useState<boolean>(false);
	const [compareIgnoreCase, setCompareIgnoreCase] = useState<boolean>(false);
	const [compareIgnoreNamespaces, setCompareIgnoreNamespaces] = useState<boolean>(false);
	const [compareIgnoreAttributes, setCompareIgnoreAttributes] = useState<string>('');

	const ignoredAttributesList = compareIgnoreAttributes
		.split(',')
		.map((a) => a.trim())
		.filter(Boolean);

	const diffOptions: XmlDiffOptions = {
		ignoreWhitespace: compareIgnoreWhitespace,
		ignoreComments: compareIgnoreComments,
		ignoreCase: compareIgnoreCase,
		ignoreNamespaces: compareIgnoreNamespaces,
		ignoreAttributes: ignoredAttributesList,
	};

	const validate = useCallback((value: string): { valid: boolean | null } => {
		if (!value.trim()) return { valid: null };
		return { valid: parseXml(value) !== null };
	}, []);

	const compare = useCallback(
		(input1: string, input2: string): GenericDiffItem[] =>
			findXmlDifferences(input1, input2, diffOptions),
		[diffOptions]
	);

	return (
		<CompareTabTemplate
			editorMode="xml"
			input={input}
			onInputChange={onInputChange}
			placeholder1="Original XML..."
			placeholder2="Modified XML..."
			validate={validate}
			compare={compare}
			onStatsChange={onStatsChange}
			pasteFromClipboard={pasteFromClipboard}
			renderComparisonOptions={() => (
				<>
					<FormCheckbox
						label="Ignore whitespace"
						checked={compareIgnoreWhitespace}
						onCheckedChange={setCompareIgnoreWhitespace}
					/>
					<FormCheckbox
						label="Ignore comments"
						checked={compareIgnoreComments}
						onCheckedChange={setCompareIgnoreComments}
					/>
				</>
			)}
			renderAdvancedOptions={() => (
				<>
					<FormCheckbox
						label="Ignore case"
						checked={compareIgnoreCase}
						onCheckedChange={setCompareIgnoreCase}
					/>
					<FormCheckbox
						label="Ignore namespaces"
						checked={compareIgnoreNamespaces}
						onCheckedChange={setCompareIgnoreNamespaces}
					/>
					<FormInput
						label="Ignore Attributes"
						value={compareIgnoreAttributes}
						onValueChange={setCompareIgnoreAttributes}
						placeholder="attr1, attr2, attr3"
						size="compact"
						hint="Comma-separated list of attributes to ignore"
					/>
				</>
			)}
		/>
	);
}

export type { CompareTabProps };
