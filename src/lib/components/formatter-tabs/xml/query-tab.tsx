import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { FormInput, FormSection } from '@/lib/components/form';
import { getErrorMessage } from '@/lib/utils';
import { InputOutputSplit } from '@/lib/components/layout';
import { Rail } from '@/lib/components/ui/rail';

import { FormatterAboutFooter } from '@/lib/components/template';
import { useClipboardActions, useReportStats, useValidation } from '@/lib/hooks';
import { executeXPath, formatXml } from '@/lib/services/formatters';

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

export function QueryTab({ input, onInputChange, onStatsChange }: QueryTabProps) {
	const [xpathExpression, setXpathExpression] = useState('//');
	const [showOptions, setShowOptions] = useState(true);

	const inputValid = useValidation(input, (s) => {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(s, 'application/xml');
			return doc.querySelector('parsererror') === null;
		} catch {
			return false;
		}
	});

	const queryResultData = useMemo<{ output: string; error: string; count: number }>(() => {
		if (!input.trim() || xpathExpression.trim() === '' || xpathExpression.trim() === '//') {
			return { output: '', error: '', count: 0 };
		}
		try {
			const results = executeXPath(input, xpathExpression);
			if (results.length === 0) {
				return { output: '', error: 'No matches found', count: 0 };
			}
			const formattedResults = results.map((result) => {
				try {
					return formatXml(result, { indentSize: 2 });
				} catch {
					return result;
				}
			});
			return {
				output: formattedResults.join('\n\n'),
				error: '',
				count: results.length,
			};
		} catch (e) {
			return {
				output: '',
				error: getErrorMessage(e, 'Query failed'),
				count: 0,
			};
		}
	}, [input, xpathExpression]);

	const queryOutput = queryResultData.output;
	const queryError = queryResultData.error;
	const resultCount = queryResultData.count;

	useReportStats(onStatsChange, input, inputValid, queryError);

	const { handlePaste, handleCopy } = useClipboardActions({
		onInputChange,
		output: queryOutput,
	});

	const handleClear = () => {
		onInputChange('');
		setXpathExpression('//');
	};

	return (
		<div className="flex flex-1 overflow-hidden">
			<Rail
				show={showOptions}
				onClose={() => setShowOptions(false)}
				onOpen={() => setShowOptions(true)}
			>
				<FormSection title="XPath Expression">
					<FormInput
						label="Path Expression"
						value={xpathExpression}
						onValueChange={setXpathExpression}
						placeholder="//element"
						size="compact"
						className="font-mono"
					/>
					{resultCount > 0 ? (
						<div className="rounded-md bg-primary/10 p-2 text-xs text-primary">
							{'Found '}
							<strong>{resultCount}</strong>
							{resultCount > 1 ? ' matches' : ' match'}
						</div>
					) : null}
				</FormSection>

				<FormSection title="Examples">
					<div className="space-y-1.5 text-xs">
						<div className="space-y-1">
							<code className="text-muted-foreground">{'//element'}</code>
							<p className="text-muted-foreground/70">{'Select all elements named "element"'}</p>
						</div>
						<div className="space-y-1">
							<code className="text-muted-foreground">{'//element[@attr]'}</code>
							<p className="text-muted-foreground/70">{'Elements with attribute "attr"'}</p>
						</div>
						<div className="space-y-1">
							<code className="text-muted-foreground">{"//element[@attr='value']"}</code>
							<p className="text-muted-foreground/70">{'Elements with specific attribute value'}</p>
						</div>
						<div className="space-y-1">
							<code className="text-muted-foreground">{'//parent/child'}</code>
							<p className="text-muted-foreground/70">{'Direct child elements'}</p>
						</div>
						<div className="space-y-1">
							<code className="text-muted-foreground">{'//element/text()'}</code>
							<p className="text-muted-foreground/70">{'Text content of elements'}</p>
						</div>
					</div>
				</FormSection>
				<FormatterAboutFooter />
			</Rail>

			<InputOutputSplit
				className="flex-1"
				input={input}
				onInputChange={onInputChange}
				editorMode="xml"
				inputPlaceholder="Enter XML here..."
				onPaste={handlePaste}
				onClear={handleClear}
				output={queryOutput}
				outputTitle="Result"
				outputPlaceholder="Query results will appear here..."
				onCopy={handleCopy}
				emptyIcon={Search}
				emptyTitle="Enter XML to query"
				emptyDescription="Run an XPath expression to see matching nodes here."
			/>
		</div>
	);
}

export type { QueryTabProps };
