import { createFileRoute } from '@tanstack/react-router';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
	ClipboardPaste,
	FilePlus2,
	FolderOpen,
	Sparkles,
	SplitSquareHorizontal,
	Terminal,
	Trash2,
} from 'lucide-react';
import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { toast } from 'sonner';

import { CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormInput,
	FormSection,
} from '@/lib/components/form';
import { RelatedTools, SectionLabel } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { useDocumentTitle } from '@/lib/hooks';
import {
	absolutize,
	fromFileUrl,
	normalize,
	parsePath,
	relativize,
	SAMPLE_PATHS,
	shellEscapeBash,
	shellEscapePowershell,
	toFileUrl,
	toPosix,
	toWindows,
	urlEncodePath,
	type ParsedPath,
	type PathStyle,
} from '@/lib/services/path-tool';
import { createToolOptionsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

interface PathToolPrefs {
	readonly basePath: string;
	readonly applyNormalize: boolean;
	readonly applyLowercase: boolean;
}

const DEFAULT_PREFS: PathToolPrefs = {
	basePath: '',
	applyNormalize: false,
	applyLowercase: false,
};

const usePathToolPrefs = createToolOptionsStore<PathToolPrefs>('path-tool', DEFAULT_PREFS);

export const Route = createFileRoute('/path-tool')({
	component: PathToolPage,
});

function PathToolPage() {
	useDocumentTitle('Path Tool');

	const { value: prefs, patch } = usePathToolPrefs();

	const [input, setInput] = useState('');
	const [isDragOver, setIsDragOver] = useState(false);
	const [showRail, setShowRail] = useState(true);

	const transformedInput = useMemo(() => {
		let working = input;
		if (prefs.applyLowercase) working = working.toLowerCase();
		return working;
	}, [input, prefs.applyLowercase]);

	const parsed: ParsedPath | null = useMemo(() => {
		if (transformedInput.length === 0) return null;
		return parsePath(transformedInput);
	}, [transformedInput]);

	// Apply normalization at display time so the equivalents card always
	// reflects what the user sees in the Parsed card. When no input has
	// been entered yet, downstream cards render their empty state.
	const styleForOps: PathStyle = parsed?.style ?? 'posix';
	const normalizedSource = useMemo(() => {
		if (!parsed) return '';
		return prefs.applyNormalize ? normalize(transformedInput, styleForOps) : transformedInput;
	}, [parsed, prefs.applyNormalize, styleForOps, transformedInput]);

	const equivalents = useMemo(() => {
		if (!parsed) return null;
		const posix = toPosix(normalizedSource);
		const windows = toWindows(normalizedSource);
		const fileUrl = toFileUrl(normalizedSource);
		return {
			posix,
			windows,
			fileUrl,
			urlEncoded: urlEncodePath(normalizedSource),
			bash: shellEscapeBash(posix),
			powershell: shellEscapePowershell(windows),
		};
	}, [normalizedSource, parsed]);

	const operations = useMemo(() => {
		if (!parsed) return null;
		const base = prefs.basePath.trim();
		const baseStyle: PathStyle = base.length > 0 ? parsePath(base).style : styleForOps;
		// When the user has supplied a base path, absolutize / relativize
		// follow that path's style so the result reads natively (POSIX or
		// Windows). The normalize result stays in the input's own style.
		const targetStyle: PathStyle = base.length > 0 ? baseStyle : styleForOps;
		return {
			normalized: normalize(normalizedSource, styleForOps),
			absolutized: base.length > 0 ? absolutize(normalizedSource, base, targetStyle) : null,
			relativized: base.length > 0 ? relativize(normalizedSource, base, targetStyle) : null,
		};
	}, [parsed, prefs.basePath, normalizedSource, styleForOps]);

	const handleLoadSample = useCallback(
		(key: keyof typeof SAMPLE_PATHS) => {
			setInput(SAMPLE_PATHS[key]);
		},
		[setInput]
	);

	const handlePaste = useCallback(async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text.length > 0) setInput(text);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to read clipboard', { description: message });
		}
	}, []);

	const handlePickFile = useCallback(async () => {
		try {
			const selected = await openDialog({ multiple: false, directory: false });
			if (typeof selected === 'string' && selected.length > 0) setInput(selected);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to open file dialog', { description: message });
		}
	}, []);

	const handlePickFolder = useCallback(async () => {
		try {
			const selected = await openDialog({ multiple: false, directory: true });
			if (typeof selected === 'string' && selected.length > 0) setInput(selected);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to open folder dialog', { description: message });
		}
	}, []);

	const handleClear = useCallback(() => {
		setInput('');
	}, []);

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
		const file = e.dataTransfer.files[0] as (File & { readonly path?: string }) | undefined;
		if (!file) return;
		if (file.path) {
			setInput(file.path);
			return;
		}
		// Browser-only fallback: relative `name` is the best we can do
		// when the webview does not expose the absolute path.
		setInput(file.name);
	};
	const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(true);
	};
	const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
	};

	const hasInput = input.length > 0;
	const valid = hasInput ? parsed !== null : null;

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			valid={valid}
			statusContent={
				parsed ? (
					<>
						<StatItem label="Style" value={parsed.style.toUpperCase()} />
						<StatItem label="Kind" value={parsed.isAbsolute ? 'Absolute' : 'Relative'} />
						<StatItem label="Segments" value={parsed.segments.length} />
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Input">
						<div className="flex flex-col gap-2">
							<Button variant="default" size="sm" onClick={handlePaste}>
								<ClipboardPaste className="h-3.5 w-3.5" />
								Paste from clipboard
							</Button>
							<Button variant="outline" size="sm" onClick={handlePickFile}>
								<FilePlus2 className="h-3.5 w-3.5" />
								Open file…
							</Button>
							<Button variant="outline" size="sm" onClick={handlePickFolder}>
								<FolderOpen className="h-3.5 w-3.5" />
								Open folder…
							</Button>
							<div className="grid grid-cols-2 gap-2 pt-1">
								<Button variant="ghost" size="sm" onClick={() => handleLoadSample('windows')}>
									<Sparkles className="h-3 w-3" />
									Windows
								</Button>
								<Button variant="ghost" size="sm" onClick={() => handleLoadSample('unix')}>
									<Sparkles className="h-3 w-3" />
									Unix
								</Button>
								<Button variant="ghost" size="sm" onClick={() => handleLoadSample('url')}>
									<Sparkles className="h-3 w-3" />
									URL
								</Button>
								<Button variant="ghost" size="sm" onClick={() => handleLoadSample('unc')}>
									<Sparkles className="h-3 w-3" />
									UNC
								</Button>
							</div>
							{hasInput ? (
								<Button variant="outline" size="sm" onClick={handleClear}>
									<Trash2 className="h-3.5 w-3.5" />
									Clear
								</Button>
							) : null}
						</div>
					</FormSection>

					<FormSection title="Base path">
						<FormInput
							label="Base for absolutize / relativize"
							value={prefs.basePath}
							placeholder="/home/alice or C:\\Users\\Alice"
							size="compact"
							onValueChange={(v) => patch({ basePath: v })}
						/>
					</FormSection>

					<FormSection title="Operations">
						<FormCheckboxGroup>
							<FormCheckbox
								label="Normalize (collapse . / ..)"
								checked={prefs.applyNormalize}
								onCheckedChange={(checked) => patch({ applyNormalize: checked === true })}
								size="compact"
							/>
							<FormCheckbox
								label="Lowercase input"
								checked={prefs.applyLowercase}
								onCheckedChange={(checked) => patch({ applyLowercase: checked === true })}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="Related">
						<RelatedTools
							items={[
								{ id: 'file-inspector', reason: 'Inspect file metadata for this path' },
								{ id: 'url-encoder', reason: 'Encode / decode generic URLs' },
								{ id: 'escape-tool', reason: 'Escape strings for shells and code' },
							]}
						/>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							Pure local parsing. Detection inspects the prefix and separator hints. URL form uses
							RFC 8089 (`file://`) with percent-encoded segments. Shell escapes target bash /
							zsh-compatible POSIX shells and PowerShell single-quoted strings.
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<MainArea
				input={input}
				onInputChange={setInput}
				isDragOver={isDragOver}
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				parsed={parsed}
				normalizedSource={normalizedSource}
				equivalents={equivalents}
				operations={operations}
				basePath={prefs.basePath}
			/>
		</ToolShell>
	);
}

interface Equivalents {
	readonly posix: string;
	readonly windows: string;
	readonly fileUrl: string;
	readonly urlEncoded: string;
	readonly bash: string;
	readonly powershell: string;
}

interface Operations {
	readonly normalized: string;
	readonly absolutized: string | null;
	readonly relativized: string | null;
}

interface MainAreaProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly isDragOver: boolean;
	readonly onDrop: (e: DragEvent<HTMLDivElement>) => void;
	readonly onDragOver: (e: DragEvent<HTMLDivElement>) => void;
	readonly onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
	readonly parsed: ParsedPath | null;
	readonly normalizedSource: string;
	readonly equivalents: Equivalents | null;
	readonly operations: Operations | null;
	readonly basePath: string;
}

function MainArea({
	input,
	onInputChange,
	isDragOver,
	onDrop,
	onDragOver,
	onDragLeave,
	parsed,
	normalizedSource,
	equivalents,
	operations,
	basePath,
}: MainAreaProps) {
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex shrink-0 items-center gap-2 border-b bg-surface-2 px-4 py-3">
				<label htmlFor="path-input" className="sr-only">
					Path input
				</label>
				<input
					id="path-input"
					type="text"
					value={input}
					onChange={(e) => onInputChange(e.target.value)}
					placeholder="Paste, drop, or open a path…"
					className={cn(
						'h-9 min-w-0 flex-1 rounded-md border bg-background px-3 font-mono text-sm transition-colors',
						'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
					)}
				/>
				{input.length > 0 ? <CopyButton text={input} toastLabel="Input path" size="sm" /> : null}
			</div>

			<section
				aria-label="Path drop zone"
				onDrop={onDrop}
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				className={cn('flex-1 overflow-auto transition-colors', isDragOver && 'bg-primary/5')}
			>
				{parsed && equivalents && operations ? (
					<div className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-2">
						<ParsedCard parsed={parsed} />
						<OperationsCard operations={operations} basePath={basePath} />
						<EquivalentsCard equivalents={equivalents} normalizedSource={normalizedSource} />
					</div>
				) : (
					<DropZone isDragOver={isDragOver} />
				)}
			</section>
		</div>
	);
}

function DropZone({ isDragOver }: { readonly isDragOver: boolean }) {
	return (
		<div className="flex h-full items-center justify-center p-6">
			<div
				className={cn(
					'flex w-full max-w-xl flex-col items-center gap-4 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
					isDragOver ? 'border-primary bg-primary/10' : 'border-border'
				)}
			>
				<EmbeddedEmptyState
					icon={SplitSquareHorizontal}
					title="Drop, paste, or open a path"
					description="The path appears parsed into components, converted between styles, and shell-escaped."
				/>
			</div>
		</div>
	);
}

// Carry a running offset into each segment so React keys reflect both
// position and content, avoiding the array-index anti-pattern.
const keySegments = (
	segments: readonly string[]
): readonly { readonly key: string; readonly value: string }[] => {
	let offset = 0;
	return segments.map((value) => {
		const key = `${offset}:${value}`;
		offset += value.length + 1;
		return { key, value };
	});
};

function ParsedCard({ parsed }: { readonly parsed: ParsedPath }) {
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-sm">
					<SplitSquareHorizontal className="h-4 w-4 text-muted-foreground" />
					Parsed components
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-1.5">
				<FieldRow label="Style" value={parsed.style.toUpperCase()} />
				<FieldRow label="Kind" value={parsed.isAbsolute ? 'Absolute' : 'Relative'} />
				<FieldRow label="Root" value={parsed.root || '(none)'} mono />
				<FieldRow label="Directory" value={parsed.dir || '(none)'} mono copyable />
				<FieldRow label="Base" value={parsed.base || '(none)'} mono copyable />
				<FieldRow label="Name" value={parsed.name || '(none)'} mono />
				<FieldRow label="Extension" value={parsed.ext || '(none)'} mono />
				{parsed.segments.length > 0 ? (
					<div className="pt-1">
						<SectionLabel>Segments ({parsed.segments.length})</SectionLabel>
						<div className="flex flex-wrap gap-1">
							{keySegments(parsed.segments).map(({ key, value }) => (
								<Badge key={key} variant="outline" className="font-mono text-2xs">
									{value}
								</Badge>
							))}
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

interface EquivalentsCardProps {
	readonly equivalents: Equivalents;
	readonly normalizedSource: string;
}

function EquivalentsCard({ equivalents, normalizedSource }: EquivalentsCardProps) {
	const rows: readonly { readonly label: string; readonly value: string }[] = [
		{ label: 'Source', value: normalizedSource },
		{ label: 'POSIX', value: equivalents.posix },
		{ label: 'Windows', value: equivalents.windows },
		{ label: 'file:// URL', value: equivalents.fileUrl },
		{ label: 'URL-encoded', value: equivalents.urlEncoded },
		{ label: 'Bash escape', value: equivalents.bash },
		{ label: 'PowerShell escape', value: equivalents.powershell },
	];
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-sm">
					<Terminal className="h-4 w-4 text-muted-foreground" />
					Equivalents
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-1.5">
				{rows.map((row) => (
					<FieldRow key={row.label} label={row.label} value={row.value} mono copyable />
				))}
			</CardContent>
		</Card>
	);
}

interface OperationsCardProps {
	readonly operations: Operations;
	readonly basePath: string;
}

function OperationsCard({ operations, basePath }: OperationsCardProps) {
	const baseShown = basePath.trim().length > 0;
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="text-sm">Operations</CardTitle>
			</CardHeader>
			<CardContent className="space-y-1.5">
				<FieldRow label="Normalize" value={operations.normalized} mono copyable />
				<FieldRow
					label="Absolutize"
					value={baseShown ? (operations.absolutized ?? '—') : 'Set a base path in the rail'}
					mono
					copyable={baseShown && operations.absolutized !== null}
				/>
				<FieldRow
					label="Relativize"
					value={baseShown ? (operations.relativized ?? '—') : 'Set a base path in the rail'}
					mono
					copyable={baseShown && operations.relativized !== null}
				/>
				{baseShown ? (
					<div className="pt-1">
						<SectionLabel>Base path</SectionLabel>
						<FieldRow label="Base" value={basePath} mono />
						<FieldRow
							label="Decoded"
							value={basePath.startsWith('file://') ? fromFileUrl(basePath) : basePath}
							mono
						/>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

interface FieldRowProps {
	readonly label: string;
	readonly value: string;
	readonly mono?: boolean;
	readonly copyable?: boolean;
}

function FieldRow({ label, value, mono = false, copyable = false }: FieldRowProps) {
	return (
		<div className="flex items-start gap-2 text-xs">
			<span className="w-28 shrink-0 text-muted-foreground">{label}</span>
			<span className={cn('min-w-0 flex-1 break-all', mono && 'font-mono')}>{value}</span>
			{copyable ? <CopyButton text={value} toastLabel={label} size="sm" /> : null}
		</div>
	);
}
