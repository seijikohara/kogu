import { useEffect, useMemo, useState } from 'react';
import * as yaml from 'yaml';

import { CodeEditor } from '@/lib/components/editor';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInput,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { SplitPane } from '@/lib/components/layout';
import { OptionsPanel } from '@/lib/components/panel';
import { executeJsonPath } from '@/lib/services/formatters';
import { copyToClipboard, pasteFromClipboard } from '@/lib/utils/file-operations';

type QueryOutputFormat = 'yaml' | 'json';

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

/** Format the query result as YAML or JSON string. */
const formatQueryResult = (result: unknown, opts: QueryOptions): string => {
	const output =
		opts.showPaths && result !== undefined ? { path: opts.queryPath, value: result } : result;
	return opts.outputFormat === 'yaml'
		? yaml.stringify(output, { indent: 2 })
		: JSON.stringify(output, null, 2);
};

export function QueryTab({ input, onInputChange, onStatsChange }: QueryTabProps) {
	const [queryPath, setQueryPath] = useState<string>('$.');
	const [showOptions, setShowOptions] = useState(true);

	// Output options.
	const [queryOutputFormat, setQueryOutputFormat] = useState<QueryOutputFormat>('yaml');
	const [queryFirstMatchOnly, setQueryFirstMatchOnly] = useState<boolean>(false);
	const [queryMaxResultsStr, setQueryMaxResultsStr] = useState<string>('0');
	const [queryShowPaths, setQueryShowPaths] = useState<boolean>(false);
	const [queryFlattenArrays, setQueryFlattenArrays] = useState<boolean>(false);
	const [queryWrapResults, setQueryWrapResults] = useState<boolean>(true);

	const inputValidation = useMemo<{ valid: boolean | null }>(() => {
		if (!input.trim()) return { valid: null };
		try {
			yaml.parse(input);
			return { valid: true };
		} catch {
			return { valid: false };
		}
	}, [input]);

	const queryMaxResults = Number.parseInt(queryMaxResultsStr, 10) || 0;

	const queryResultData = ((): { result: string; error: string } => {
		if (!input.trim() || queryPath.trim() === '' || queryPath.trim() === '$.') {
			return { result: '', error: '' };
		}
		try {
			const yamlData = yaml.parse(input);
			const jsonInput = JSON.stringify(yamlData);
			const rawResult = executeJsonPath(jsonInput, queryPath);

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
			return { result: '', error: e instanceof Error ? e.message : 'Query failed' };
		}
	})();

	const queryResult = queryResultData.result;
	const queryError = queryResultData.error;

	useEffect(() => {
		onStatsChange?.({
			input,
			valid: inputValidation.valid,
			error: queryError,
		});
	}, [input, inputValidation.valid, queryError, onStatsChange]);

	const handlePaste = async () => {
		const text = await pasteFromClipboard();
		if (text) onInputChange(text);
	};

	const handleClear = () => {
		onInputChange('');
		setQueryPath('$.');
	};

	const handleCopyResult = () => {
		copyToClipboard(queryResult).catch(() => {
			// Clipboard write failed; ignore.
		});
	};

	return (
		<div className="flex flex-1 overflow-hidden">
			<OptionsPanel
				show={showOptions}
				onClose={() => setShowOptions(false)}
				onOpen={() => setShowOptions(true)}
			>
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
								{ value: 'yaml', label: 'YAML' },
								{ value: 'json', label: 'JSON' },
							]}
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
						<div className="truncate" title="All items">
							{'$.store.book[*]'}
						</div>
						<div className="truncate" title="All authors">
							{'$..author'}
						</div>
						<div className="truncate" title="Items with condition">
							{'$.store.book[?(@.price<10)]'}
						</div>
						<div className="truncate" title="First two items">
							{'$.store.book[0:2]'}
						</div>
						<div className="truncate" title="Last item">
							{'$.store.book[-1:]'}
						</div>
					</div>
				</FormSection>
			</OptionsPanel>

			<SplitPane
				className="flex-1"
				left={
					<CodeEditor
						title="Input"
						value={input}
						onChange={onInputChange}
						mode="input"
						editorMode="yaml"
						placeholder="Enter YAML here..."
						onPaste={handlePaste}
						onClear={handleClear}
					/>
				}
				right={
					<CodeEditor
						title="Result"
						value={queryResult}
						mode="readonly"
						editorMode={queryOutputFormat}
						placeholder="Query result..."
						onCopy={handleCopyResult}
					/>
				}
			/>
		</div>
	);
}

export type { QueryTabProps };
