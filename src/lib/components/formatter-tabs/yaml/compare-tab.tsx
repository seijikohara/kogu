import { useCallback, useState } from 'react';
import * as yaml from 'yaml';

import { FormCheckbox, FormInput } from '@/lib/components/form';
import { CompareTab as CompareTabTemplate } from '@/lib/components/template';
import type { GenericDiffItem } from '@/lib/constants/diff';
import { findYamlDifferences, type YamlDiffOptions } from '@/lib/services/yaml-diff';
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
	const [compareIgnoreWhitespace, setCompareIgnoreWhitespace] = useState<boolean>(false);
	const [compareIgnoreArrayOrder, setCompareIgnoreArrayOrder] = useState<boolean>(false);
	const [compareIgnoreCase, setCompareIgnoreCase] = useState<boolean>(false);
	const [compareIgnoreEmpty, setCompareIgnoreEmpty] = useState<boolean>(false);
	const [compareDeepCompare, setCompareDeepCompare] = useState<boolean>(true);
	const [compareIgnoreKeys, setCompareIgnoreKeys] = useState<string>('');

	const ignoredKeysList = compareIgnoreKeys
		.split(',')
		.map((k) => k.trim())
		.filter(Boolean);

	const diffOptions: YamlDiffOptions = {
		ignoreWhitespace: compareIgnoreWhitespace,
		ignoreArrayOrder: compareIgnoreArrayOrder,
		ignoreCase: compareIgnoreCase,
		ignoreEmpty: compareIgnoreEmpty,
		deepCompare: compareDeepCompare,
		ignoreKeys: ignoredKeysList,
	};

	const validate = useCallback((value: string): { valid: boolean | null } => {
		if (!value.trim()) return { valid: null };
		try {
			yaml.parse(value);
			return { valid: true };
		} catch {
			return { valid: false };
		}
	}, []);

	const compare = useCallback(
		(input1: string, input2: string): GenericDiffItem[] =>
			findYamlDifferences(input1, input2, diffOptions),
		[diffOptions]
	);

	return (
		<CompareTabTemplate
			editorMode="yaml"
			input={input}
			onInputChange={onInputChange}
			placeholder1="Original YAML..."
			placeholder2="Modified YAML..."
			validate={validate}
			compare={compare}
			onStatsChange={onStatsChange}
			pasteFromClipboard={pasteFromClipboard}
			renderComparisonOptions={() => (
				<>
					<FormCheckbox
						label="Deep compare"
						checked={compareDeepCompare}
						onCheckedChange={setCompareDeepCompare}
						size="compact"
					/>
					<FormCheckbox
						label="Ignore whitespace"
						checked={compareIgnoreWhitespace}
						onCheckedChange={setCompareIgnoreWhitespace}
						size="compact"
					/>
					<FormCheckbox
						label="Ignore array order"
						checked={compareIgnoreArrayOrder}
						onCheckedChange={setCompareIgnoreArrayOrder}
						size="compact"
					/>
				</>
			)}
			renderAdvancedOptions={() => (
				<>
					<FormCheckbox
						label="Ignore case"
						checked={compareIgnoreCase}
						onCheckedChange={setCompareIgnoreCase}
						size="compact"
					/>
					<FormCheckbox
						label="Ignore empty values"
						checked={compareIgnoreEmpty}
						onCheckedChange={setCompareIgnoreEmpty}
						size="compact"
					/>
					<FormInput
						label="Ignore Keys"
						value={compareIgnoreKeys}
						onValueChange={setCompareIgnoreKeys}
						placeholder="key1, key2, key3"
						size="compact"
						hint="Comma-separated list of keys to ignore"
					/>
				</>
			)}
		/>
	);
}

export type { CompareTabProps };
