import { createFileRoute } from '@tanstack/react-router';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ClipboardCopy,
	ClipboardPaste,
	FlaskConical,
	FolderOpen,
	Plus,
	Save,
	Table as TableIcon,
	Trash2,
	X,
} from 'lucide-react';
import {
	type ChangeEvent,
	type DragEvent,
	type KeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { toast } from 'sonner';

import { FormCheckbox, FormInput, FormMode, FormSection, FormSelect } from '@/lib/components/form';
import { SectionLabel } from '@/lib/components/layout';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Input } from '@/lib/components/ui/input';
import { Textarea } from '@/lib/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/lib/components/ui/tooltip';
import { useDocumentTitle } from '@/lib/hooks';
import {
	addColumn,
	addRow,
	type ColumnType,
	computeColumnStats,
	computeDisplayOrder,
	type Delimiter,
	detectColumnTypes,
	formatTable,
	getDelimiterLabel,
	type OutputFormat,
	type ParsedTable,
	parseTable,
	removeColumn,
	removeRow,
	renameHeader,
	SAMPLE_TEXT,
	type SortDirection,
	updateCell,
} from '@/lib/services/csv-tool';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import { cn } from '@/lib/utils';

interface CsvToolPrefs {
	readonly outputFormat: OutputFormat;
	readonly delimiterOverride: Delimiter | 'auto';
	readonly hasHeader: boolean;
	readonly sqlTableName: string;
}

const DEFAULT_PREFS: CsvToolPrefs = {
	outputFormat: 'json-objects',
	delimiterOverride: 'auto',
	hasHeader: true,
	sqlTableName: 'my_table',
};

const useCsvToolPrefs = createToolOptionsStore<CsvToolPrefs>('csv-tool', DEFAULT_PREFS);

const OUTPUT_FORMAT_OPTIONS: readonly { readonly value: OutputFormat; readonly label: string }[] = [
	{ value: 'csv', label: 'CSV' },
	{ value: 'tsv', label: 'TSV' },
	{ value: 'json-objects', label: 'JSON (array of objects)' },
	{ value: 'json-arrays', label: 'JSON (array of arrays)' },
	{ value: 'yaml', label: 'YAML' },
	{ value: 'sql-insert', label: 'SQL INSERT' },
	{ value: 'markdown', label: 'Markdown table' },
	{ value: 'html', label: 'HTML table' },
];

const DELIMITER_OPTIONS = [
	{ value: 'auto' as const, label: 'Auto-detect' },
	{ value: ',' as const, label: 'Comma (,)' },
	{ value: '\t' as const, label: 'Tab (\\t)' },
	{ value: ';' as const, label: 'Semicolon (;)' },
	{ value: '|' as const, label: 'Pipe (|)' },
];

const FORMAT_EXTENSIONS: Readonly<Record<OutputFormat, string>> = {
	csv: 'csv',
	tsv: 'tsv',
	'json-objects': 'json',
	'json-arrays': 'json',
	yaml: 'yaml',
	'sql-insert': 'sql',
	markdown: 'md',
	html: 'html',
};

interface SortState {
	readonly columnIndex: number;
	readonly direction: SortDirection;
}

export const Route = createFileRoute('/csv-tool')({
	component: CsvToolPage,
});

function CsvToolPage() {
	useDocumentTitle('CSV / TSV Tool');

	const { value: prefs, patch } = useCsvToolPrefs();

	const [rawText, setRawText] = useState('');
	const [table, setTable] = useState<ParsedTable | null>(null);
	const [filterQuery, setFilterQuery] = useState('');
	const [sort, setSort] = useState<SortState | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const [showRail, setShowRail] = usePersistedRail('csv-tool');
	const [editingHeader, setEditingHeader] = useState<number | null>(null);
	const [editingCell, setEditingCell] = useState<{
		readonly rowIndex: number;
		readonly colIndex: number;
	} | null>(null);

	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	const handleParse = useCallback(
		(text: string) => {
			if (text.trim() === '') {
				setTable(null);
				return;
			}
			const hint =
				prefs.delimiterOverride === 'auto' ? undefined : { delimiter: prefs.delimiterOverride };
			const parsed = parseTable(text, { ...hint, hasHeader: prefs.hasHeader });
			setTable(parsed);
			setSort(null);
		},
		[prefs.delimiterOverride, prefs.hasHeader]
	);

	// Re-parse whenever the raw text or the user-controlled hints change.
	// Inline cell edits bypass this effect by mutating `table` directly via
	// the handlers below.
	useEffect(() => {
		if (rawText.trim() === '') {
			setTable(null);
			return;
		}
		handleParse(rawText);
	}, [rawText, handleParse]);

	const columnTypes = useMemo<readonly ColumnType[]>(
		() => (table ? detectColumnTypes(table) : []),
		[table]
	);
	const columnStats = useMemo(() => (table ? computeColumnStats(table) : []), [table]);

	const displayOrder = useMemo<readonly number[]>(() => {
		if (!table) return [];
		const type = sort ? (columnTypes[sort.columnIndex] ?? 'string') : 'string';
		return computeDisplayOrder(table.rows, filterQuery, sort, type);
	}, [table, filterQuery, sort, columnTypes]);

	const mismatchRowIndexes = useMemo<ReadonlySet<number>>(() => {
		if (!table) return new Set();
		const expected = table.headers.length;
		const set = new Set<number>();
		table.rows.forEach((row, i) => {
			const nonEmpty = row.filter((c) => c !== '').length;
			if (row.length !== expected || nonEmpty !== expected) {
				// Mismatch flag: rows missing trailing data are surfaced; we
				// treat any-empty-cell as a softer mismatch via a class below
				// only when the row length is wrong.
				if (row.length !== expected) set.add(i);
			}
		});
		return set;
	}, [table]);

	const output = useMemo(() => {
		if (!table) return '';
		return formatTable(table, prefs.outputFormat, { sqlTableName: prefs.sqlTableName });
	}, [table, prefs.outputFormat, prefs.sqlTableName]);

	const errorCount = table?.errors.length ?? 0;
	const valid = table ? errorCount === 0 : null;

	const handleClear = () => {
		setRawText('');
		setTable(null);
		setFilterQuery('');
		setSort(null);
		setEditingCell(null);
		setEditingHeader(null);
	};

	const handleLoadSample = () => {
		setRawText(SAMPLE_TEXT);
	};

	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) {
				setRawText(text);
				toast.success('Pasted from clipboard');
			}
		} catch {
			toast.error('Failed to paste from clipboard');
		}
	};

	const handleOpenFile = async () => {
		try {
			const selected = await openDialog({
				multiple: false,
				directory: false,
				filters: [
					{ name: 'Tabular', extensions: ['csv', 'tsv', 'txt', 'json'] },
					{ name: 'All files', extensions: ['*'] },
				],
			});
			if (typeof selected === 'string' && selected.length > 0) {
				const content = await readTextFile(selected);
				setRawText(content);
				toast.success('File loaded', { description: selected });
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to open file', { description: message });
		}
	};

	const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
		const file = e.dataTransfer.files[0] as (File & { readonly path?: string }) | undefined;
		if (!file) return;
		try {
			if (file.path) {
				const content = await readTextFile(file.path);
				setRawText(content);
				toast.success('File loaded', { description: file.name });
				return;
			}
			const content = await file.text();
			setRawText(content);
			toast.success('File loaded', { description: file.name });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			toast.error('Failed to load file', { description: message });
		}
	};

	const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(true);
	};
	const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
	};

	const handleCopyOutput = async () => {
		if (!output) return;
		try {
			await navigator.clipboard.writeText(output);
			toast.success('Output copied to clipboard');
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to copy to clipboard', { description: message });
		}
	};

	const handleSaveOutput = async () => {
		if (!output) {
			toast.error('No output to save');
			return;
		}
		try {
			const ext = FORMAT_EXTENSIONS[prefs.outputFormat];
			const path = await saveDialog({
				defaultPath: `table.${ext}`,
				filters: [{ name: prefs.outputFormat.toUpperCase(), extensions: [ext] }],
			});
			if (typeof path !== 'string') return;
			await writeTextFile(path, output);
			toast.success('Saved', { description: path });
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to save', { description: message });
		}
	};

	const handleSortClick = (colIndex: number) => {
		setSort((prev) => {
			if (!prev || prev.columnIndex !== colIndex)
				return { columnIndex: colIndex, direction: 'asc' };
			if (prev.direction === 'asc') return { columnIndex: colIndex, direction: 'desc' };
			return null;
		});
	};

	const handleCellEdit = (visibleRowIndex: number, colIndex: number, value: string) => {
		if (!table) return;
		const realIndex = displayOrder[visibleRowIndex];
		if (realIndex === undefined) return;
		setTable(updateCell(table, realIndex, colIndex, value));
	};

	const handleHeaderRename = (colIndex: number, value: string) => {
		if (!table) return;
		setTable(renameHeader(table, colIndex, value));
	};

	const handleAddRow = () => {
		if (!table) return;
		setTable(addRow(table));
	};

	const handleRemoveRow = (visibleRowIndex: number) => {
		if (!table) return;
		const realIndex = displayOrder[visibleRowIndex];
		if (realIndex === undefined) return;
		setTable(removeRow(table, realIndex));
	};

	const handleAddColumn = () => {
		if (!table) return;
		setTable(addColumn(table));
	};

	const handleRemoveColumn = (colIndex: number) => {
		if (!table) return;
		setTable(removeColumn(table, colIndex));
	};

	const hasTable = table !== null && table.headers.length > 0;
	const detectedDelimiter = table?.delimiter ?? prefs.delimiterOverride;
	const detectedDelimiterLabel =
		detectedDelimiter === 'auto' ? '—' : getDelimiterLabel(detectedDelimiter as Delimiter);

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			valid={valid}
			error={errorCount > 0 ? `${errorCount} parse issue${errorCount === 1 ? '' : 's'}` : undefined}
			statusContent={
				<>
					<StatItem label="Rows" value={table?.rows.length ?? 0} />
					<StatItem label="Columns" value={table?.headers.length ?? 0} />
					<StatItem label="Delimiter" value={detectedDelimiterLabel} />
					<StatItem
						label="Errors"
						value={errorCount}
						variant={errorCount > 0 ? 'warning' : 'default'}
					/>
				</>
			}
			rail={
				<>
					<FormSection title="Input">
						<div className="flex flex-col gap-2">
							<Button variant="default" size="sm" onClick={handleOpenFile}>
								<FolderOpen className="h-3.5 w-3.5" />
								Open file…
							</Button>
							<Button variant="outline" size="sm" onClick={handlePaste}>
								<ClipboardPaste className="h-3.5 w-3.5" />
								Paste
							</Button>
							<Button variant="outline" size="sm" onClick={handleLoadSample}>
								<FlaskConical className="h-3.5 w-3.5" />
								Load sample
							</Button>
							<Button variant="outline" size="sm" onClick={handleClear} disabled={rawText === ''}>
								<Trash2 className="h-3.5 w-3.5" />
								Clear
							</Button>
						</div>
					</FormSection>

					<FormSection title="Format">
						<FormSelect
							label="Output format"
							value={prefs.outputFormat}
							options={OUTPUT_FORMAT_OPTIONS}
							onValueChange={(v) => patch({ outputFormat: v as OutputFormat })}
						/>
					</FormSection>

					<FormSection title="Delimiter">
						<FormMode
							layout="stacked"
							value={prefs.delimiterOverride}
							options={DELIMITER_OPTIONS}
							onValueChange={(v) => patch({ delimiterOverride: v })}
						/>
					</FormSection>

					<FormSection title="Options">
						<FormCheckbox
							label="First row is header"
							checked={prefs.hasHeader}
							onCheckedChange={(checked) => patch({ hasHeader: checked })}
						/>
					</FormSection>

					{prefs.outputFormat === 'sql-insert' ? (
						<FormSection title="SQL">
							<FormInput
								label="Table name"
								value={prefs.sqlTableName}
								placeholder="my_table"
								onValueChange={(v) => patch({ sqlTableName: v })}
							/>
						</FormSection>
					) : null}

					<FormSection title="Save">
						<div className="flex flex-col gap-2">
							<Button variant="outline" size="sm" onClick={handleCopyOutput} disabled={!output}>
								<ClipboardCopy className="h-3.5 w-3.5" />
								Copy output
							</Button>
							<Button variant="outline" size="sm" onClick={handleSaveOutput} disabled={!output}>
								<Save className="h-3.5 w-3.5" />
								Save as file…
							</Button>
						</div>
					</FormSection>

					<ToolFooter
						relatedItems={[
							{ id: 'file-inspector', reason: 'Inspect raw file' },
							{ id: 'hex-editor', reason: 'View bytes' },
						]}
						aboutText={
							<>
								Pure local parsing. Drag-drop a CSV / TSV / JSON file, paste text, or open via
								dialog. Edits update the table in memory; the output preview re-formats live.
							</>
						}
					/>
				</>
			}
		>
			<MainPane
				rawText={rawText}
				onRawTextChange={setRawText}
				hasTable={hasTable}
				table={table}
				displayOrder={displayOrder}
				columnTypes={columnTypes}
				columnStats={columnStats}
				mismatchRowIndexes={mismatchRowIndexes}
				sort={sort}
				onSortClick={handleSortClick}
				filterQuery={filterQuery}
				onFilterChange={setFilterQuery}
				editingCell={editingCell}
				onEditingCellChange={setEditingCell}
				editingHeader={editingHeader}
				onEditingHeaderChange={setEditingHeader}
				onCellEdit={handleCellEdit}
				onHeaderRename={handleHeaderRename}
				onAddRow={handleAddRow}
				onAddColumn={handleAddColumn}
				onRemoveRow={handleRemoveRow}
				onRemoveColumn={handleRemoveColumn}
				output={output}
				outputFormat={prefs.outputFormat}
				onCopyOutput={handleCopyOutput}
				onSaveOutput={handleSaveOutput}
				isDragOver={isDragOver}
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				textareaRef={textareaRef}
			/>
		</ToolShell>
	);
}

interface MainPaneProps {
	readonly rawText: string;
	readonly onRawTextChange: (text: string) => void;
	readonly hasTable: boolean;
	readonly table: ParsedTable | null;
	readonly displayOrder: readonly number[];
	readonly columnTypes: readonly ColumnType[];
	readonly columnStats: readonly {
		readonly count: number;
		readonly nulls: number;
		readonly unique: number;
		readonly min: string | null;
		readonly max: string | null;
		readonly type: ColumnType;
	}[];
	readonly mismatchRowIndexes: ReadonlySet<number>;
	readonly sort: SortState | null;
	readonly onSortClick: (colIndex: number) => void;
	readonly filterQuery: string;
	readonly onFilterChange: (q: string) => void;
	readonly editingCell: { readonly rowIndex: number; readonly colIndex: number } | null;
	readonly onEditingCellChange: (
		v: { readonly rowIndex: number; readonly colIndex: number } | null
	) => void;
	readonly editingHeader: number | null;
	readonly onEditingHeaderChange: (i: number | null) => void;
	readonly onCellEdit: (rowIndex: number, colIndex: number, value: string) => void;
	readonly onHeaderRename: (colIndex: number, value: string) => void;
	readonly onAddRow: () => void;
	readonly onAddColumn: () => void;
	readonly onRemoveRow: (rowIndex: number) => void;
	readonly onRemoveColumn: (colIndex: number) => void;
	readonly output: string;
	readonly outputFormat: OutputFormat;
	readonly onCopyOutput: () => void;
	readonly onSaveOutput: () => void;
	readonly isDragOver: boolean;
	readonly onDrop: (e: DragEvent<HTMLDivElement>) => void;
	readonly onDragOver: (e: DragEvent<HTMLDivElement>) => void;
	readonly onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
	readonly textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

function MainPane({
	rawText,
	onRawTextChange,
	hasTable,
	table,
	displayOrder,
	columnTypes,
	columnStats,
	mismatchRowIndexes,
	sort,
	onSortClick,
	filterQuery,
	onFilterChange,
	editingCell,
	onEditingCellChange,
	editingHeader,
	onEditingHeaderChange,
	onCellEdit,
	onHeaderRename,
	onAddRow,
	onAddColumn,
	onRemoveRow,
	onRemoveColumn,
	output,
	outputFormat,
	onCopyOutput,
	onSaveOutput,
	isDragOver,
	onDrop,
	onDragOver,
	onDragLeave,
	textareaRef,
}: MainPaneProps) {
	return (
		<div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
			<section
				aria-label="CSV / TSV input drop zone"
				onDrop={onDrop}
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				className={cn(
					'flex shrink-0 flex-col gap-2 border-b px-4 py-3 transition-colors',
					isDragOver && 'bg-primary/5'
				)}
			>
				<div className="flex items-center justify-between gap-2">
					<SectionLabel icon={TableIcon}>Input</SectionLabel>
					<span className="text-2xs text-muted-foreground">
						Drop a file here, paste, or type below.
					</span>
				</div>
				<Textarea
					ref={textareaRef}
					value={rawText}
					onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onRawTextChange(e.target.value)}
					placeholder="Paste CSV, TSV, or JSON here, drop a file above, or use Open file… in the rail."
					className={cn('h-32 min-h-32 resize-y font-mono text-xs', isDragOver && 'border-primary')}
				/>
			</section>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
				<section className="flex min-h-0 flex-1 flex-col overflow-hidden border-b xl:border-b-0 xl:border-r">
					{hasTable && table ? (
						<TableView
							table={table}
							displayOrder={displayOrder}
							columnTypes={columnTypes}
							columnStats={columnStats}
							mismatchRowIndexes={mismatchRowIndexes}
							sort={sort}
							onSortClick={onSortClick}
							filterQuery={filterQuery}
							onFilterChange={onFilterChange}
							editingCell={editingCell}
							onEditingCellChange={onEditingCellChange}
							editingHeader={editingHeader}
							onEditingHeaderChange={onEditingHeaderChange}
							onCellEdit={onCellEdit}
							onHeaderRename={onHeaderRename}
							onAddRow={onAddRow}
							onAddColumn={onAddColumn}
							onRemoveRow={onRemoveRow}
							onRemoveColumn={onRemoveColumn}
						/>
					) : (
						<div className="flex flex-1 items-center justify-center p-6">
							<EmbeddedEmptyState
								icon={TableIcon}
								title="No table yet"
								description="Drop a CSV / TSV / JSON file, paste text, or load the sample to see a table here."
								fillHeight
							/>
						</div>
					)}
				</section>

				<section className="flex min-h-0 flex-1 flex-col overflow-hidden">
					<OutputPane
						output={output}
						outputFormat={outputFormat}
						onCopy={onCopyOutput}
						onSave={onSaveOutput}
					/>
				</section>
			</div>
		</div>
	);
}

interface TableViewProps {
	readonly table: ParsedTable;
	readonly displayOrder: readonly number[];
	readonly columnTypes: readonly ColumnType[];
	readonly columnStats: readonly {
		readonly count: number;
		readonly nulls: number;
		readonly unique: number;
		readonly min: string | null;
		readonly max: string | null;
		readonly type: ColumnType;
	}[];
	readonly mismatchRowIndexes: ReadonlySet<number>;
	readonly sort: SortState | null;
	readonly onSortClick: (colIndex: number) => void;
	readonly filterQuery: string;
	readonly onFilterChange: (q: string) => void;
	readonly editingCell: { readonly rowIndex: number; readonly colIndex: number } | null;
	readonly onEditingCellChange: (
		v: { readonly rowIndex: number; readonly colIndex: number } | null
	) => void;
	readonly editingHeader: number | null;
	readonly onEditingHeaderChange: (i: number | null) => void;
	readonly onCellEdit: (rowIndex: number, colIndex: number, value: string) => void;
	readonly onHeaderRename: (colIndex: number, value: string) => void;
	readonly onAddRow: () => void;
	readonly onAddColumn: () => void;
	readonly onRemoveRow: (rowIndex: number) => void;
	readonly onRemoveColumn: (colIndex: number) => void;
}

const COLUMN_TYPE_TONE: Readonly<Record<ColumnType, string>> = {
	string: 'bg-muted text-muted-foreground',
	number: 'bg-info/10 text-info',
	date: 'bg-violet-500/10 text-violet-500',
	bool: 'bg-success/10 text-success',
	email: 'bg-warning/10 text-warning',
};

function TableView({
	table,
	displayOrder,
	columnTypes,
	columnStats,
	mismatchRowIndexes,
	sort,
	onSortClick,
	filterQuery,
	onFilterChange,
	editingCell,
	onEditingCellChange,
	editingHeader,
	onEditingHeaderChange,
	onCellEdit,
	onHeaderRename,
	onAddRow,
	onAddColumn,
	onRemoveRow,
	onRemoveColumn,
}: TableViewProps) {
	return (
		<>
			<div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
				<Input
					value={filterQuery}
					onChange={(e) => onFilterChange(e.target.value)}
					placeholder="Filter rows…"
					className="h-7 flex-1 text-xs"
				/>
				<Button variant="outline" size="sm" onClick={onAddRow}>
					<Plus className="h-3.5 w-3.5" />
					Row
				</Button>
				<Button variant="outline" size="sm" onClick={onAddColumn}>
					<Plus className="h-3.5 w-3.5" />
					Column
				</Button>
			</div>
			<div className="flex-1 overflow-auto">
				<table className="w-full border-collapse text-xs">
					<thead className="sticky top-0 z-10 bg-surface-2">
						<tr>
							<th className="w-10 border-b border-r px-2 py-1 text-left text-2xs font-medium text-muted-foreground">
								#
							</th>
							{table.headers.map((header, colIndex) => {
								const stats = columnStats[colIndex];
								const type = columnTypes[colIndex] ?? 'string';
								const isSorted = sort?.columnIndex === colIndex;
								const SortIcon = isSorted
									? sort?.direction === 'asc'
										? ArrowUp
										: ArrowDown
									: ArrowUpDown;
								const isEditing = editingHeader === colIndex;
								const colId = table.colIds[colIndex] ?? `col-${colIndex}`;
								return (
									<th
										key={colId}
										className="min-w-32 border-b border-r px-2 py-1 text-left align-bottom"
									>
										<div className="flex flex-col gap-1">
											<div className="flex items-center gap-1">
												{isEditing ? (
													<Input
														autoFocus
														defaultValue={header}
														onBlur={(e) => {
															onHeaderRename(colIndex, e.target.value || header);
															onEditingHeaderChange(null);
														}}
														onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
															if (e.key === 'Enter') {
																onHeaderRename(
																	colIndex,
																	(e.target as HTMLInputElement).value || header
																);
																onEditingHeaderChange(null);
															}
															if (e.key === 'Escape') {
																onEditingHeaderChange(null);
															}
														}}
														className="h-6 text-xs"
													/>
												) : (
													<button
														type="button"
														onDoubleClick={() => onEditingHeaderChange(colIndex)}
														onClick={() => onSortClick(colIndex)}
														className="flex flex-1 items-center gap-1 truncate font-semibold text-foreground hover:text-primary"
														title="Click to sort, double-click to rename"
													>
														<span className="truncate">{header}</span>
														<SortIcon
															className={cn(
																'h-3 w-3 shrink-0',
																isSorted ? 'text-primary' : 'text-muted-foreground/50'
															)}
														/>
													</button>
												)}
												<Tooltip>
													<TooltipTrigger asChild>
														<Badge
															variant="outline"
															className={cn('h-4 px-1 font-mono text-2xs', COLUMN_TYPE_TONE[type])}
														>
															{type}
														</Badge>
													</TooltipTrigger>
													{stats ? (
														<TooltipContent>
															<ColumnStatsTooltip stats={stats} />
														</TooltipContent>
													) : null}
												</Tooltip>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="icon-sm"
															className="h-5 w-5 text-muted-foreground hover:text-destructive"
															onClick={() => onRemoveColumn(colIndex)}
														>
															<X className="h-3 w-3" />
															<span className="sr-only">Remove column</span>
														</Button>
													</TooltipTrigger>
													<TooltipContent>Remove column</TooltipContent>
												</Tooltip>
											</div>
										</div>
									</th>
								);
							})}
							<th className="w-10 border-b px-2 py-1" />
						</tr>
					</thead>
					<tbody>
						{displayOrder.length === 0 ? (
							<tr>
								<td
									colSpan={table.headers.length + 2}
									className="p-6 text-center text-muted-foreground"
								>
									{filterQuery
										? 'No rows match the filter.'
										: 'No rows. Use Add Row to insert one.'}
								</td>
							</tr>
						) : (
							displayOrder.map((realIdx, visibleRowIndex) => {
								const row = table.rows[realIdx];
								if (!row) return null;
								const rowId = table.rowIds[realIdx] ?? `row-${realIdx}`;
								const isMismatch = mismatchRowIndexes.has(realIdx);
								return (
									<tr
										key={rowId}
										className={cn(
											'group transition-colors hover:bg-interactive-hover/50',
											isMismatch && 'bg-warning/10'
										)}
									>
										<td className="w-10 border-b border-r px-2 py-1 text-2xs text-muted-foreground tabular-nums">
											{realIdx + 1}
										</td>
										{table.headers.map((_, colIndex) => {
											const isEditing =
												editingCell?.rowIndex === visibleRowIndex &&
												editingCell.colIndex === colIndex;
											const cell = row[colIndex] ?? '';
											const colId = table.colIds[colIndex] ?? `col-${colIndex}`;
											return (
												<td
													key={`${rowId}:${colId}`}
													className="min-w-32 border-b border-r px-0 py-0 align-top"
												>
													{isEditing ? (
														<Input
															autoFocus
															defaultValue={cell}
															onBlur={(e) => {
																onCellEdit(visibleRowIndex, colIndex, e.target.value);
																onEditingCellChange(null);
															}}
															onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
																if (e.key === 'Enter') {
																	onCellEdit(
																		visibleRowIndex,
																		colIndex,
																		(e.target as HTMLInputElement).value
																	);
																	onEditingCellChange(null);
																}
																if (e.key === 'Escape') {
																	onEditingCellChange(null);
																}
															}}
															className="h-7 rounded-none border-0 text-xs"
														/>
													) : (
														<button
															type="button"
															onDoubleClick={() =>
																onEditingCellChange({ rowIndex: visibleRowIndex, colIndex })
															}
															className="block w-full truncate px-2 py-1 text-left font-mono text-xs hover:bg-primary/5"
															title="Double-click to edit"
														>
															{cell || <span className="text-muted-foreground/40">∅</span>}
														</button>
													)}
												</td>
											);
										})}
										<td className="w-10 border-b px-1 py-1 text-center">
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														variant="ghost"
														size="icon-sm"
														className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
														onClick={() => onRemoveRow(visibleRowIndex)}
													>
														<X className="h-3 w-3" />
														<span className="sr-only">Remove row</span>
													</Button>
												</TooltipTrigger>
												<TooltipContent>Remove row</TooltipContent>
											</Tooltip>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>
			{table.errors.length > 0 ? (
				<div className="shrink-0 border-t bg-warning/10 px-4 py-2 text-2xs text-warning">
					<div className="font-semibold">Parse issues:</div>
					<ul className="list-inside list-disc">
						{table.errors.slice(0, 5).map((err) => (
							<li key={err}>{err}</li>
						))}
						{table.errors.length > 5 ? <li>… and {table.errors.length - 5} more</li> : null}
					</ul>
				</div>
			) : null}
		</>
	);
}

interface ColumnStatsTooltipProps {
	readonly stats: {
		readonly count: number;
		readonly nulls: number;
		readonly unique: number;
		readonly min: string | null;
		readonly max: string | null;
		readonly type: ColumnType;
	};
}

function ColumnStatsTooltip({ stats }: ColumnStatsTooltipProps) {
	return (
		<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-2xs">
			<dt className="opacity-70">Type</dt>
			<dd>{stats.type}</dd>
			<dt className="opacity-70">Count</dt>
			<dd>{stats.count}</dd>
			<dt className="opacity-70">Nulls</dt>
			<dd>{stats.nulls}</dd>
			<dt className="opacity-70">Unique</dt>
			<dd>{stats.unique}</dd>
			{stats.min !== null ? (
				<>
					<dt className="opacity-70">Min</dt>
					<dd className="max-w-32 truncate">{stats.min}</dd>
				</>
			) : null}
			{stats.max !== null ? (
				<>
					<dt className="opacity-70">Max</dt>
					<dd className="max-w-32 truncate">{stats.max}</dd>
				</>
			) : null}
		</dl>
	);
}

interface OutputPaneProps {
	readonly output: string;
	readonly outputFormat: OutputFormat;
	readonly onCopy: () => void;
	readonly onSave: () => void;
}

function OutputPane({ output, outputFormat, onCopy, onSave }: OutputPaneProps) {
	const formatLabel =
		OUTPUT_FORMAT_OPTIONS.find((opt) => opt.value === outputFormat)?.label ?? outputFormat;
	return (
		<Card density="compact" className="flex h-full flex-col rounded-none border-0">
			<CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 border-b">
				<CardTitle className="text-sm">Output — {formatLabel}</CardTitle>
				<div className="flex items-center gap-1">
					<Button variant="outline" size="sm" onClick={onCopy} disabled={!output}>
						<ClipboardCopy className="h-3 w-3" />
						Copy
					</Button>
					<Button variant="outline" size="sm" onClick={onSave} disabled={!output}>
						<Save className="h-3 w-3" />
						Save
					</Button>
				</div>
			</CardHeader>
			<CardContent className="min-h-0 flex-1 overflow-auto p-0">
				{output ? (
					<pre className="m-0 h-full overflow-auto p-4 font-mono text-xs leading-relaxed">
						{output}
					</pre>
				) : (
					<div className="flex h-full items-center justify-center p-6 text-2xs text-muted-foreground">
						Output appears here once a table is loaded.
					</div>
				)}
			</CardContent>
		</Card>
	);
}
