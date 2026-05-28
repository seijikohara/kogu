import { createFileRoute } from '@tanstack/react-router';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import {
	ClipboardCopy,
	Download,
	Eye,
	GripVertical,
	Plus,
	RefreshCw,
	Save,
	Shuffle,
	Table2,
	TestTube,
	Trash2,
} from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { ActionButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormError,
	FormInput,
	FormSection,
	FormSelect,
	FormSlider,
	FormTextarea,
} from '@/lib/components/form';
import { SectionHeader } from '@/lib/components/layout';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { useDocumentTitle } from '@/lib/hooks';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import {
	approxUtf8Bytes,
	COLUMN_TYPE_LABELS,
	COLUMN_TYPES,
	type ColumnSpec,
	createColumnId,
	type DatasetSpec,
	DEFAULT_COLUMN_OPTIONS,
	EMPTY_SPEC,
	ensureColumnIds,
	formatOutput,
	generateDataset,
	humanSize,
	isColumnType,
	isLocale,
	isOutputFormat,
	LOCALE_LABELS,
	LOCALES,
	OUTPUT_FORMAT_EXTENSIONS,
	OUTPUT_FORMAT_LABELS,
	OUTPUT_FORMATS,
	type OutputFormat,
	ROW_COUNT_MAX,
	ROW_COUNT_MIN,
	SAMPLE_SPEC,
} from '@/lib/services/test-data';
import { cn } from '@/lib/utils';

interface TestDataPrefs {
	readonly spec: DatasetSpec;
	readonly format: OutputFormat;
	readonly sqlTableName: string;
}

const DEFAULT_PREFS: TestDataPrefs = {
	spec: SAMPLE_SPEC,
	format: 'csv',
	sqlTableName: 'generated_data',
};

const useTestDataPrefs = createToolOptionsStore<TestDataPrefs>(
	'test-data-generator',
	DEFAULT_PREFS
);

const PREVIEW_ROWS = 10;
const RANDOM_SEED_MAX = 9_999_999;

export const Route = createFileRoute('/test-data-generator')({
	component: TestDataGeneratorPage,
});

function TestDataGeneratorPage() {
	useDocumentTitle('Test Data Generator');

	const { value: prefs, patch } = useTestDataPrefs();
	// Persisted specs from earlier preview builds may lack the `id`
	// field. Repair them up-front so the rest of the component can
	// assume every column has a stable identifier.
	const spec = useMemo(() => ensureColumnIds(prefs.spec), [prefs.spec]);
	const { format, sqlTableName } = prefs;

	const [showRail, setShowRail] = usePersistedRail('test-data-generator');

	const updateSpec = useCallback(
		(next: Partial<DatasetSpec>) => {
			patch({ spec: { ...spec, ...next } });
		},
		[patch, spec]
	);

	const updateColumns = useCallback(
		(columns: readonly ColumnSpec[]) => {
			updateSpec({ columns });
		},
		[updateSpec]
	);

	const handleAddColumn = useCallback(() => {
		const nextIndex = spec.columns.length + 1;
		const column: ColumnSpec = {
			id: createColumnId(),
			name: `column_${nextIndex}`,
			type: 'string',
			options: { ...DEFAULT_COLUMN_OPTIONS.string },
		};
		updateColumns([...spec.columns, column]);
	}, [spec.columns, updateColumns]);

	const handleRemoveAll = useCallback(() => {
		updateSpec({ columns: EMPTY_SPEC.columns });
	}, [updateSpec]);

	const handleLoadSample = useCallback(() => {
		patch({ spec: SAMPLE_SPEC });
	}, [patch]);

	const handleColumnChange = useCallback(
		(index: number, next: ColumnSpec) => {
			updateColumns(spec.columns.map((col, idx) => (idx === index ? next : col)));
		},
		[spec.columns, updateColumns]
	);

	const handleColumnRemove = useCallback(
		(index: number) => {
			updateColumns(spec.columns.filter((_unused, idx) => idx !== index));
		},
		[spec.columns, updateColumns]
	);

	const handleMoveColumn = useCallback(
		(index: number, direction: -1 | 1) => {
			const target = index + direction;
			if (target < 0 || target >= spec.columns.length) return;
			const next = [...spec.columns];
			const [moved] = next.splice(index, 1);
			if (!moved) return;
			next.splice(target, 0, moved);
			updateColumns(next);
		},
		[spec.columns, updateColumns]
	);

	const handleRandomSeed = useCallback(() => {
		const seed = Math.floor(Math.random() * RANDOM_SEED_MAX);
		updateSpec({ seed });
	}, [updateSpec]);

	const handleLocaleChange = (value: string) => {
		if (isLocale(value)) updateSpec({ locale: value });
	};

	const handleFormatChange = (value: string) => {
		if (isOutputFormat(value)) patch({ format: value });
	};

	const previewSpec = useMemo<DatasetSpec>(
		() => ({ ...spec, rowCount: Math.min(spec.rowCount, PREVIEW_ROWS) }),
		[spec]
	);

	const previewRows = useMemo(() => {
		if (spec.columns.length === 0) return [];
		try {
			return generateDataset(previewSpec);
		} catch {
			return [];
		}
	}, [previewSpec, spec.columns.length]);

	const headers = useMemo(() => spec.columns.map((col) => col.name), [spec.columns]);

	const previewOutput = useMemo(() => {
		if (spec.columns.length === 0) return '';
		try {
			return formatOutput(previewRows, headers, format, sqlTableName);
		} catch {
			return '';
		}
	}, [format, headers, previewRows, sqlTableName, spec.columns.length]);

	const approximateSize = useMemo(() => {
		if (spec.columns.length === 0 || spec.rowCount === 0) return 0;
		if (previewRows.length === 0) return 0;
		// Extrapolate from preview output size to the full row count so
		// the status bar shows a realistic estimate without building the
		// whole dataset up-front.
		const previewBytes = approxUtf8Bytes(previewOutput);
		const ratio = spec.rowCount / Math.max(1, previewRows.length);
		return Math.round(previewBytes * ratio);
	}, [previewOutput, previewRows.length, spec.columns.length, spec.rowCount]);

	const duplicateNames = useMemo(() => {
		const counts = new Map<string, number>();
		spec.columns.forEach((col) => {
			counts.set(col.name, (counts.get(col.name) ?? 0) + 1);
		});
		return Array.from(counts.entries())
			.filter(([, n]) => n > 1)
			.map(([name]) => name);
	}, [spec.columns]);

	const hasError = duplicateNames.length > 0;
	const errorMessage = hasError
		? `Duplicate column name(s): ${duplicateNames.join(', ')}`
		: undefined;

	const generateFull = useCallback((): string => {
		const rows = generateDataset(spec);
		return formatOutput(rows, headers, format, sqlTableName);
	}, [format, headers, sqlTableName, spec]);

	const handleCopyOutput = useCallback(async () => {
		if (spec.columns.length === 0) {
			toast.error('Add at least one column before generating');
			return;
		}
		try {
			const text = generateFull();
			await navigator.clipboard.writeText(text);
			toast.success('Generated dataset copied to clipboard', {
				description: `${spec.rowCount.toLocaleString()} rows, ${humanSize(approxUtf8Bytes(text))}`,
			});
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to generate', { description: message });
		}
	}, [generateFull, spec.columns.length, spec.rowCount]);

	const handleSaveOutput = useCallback(async () => {
		if (spec.columns.length === 0) {
			toast.error('Add at least one column before generating');
			return;
		}
		try {
			const extension = OUTPUT_FORMAT_EXTENSIONS[format];
			const defaultPath = `test-data.${extension}`;
			const target = await saveDialog({
				defaultPath,
				filters: [{ name: OUTPUT_FORMAT_LABELS[format], extensions: [extension] }],
			});
			if (!target) return;
			const text = generateFull();
			await writeTextFile(target, text);
			toast.success('Dataset saved', {
				description: `${spec.rowCount.toLocaleString()} rows → ${target}`,
			});
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to save', { description: message });
		}
	}, [format, generateFull, spec.columns.length, spec.rowCount]);

	const handleResetDefaults = useCallback(() => {
		patch(DEFAULT_PREFS);
	}, [patch]);

	const localeOptions = useMemo(
		() => LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] })),
		[]
	);

	const formatOptions = useMemo(
		() => OUTPUT_FORMATS.map((f) => ({ value: f, label: OUTPUT_FORMAT_LABELS[f] })),
		[]
	);

	const hasColumns = spec.columns.length > 0;

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			valid={hasError ? false : hasColumns ? true : null}
			error={errorMessage}
			statusContent={
				<>
					<StatItem label="Columns" value={spec.columns.length} />
					<StatItem label="Rows" value={spec.rowCount.toLocaleString()} />
					<StatItem label="Approx size" value={humanSize(approximateSize)} />
				</>
			}
			rail={
				<>
					<FormSection title="Dataset">
						<div className="flex flex-col gap-2">
							<ActionButton label="Add column" icon={Plus} onClick={handleAddColumn} size="sm" />
							<ActionButton
								label="Load sample"
								icon={TestTube}
								variant="outline"
								size="sm"
								onClick={handleLoadSample}
							/>
							<ActionButton
								label="Clear all"
								icon={Trash2}
								variant="outline"
								size="sm"
								onClick={handleRemoveAll}
								disabled={!hasColumns}
							/>
						</div>
					</FormSection>

					<FormSection title="Row count">
						<FormSlider
							label="Rows"
							value={spec.rowCount}
							min={ROW_COUNT_MIN}
							max={ROW_COUNT_MAX}
							step={1}
							valueLabel={spec.rowCount.toLocaleString()}
							onValueChange={(v) => updateSpec({ rowCount: v })}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Locale">
						<FormSelect
							label="Language / region"
							value={spec.locale}
							options={localeOptions}
							onValueChange={handleLocaleChange}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Seed">
						<FormInput
							label="Random seed"
							value={String(spec.seed)}
							onValueChange={(v) => {
								const parsed = Number.parseInt(v, 10);
								if (Number.isFinite(parsed)) updateSpec({ seed: parsed });
							}}
							hint="Same seed produces the same data"
							size="compact"
						/>
						<ActionButton
							label="Randomize seed"
							icon={Shuffle}
							variant="outline"
							size="sm"
							onClick={handleRandomSeed}
						/>
					</FormSection>

					<FormSection title="Output">
						<FormSelect
							label="Format"
							value={format}
							options={formatOptions}
							onValueChange={handleFormatChange}
							size="compact"
						/>
						{format === 'sql' ? (
							<FormInput
								label="SQL table name"
								value={sqlTableName}
								onValueChange={(v) => patch({ sqlTableName: v })}
								placeholder="generated_data"
								size="compact"
							/>
						) : null}
					</FormSection>

					<FormSection title="Export">
						<div className="flex flex-col gap-2">
							<ActionButton
								label="Copy to clipboard"
								icon={ClipboardCopy}
								onClick={handleCopyOutput}
								disabled={!hasColumns || hasError}
								size="sm"
							/>
							<ActionButton
								label="Save file…"
								icon={Save}
								variant="outline"
								onClick={handleSaveOutput}
								disabled={!hasColumns || hasError}
								size="sm"
							/>
							<ActionButton
								label="Reset options"
								icon={RefreshCw}
								variant="outline"
								size="sm"
								onClick={handleResetDefaults}
							/>
						</div>
					</FormSection>

					<ToolFooter
						relatedItems={[
							{ id: 'lorem-ipsum', reason: 'Generate placeholder text' },
							{ id: 'uuid-generator', reason: 'Standalone UUIDs' },
							{ id: 'regex-tester', reason: 'Test regex patterns first' },
						]}
						aboutText={
							<ul className="list-inside list-disc space-y-0.5">
								<li>20+ column types — numeric, text, date, identity, regex, sequence</li>
								<li>Locale-aware names and addresses (en / ja / fr / de / es)</li>
								<li>Per-column nullability and uniqueness</li>
								<li>Export as CSV / TSV / JSON / NDJSON / SQL INSERT</li>
								<li>Same seed → same data; randomize the seed for fresh output</li>
							</ul>
						}
					/>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<SectionHeader
					title="Dataset"
					trailing={
						<div className="flex items-center gap-2">
							<Badge variant="outline" className="font-mono text-2xs">
								{spec.columns.length} cols × {spec.rowCount.toLocaleString()} rows
							</Badge>
							<Button
								variant="outline"
								size="sm"
								className="h-7"
								onClick={handleSaveOutput}
								disabled={!hasColumns || hasError}
							>
								<Download className="h-3.5 w-3.5" />
								Save
							</Button>
						</div>
					}
				/>
				<div className="flex-1 overflow-auto p-4">
					{hasError ? <FormError message={errorMessage} className="mb-3" /> : null}
					{hasColumns ? (
						<div className="grid grid-cols-1 gap-3">
							<ColumnBuilderCard
								columns={spec.columns}
								onChange={handleColumnChange}
								onRemove={handleColumnRemove}
								onMove={handleMoveColumn}
								onAdd={handleAddColumn}
							/>
							<PreviewCard
								columns={spec.columns}
								rows={previewRows}
								totalRows={spec.rowCount}
								format={format}
								previewOutput={previewOutput}
							/>
						</div>
					) : (
						<EmptyState onLoadSample={handleLoadSample} onAdd={handleAddColumn} />
					)}
				</div>
			</div>
		</ToolShell>
	);
}

interface EmptyStateProps {
	readonly onLoadSample: () => void;
	readonly onAdd: () => void;
}

function EmptyState({ onLoadSample, onAdd }: EmptyStateProps) {
	return (
		<div className="flex h-full items-center justify-center">
			<div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border p-10 text-center">
				<EmbeddedEmptyState
					icon={TestTube}
					title="No columns defined"
					description="Add columns one by one, or load the sample schema to see how the builder works."
				/>
				<div className="flex flex-col gap-2 sm:flex-row">
					<Button variant="default" size="sm" onClick={onLoadSample}>
						<TestTube className="h-3.5 w-3.5" />
						Load sample
					</Button>
					<Button variant="outline" size="sm" onClick={onAdd}>
						<Plus className="h-3.5 w-3.5" />
						Add column
					</Button>
				</div>
			</div>
		</div>
	);
}

interface ColumnBuilderCardProps {
	readonly columns: readonly ColumnSpec[];
	readonly onChange: (index: number, next: ColumnSpec) => void;
	readonly onRemove: (index: number) => void;
	readonly onMove: (index: number, direction: -1 | 1) => void;
	readonly onAdd: () => void;
}

function ColumnBuilderCard({ columns, onChange, onRemove, onMove, onAdd }: ColumnBuilderCardProps) {
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center justify-between gap-2 text-sm">
					<span className="flex items-center gap-2">
						<Table2 className="h-4 w-4 text-muted-foreground" />
						Columns
					</span>
					<Button variant="outline" size="sm" className="h-7" onClick={onAdd}>
						<Plus className="h-3.5 w-3.5" />
						Add column
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{columns.map((column, index) => (
					<ColumnRow
						key={column.id}
						column={column}
						index={index}
						total={columns.length}
						onChange={(next) => onChange(index, next)}
						onRemove={() => onRemove(index)}
						onMoveUp={() => onMove(index, -1)}
						onMoveDown={() => onMove(index, 1)}
					/>
				))}
			</CardContent>
		</Card>
	);
}

interface ColumnRowProps {
	readonly column: ColumnSpec;
	readonly index: number;
	readonly total: number;
	readonly onChange: (next: ColumnSpec) => void;
	readonly onRemove: () => void;
	readonly onMoveUp: () => void;
	readonly onMoveDown: () => void;
}

function ColumnRow({
	column,
	index,
	total,
	onChange,
	onRemove,
	onMoveUp,
	onMoveDown,
}: ColumnRowProps) {
	const typeOptions = useMemo(
		() => COLUMN_TYPES.map((t) => ({ value: t, label: COLUMN_TYPE_LABELS[t] })),
		[]
	);

	const handleTypeChange = (value: string) => {
		if (!isColumnType(value)) return;
		// Reset type-specific options when the type changes so an
		// incompatible carry-over (e.g. `min`/`max` on `email`) cannot
		// confuse the cell generator.
		onChange({
			...column,
			type: value,
			options: { ...DEFAULT_COLUMN_OPTIONS[value] },
		});
	};

	const handleNameChange = (value: string) => {
		onChange({ ...column, name: value });
	};

	const handleNullableChange = (value: number) => {
		onChange({ ...column, nullablePercent: value });
	};

	const handleUniqueChange = (checked: boolean) => {
		onChange({ ...column, unique: checked });
	};

	const handleOptionChange = (key: string, value: unknown) => {
		onChange({
			...column,
			options: { ...(column.options ?? {}), [key]: value },
		});
	};

	return (
		<div className="rounded-md border border-border bg-background p-2.5">
			<div className="flex items-start gap-2">
				<div className="flex flex-col items-center gap-0.5 pt-1">
					<GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
					<span className="text-2xs text-muted-foreground">#{index + 1}</span>
				</div>
				<div className="grid min-w-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2">
					<FormInput
						label="Name"
						value={column.name}
						onValueChange={handleNameChange}
						size="compact"
					/>
					<FormSelect
						label="Type"
						value={column.type}
						options={typeOptions}
						onValueChange={handleTypeChange}
						size="compact"
					/>
					<TypeOptionsEditor column={column} onOptionChange={handleOptionChange} />
					<div className="space-y-1.5">
						<FormSlider
							label="Nullable %"
							value={column.nullablePercent ?? 0}
							min={0}
							max={100}
							step={5}
							valueLabel={`${column.nullablePercent ?? 0}%`}
							onValueChange={handleNullableChange}
							size="compact"
						/>
						<FormCheckbox
							label="Unique values"
							checked={column.unique ?? false}
							onCheckedChange={handleUniqueChange}
							size="compact"
						/>
					</div>
				</div>
				<div className="flex flex-col gap-1">
					<Button
						variant="ghost"
						size="icon-sm"
						className="h-6 w-6"
						onClick={onMoveUp}
						disabled={index === 0}
						title="Move up"
					>
						<span className="text-xs">▲</span>
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						className="h-6 w-6"
						onClick={onMoveDown}
						disabled={index === total - 1}
						title="Move down"
					>
						<span className="text-xs">▼</span>
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						className="h-6 w-6 text-destructive hover:text-destructive"
						onClick={onRemove}
						title="Remove column"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>
		</div>
	);
}

interface TypeOptionsEditorProps {
	readonly column: ColumnSpec;
	readonly onOptionChange: (key: string, value: unknown) => void;
}

function TypeOptionsEditor({ column, onOptionChange }: TypeOptionsEditorProps) {
	const opts = column.options ?? {};

	const numberValue = (key: string, fallback: number): number => {
		const raw = opts[key];
		return typeof raw === 'number' ? raw : fallback;
	};

	const stringValue = (key: string, fallback: string): string => {
		const raw = opts[key];
		return typeof raw === 'string' ? raw : fallback;
	};

	const handleNumberInput = (key: string, fallback: number) => (value: string) => {
		const parsed = Number(value);
		onOptionChange(key, Number.isFinite(parsed) ? parsed : fallback);
	};

	switch (column.type) {
		case 'integer':
			return (
				<div className="grid grid-cols-2 gap-2">
					<FormInput
						label="Min"
						value={String(numberValue('min', 1))}
						onValueChange={handleNumberInput('min', 1)}
						size="compact"
					/>
					<FormInput
						label="Max"
						value={String(numberValue('max', 1000))}
						onValueChange={handleNumberInput('max', 1000)}
						size="compact"
					/>
				</div>
			);
		case 'float':
			return (
				<div className="grid grid-cols-3 gap-2">
					<FormInput
						label="Min"
						value={String(numberValue('min', 0))}
						onValueChange={handleNumberInput('min', 0)}
						size="compact"
					/>
					<FormInput
						label="Max"
						value={String(numberValue('max', 1))}
						onValueChange={handleNumberInput('max', 1)}
						size="compact"
					/>
					<FormInput
						label="Decimals"
						value={String(numberValue('decimals', 2))}
						onValueChange={handleNumberInput('decimals', 2)}
						size="compact"
					/>
				</div>
			);
		case 'string':
			return (
				<FormInput
					label="Length"
					value={String(numberValue('length', 12))}
					onValueChange={handleNumberInput('length', 12)}
					size="compact"
				/>
			);
		case 'date':
		case 'datetime':
			return (
				<div className="grid grid-cols-2 gap-2">
					<FormInput
						label="Format"
						value={stringValue('format', column.type === 'date' ? 'YYYY-MM-DD' : 'ISO')}
						onValueChange={(value) => onOptionChange('format', value)}
						hint="YYYY-MM-DD, ISO, UNIX, UNIX_MS"
						size="compact"
					/>
					<FormInput
						label="Years back"
						value={String(numberValue('yearsBack', 5))}
						onValueChange={handleNumberInput('yearsBack', 5)}
						size="compact"
					/>
				</div>
			);
		case 'lorem-words':
		case 'lorem-sentences':
			return (
				<FormInput
					label="Count"
					value={String(numberValue('count', column.type === 'lorem-words' ? 4 : 1))}
					onValueChange={handleNumberInput('count', column.type === 'lorem-words' ? 4 : 1)}
					size="compact"
				/>
			);
		case 'pick-from-list':
			return (
				<FormTextarea
					label="Values (comma- or newline-separated)"
					value={stringValue('values', 'red, green, blue')}
					onValueChange={(value) => onOptionChange('values', value)}
					rows={2}
					size="compact"
				/>
			);
		case 'sequence':
			return (
				<div className="grid grid-cols-2 gap-2">
					<FormInput
						label="Start"
						value={String(numberValue('start', 1))}
						onValueChange={handleNumberInput('start', 1)}
						size="compact"
					/>
					<FormInput
						label="Step"
						value={String(numberValue('step', 1))}
						onValueChange={handleNumberInput('step', 1)}
						size="compact"
					/>
				</div>
			);
		case 'regex':
			return (
				<FormInput
					label="Pattern"
					value={stringValue('pattern', '[A-Z]{2}-[0-9]{4}')}
					onValueChange={(value) => onOptionChange('pattern', value)}
					hint="Supports literals, classes, ?, +, *, {n}, {n,m}, |"
					size="compact"
				/>
			);
		default:
			return (
				<div className="flex h-full items-end text-xs text-muted-foreground">
					<span>No additional options</span>
				</div>
			);
	}
}

interface PreviewCardProps {
	readonly columns: readonly ColumnSpec[];
	readonly rows: readonly (readonly string[])[];
	readonly totalRows: number;
	readonly format: OutputFormat;
	readonly previewOutput: string;
}

function PreviewCard({ columns, rows, totalRows, format, previewOutput }: PreviewCardProps) {
	const displayCount = Math.min(rows.length, PREVIEW_ROWS);
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-sm">
					<Eye className="h-4 w-4 text-muted-foreground" />
					Preview
					<Badge variant="outline" className="font-mono text-2xs">
						{displayCount} of {totalRows.toLocaleString()}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="overflow-auto rounded-md border bg-muted/30">
					<table className="w-full border-collapse text-xs">
						<thead className="sticky top-0 bg-surface-2">
							<tr>
								{columns.map((col, idx) => (
									<th
										key={col.id}
										className="border-b border-border px-2 py-1.5 text-left font-medium text-foreground"
									>
										<div className="flex items-center gap-1">
											<span className="truncate">{col.name || `column_${idx + 1}`}</span>
											<span className="text-2xs text-muted-foreground">
												({COLUMN_TYPE_LABELS[col.type]})
											</span>
										</div>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.length === 0 ? (
								<tr>
									<td
										colSpan={Math.max(1, columns.length)}
										className="px-2 py-4 text-center text-xs text-muted-foreground"
									>
										No preview available
									</td>
								</tr>
							) : (
								rows.map((row, rowIdx) => (
									<tr
										// biome-ignore lint/suspicious/noArrayIndexKey: preview rows are regenerated each render and have no intrinsic id.
										key={rowIdx}
										className={cn(rowIdx % 2 === 0 ? 'bg-transparent' : 'bg-surface-2/40')}
									>
										{row.map((cell, cellIdx) => {
											const column = columns[cellIdx];
											const cellKey = column ? `${column.id}-${rowIdx}` : `${rowIdx}-${cellIdx}`;
											return (
												<td
													key={cellKey}
													className="border-b border-border/50 px-2 py-1 font-mono text-2xs text-foreground"
												>
													{cell === '' ? (
														<span className="italic text-muted-foreground">NULL</span>
													) : (
														<span className="block max-w-xs truncate" title={cell}>
															{cell}
														</span>
													)}
												</td>
											);
										})}
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				<div>
					<div className="mb-1 flex items-center justify-between gap-2">
						<span className="text-xs font-medium text-foreground">
							{OUTPUT_FORMAT_LABELS[format]} preview
						</span>
						<span className="text-2xs text-muted-foreground">
							First {displayCount} of {totalRows.toLocaleString()} rows
						</span>
					</div>
					<pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-2xs whitespace-pre-wrap break-words text-foreground">
						{previewOutput || '(no output)'}
					</pre>
				</div>
			</CardContent>
		</Card>
	);
}
