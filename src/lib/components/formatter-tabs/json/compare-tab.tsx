import { useCallback, useState } from 'react';

import { FormCheckbox, FormInput } from '@/lib/components/form';
import { CompareTab as CompareTabTemplate } from '@/lib/components/template';
import type { GenericDiffItem } from '@/lib/constants/diff';
import { findJsonDifferences, type JsonDiffOptions, validateJson } from '@/lib/services/formatters';
import { useJsonFormatterOptions } from '@/lib/stores';
import { pasteFromClipboard } from '@/lib/utils/file-operations';

import { JsonFormatSection } from './json-format-section';

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

interface SearchState {
	readonly found: number | null;
	readonly pathStack: readonly string[];
	readonly currentArrayIndex: number;
}

/** Handle key match in JSON line. */
const handleKeyMatch = (
	key: string,
	line: string,
	lineNum: number,
	state: SearchState,
	targetPath: string
): SearchState | null => {
	const currentPath = [...state.pathStack, key].join('.');
	if (currentPath === targetPath) return { ...state, found: lineNum };

	if (line.endsWith('{') || line.endsWith('[')) {
		return {
			...state,
			pathStack: [...state.pathStack, key],
			currentArrayIndex: line.endsWith('[') ? 0 : state.currentArrayIndex,
		};
	}
	return null;
};

/** Handle the opening of an array element. */
const handleArrayStart = (lineNum: number, state: SearchState, targetPath: string): SearchState => {
	const arrayPath = [...state.pathStack, String(state.currentArrayIndex)].join('.');
	if (arrayPath === targetPath) return { ...state, found: lineNum };
	return { ...state, currentArrayIndex: state.currentArrayIndex + 1 };
};

/** Handle a closing bracket line. */
const handleClosingBracket = (line: string, state: SearchState): SearchState => {
	const isArrayClose = line.startsWith(']') || line === '],';
	const isObjectClose = line.startsWith('}') || line === '},';

	if (isArrayClose) {
		return state.pathStack.length > 0
			? { ...state, pathStack: state.pathStack.slice(0, -1), currentArrayIndex: -1 }
			: { ...state, currentArrayIndex: -1 };
	}
	if (isObjectClose && state.pathStack.length > 0 && !line.includes('[')) {
		return { ...state, pathStack: state.pathStack.slice(0, -1) };
	}
	return state;
};

/** Process a single line during JSON path search. */
const processSearchLine = (
	state: SearchState,
	line: string,
	lineNum: number,
	targetPath: string
): SearchState => {
	if (state.found !== null) return state;

	const keyMatch = line.match(/^"([^"]+)"\s*:/);
	if (keyMatch?.[1] !== undefined) {
		const result = handleKeyMatch(keyMatch[1], line, lineNum, state, targetPath);
		if (result) return result;
	}

	if (line === '{' && state.currentArrayIndex >= 0) {
		return handleArrayStart(lineNum, state, targetPath);
	}

	return handleClosingBracket(line, state);
};

/** Find the line number for a JSON path in a JSON string. */
const findLineForPath = (jsonStr: string, targetPath: string): number | null => {
	if (!jsonStr?.trim() || !targetPath) return null;

	const pathParts = targetPath
		.replace(/^\$\.?/, '')
		.split(/\.|\[/)
		.filter(Boolean);
	if (pathParts.length === 0) return 1;

	const targetPathNormalized = pathParts.map((p) => p.replace(/\]$/, '')).join('.');
	const lines = jsonStr.split('\n');
	const initialState: SearchState = { found: null, pathStack: [], currentArrayIndex: -1 };

	const result = lines.reduce<SearchState>(
		(acc, rawLine, i) =>
			rawLine === undefined
				? acc
				: processSearchLine(acc, rawLine.trim(), i + 1, targetPathNormalized),
		initialState
	);

	return result.found;
};

export function CompareTab({ input, onInputChange, onStatsChange }: CompareTabProps) {
	const { value: jsonOptions } = useJsonFormatterOptions();
	const { inputFormat } = jsonOptions;

	const [compareIgnoreWhitespace, setCompareIgnoreWhitespace] = useState<boolean>(false);
	const [compareIgnoreArrayOrder, setCompareIgnoreArrayOrder] = useState<boolean>(false);
	const [compareIgnoreCase, setCompareIgnoreCase] = useState<boolean>(false);
	const [compareIgnoreNumericType, setCompareIgnoreNumericType] = useState<boolean>(false);
	const [compareIgnoreEmpty, setCompareIgnoreEmpty] = useState<boolean>(false);
	const [compareDeepCompare, setCompareDeepCompare] = useState<boolean>(true);
	const [compareIgnoreKeys, setCompareIgnoreKeys] = useState<string>('');

	const ignoredKeysList = compareIgnoreKeys
		.split(',')
		.map((k) => k.trim())
		.filter(Boolean);

	const diffOptions: JsonDiffOptions = {
		ignoreCase: compareIgnoreCase,
		ignoreWhitespace: compareIgnoreWhitespace,
		ignoreArrayOrder: compareIgnoreArrayOrder,
		ignoreNumericType: compareIgnoreNumericType,
		ignoreEmpty: compareIgnoreEmpty,
		deepCompare: compareDeepCompare,
		ignoreKeys: ignoredKeysList,
	};

	const validate = useCallback(
		(value: string): { valid: boolean | null } => {
			if (!value.trim()) return { valid: null };
			const result = validateJson(value, inputFormat);
			return { valid: result.valid };
		},
		[inputFormat]
	);

	const compare = useCallback(
		(input1: string, input2: string): GenericDiffItem[] =>
			findJsonDifferences(input1, input2, diffOptions, inputFormat),
		[diffOptions, inputFormat]
	);

	return (
		<CompareTabTemplate
			editorMode="json"
			input={input}
			onInputChange={onInputChange}
			placeholder1="Original JSON..."
			placeholder2="Modified JSON..."
			validate={validate}
			compare={compare}
			onStatsChange={onStatsChange}
			findLineForPath={findLineForPath}
			pasteFromClipboard={pasteFromClipboard}
			renderFormatSection={() => <JsonFormatSection showOutput={false} />}
			renderComparisonOptions={() => (
				<>
					<FormCheckbox
						label="Deep compare"
						checked={compareDeepCompare}
						onCheckedChange={setCompareDeepCompare}
					/>
					<FormCheckbox
						label="Ignore whitespace"
						checked={compareIgnoreWhitespace}
						onCheckedChange={setCompareIgnoreWhitespace}
					/>
					<FormCheckbox
						label="Ignore array order"
						checked={compareIgnoreArrayOrder}
						onCheckedChange={setCompareIgnoreArrayOrder}
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
						label="Ignore numeric type"
						checked={compareIgnoreNumericType}
						onCheckedChange={setCompareIgnoreNumericType}
					/>
					<FormCheckbox
						label="Ignore empty values"
						checked={compareIgnoreEmpty}
						onCheckedChange={setCompareIgnoreEmpty}
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
