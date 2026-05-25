import { Search } from 'lucide-react';
import { useState } from 'react';

import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInput,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { getErrorMessage } from '@/lib/utils';
import { InputOutputSplit } from '@/lib/components/layout';
import { Rail } from '@/lib/components/ui/rail';
import { useClipboardActions, useReportStats, useValidation } from '@/lib/hooks';
import { executeJsonPath, validateJson } from '@/lib/services/formatters';
import { useJsonFormatterOptions } from '@/lib/stores';

import { JsonFormatSection } from './json-format-section';

type QueryOutputFormat = 'formatted' | 'compact';

interface TabStats {
	readonly input: string;
	readonly valid: boolean | null;
	readonly error: string;
}

interface QueryTabProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly onStatsChange?: (stats: TabStats) => void;
}

interface QueryOptions {
	readonly flattenArrays: boolean;
	readonly firstMatchOnly: boolean;
	readonly maxResults: number;
	readonly wrapResults: boolean;
	readonly showPaths: boolean;
	readonly outputFormat: QueryOutputFormat;
	readonly queryPath: string;
}

/** Apply array transformations based on options. */
const applyArrayOptions = (arr: readonly unknown[], opts: QueryOptions): unknown => {
	const flattened = opts.flattenArrays ? arr.flat(Number.POSITIVE_INFINITY) : [...arr];
	if (opts.firstMatchOnly && flattened.length > 0) return flattened[0];

	const limited = opts.maxResults > 0 ? flattened.slice(0, opts.maxResults) : flattened;
	return !opts.wrapResults && limited.length === 1 ? limited[0] : limited;
};

/** Format the query result as a JSON string. */
const formatQueryResult = (result: unknown, opts: QueryOptions): string => {
	const indent = opts.outputFormat === 'compact' ? 0 : 2;
	const output =
		opts.showPaths && result !== undefined ? { path: opts.queryPath, value: result } : result;
	return JSON.stringify(output, null, indent);
};

export function QueryTab({ input, onInputChange, onStatsChange }: QueryTabProps) {
	const { value: jsonOptions } = useJsonFormatterOptions();
	const { inputFormat } = jsonOptions;

	const [queryPath, setQueryPath] = useState<string>('$.');
	const [showOptions, setShowOptions] = useState(true);

	// Output options.
	const [queryOutputFormat, setQueryOutputFormat] = useState<QueryOutputFormat>('formatted');
	const [queryFirstMatchOnly, setQueryFirstMatchOnly] = useState<boolean>(false);
	const [queryMaxResultsStr, setQueryMaxResultsStr] = useState<string>('0');
	const [queryShowPaths, setQueryShowPaths] = useState<boolean>(false);
	const [queryFlattenArrays, setQueryFlattenArrays] = useState<boolean>(false);
	const [queryWrapResults, setQueryWrapResults] = useState<boolean>(true);

	const inputValid = useValidation(input, (s) => validateJson(s, inputFormat).valid);

	const queryMaxResults = Number.parseInt(queryMaxResultsStr, 10) || 0;

	const queryResultData = ((): { result: string; error: string } => {
		if (!input.trim() || queryPath.trim() === '' || queryPath.trim() === '$.') {
			return { result: '', error: '' };
		}
		try {
			const rawResult = executeJsonPath(input, queryPath, inputFormat);
			const opts: QueryOptions = {
				flattenArrays: queryFlattenArrays,
				firstMatchOnly: queryFirstMatchOnly,
				maxResults: queryMaxResults,
				wrapResults: queryWrapResults,
				showPaths: queryShowPaths,
				outputFormat: queryOutputFormat,
				queryPath,
			};
			const result = Array.isArray(rawResult) ? applyArrayOptions(rawResult, opts) : rawResult;
			return { result: formatQueryResult(result, opts), error: '' };
		} catch (e) {
			return { result: '', error: getErrorMessage(e, 'Query failed') };
		}
	})();

	const queryResult = queryResultData.result;
	const queryError = queryResultData.error;

	useReportStats(onStatsChange, input, inputValid, queryError);

	const { handlePaste, handleCopy } = useClipboardActions({
		onInputChange,
		output: queryResult,
	});

	const handleClear = () => {
		onInputChange('{}');
		setQueryPath('$.');
	};

	return (
		<div className="flex flex-1 overflow-hidden">
			<Rail
				show={showOptions}
				onClose={() => setShowOptions(false)}
				onOpen={() => setShowOptions(true)}
			>
				<JsonFormatSection showOutput={false} />

				<FormSection title="JSONPath Query">
					<FormInput
						label="Path Expression"
						value={queryPath}
						onValueChange={setQueryPath}
						placeholder="$.path.to.value"
						size="compact"
						className="font-mono"
					/>
				</FormSection>

				<FormSection title="Output">
					<div className="grid grid-cols-2 gap-2">
						<FormSelect
							label="Format"
							value={queryOutputFormat}
							onValueChange={(v) => setQueryOutputFormat(v as QueryOutputFormat)}
							options={[
								{ value: 'formatted', label: 'Formatted' },
								{ value: 'compact', label: 'Compact' },
							]}
							size="compact"
						/>
						<FormSelect
							label="Max Results"
							value={queryMaxResultsStr}
							onValueChange={setQueryMaxResultsStr}
							options={[
								{ value: '0', label: 'Unlimited' },
								{ value: '1', label: '1' },
								{ value: '5', label: '5' },
								{ value: '10', label: '10' },
								{ value: '50', label: '50' },
								{ value: '100', label: '100' },
							]}
							size="compact"
						/>
					</div>
					<FormCheckboxGroup className="pt-1">
						<FormCheckbox
							label="First match only"
							checked={queryFirstMatchOnly}
							onCheckedChange={setQueryFirstMatchOnly}
							size="compact"
						/>
						<FormCheckbox
							label="Show paths in results"
							checked={queryShowPaths}
							onCheckedChange={setQueryShowPaths}
							size="compact"
						/>
						<FormCheckbox
							label="Flatten nested arrays"
							checked={queryFlattenArrays}
							onCheckedChange={setQueryFlattenArrays}
							size="compact"
						/>
						<FormCheckbox
							label="Wrap results in array"
							checked={queryWrapResults}
							onCheckedChange={setQueryWrapResults}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="JSONPath Examples">
					<div className="space-y-1.5 rounded-md bg-muted/50 p-2 font-mono text-xs text-muted-foreground">
						<div className="truncate" title="All books">
							{'$.store.book[*]'}
						</div>
						<div className="truncate" title="All authors">
							{'$..author'}
						</div>
						<div className="truncate" title="Books under $10">
							{'$.store.book[?(@.price<10)]'}
						</div>
						<div className="truncate" title="First two books">
							{'$.store.book[0:2]'}
						</div>
						<div className="truncate" title="Last book">
							{'$.store.book[-1:]'}
						</div>
					</div>
				</FormSection>
			</Rail>

			<InputOutputSplit
				className="flex-1"
				input={input}
				onInputChange={onInputChange}
				editorMode="json"
				inputPlaceholder="Enter JSON here..."
				onPaste={handlePaste}
				onClear={handleClear}
				output={queryResult}
				outputTitle="Result"
				outputPlaceholder="Query result..."
				onCopy={handleCopy}
				emptyIcon={Search}
				emptyTitle="Enter JSON to query"
				emptyDescription="Run a JSONPath expression to see matching values here."
			/>
		</div>
	);
}

export type { QueryTabProps };
