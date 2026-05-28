import { createFileRoute } from '@tanstack/react-router';
import { AlertTriangle, BookOpen, ExternalLink, Search, X } from 'lucide-react';
import { useMemo } from 'react';

import { ActionButton, CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormInput,
	FormSection,
} from '@/lib/components/form';
import { MasterDetailLayout, SubsectionLabel } from '@/lib/components/layout';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { ToneBadge } from '@/lib/components/ui/tone-badge';
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks';
import {
	ALL_CATEGORIES,
	CATEGORY_LABELS,
	CATEGORY_TONES,
	type FilterOptions,
	filterStatusCodes,
	getStatusCode,
	IANA_REGISTRY_URL,
	type StatusCategory,
	type StatusCode,
	STATUS_CODES,
	TOTAL_CODES,
} from '@/lib/services/http-status';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import { cn } from '@/lib/utils';

interface HttpStatusOptions {
	readonly query: string;
	readonly categories: readonly StatusCategory[];
	readonly includeNonStandard: boolean;
	readonly misuseOnly: boolean;
	readonly selectedCode: number | null;
}

const DEFAULTS: HttpStatusOptions = {
	query: '',
	categories: ALL_CATEGORIES,
	includeNonStandard: false,
	misuseOnly: false,
	selectedCode: null,
};

const useHttpStatusOptions = createToolOptionsStore<HttpStatusOptions>(
	'http-status-codes',
	DEFAULTS
);

export const Route = createFileRoute('/http-status-codes')({
	component: HttpStatusCodesPage,
});

function HttpStatusCodesPage() {
	useDocumentTitle('HTTP Status Codes');

	const { value: options, patch } = useHttpStatusOptions();
	const { query, categories, includeNonStandard, misuseOnly, selectedCode } = options;

	const [showRail, setShowRail] = usePersistedRail('http-status-codes');
	// Debounce text input by 100ms so typing does not thrash the grid.
	const debouncedQuery = useDebouncedValue(query, 100);

	const categorySet = useMemo<ReadonlySet<StatusCategory>>(() => new Set(categories), [categories]);

	const filterOptions = useMemo<FilterOptions>(
		() => ({
			query: debouncedQuery,
			categories: categorySet,
			includeNonStandard,
			misuseOnly,
		}),
		[debouncedQuery, categorySet, includeNonStandard, misuseOnly]
	);

	const filtered = useMemo(() => filterStatusCodes(STATUS_CODES, filterOptions), [filterOptions]);

	const selectedEntry = useMemo(
		() => (selectedCode === null ? null : (getStatusCode(selectedCode) ?? null)),
		[selectedCode]
	);

	const toggleCategory = (category: StatusCategory) => {
		const set = new Set(categories);
		if (set.has(category)) set.delete(category);
		else set.add(category);
		patch({ categories: ALL_CATEGORIES.filter((c) => set.has(c)) });
	};

	const setCategories = (next: readonly StatusCategory[]) => {
		patch({ categories: ALL_CATEGORIES.filter((c) => next.includes(c)) });
	};

	const setSelectedCode = (code: number | null) => patch({ selectedCode: code });

	const standardCount = useMemo(() => STATUS_CODES.filter((c) => c.standard).length, []);

	return (
		<ToolShell
			layout="master-detail"
			showRail={showRail}
			onShowRailChange={setShowRail}
			statusContent={
				<>
					<StatItem label="Visible" value={filtered.length} />
					<StatItem label="Total" value={TOTAL_CODES} />
					<StatItem label="Standard" value={standardCount} />
					{selectedEntry ? <StatItem label="Selected" value={selectedEntry.code} /> : null}
				</>
			}
			rail={
				<>
					<FormSection title="Search">
						<FormInfo>
							Search by code (e.g. <code className="font-mono">401</code>,{' '}
							<code className="font-mono">4</code>) or text (e.g.{' '}
							<code className="font-mono">unauth</code>).
						</FormInfo>
						{query.length > 0 ? (
							<ActionButton
								label="Clear search"
								variant="outline"
								onClick={() => patch({ query: '' })}
							/>
						) : null}
					</FormSection>

					<FormSection title="Categories">
						<FormCheckboxGroup>
							{ALL_CATEGORIES.map((category) => (
								<FormCheckbox
									key={category}
									label={CATEGORY_LABELS[category]}
									checked={categorySet.has(category)}
									onCheckedChange={() => toggleCategory(category)}
								/>
							))}
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="Non-standard codes">
						<FormCheckbox
							label="Include non-standard (418, 499, 520-527, ...)"
							checked={includeNonStandard}
							onCheckedChange={(checked) => patch({ includeNonStandard: checked })}
						/>
					</FormSection>

					<FormSection title="Quick filters">
						<div className="grid grid-cols-2 gap-1">
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									patch({
										query: '',
										categories: ALL_CATEGORIES,
										includeNonStandard: true,
										misuseOnly: false,
									})
								}
							>
								All
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									patch({
										query: '',
										categories: ALL_CATEGORIES,
										includeNonStandard: false,
										misuseOnly: false,
									})
								}
							>
								Only standard
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => patch({ misuseOnly: !misuseOnly })}
							>
								{misuseOnly ? 'Show all' : 'Misuse warnings'}
							</Button>
							<Button variant="outline" size="sm" onClick={() => setCategories(['3xx'])}>
								Only redirects
							</Button>
						</div>
					</FormSection>

					<ToolFooter
						aboutText={
							<>
								Status codes are primarily defined in RFC 9110 (HTTP Semantics, June 2022). WebDAV
								additions come from RFC 4918 / 5842; the IANA registry is the authoritative source.
							</>
						}
					/>
				</>
			}
		>
			<MasterDetailLayout
				listTitle="Status Codes"
				listCount={filtered.length}
				defaultListSize="48"
				minListSize="30"
				maxListSize="70"
				list={
					<div className="flex h-full flex-col">
						<div className="shrink-0 space-y-2 border-b border-border/60 bg-surface-1 p-3">
							<div className="relative">
								<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<FormInput
									label="Search status codes"
									value={query}
									onValueChange={(value) => patch({ query: value })}
									placeholder="Search by code or text (e.g. 401, 4, unauth)"
									size="default"
									className="pl-8"
								/>
							</div>
							<ActiveFilterChips
								categories={categorySet}
								includeNonStandard={includeNonStandard}
								misuseOnly={misuseOnly}
								query={debouncedQuery}
								onRemoveCategory={toggleCategory}
								onToggleNonStandard={() => patch({ includeNonStandard: false })}
								onToggleMisuseOnly={() => patch({ misuseOnly: false })}
								onClearQuery={() => patch({ query: '' })}
							/>
						</div>
						{filtered.length === 0 ? (
							<EmbeddedEmptyState
								icon={BookOpen}
								title="No status codes match the current filters"
								description="Try widening the categories, enabling non-standard codes, or clearing the search query."
								fillHeight
							/>
						) : (
							<div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
								{filtered.map((entry) => (
									<StatusCard
										key={entry.code}
										entry={entry}
										isSelected={entry.code === selectedCode}
										onSelect={() =>
											setSelectedCode(entry.code === selectedCode ? null : entry.code)
										}
									/>
								))}
							</div>
						)}
					</div>
				}
				detail={
					selectedEntry ? (
						<div className="h-full overflow-auto">
							<DetailPanel
								entry={selectedEntry}
								onClose={() => setSelectedCode(null)}
								onSelectRelated={(code) => setSelectedCode(code)}
							/>
						</div>
					) : (
						<EmbeddedEmptyState
							icon={BookOpen}
							title="Select a status code"
							description="Pick any entry on the left to see its summary, RFC reference, common misuses, and related codes."
							fillHeight
						/>
					)
				}
			/>
		</ToolShell>
	);
}

/* -------------------------------------------------------------------------- */

interface ActiveFilterChipsProps {
	readonly categories: ReadonlySet<StatusCategory>;
	readonly includeNonStandard: boolean;
	readonly misuseOnly: boolean;
	readonly query: string;
	readonly onRemoveCategory: (category: StatusCategory) => void;
	readonly onToggleNonStandard: () => void;
	readonly onToggleMisuseOnly: () => void;
	readonly onClearQuery: () => void;
}

function ActiveFilterChips({
	categories,
	includeNonStandard,
	misuseOnly,
	query,
	onRemoveCategory,
	onToggleNonStandard,
	onToggleMisuseOnly,
	onClearQuery,
}: ActiveFilterChipsProps) {
	const allOn = categories.size === ALL_CATEGORIES.length;
	if (allOn && !includeNonStandard && !misuseOnly && query.trim().length === 0) {
		return null;
	}

	return (
		<div className="flex flex-wrap gap-1.5">
			{!allOn
				? ALL_CATEGORIES.filter((c) => categories.has(c)).map((category) => (
						<RemovableChip
							key={category}
							label={CATEGORY_LABELS[category]}
							tone={CATEGORY_TONES[category]}
							onRemove={() => onRemoveCategory(category)}
						/>
					))
				: null}
			{includeNonStandard ? (
				<RemovableChip label="Non-standard" tone="info" onRemove={onToggleNonStandard} />
			) : null}
			{misuseOnly ? (
				<RemovableChip label="Misuse warnings" tone="warning" onRemove={onToggleMisuseOnly} />
			) : null}
			{query.trim().length > 0 ? (
				<RemovableChip label={`"${query.trim()}"`} tone="info" onRemove={onClearQuery} />
			) : null}
		</div>
	);
}

/* -------------------------------------------------------------------------- */

interface RemovableChipProps {
	readonly label: string;
	readonly tone: 'success' | 'warning' | 'info' | 'destructive';
	readonly onRemove: () => void;
}

function RemovableChip({ label, tone, onRemove }: RemovableChipProps) {
	return (
		<ToneBadge tone={tone} className="cursor-pointer pr-1">
			{label}
			<button
				type="button"
				className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-foreground/10"
				onClick={onRemove}
				aria-label={`Remove ${label} filter`}
			>
				<X className="h-3 w-3" />
			</button>
		</ToneBadge>
	);
}

/* -------------------------------------------------------------------------- */

interface StatusCardProps {
	readonly entry: StatusCode;
	readonly isSelected: boolean;
	readonly onSelect: () => void;
}

function StatusCard({ entry, isSelected, onSelect }: StatusCardProps) {
	const tone = CATEGORY_TONES[entry.category];
	const copyText = `${entry.code} ${entry.phrase}`;

	return (
		<Card
			density="compact"
			className={cn(
				'cursor-pointer transition-colors hover:bg-muted/40',
				isSelected && 'border-primary ring-1 ring-primary/40'
			)}
			onClick={onSelect}
		>
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between gap-2">
					<div className="flex min-w-0 flex-col gap-1">
						<div className="flex items-baseline gap-2">
							<span className="font-mono text-2xl font-semibold tabular-nums leading-none">
								{entry.code}
							</span>
							{entry.misuse ? (
								<AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
							) : null}
						</div>
						<CardTitle className="truncate text-sm">{entry.phrase}</CardTitle>
					</div>
					<div className="flex flex-col items-end gap-1.5">
						<ToneBadge tone={tone} className="text-2xs">
							{entry.category}
						</ToneBadge>
						{!entry.standard ? (
							<Badge variant="outline" className="text-2xs">
								Non-standard
							</Badge>
						) : null}
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-2">
				<p className="line-clamp-2 text-xs text-muted-foreground">{entry.summary}</p>
				<div className="flex items-center justify-between gap-2">
					<span className="truncate text-2xs text-muted-foreground">{entry.rfc ?? 'No RFC'}</span>
					{/* biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper around an interactive CopyButton; the wrapper itself is not the target. */}
					<div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
						<CopyButton
							text={copyText}
							toastLabel={`${entry.code} ${entry.phrase}`}
							label="Copy"
							size="sm"
							variant="outline"
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

/* -------------------------------------------------------------------------- */

interface DetailPanelProps {
	readonly entry: StatusCode;
	readonly onClose: () => void;
	readonly onSelectRelated: (code: number) => void;
}

function DetailPanel({ entry, onClose, onSelectRelated }: DetailPanelProps) {
	const tone = CATEGORY_TONES[entry.category];

	const handleOpenRfc = async () => {
		if (!entry.rfcUrl) return;
		try {
			const { openUrl } = await import('@tauri-apps/plugin-opener');
			await openUrl(entry.rfcUrl);
		} catch {
			window.open(entry.rfcUrl, '_blank', 'noopener,noreferrer');
		}
	};

	const handleOpenIana = async () => {
		try {
			const { openUrl } = await import('@tauri-apps/plugin-opener');
			await openUrl(IANA_REGISTRY_URL);
		} catch {
			window.open(IANA_REGISTRY_URL, '_blank', 'noopener,noreferrer');
		}
	};

	return (
		<Card density="compact" className="border-primary/40">
			<CardHeader className="pb-2">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex min-w-0 flex-col gap-1.5">
						<div className="flex items-baseline gap-3">
							<span className="font-mono text-4xl font-semibold tabular-nums leading-none">
								{entry.code}
							</span>
							<CardTitle className="text-xl">{entry.phrase}</CardTitle>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<ToneBadge tone={tone}>{entry.category}</ToneBadge>
							{!entry.standard ? <Badge variant="outline">Non-standard</Badge> : null}
							{entry.rfc ? (
								<Badge variant="outline" className="font-mono text-2xs">
									{entry.rfc}
								</Badge>
							) : null}
						</div>
					</div>
					<div className="flex items-center gap-1.5">
						<CopyButton
							text={`${entry.code} ${entry.phrase}`}
							label={`Copy ${entry.code} ${entry.phrase}`}
							toastLabel={`${entry.code} ${entry.phrase}`}
							size="sm"
							variant="outline"
						/>
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={onClose}
							aria-label="Close detail panel"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<section className="space-y-1.5">
					<SubsectionLabel>Summary</SubsectionLabel>
					<p className="text-sm text-foreground/90">{entry.summary}</p>
				</section>

				{entry.whenToUse ? (
					<section className="space-y-1.5">
						<SubsectionLabel>When to use</SubsectionLabel>
						<p className="text-sm text-foreground/90">{entry.whenToUse}</p>
					</section>
				) : null}

				{entry.misuse ? (
					<section className="rounded-md border border-warning/40 bg-warning/5 p-3">
						<div className="flex items-start gap-2">
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
							<div className="space-y-0.5">
								<SubsectionLabel tone="warning">Common misuse</SubsectionLabel>
								<p className="text-sm text-foreground/90">{entry.misuse}</p>
							</div>
						</div>
					</section>
				) : null}

				{entry.related && entry.related.length > 0 ? (
					<section className="space-y-1.5">
						<SubsectionLabel>Related codes</SubsectionLabel>
						<div className="flex flex-wrap gap-1.5">
							{entry.related.map((code) => {
								const related = getStatusCode(code);
								if (!related) return null;
								const relatedTone = CATEGORY_TONES[related.category];
								return (
									<button
										key={code}
										type="button"
										onClick={() => onSelectRelated(code)}
										className="inline-flex items-center"
									>
										<ToneBadge
											tone={relatedTone}
											className="cursor-pointer transition-colors hover:bg-foreground/10"
										>
											<span className="font-mono font-semibold">{related.code}</span>
											<span className="ml-1">{related.phrase}</span>
										</ToneBadge>
									</button>
								);
							})}
						</div>
					</section>
				) : null}

				<section className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
					{entry.rfcUrl ? (
						<Button variant="outline" size="sm" onClick={handleOpenRfc}>
							<ExternalLink className="mr-1.5 h-3.5 w-3.5" />
							Open RFC reference
						</Button>
					) : null}
					<Button variant="ghost" size="sm" onClick={handleOpenIana}>
						<ExternalLink className="mr-1.5 h-3.5 w-3.5" />
						IANA registry
					</Button>
				</section>
			</CardContent>
		</Card>
	);
}
