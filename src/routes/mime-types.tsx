import { createFileRoute } from '@tanstack/react-router';
import { ExternalLink, FileSearch } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormInput,
	FormSection,
} from '@/lib/components/form';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { useDocumentTitle } from '@/lib/hooks';
import {
	asContentTypeHeader,
	asGoConstant,
	asJavaMediaType,
	asPythonTuple,
	CATEGORY_LABELS,
	CATEGORY_TONES,
	type FilterOptions,
	filterEntries,
	type MimeCategory,
	type MimeEntry,
	MIME_ENTRIES,
} from '@/lib/services/mime';
import { createToolOptionsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

const ALL_CATEGORIES: readonly MimeCategory[] = [
	'image',
	'audio',
	'video',
	'font',
	'text',
	'application',
	'multipart',
	'message',
];

const TEXT_LIKE_CATEGORIES = new Set<MimeCategory>(['text']);
const BINARY_LIKE_CATEGORIES = new Set<MimeCategory>([
	'image',
	'audio',
	'video',
	'font',
	'application',
]);

const WEB_COMMON_TYPES = new Set<string>([
	'text/html',
	'text/javascript',
	'text/css',
	'image/png',
	'image/jpeg',
	'application/json',
]);

interface MimeTypesOptions {
	readonly query: string;
	readonly categories: readonly MimeCategory[];
	readonly requireMagic: boolean;
	readonly selectedType: string | null;
}

const DEFAULTS: MimeTypesOptions = {
	query: '',
	categories: ALL_CATEGORIES,
	requireMagic: false,
	selectedType: null,
};

const useMimeOptions = createToolOptionsStore<MimeTypesOptions>('mime-types', DEFAULTS);

export const Route = createFileRoute('/mime-types')({
	component: MimeTypesPage,
});

function MimeTypesPage() {
	useDocumentTitle('MIME Type Explorer');

	const { value: options, patch } = useMimeOptions();
	const { query, categories, requireMagic, selectedType } = options;

	const [showRail, setShowRail] = useState(true);

	const categoriesSet = useMemo(() => new Set<MimeCategory>(categories), [categories]);

	const filterOpts: FilterOptions = useMemo(
		() => ({ query, categories: categoriesSet, requireMagic }),
		[query, categoriesSet, requireMagic]
	);

	const filtered = useMemo(() => filterEntries(MIME_ENTRIES, filterOpts), [filterOpts]);

	const selected = useMemo<MimeEntry | null>(() => {
		if (!selectedType) return null;
		return MIME_ENTRIES.find((entry) => entry.type === selectedType) ?? null;
	}, [selectedType]);

	const handleToggleCategory = (category: MimeCategory, checked: boolean) => {
		const next = checked
			? Array.from(new Set([...categories, category]))
			: categories.filter((c) => c !== category);
		patch({ categories: next });
	};

	const handleSelectAllCategories = () => {
		patch({ categories: ALL_CATEGORIES });
	};

	const handleSelectTextOnly = () => {
		patch({
			categories: ALL_CATEGORIES.filter((c) => TEXT_LIKE_CATEGORIES.has(c)),
			requireMagic: false,
		});
	};

	const handleSelectBinaryOnly = () => {
		patch({
			categories: ALL_CATEGORIES.filter((c) => BINARY_LIKE_CATEGORIES.has(c)),
		});
	};

	const handleSelectWebCommon = () => {
		patch({
			categories: ALL_CATEGORIES,
			requireMagic: false,
			query: '',
		});
	};

	const handleSelectEntry = (entry: MimeEntry) => {
		patch({ selectedType: entry.type });
	};

	const visibleWebCommon = useMemo(
		() => filtered.filter((entry) => WEB_COMMON_TYPES.has(entry.type)),
		[filtered]
	);

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			statusContent={
				<>
					<StatItem label="Visible" value={filtered.length} />
					<StatItem label="Selected" value={selected ? 1 : 0} />
					<StatItem label="Total" value={MIME_ENTRIES.length} />
				</>
			}
			rail={
				<>
					<FormSection title="Search">
						<FormInfo>
							Search by MIME type (<code className="font-mono">image/png</code>), extension (
							<code className="font-mono">.png</code>), or any text in the summary.
						</FormInfo>
					</FormSection>

					<FormSection title="Categories">
						<FormCheckboxGroup>
							{ALL_CATEGORIES.map((category) => (
								<FormCheckbox
									key={category}
									size="compact"
									label={CATEGORY_LABELS[category]}
									checked={categoriesSet.has(category)}
									onCheckedChange={(checked) => handleToggleCategory(category, checked)}
								/>
							))}
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="Magic bytes">
						<FormCheckbox
							size="compact"
							label="Only show entries with known magic bytes"
							checked={requireMagic}
							onCheckedChange={(checked) => patch({ requireMagic: checked })}
						/>
					</FormSection>

					<FormSection title="Quick filters">
						<div className="grid grid-cols-2 gap-1">
							<Button variant="outline" size="sm" onClick={handleSelectAllCategories}>
								All
							</Button>
							<Button variant="outline" size="sm" onClick={handleSelectTextOnly}>
								Text only
							</Button>
							<Button variant="outline" size="sm" onClick={handleSelectBinaryOnly}>
								Binary only
							</Button>
							<Button variant="outline" size="sm" onClick={handleSelectWebCommon}>
								Web common
							</Button>
						</div>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							<ul className="list-inside list-disc space-y-0.5">
								<li>Catalog of {MIME_ENTRIES.length} commonly-encountered MIME types.</li>
								<li>Magic bytes are the first-N bytes used for file-type sniffing.</li>
								<li>Alias notes flag deprecated or non-standard variants.</li>
								<li>All lookups happen in-browser; no external requests.</li>
							</ul>
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="border-b border-border/40 bg-background p-3">
					<FormInput
						label="Search MIME types, extensions, or text"
						placeholder="e.g. image/png, .json, video"
						value={query}
						onValueChange={(value) => patch({ query: value })}
						size="default"
					/>
					<div className="mt-2 flex flex-wrap items-center gap-1.5 text-2xs">
						<span className="text-muted-foreground">Active categories:</span>
						{ALL_CATEGORIES.filter((category) => categoriesSet.has(category)).map((category) => (
							<button
								key={category}
								type="button"
								className={cn(
									'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-medium transition-opacity hover:opacity-80',
									CATEGORY_TONES[category]
								)}
								onClick={() => handleToggleCategory(category, false)}
							>
								{CATEGORY_LABELS[category]}
								<span className="text-muted-foreground/80">×</span>
							</button>
						))}
						{categoriesSet.size === 0 ? (
							<span className="text-muted-foreground">No category selected.</span>
						) : null}
					</div>
					{query.trim().length > 0 && visibleWebCommon.length > 0 ? (
						<p className="mt-1 text-2xs text-muted-foreground">
							Web-common matches: {visibleWebCommon.map((entry) => entry.type).join(', ')}
						</p>
					) : null}
				</div>

				<div className="flex-1 overflow-auto p-3">
					{filtered.length === 0 ? (
						<Card density="compact">
							<CardContent>
								<EmbeddedEmptyState
									icon={FileSearch}
									title="No matching MIME types"
									description="Adjust the search query, enable more categories, or disable the magic-bytes filter."
								/>
							</CardContent>
						</Card>
					) : (
						<div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
							{filtered.map((entry) => (
								<MimeCard
									key={entry.type}
									entry={entry}
									isSelected={entry.type === selectedType}
									onSelect={handleSelectEntry}
								/>
							))}
						</div>
					)}

					{selected ? (
						<div className="mt-3">
							<MimeDetailPanel entry={selected} onClose={() => patch({ selectedType: null })} />
						</div>
					) : null}
				</div>
			</div>
		</ToolShell>
	);
}

/* -------------------------------------------------------------------------- */

interface MimeCardProps {
	readonly entry: MimeEntry;
	readonly isSelected: boolean;
	readonly onSelect: (entry: MimeEntry) => void;
}

function MimeCard({ entry, isSelected, onSelect }: MimeCardProps) {
	const hasMagic = (entry.magic?.length ?? 0) > 0;
	return (
		<Card
			density="compact"
			className={cn(
				'cursor-pointer transition-colors hover:bg-interactive-hover',
				isSelected ? 'ring-2 ring-primary/60' : ''
			)}
			onClick={() => onSelect(entry)}
		>
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between gap-2">
					<CardTitle className="font-mono text-xs break-all">{entry.type}</CardTitle>
					<span
						className={cn(
							'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-2xs font-medium',
							CATEGORY_TONES[entry.category]
						)}
					>
						{CATEGORY_LABELS[entry.category]}
					</span>
				</div>
			</CardHeader>
			<CardContent className="space-y-1.5">
				<div className="flex flex-wrap gap-1 text-2xs">
					{entry.extensions.length > 0 ? (
						entry.extensions.map((ext) => (
							<span
								key={ext}
								className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground"
							>
								{ext}
							</span>
						))
					) : (
						<span className="text-muted-foreground italic">No file extension</span>
					)}
				</div>
				<p className="text-2xs leading-snug text-muted-foreground line-clamp-2">{entry.summary}</p>
				<div className="flex flex-wrap gap-1 text-2xs text-muted-foreground">
					{hasMagic ? (
						<span className="rounded bg-info/10 px-1.5 py-0.5 text-info">magic</span>
					) : null}
					{entry.aliases && entry.aliases.length > 0 ? (
						<span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">
							{entry.aliases.length} alias{entry.aliases.length === 1 ? '' : 'es'}
						</span>
					) : null}
					{entry.charset && entry.charset.length > 0 ? (
						<span className="rounded bg-success/10 px-1.5 py-0.5 text-success">charset</span>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}

/* -------------------------------------------------------------------------- */

interface MimeDetailPanelProps {
	readonly entry: MimeEntry;
	readonly onClose: () => void;
}

function MimeDetailPanel({ entry, onClose }: MimeDetailPanelProps) {
	const headerSnippet = asContentTypeHeader(entry);
	const javaSnippet = asJavaMediaType(entry);
	const pythonSnippet = asPythonTuple(entry);
	const goSnippet = asGoConstant(entry);

	const handleOpenExternal = async (url: string) => {
		const { openUrl } = await import('@tauri-apps/plugin-opener');
		openUrl(url).catch(() => {});
	};

	return (
		<Card density="compact" variant="info">
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between gap-2">
					<div className="flex min-w-0 flex-col gap-1">
						<CardTitle className="font-mono text-sm break-all">{entry.type}</CardTitle>
						<div className="flex flex-wrap items-center gap-1.5">
							<span
								className={cn(
									'inline-flex items-center rounded-md px-1.5 py-0.5 text-2xs font-medium',
									CATEGORY_TONES[entry.category]
								)}
							>
								{CATEGORY_LABELS[entry.category]}
							</span>
							{entry.extensions.map((ext) => (
								<span
									key={ext}
									className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground"
								>
									{ext}
								</span>
							))}
						</div>
					</div>
					<Button variant="ghost" size="sm" onClick={onClose}>
						Close
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<p className="text-xs leading-relaxed text-muted-foreground">{entry.summary}</p>

				{entry.aliases && entry.aliases.length > 0 ? (
					<section className="space-y-1">
						<h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
							Aliases
						</h3>
						<div className="flex flex-wrap gap-1.5">
							{entry.aliases.map((alias) => (
								<span
									key={alias}
									className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-2xs"
								>
									{alias}
									<CopyButton
										text={alias}
										toastLabel="Alias"
										size="sm"
										variant="ghost"
										showLabel={false}
									/>
								</span>
							))}
						</div>
						{entry.aliasNote ? (
							<p className="text-2xs leading-relaxed text-warning">{entry.aliasNote}</p>
						) : null}
					</section>
				) : null}

				{entry.magic && entry.magic.length > 0 ? (
					<section className="space-y-1">
						<h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
							Magic bytes
						</h3>
						<table className="w-full min-w-max border-collapse text-2xs">
							<thead>
								<tr className="border-b border-border/60 text-left uppercase tracking-wide text-muted-foreground">
									<th className="py-1 pr-3 font-semibold">Offset</th>
									<th className="py-1 pr-3 font-semibold">Hex</th>
									<th className="py-1 pr-3 font-semibold">Description</th>
									<th className="py-1" />
								</tr>
							</thead>
							<tbody>
								{entry.magic.map((m) => (
									<tr
										key={`${entry.type}-magic-${m.offset ?? 0}-${m.hex}`}
										className="border-b border-border/30 last:border-b-0"
									>
										<td className="py-1 pr-3 font-mono tabular-nums">{m.offset ?? 0}</td>
										<td className="py-1 pr-3 font-mono">{m.hex}</td>
										<td className="py-1 pr-3 text-muted-foreground">{m.description ?? ''}</td>
										<td className="py-1 text-right">
											<CopyButton
												text={m.hex}
												toastLabel="Magic bytes"
												size="sm"
												variant="ghost"
												showLabel={false}
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</section>
				) : null}

				{entry.charset && entry.charset.length > 0 ? (
					<section className="space-y-1">
						<h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
							Charset
						</h3>
						<div className="flex flex-wrap gap-1.5">
							{entry.charset.map((cs) => (
								<span
									key={cs}
									className={cn(
										'inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-2xs',
										cs === entry.defaultCharset
											? 'border-success/40 bg-success/10 text-success'
											: 'bg-muted text-muted-foreground'
									)}
								>
									{cs}
									{cs === entry.defaultCharset ? ' (default)' : ''}
								</span>
							))}
						</div>
					</section>
				) : null}

				<section className="space-y-1">
					<h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
						Copy snippets
					</h3>
					<div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
						<SnippetRow label="Content-Type header" value={headerSnippet} />
						<SnippetRow label="Java MediaType" value={javaSnippet} />
						<SnippetRow label="Python tuple" value={pythonSnippet} />
						<SnippetRow label="Go constant" value={goSnippet} />
					</div>
				</section>

				{entry.references && entry.references.length > 0 ? (
					<section className="space-y-1">
						<h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
							References
						</h3>
						<div className="flex flex-wrap gap-1.5">
							{entry.references.map((r) => (
								<Button
									key={r.url}
									variant="outline"
									size="sm"
									className="h-7 gap-1 text-2xs"
									onClick={() => handleOpenExternal(r.url)}
								>
									<ExternalLink className="h-3 w-3" />
									{r.label}
								</Button>
							))}
						</div>
					</section>
				) : null}
			</CardContent>
		</Card>
	);
}

/* -------------------------------------------------------------------------- */

interface SnippetRowProps {
	readonly label: string;
	readonly value: string;
}

function SnippetRow({ label, value }: SnippetRowProps) {
	return (
		<div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1">
			<div className="min-w-0 flex-1">
				<div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
					{label}
				</div>
				<div className="truncate font-mono text-2xs">{value}</div>
			</div>
			<CopyButton text={value} toastLabel={label} size="sm" variant="ghost" showLabel={false} />
		</div>
	);
}
