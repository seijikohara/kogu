import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
	Braces,
	ClipboardPaste,
	Eraser,
	FileCode,
	FlaskConical,
	Globe,
	RotateCcw,
	Table,
	Terminal,
} from 'lucide-react';

import { CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormMode,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { SplitPane } from '@/lib/components/layout';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { StatItem } from '@/lib/components/status';
import { Button } from '@/lib/components/ui/button';
import { IconTooltip } from '@/lib/components/ui/icon-tooltip';
import { Textarea } from '@/lib/components/ui/textarea';
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks';
import { createToolOptionsStore, useActiveTab, useTabStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { pasteFromClipboard } from '@/lib/utils/file-operations';
import {
	type CsvEscapeOptions,
	type CsvSeparator,
	DEFAULT_FLAVOR_OPTIONS,
	type EscapeFlavor,
	type EscapedSegment,
	FLAVOR_DESCRIPTIONS,
	type FlavorOptions,
	type HtmlEscapeOptions,
	type JsEscapeOptions,
	SAMPLES,
	type ShellDialect,
	type XmlEscapeOptions,
	escapeByFlavor,
	escapeSegmentsByFlavor,
	unescapeByFlavor,
} from '@/lib/services/escape';

type Side = 'raw' | 'escaped';

const FLAVOR_TABS = [
	{ id: 'json' as const, label: 'JSON', icon: Braces },
	{ id: 'javascript' as const, label: 'JS', icon: FileCode },
	{ id: 'html' as const, label: 'HTML', icon: Globe },
	{ id: 'xml' as const, label: 'XML', icon: FileCode },
	{ id: 'csv' as const, label: 'CSV', icon: Table },
	{ id: 'shell' as const, label: 'Shell', icon: Terminal },
] as const;

const PERSIST_KEY = 'escape-tool';

const EMPTY_BY_FLAVOR: Record<EscapeFlavor, string> = {
	json: '',
	javascript: '',
	html: '',
	xml: '',
	csv: '',
	shell: '',
};

interface PersistedOptions {
	readonly activeFlavor: EscapeFlavor;
	readonly options: FlavorOptions;
}

const PERSISTED_DEFAULTS: PersistedOptions = {
	activeFlavor: 'json',
	options: DEFAULT_FLAVOR_OPTIONS,
};

const useEscapeOptions = createToolOptionsStore<PersistedOptions>(
	'escape-tool',
	PERSISTED_DEFAULTS
);

const isEscapeFlavor = (value: string): value is EscapeFlavor =>
	value === 'json' ||
	value === 'javascript' ||
	value === 'html' ||
	value === 'xml' ||
	value === 'csv' ||
	value === 'shell';

export const Route = createFileRoute('/escape-tool')({
	component: EscapeToolPage,
});

function EscapeToolPage() {
	const persistedTab = useActiveTab(PERSIST_KEY);
	const setActive = useTabStore((s) => s.setActive);

	const persisted = useEscapeOptions((s) => s.value);
	const patchPersisted = useEscapeOptions((s) => s.patch);

	const activeFlavor: EscapeFlavor = (() => {
		if (persistedTab && isEscapeFlavor(persistedTab)) return persistedTab;
		return persisted.activeFlavor;
	})();

	useDocumentTitle('Escape / Unescape');

	const handleTabChange = (tab: string) => {
		if (!isEscapeFlavor(tab)) return;
		setActive(PERSIST_KEY, tab);
		patchPersisted({ activeFlavor: tab });
	};

	const [rawByFlavor, setRawByFlavor] = useState<Record<EscapeFlavor, string>>({
		...EMPTY_BY_FLAVOR,
	});
	const [escapedByFlavor, setEscapedByFlavor] = useState<Record<EscapeFlavor, string>>({
		...EMPTY_BY_FLAVOR,
	});

	// `lastEditedSide` tracks which textarea the user typed into last so the
	// reactive sync effect knows which direction to transform.
	const lastEditedSideRef = useRef<Side>('raw');

	const raw = rawByFlavor[activeFlavor];
	const escaped = escapedByFlavor[activeFlavor];

	// Debounce the textareas separately so character-by-character processing
	// (escapeByFlavor / unescapeByFlavor traverse every input character) does
	// not run on every keystroke. Typing remains instant in the textarea
	// (which renders `raw` / `escaped` directly); only the cross-side sync
	// lags by 150ms.
	const debouncedRaw = useDebouncedValue(raw, 150);
	const debouncedEscaped = useDebouncedValue(escaped, 150);

	// Sync: when the raw side or options change after a raw edit, recompute the
	// escaped side. Symmetrically, after an escaped edit recompute the raw
	// side. Driven by `[activeFlavor, persisted.options, debouncedRaw,
	// debouncedEscaped]` so option toggles take effect immediately.
	useEffect(() => {
		if (lastEditedSideRef.current === 'raw') {
			const nextEscaped = escapeByFlavor(activeFlavor, debouncedRaw, persisted.options);
			if (nextEscaped !== escapedByFlavor[activeFlavor]) {
				setEscapedByFlavor((prev) => ({ ...prev, [activeFlavor]: nextEscaped }));
			}
		} else {
			const nextRaw = unescapeByFlavor(activeFlavor, debouncedEscaped, persisted.options);
			if (nextRaw !== rawByFlavor[activeFlavor]) {
				setRawByFlavor((prev) => ({ ...prev, [activeFlavor]: nextRaw }));
			}
		}
		// rawByFlavor / escapedByFlavor read inside the effect intentionally
		// skip the dep array to avoid cycling on the very state this effect
		// writes; the debounced reads above already provide the trigger.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeFlavor, persisted.options, debouncedRaw, debouncedEscaped]);

	const updateRaw = (value: string) => {
		lastEditedSideRef.current = 'raw';
		setRawByFlavor((prev) => ({ ...prev, [activeFlavor]: value }));
	};

	const updateEscaped = (value: string) => {
		lastEditedSideRef.current = 'escaped';
		setEscapedByFlavor((prev) => ({ ...prev, [activeFlavor]: value }));
	};

	const updateOptions = <K extends EscapeFlavor>(flavor: K, next: FlavorOptions[K]) => {
		patchPersisted({
			options: {
				...persisted.options,
				[flavor]: next,
			},
		});
	};

	const resetFlavorOptions = () => {
		patchPersisted({
			options: {
				...persisted.options,
				[activeFlavor]: DEFAULT_FLAVOR_OPTIONS[activeFlavor],
			},
		});
	};

	const handlePaste = async (side: Side) => {
		const text = await pasteFromClipboard();
		if (text === null) return;
		if (side === 'raw') updateRaw(text);
		else updateEscaped(text);
	};

	const handleClear = (side: Side) => {
		if (side === 'raw') updateRaw('');
		else updateEscaped('');
	};

	const handleSample = () => {
		const sample = SAMPLES[activeFlavor];
		lastEditedSideRef.current = 'raw';
		setRawByFlavor((prev) => ({ ...prev, [activeFlavor]: sample.raw }));
	};

	const segments: readonly EscapedSegment[] =
		raw.length === 0 ? [] : escapeSegmentsByFlavor(activeFlavor, raw, persisted.options);

	const rawLength = raw.length;
	const escapedLength = escaped.length;
	const delta = escapedLength - rawLength;

	const renderOptionsForFlavor = () => {
		if (activeFlavor === 'json') {
			const opts = persisted.options.json;
			return (
				<FormCheckboxGroup>
					<FormCheckbox
						label="Escape non-ASCII characters as \\uHHHH"
						checked={opts.escapeUnicode}
						onCheckedChange={(v) => updateOptions<'json'>('json', { ...opts, escapeUnicode: v })}
						size="compact"
					/>
					<FormCheckbox
						label="Preserve forward slash (/)"
						checked={opts.preserveForwardSlash}
						onCheckedChange={(v) =>
							updateOptions<'json'>('json', { ...opts, preserveForwardSlash: v })
						}
						size="compact"
					/>
				</FormCheckboxGroup>
			);
		}
		if (activeFlavor === 'javascript') {
			const opts = persisted.options.javascript;
			return (
				<div className="space-y-3">
					<FormMode<JsEscapeOptions['quoteStyle']>
						label="Quote style"
						value={opts.quoteStyle}
						onValueChange={(v) =>
							updateOptions<'javascript'>('javascript', { ...opts, quoteStyle: v })
						}
						options={[
							{ value: 'single', label: "Single (')" },
							{ value: 'double', label: 'Double (")' },
						]}
					/>
					<FormCheckboxGroup>
						<FormCheckbox
							label="Escape non-ASCII characters"
							checked={opts.escapeUnicode}
							onCheckedChange={(v) =>
								updateOptions<'javascript'>('javascript', { ...opts, escapeUnicode: v })
							}
							size="compact"
						/>
					</FormCheckboxGroup>
				</div>
			);
		}
		if (activeFlavor === 'html') {
			const opts = persisted.options.html;
			return (
				<div className="space-y-3">
					<FormMode<HtmlEscapeOptions['entityForm']>
						label="Entity form"
						value={opts.entityForm}
						onValueChange={(v) => updateOptions<'html'>('html', { ...opts, entityForm: v })}
						options={[
							{ value: 'named', label: 'Named (&amp;)' },
							{ value: 'numeric', label: 'Numeric (&#38;)' },
						]}
						layout="stacked"
					/>
					<FormCheckboxGroup>
						<FormCheckbox
							label="Encode non-ASCII characters"
							checked={opts.encodeNonAscii}
							onCheckedChange={(v) => updateOptions<'html'>('html', { ...opts, encodeNonAscii: v })}
							size="compact"
						/>
					</FormCheckboxGroup>
				</div>
			);
		}
		if (activeFlavor === 'xml') {
			const opts = persisted.options.xml;
			const toggle = (key: keyof XmlEscapeOptions, v: boolean) =>
				updateOptions<'xml'>('xml', { ...opts, [key]: v });
			return (
				<FormCheckboxGroup>
					<FormCheckbox
						label="& → &amp;"
						checked={opts.amp}
						onCheckedChange={(v) => toggle('amp', v)}
						size="compact"
					/>
					<FormCheckbox
						label="< → &lt;"
						checked={opts.lt}
						onCheckedChange={(v) => toggle('lt', v)}
						size="compact"
					/>
					<FormCheckbox
						label="> → &gt;"
						checked={opts.gt}
						onCheckedChange={(v) => toggle('gt', v)}
						size="compact"
					/>
					<FormCheckbox
						label={'" → &quot;'}
						checked={opts.quot}
						onCheckedChange={(v) => toggle('quot', v)}
						size="compact"
					/>
					<FormCheckbox
						label={"' → &apos;"}
						checked={opts.apos}
						onCheckedChange={(v) => toggle('apos', v)}
						size="compact"
					/>
				</FormCheckboxGroup>
			);
		}
		if (activeFlavor === 'csv') {
			const opts = persisted.options.csv;
			const isAllowedSeparator = (v: string): v is CsvSeparator =>
				v === ',' || v === ';' || v === '\t';
			return (
				<div className="space-y-3">
					<FormMode<CsvSeparator>
						label="Separator"
						value={opts.separator}
						onValueChange={(v) => {
							if (isAllowedSeparator(v)) {
								updateOptions<'csv'>('csv', { ...opts, separator: v });
							}
						}}
						options={[
							{ value: ',', label: 'Comma' },
							{ value: ';', label: 'Semicolon' },
							{ value: '\t', label: 'Tab' },
						]}
						layout="stacked"
					/>
					<FormMode<CsvEscapeOptions['quoteStyle']>
						label="Quote style"
						value={opts.quoteStyle}
						onValueChange={(v) => updateOptions<'csv'>('csv', { ...opts, quoteStyle: v })}
						options={[
							{
								value: 'minimal',
								label: 'Minimal',
								description: 'Quote only when needed',
							},
							{
								value: 'always',
								label: 'Always',
								description: 'Always wrap in quotes',
							},
						]}
						layout="stacked"
					/>
				</div>
			);
		}
		if (activeFlavor === 'shell') {
			const opts = persisted.options.shell;
			return (
				<FormSelect
					label="Dialect"
					value={opts.dialect}
					onValueChange={(v) =>
						updateOptions<'shell'>('shell', { ...opts, dialect: v as ShellDialect })
					}
					options={[
						{ value: 'bash', label: 'Bash / POSIX', description: 'Single-quote wrap' },
						{ value: 'powershell', label: 'PowerShell', description: 'Single-quote wrap' },
						{ value: 'cmd', label: 'Windows CMD', description: 'Double-quote + caret' },
					]}
					size="compact"
				/>
			);
		}
		return null;
	};

	const rail = (
		<>
			<FormSection title="Mode">
				<FormInfo>
					Both panes are editable. Typing in the raw side updates the escaped side; typing in the
					escaped side updates the raw side via parsing.
				</FormInfo>
			</FormSection>

			<FormSection title="Options">{renderOptionsForFlavor()}</FormSection>

			<FormSection title="Actions">
				<Button variant="outline" size="sm" className="w-full" onClick={resetFlavorOptions}>
					<RotateCcw className="size-3.5" />
					Reset {FLAVOR_TABS.find((t) => t.id === activeFlavor)?.label} options
				</Button>
			</FormSection>

			<ToolFooter
				relatedItems={[
					{ id: 'base64-encoder', reason: 'Encode and decode Base64 text' },
					{ id: 'url-encoder', reason: 'Percent-encode and decode URLs' },
					{ id: 'string-compressor', reason: 'Compress and decompress text' },
				]}
				aboutText={FLAVOR_DESCRIPTIONS[activeFlavor]}
			/>
		</>
	);

	const renderPaneHeader = (label: string, side: Side) => {
		const value = side === 'raw' ? raw : escaped;
		const onClear = () => handleClear(side);
		const onPaste = (): void => {
			handlePaste(side).catch(() => {
				// `pasteFromClipboard` already surfaces clipboard failures via toast.
			});
		};
		return (
			<div className="flex items-center justify-between gap-2 border-b bg-surface-2 px-3 py-2">
				<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					{label}
				</span>
				<div className="flex items-center gap-1">
					<CopyButton text={value} toastLabel={label} variant="ghost" size="sm" showLabel={false} />
					<IconTooltip label={`Paste into ${label.toLowerCase()}`}>
						<Button variant="ghost" size="icon-sm" onClick={onPaste}>
							<ClipboardPaste className="size-3.5" />
							<span className="sr-only">Paste</span>
						</Button>
					</IconTooltip>
					<IconTooltip label={`Clear ${label.toLowerCase()}`}>
						<Button variant="ghost" size="icon-sm" onClick={onClear}>
							<Eraser className="size-3.5" />
							<span className="sr-only">Clear</span>
						</Button>
					</IconTooltip>
					{side === 'raw' ? (
						<IconTooltip label="Load sample">
							<Button variant="ghost" size="icon-sm" onClick={handleSample}>
								<FlaskConical className="size-3.5" />
								<span className="sr-only">Sample</span>
							</Button>
						</IconTooltip>
					) : null}
				</div>
			</div>
		);
	};

	const renderHighlightOverlay = () => {
		if (segments.length === 0) {
			return (
				<div className="pointer-events-none flex h-full items-center justify-center text-xs text-muted-foreground">
					Enter raw input above to see the escaped output and highlighted changes.
				</div>
			);
		}
		// Carry a running offset into each segment so React keys reflect both
		// position and content, avoiding the array-index anti-pattern.
		let offset = 0;
		const keyedSegments = segments.map((seg) => {
			const key = `${offset}:${seg.text}`;
			offset += seg.text.length;
			return { key, seg };
		});
		return (
			<pre className="m-0 h-full overflow-auto whitespace-pre-wrap break-words bg-muted/20 px-3 py-2 font-mono text-sm leading-relaxed">
				{keyedSegments.map(({ key, seg }) => (
					<span key={key} className={cn(seg.changed && 'rounded-sm bg-warning/20 text-foreground')}>
						{seg.text}
					</span>
				))}
			</pre>
		);
	};

	const renderMain = () => (
		<div className="flex h-full min-h-0 flex-1 overflow-hidden p-3">
			<SplitPane
				direction="horizontal"
				defaultSizes={[50, 50]}
				minSizes={[25, 25]}
				className="gap-3"
				left={
					<div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
						{renderPaneHeader('Raw', 'raw')}
						<Textarea
							value={raw}
							onChange={(e) => updateRaw(e.currentTarget.value)}
							placeholder="Type or paste the raw text to escape..."
							spellCheck={false}
							className="min-h-32 flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-sm focus-visible:ring-0"
						/>
					</div>
				}
				right={
					<div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
						{renderPaneHeader('Escaped', 'escaped')}
						<div className="grid min-h-0 flex-1 grid-rows-2 divide-y">
							<Textarea
								value={escaped}
								onChange={(e) => updateEscaped(e.currentTarget.value)}
								placeholder="Escaped output appears here. Edit directly to unescape back to raw."
								spellCheck={false}
								className="min-h-32 h-full resize-none rounded-none border-0 bg-transparent font-mono text-sm focus-visible:ring-0"
							/>
							<div className="min-h-32 overflow-hidden">{renderHighlightOverlay()}</div>
						</div>
					</div>
				}
			/>
		</div>
	);

	return (
		<ToolShell
			layout="tabbed"
			tabs={FLAVOR_TABS}
			activeTab={activeFlavor}
			onTabChange={handleTabChange}
			rail={rail}
			statusContent={
				<>
					<StatItem label="Raw" value={`${rawLength} chars`} />
					<StatItem label="Escaped" value={`${escapedLength} chars`} />
					<StatItem
						label="Δ"
						value={delta > 0 ? `+${delta}` : `${delta}`}
						variant={delta > 0 ? 'warning' : 'default'}
					/>
				</>
			}
			renderTabContent={() => renderMain()}
		/>
	);
}
