import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { RefreshCw, TextQuote } from 'lucide-react';

import { ActionButton, CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormMode,
	FormSection,
	FormSelect,
	FormSlider,
} from '@/lib/components/form';
import { SectionHeader } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { LiveStatusRegion, StatItem } from '@/lib/components/status';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { useDocumentTitle } from '@/lib/hooks';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import {
	COUNT_RANGES,
	countStats,
	DEFAULT_OPTIONS,
	FLAVOR_LABELS,
	FLAVORS,
	FORMAT_LABELS,
	generateLorem,
	isFlavor,
	isOutputFormat,
	isSentenceLength,
	isUnit,
	type LoremOptions,
	OUTPUT_FORMATS,
	SENTENCE_LENGTH_LABELS,
	SENTENCE_LENGTHS,
	UNIT_LABELS,
	UNITS,
} from '@/lib/services/lorem';

const useLoremOptions = createToolOptionsStore<LoremOptions>('lorem-ipsum', DEFAULT_OPTIONS);

export const Route = createFileRoute('/lorem-ipsum')({
	component: LoremIpsumPage,
});

function LoremIpsumPage() {
	const { value: options, patch } = useLoremOptions();
	const { flavor, unit, count, sentenceLength, startWithClassic, format } = options;

	const [regenerateCounter, setRegenerateCounter] = useState(0);
	const [showRail, setShowRail] = usePersistedRail('lorem-ipsum');

	useDocumentTitle('Lorem Ipsum');

	const range = COUNT_RANGES[unit];

	// Fold the regenerate counter into the PRNG seed so every counter
	// tick produces a different but deterministic output. The seed is
	// derived from option values so the memo also recomputes on any
	// option change without needing a separate effect.
	const seed = useMemo(
		() => regenerateCounter * 9973 + count * 17 + flavor.length * 31 + unit.length,
		[regenerateCounter, count, flavor, unit]
	);

	const output = useMemo(() => generateLorem({ ...options, seed }), [options, seed]);

	const stats = useMemo(() => countStats(output), [output]);

	const flavorOptions = useMemo(
		() => FLAVORS.map((f) => ({ value: f, label: FLAVOR_LABELS[f] })),
		[]
	);

	const unitOptions = useMemo(() => UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] })), []);

	const sentenceLengthOptions = useMemo(
		() => SENTENCE_LENGTHS.map((s) => ({ value: s, label: SENTENCE_LENGTH_LABELS[s] })),
		[]
	);

	const formatOptions = useMemo(
		() => OUTPUT_FORMATS.map((f) => ({ value: f, label: FORMAT_LABELS[f] })),
		[]
	);

	const handleFlavorChange = (value: string) => {
		if (isFlavor(value)) patch({ flavor: value });
	};

	const handleUnitChange = (value: string) => {
		if (!isUnit(value)) return;
		// Clamp count into the new unit's range so the slider does not
		// render with an out-of-bounds value (e.g. paragraphs=20 -> bytes).
		const nextRange = COUNT_RANGES[value];
		const clamped = Math.min(Math.max(count, nextRange.min), nextRange.max);
		patch({ unit: value, count: clamped });
	};

	const handleSentenceLengthChange = (value: string) => {
		if (isSentenceLength(value)) patch({ sentenceLength: value });
	};

	const handleFormatChange = (value: string) => {
		if (isOutputFormat(value)) patch({ format: value });
	};

	const handleRegenerate = () => setRegenerateCounter((c) => c + 1);

	const handleResetDefaults = () => {
		patch(DEFAULT_OPTIONS);
		setRegenerateCounter((c) => c + 1);
	};

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			primaryAction={{ run: handleRegenerate }}
			statusContent={
				<>
					<StatItem label="Characters" value={stats.chars} />
					<StatItem label="Bytes" value={stats.bytes} />
					<StatItem label="Words" value={stats.words} />
					<StatItem label="Sentences" value={stats.sentences} />
					<StatItem label="Paragraphs" value={stats.paragraphs} />
				</>
			}
			rail={
				<>
					<FormSection title="Flavor">
						<FormSelect
							label="Style"
							value={flavor}
							options={flavorOptions}
							onValueChange={handleFlavorChange}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Output unit">
						<FormMode value={unit} options={unitOptions} onValueChange={handleUnitChange} />
					</FormSection>

					<FormSection title="Count">
						<FormSlider
							label={UNIT_LABELS[unit]}
							value={count}
							onValueChange={(v) => patch({ count: v })}
							min={range.min}
							max={range.max}
							step={range.step}
							valueLabel={String(count)}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Sentence length">
						<FormMode
							value={sentenceLength}
							options={sentenceLengthOptions}
							onValueChange={handleSentenceLengthChange}
						/>
					</FormSection>

					<FormSection title="Options">
						<FormCheckboxGroup>
							<FormCheckbox
								label="Start with classic opener"
								hint="Latin only"
								checked={startWithClassic}
								disabled={flavor !== 'latin'}
								onCheckedChange={(v) => patch({ startWithClassic: v })}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="Output format">
						<FormSelect
							label="Wrapper"
							value={format}
							options={formatOptions}
							onValueChange={handleFormatChange}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Actions">
						<div className="space-y-2">
							<ActionButton
								label="Regenerate"
								icon={RefreshCw}
								shortcutHint
								onClick={handleRegenerate}
							/>
							<ActionButton label="Reset options" variant="outline" onClick={handleResetDefaults} />
						</div>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							<ul className="list-inside list-disc space-y-0.5">
								<li>Six word banks: Latin, food, hipster, pirate, cyberpunk, Japanese</li>
								<li>Choose unit (paragraphs / sentences / words / bytes) and length</li>
								<li>Wrap as plain text, HTML, Markdown, JSON, TypeScript, or JSX</li>
								<li>Status bar reports UTF-8 byte length for accurate CJK / emoji counts</li>
							</ul>
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<SectionHeader
					title="Output"
					trailing={
						output.length > 0 ? (
							<CopyButton
								text={output}
								label="Copy"
								toastLabel="Generated text"
								size="sm"
								className="h-7 hover:bg-interactive-hover"
							/>
						) : null
					}
				/>
				<LiveStatusRegion className="flex-1 overflow-auto p-4">
					<Card density="compact" className="h-full">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-sm font-medium">
								<TextQuote className="h-4 w-4 text-muted-foreground" />
								{FORMAT_LABELS[format]} — {FLAVOR_LABELS[flavor]}
							</CardTitle>
						</CardHeader>
						<CardContent className="flex-1 overflow-hidden">
							<pre className="h-full min-h-64 overflow-auto rounded-md bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap break-words text-foreground">
								{output}
							</pre>
						</CardContent>
					</Card>
				</LiveStatusRegion>
			</div>
		</ToolShell>
	);
}
