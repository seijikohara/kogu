import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { CaseSensitive } from 'lucide-react';
import { readText } from '@tauri-apps/plugin-clipboard-manager';

import { CopyButton } from '@/lib/components/action';
import { CodeEditor } from '@/lib/components/editor';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { SectionHeader } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Card, CardContent } from '@/lib/components/ui/card';
import {
	CASE_DEFINITIONS,
	convertToAllCases,
	getTextStats,
	SAMPLE_TEXT_FOR_CASE,
} from '@/lib/services/string-case';

type SortOrder = 'none' | 'asc' | 'desc';

export const Route = createFileRoute('/string-case-converter')({
	component: StringCaseConverterPage,
});

function StringCaseConverterPage() {
	const [input, setInput] = useState('');
	const [showOptions, setShowOptions] = useState(true);
	const [sortLines, setSortLines] = useState<SortOrder>('none');
	const [removeDuplicates, setRemoveDuplicates] = useState(false);
	const [trimLines, setTrimLines] = useState(false);
	const [removeEmptyLines, setRemoveEmptyLines] = useState(false);
	const [reverseLines, setReverseLines] = useState(false);

	useEffect(() => {
		document.title = 'String Case Converter — Kogu';
	}, []);

	const processedInput = (() => {
		if (!input.trim()) return '';
		let lines = input.split('\n');
		if (trimLines) lines = lines.map((line) => line.trim());
		if (removeEmptyLines) lines = lines.filter((line) => line.length > 0);
		if (removeDuplicates) lines = [...new Set(lines)];
		if (sortLines === 'asc') lines = [...lines].sort((a, b) => a.localeCompare(b));
		else if (sortLines === 'desc') lines = [...lines].sort((a, b) => b.localeCompare(a));
		if (reverseLines) lines = [...lines].reverse();
		return lines.join('\n');
	})();

	const caseResults = processedInput.trim() ? convertToAllCases(processedInput) : [];
	const stats = getTextStats(processedInput);

	const handlePaste = async () => {
		try {
			const text = await readText();
			if (text) setInput(text);
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => setInput('');
	const handleSample = () => setInput(SAMPLE_TEXT_FOR_CASE);

	return (
		<ToolShell
			valid={input.trim() ? true : null}
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			statusContent={
				input.trim() ? (
					<>
						<StatItem label="lines" value={stats.lines} />
						<StatItem label="words" value={stats.words} />
						<StatItem label="chars" value={stats.chars} />
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Line Processing">
						<FormSelect
							label="Sort Lines"
							value={sortLines}
							onValueChange={(v) => setSortLines(v as SortOrder)}
							options={[
								{ value: 'none', label: 'No sorting' },
								{ value: 'asc', label: 'A → Z' },
								{ value: 'desc', label: 'Z → A' },
							]}
							size="compact"
						/>
						<FormCheckboxGroup className="pt-1">
							<FormCheckbox
								label="Remove duplicate lines"
								checked={removeDuplicates}
								onCheckedChange={setRemoveDuplicates}
								size="compact"
							/>
							<FormCheckbox
								label="Trim whitespace"
								checked={trimLines}
								onCheckedChange={setTrimLines}
								size="compact"
							/>
							<FormCheckbox
								label="Remove empty lines"
								checked={removeEmptyLines}
								onCheckedChange={setRemoveEmptyLines}
								size="compact"
							/>
							<FormCheckbox
								label="Reverse line order"
								checked={reverseLines}
								onCheckedChange={setReverseLines}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							<ul className="list-inside list-disc space-y-0.5">
								<li>Converts text to 17+ case formats</li>
								<li>Handles camelCase, PascalCase, snake_case</li>
								<li>Supports kebab-case, CONSTANT_CASE, Title Case</li>
								<li>Automatically detects word boundaries</li>
							</ul>
						</FormInfo>
					</FormSection>

					<FormSection title="Supported Formats">
						<FormInfo showIcon={false}>
							<div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
								{CASE_DEFINITIONS.slice(0, 10).map((def) => (
									<div key={def.label} className="truncate" title={def.description}>
										{def.label}
									</div>
								))}
								<div className="text-muted-foreground">+{CASE_DEFINITIONS.length - 10} more</div>
							</div>
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="h-1/3 shrink-0 border-b">
					<CodeEditor
						title="Input Text"
						value={input}
						onChange={setInput}
						mode="input"
						editorMode="plain"
						placeholder="Enter text to convert..."
						showViewToggle={false}
						onPaste={handlePaste}
						onClear={handleClear}
						onSample={handleSample}
					/>
				</div>

				<div className="flex flex-1 flex-col overflow-hidden">
					<SectionHeader title="Converted Results" />
					<div className="flex-1 overflow-auto p-4">
						{caseResults.length > 0 ? (
							<div className="space-y-2">
								{caseResults.map((result) => (
									<Card key={result.label} density="compact">
										<CardContent className="flex items-start gap-3 px-3 py-2">
											<span className="w-32 shrink-0 pt-0.5 font-mono text-xs font-medium">
												{result.label}
											</span>
											<code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">
												{result.value}
											</code>
											<CopyButton
												text={result.value}
												toastLabel={result.label}
												size="sm"
												className="h-6 shrink-0"
											/>
										</CardContent>
									</Card>
								))}
							</div>
						) : (
							<EmbeddedEmptyState
								icon={CaseSensitive}
								title="Enter text to convert"
								description="Type or paste text above to see all case format conversions."
								fillHeight
							/>
						)}
					</div>
				</div>
			</div>
		</ToolShell>
	);
}
