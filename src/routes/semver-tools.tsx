import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import {
	ArrowDown,
	ArrowRight,
	ArrowUp,
	Check,
	FlaskConical,
	GitCompare,
	History,
	ListChecks,
	Minus,
	Package,
	Search,
	Sparkles,
	Tag,
	Target,
	TrendingUp,
	X,
} from 'lucide-react';

import { CopyButton } from '@/lib/components/action';
import { FormError, FormInfo, FormInput, FormSection, FormTextarea } from '@/lib/components/form';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/lib/components/ui/card';
import { useActiveTab, useTabStore, createToolOptionsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/hooks';
import {
	calculateBumps,
	compareVersions,
	computeReleaseSteps,
	type DiffKind,
	parseVersion,
	SAMPLE_RANGE,
	SAMPLE_RANGE_VERSION,
	SAMPLE_TIMELINE_TEXT,
	SAMPLE_VERSION,
	SAMPLE_VERSION_A,
	SAMPLE_VERSION_B,
	testRange,
} from '@/lib/services/semver-tools';

type SemverTab = 'parse' | 'compare' | 'range' | 'bump';

const TABS = [
	{ id: 'parse' as const, label: 'Parse', icon: Search },
	{ id: 'compare' as const, label: 'Compare', icon: GitCompare },
	{ id: 'range' as const, label: 'Range', icon: Target },
	{ id: 'bump' as const, label: 'Bump', icon: TrendingUp },
] as const;

const PERSIST_KEY = 'semver-tools';

interface SemverPrefs {
	readonly parseInput: string;
	readonly compareA: string;
	readonly compareB: string;
	readonly rangeRange: string;
	readonly rangeVersion: string;
	readonly bumpVersion: string;
	readonly bumpIdentifier: string;
	readonly timelineInput: string;
}

const DEFAULT_PREFS: SemverPrefs = {
	parseInput: '',
	compareA: '',
	compareB: '',
	rangeRange: '',
	rangeVersion: '',
	bumpVersion: '',
	bumpIdentifier: 'rc',
	timelineInput: '',
};

const useSemverOptions = createToolOptionsStore<SemverPrefs>(PERSIST_KEY, DEFAULT_PREFS);

export const Route = createFileRoute('/semver-tools')({
	component: SemverToolsPage,
});

const isSemverTab = (value: string): value is SemverTab =>
	value === 'parse' || value === 'compare' || value === 'range' || value === 'bump';

const BUMP_TONE: Record<Exclude<DiffKind, null>, string> = {
	major: 'bg-destructive/10 text-destructive border-destructive/30',
	minor: 'bg-warning/10 text-warning border-warning/30',
	patch: 'bg-success/10 text-success border-success/30',
	premajor: 'bg-destructive/10 text-destructive border-destructive/30',
	preminor: 'bg-warning/10 text-warning border-warning/30',
	prepatch: 'bg-info/10 text-info border-info/30',
	prerelease: 'bg-info/10 text-info border-info/30',
};

const SIGN_TONE: Record<'<' | '=' | '>', string> = {
	'<': 'bg-info/10 text-info border-info/30',
	'=': 'bg-muted text-foreground border-border',
	'>': 'bg-success/10 text-success border-success/30',
};

const DIRECTION_ICON = {
	forward: ArrowUp,
	same: Minus,
	backward: ArrowDown,
} as const;

const formatBump = (bump: DiffKind): string => (bump === null ? 'identical' : bump);

interface SegmentBadgeProps {
	readonly label: string;
	readonly value: string;
	readonly highlight?: boolean;
	readonly tone?: string;
}

function SegmentBadge({ label, value, highlight = false, tone }: SegmentBadgeProps) {
	return (
		<div
			className={cn(
				'flex flex-col items-start rounded-md border bg-card px-3 py-2 transition-colors',
				highlight && (tone ?? 'border-primary/40 bg-primary/5')
			)}
		>
			<span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</span>
			<span className="font-mono text-base tabular-nums">{value}</span>
		</div>
	);
}

function SemverToolsPage() {
	const persistedTab = useActiveTab(PERSIST_KEY);
	const setActive = useTabStore((s) => s.setActive);
	const activeTab: SemverTab = isSemverTab(persistedTab ?? '')
		? (persistedTab as SemverTab)
		: 'parse';
	const handleTabChange = (tab: string) => {
		if (isSemverTab(tab)) setActive(PERSIST_KEY, tab);
	};

	const prefs = useSemverOptions((s) => s.value);
	const patch = useSemverOptions((s) => s.patch);

	useDocumentTitle('SemVer Tools');

	const parseResult = useMemo(() => parseVersion(prefs.parseInput), [prefs.parseInput]);
	const timelineSteps = useMemo(
		() => computeReleaseSteps(prefs.timelineInput.split('\n')),
		[prefs.timelineInput]
	);

	const compareResult = useMemo(
		() => compareVersions(prefs.compareA, prefs.compareB),
		[prefs.compareA, prefs.compareB]
	);

	const rangeResult = useMemo(
		() => testRange(prefs.rangeRange, prefs.rangeVersion),
		[prefs.rangeRange, prefs.rangeVersion]
	);

	const bumpResult = useMemo(
		() => calculateBumps(prefs.bumpVersion, prefs.bumpIdentifier),
		[prefs.bumpVersion, prefs.bumpIdentifier]
	);

	const statusContent = (() => {
		if (activeTab === 'parse') {
			if (!parseResult.ok) return <StatItem label="Segments" value="—" />;
			const count =
				3 +
				(parseResult.parsed.prerelease.length > 0 ? 1 : 0) +
				(parseResult.parsed.build.length > 0 ? 1 : 0);
			return <StatItem label="Segments" value={count} />;
		}
		if (activeTab === 'compare') {
			if (!compareResult.ok) return <StatItem label="Compare" value="—" />;
			return (
				<>
					<StatItem label="Sign" value={compareResult.sign} />
					<StatItem label="Bump" value={formatBump(compareResult.bump)} />
				</>
			);
		}
		if (activeTab === 'range') {
			if (!rangeResult.ok) return <StatItem label="Satisfies" value="—" />;
			return (
				<StatItem
					label="Satisfies"
					value={rangeResult.satisfies ? 'yes' : 'no'}
					variant={rangeResult.satisfies ? 'success' : 'warning'}
				/>
			);
		}
		return <StatItem label="Identifier" value={prefs.bumpIdentifier || 'rc'} />;
	})();

	const currentValid: boolean | null = (() => {
		if (activeTab === 'parse') return prefs.parseInput.length === 0 ? null : parseResult.ok;
		if (activeTab === 'compare')
			return prefs.compareA.length === 0 && prefs.compareB.length === 0 ? null : compareResult.ok;
		if (activeTab === 'range')
			return prefs.rangeRange.length === 0 && prefs.rangeVersion.length === 0
				? null
				: rangeResult.ok && rangeResult.satisfies;
		return prefs.bumpVersion.length === 0 ? null : bumpResult.ok;
	})();

	const loadCurrentTabSample = () => {
		if (activeTab === 'parse') {
			patch({ parseInput: SAMPLE_VERSION, timelineInput: SAMPLE_TIMELINE_TEXT });
		} else if (activeTab === 'compare') {
			patch({ compareA: SAMPLE_VERSION_A, compareB: SAMPLE_VERSION_B });
		} else if (activeTab === 'range') {
			patch({ rangeRange: SAMPLE_RANGE, rangeVersion: SAMPLE_RANGE_VERSION });
		} else {
			patch({ bumpVersion: SAMPLE_VERSION_A, bumpIdentifier: 'rc' });
		}
	};

	const renderParseTab = () => (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex-1 overflow-auto p-4">
				<div className="mx-auto flex max-w-5xl flex-col gap-4">
					<Card density="compact">
						<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
							<div className="space-y-1.5">
								<CardTitle className="text-sm font-medium">Version string</CardTitle>
								<CardDescription className="text-xs">
									Paste a SemVer 2.0.0 string —{' '}
									<code className="rounded bg-muted px-1 font-mono">
										major.minor.patch-prerelease+buildmetadata
									</code>
									.
								</CardDescription>
							</div>
							<div className="flex shrink-0 items-center gap-1">
								<Button
									variant="outline"
									size="sm"
									className="h-7"
									onClick={() => patch({ parseInput: SAMPLE_VERSION })}
								>
									<FlaskConical className="h-3.5 w-3.5" />
									Sample
								</Button>
								<CopyButton
									text={prefs.parseInput}
									toastLabel="Version"
									variant="outline"
									size="sm"
									disabled={prefs.parseInput.length === 0}
								/>
							</div>
						</CardHeader>
						<CardContent>
							<FormInput
								label=""
								value={prefs.parseInput}
								onValueChange={(v) => patch({ parseInput: v })}
								placeholder={SAMPLE_VERSION}
								className="font-mono"
							/>
						</CardContent>
					</Card>

					{prefs.parseInput.trim().length === 0 ? (
						<Card density="compact">
							<CardContent className="py-10">
								<EmbeddedEmptyState
									icon={Tag}
									title="Enter a version string"
									description="Click Sample to load a representative version or type your own."
								/>
							</CardContent>
						</Card>
					) : parseResult.ok ? (
						<>
							<Card density="compact">
								<CardHeader className="pb-3">
									<div className="flex items-center gap-2">
										<Tag className="h-4 w-4 text-muted-foreground" />
										<CardTitle className="text-sm font-medium">Segments</CardTitle>
									</div>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-2">
									<SegmentBadge label="Major" value={String(parseResult.parsed.major)} highlight />
									<SegmentBadge label="Minor" value={String(parseResult.parsed.minor)} highlight />
									<SegmentBadge label="Patch" value={String(parseResult.parsed.patch)} highlight />
									{parseResult.parsed.prerelease.length > 0 ? (
										<SegmentBadge
											label="Prerelease"
											value={parseResult.parsed.prerelease.join('.')}
											highlight
											tone="border-info/40 bg-info/5"
										/>
									) : null}
									{parseResult.parsed.build.length > 0 ? (
										<SegmentBadge
											label="Build"
											value={parseResult.parsed.build.join('.')}
											highlight
											tone="border-warning/40 bg-warning/5"
										/>
									) : null}
								</CardContent>
							</Card>

							<Card density="compact">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
									<div className="flex items-center gap-2">
										<Package className="h-4 w-4 text-muted-foreground" />
										<CardTitle className="text-sm font-medium">Canonical</CardTitle>
									</div>
									<CopyButton
										text={parseResult.parsed.fullVersion}
										toastLabel="Version"
										size="sm"
									/>
								</CardHeader>
								<CardContent>
									<code className="block break-all rounded-md bg-muted p-3 font-mono text-base tabular-nums">
										{parseResult.parsed.fullVersion}
									</code>
								</CardContent>
							</Card>
						</>
					) : (
						<Card density="compact" variant="destructive">
							<CardHeader className="pb-3">
								<div className="flex items-center gap-2">
									<X className="h-4 w-4 text-destructive" />
									<CardTitle className="text-sm font-medium text-destructive">
										Parse error
									</CardTitle>
								</div>
							</CardHeader>
							<CardContent>
								<FormError message={parseResult.error} className="text-sm" />
							</CardContent>
						</Card>
					)}

					<Card density="compact">
						<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
							<div className="space-y-1.5">
								<div className="flex items-center gap-2">
									<History className="h-4 w-4 text-muted-foreground" />
									<CardTitle className="text-sm font-medium">Release type detector</CardTitle>
								</div>
								<CardDescription className="text-xs">
									List versions in chronological order — one per line — to classify the bump type
									between each step.
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="h-7 shrink-0"
								onClick={() => patch({ timelineInput: SAMPLE_TIMELINE_TEXT })}
							>
								<FlaskConical className="h-3.5 w-3.5" />
								Sample
							</Button>
						</CardHeader>
						<CardContent className="space-y-3">
							<FormTextarea
								label=""
								value={prefs.timelineInput}
								onValueChange={(v) => patch({ timelineInput: v })}
								placeholder={'1.0.0\n1.0.1\n1.1.0\n2.0.0'}
								rows={5}
								className="font-mono text-sm"
							/>
							{timelineSteps.length === 0 ? (
								<EmbeddedEmptyState
									icon={ListChecks}
									title="At least two versions required"
									description="Add two or more versions to see bump classifications between adjacent entries."
								/>
							) : (
								<ul className="space-y-1.5">
									{timelineSteps.map((step, idx) => {
										if (!step.ok) {
											return (
												<li
													// biome-ignore lint/suspicious/noArrayIndexKey: ordered step list is immutable per render
													key={idx}
													className="flex flex-col gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
												>
													<div className="flex items-center gap-2 text-xs font-mono tabular-nums">
														<span className="text-muted-foreground">{idx + 1}.</span>
														<span>{step.from || '?'}</span>
														<ArrowRight className="h-3 w-3 text-muted-foreground" />
														<span>{step.to || '?'}</span>
													</div>
													<span className="text-xs text-destructive">{step.error}</span>
												</li>
											);
										}
										const DirectionIcon = DIRECTION_ICON[step.direction];
										const tone = step.bump
											? BUMP_TONE[step.bump]
											: 'bg-muted text-foreground border-border';
										return (
											<li
												// biome-ignore lint/suspicious/noArrayIndexKey: ordered step list is immutable per render
												key={idx}
												className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
											>
												<span className="w-6 text-xs tabular-nums text-muted-foreground">
													{idx + 1}.
												</span>
												<code className="font-mono text-xs tabular-nums">{step.from}</code>
												<DirectionIcon className="h-3.5 w-3.5 text-muted-foreground" />
												<code className="font-mono text-xs tabular-nums">{step.to}</code>
												<Badge className={cn('ml-auto text-2xs font-mono', tone)}>
													{formatBump(step.bump)}
												</Badge>
											</li>
										);
									})}
								</ul>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);

	const renderCompareTab = () => (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex-1 overflow-auto p-4">
				<div className="mx-auto flex max-w-5xl flex-col gap-4">
					<Card density="compact">
						<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
							<div className="space-y-1.5">
								<CardTitle className="text-sm font-medium">Versions</CardTitle>
								<CardDescription className="text-xs">
									Enter two semantic versions to compare their precedence and bump type.
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="h-7 shrink-0"
								onClick={() => patch({ compareA: SAMPLE_VERSION_A, compareB: SAMPLE_VERSION_B })}
							>
								<FlaskConical className="h-3.5 w-3.5" />
								Sample
							</Button>
						</CardHeader>
						<CardContent className="grid gap-3 sm:grid-cols-2">
							<FormInput
								label="A"
								value={prefs.compareA}
								onValueChange={(v) => patch({ compareA: v })}
								placeholder={SAMPLE_VERSION_A}
								className="font-mono"
							/>
							<FormInput
								label="B"
								value={prefs.compareB}
								onValueChange={(v) => patch({ compareB: v })}
								placeholder={SAMPLE_VERSION_B}
								className="font-mono"
							/>
						</CardContent>
					</Card>

					{prefs.compareA.trim().length === 0 || prefs.compareB.trim().length === 0 ? (
						<Card density="compact">
							<CardContent className="py-10">
								<EmbeddedEmptyState
									icon={GitCompare}
									title="Enter two versions"
									description="Provide both A and B to see the comparison result, bump type, and segment visualization."
								/>
							</CardContent>
						</Card>
					) : compareResult.ok ? (
						<>
							<Card density="compact">
								<CardContent className="flex flex-col items-center gap-3 py-6">
									<div
										className={cn(
											'flex h-20 w-20 items-center justify-center rounded-full border-2 font-mono text-5xl font-semibold tabular-nums',
											SIGN_TONE[compareResult.sign]
										)}
										role="status"
										aria-live="polite"
									>
										{compareResult.sign}
									</div>
									<div className="flex flex-wrap items-center justify-center gap-2">
										<Badge
											className={cn(
												'text-xs font-mono',
												compareResult.bump
													? BUMP_TONE[compareResult.bump]
													: 'bg-muted text-foreground border-border'
											)}
										>
											{formatBump(compareResult.bump)}
										</Badge>
										{compareResult.metadataOnly ? (
											<Badge className="bg-info/10 text-info border-info/30 text-xs">
												metadata-only
											</Badge>
										) : null}
									</div>
									<p className="text-center text-xs text-muted-foreground">
										<code className="font-mono">{compareResult.a.fullVersion}</code>{' '}
										{compareResult.sign === '='
											? 'equals'
											: compareResult.sign === '<'
												? 'precedes'
												: 'follows'}{' '}
										<code className="font-mono">{compareResult.b.fullVersion}</code>.
									</p>
								</CardContent>
							</Card>

							<Card density="compact">
								<CardHeader className="pb-3">
									<div className="flex items-center gap-2">
										<Tag className="h-4 w-4 text-muted-foreground" />
										<CardTitle className="text-sm font-medium">Segment visualization</CardTitle>
									</div>
									<CardDescription className="text-xs">
										Differing segments are highlighted. Lower segments reset when a higher one
										changes per SemVer precedence rules.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									{(
										[
											{ label: 'Version A', parsed: compareResult.a },
											{ label: 'Version B', parsed: compareResult.b },
										] as const
									).map((row) => {
										const majorDiffers = compareResult.a.major !== compareResult.b.major;
										const minorDiffers = compareResult.a.minor !== compareResult.b.minor;
										const patchDiffers = compareResult.a.patch !== compareResult.b.patch;
										const preDiffers =
											compareResult.a.prerelease.join('.') !== compareResult.b.prerelease.join('.');
										return (
											<div key={row.label} className="flex flex-col gap-1.5">
												<span className="text-xs font-medium text-muted-foreground">
													{row.label}
												</span>
												<div className="flex flex-wrap gap-2">
													<SegmentBadge
														label="Major"
														value={String(row.parsed.major)}
														highlight={majorDiffers}
														tone="border-destructive/40 bg-destructive/5"
													/>
													<SegmentBadge
														label="Minor"
														value={String(row.parsed.minor)}
														highlight={minorDiffers}
														tone="border-warning/40 bg-warning/5"
													/>
													<SegmentBadge
														label="Patch"
														value={String(row.parsed.patch)}
														highlight={patchDiffers}
														tone="border-success/40 bg-success/5"
													/>
													{row.parsed.prerelease.length > 0 ? (
														<SegmentBadge
															label="Prerelease"
															value={row.parsed.prerelease.join('.')}
															highlight={preDiffers}
															tone="border-info/40 bg-info/5"
														/>
													) : null}
													{row.parsed.build.length > 0 ? (
														<SegmentBadge
															label="Build"
															value={row.parsed.build.join('.')}
															tone="border-warning/40 bg-warning/5"
														/>
													) : null}
												</div>
											</div>
										);
									})}
								</CardContent>
							</Card>
						</>
					) : (
						<Card density="compact" variant="destructive">
							<CardHeader className="pb-3">
								<div className="flex items-center gap-2">
									<X className="h-4 w-4 text-destructive" />
									<CardTitle className="text-sm font-medium text-destructive">
										Compare error
									</CardTitle>
								</div>
							</CardHeader>
							<CardContent>
								<FormError message={compareResult.error} className="text-sm" />
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</div>
	);

	const renderRangeTab = () => (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex-1 overflow-auto p-4">
				<div className="mx-auto flex max-w-5xl flex-col gap-4">
					<Card density="compact">
						<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
							<div className="space-y-1.5">
								<CardTitle className="text-sm font-medium">Range and version</CardTitle>
								<CardDescription className="text-xs">
									Use npm-style ranges —{' '}
									<code className="rounded bg-muted px-1 font-mono">^1.2.3</code>,{' '}
									<code className="rounded bg-muted px-1 font-mono">~1.2.0</code>,{' '}
									<code className="rounded bg-muted px-1 font-mono">{'>=1.0.0 <2.0.0'}</code>, or{' '}
									<code className="rounded bg-muted px-1 font-mono">||</code> alternatives.
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="h-7 shrink-0"
								onClick={() =>
									patch({ rangeRange: SAMPLE_RANGE, rangeVersion: SAMPLE_RANGE_VERSION })
								}
							>
								<FlaskConical className="h-3.5 w-3.5" />
								Sample
							</Button>
						</CardHeader>
						<CardContent className="grid gap-3 sm:grid-cols-2">
							<FormInput
								label="Range"
								value={prefs.rangeRange}
								onValueChange={(v) => patch({ rangeRange: v })}
								placeholder={SAMPLE_RANGE}
								className="font-mono"
							/>
							<FormInput
								label="Version"
								value={prefs.rangeVersion}
								onValueChange={(v) => patch({ rangeVersion: v })}
								placeholder={SAMPLE_RANGE_VERSION}
								className="font-mono"
							/>
						</CardContent>
					</Card>

					{prefs.rangeRange.trim().length === 0 || prefs.rangeVersion.trim().length === 0 ? (
						<Card density="compact">
							<CardContent className="py-10">
								<EmbeddedEmptyState
									icon={Target}
									title="Enter a range and version"
									description="Provide both fields to check if the version satisfies the range."
								/>
							</CardContent>
						</Card>
					) : rangeResult.ok ? (
						<>
							<Card density="compact">
								<CardContent className="flex flex-col items-center gap-3 py-6">
									<Badge
										className={cn(
											'px-4 py-1 text-base font-medium',
											rangeResult.satisfies
												? 'bg-success/10 text-success border-success/30'
												: 'bg-destructive/10 text-destructive border-destructive/30'
										)}
									>
										{rangeResult.satisfies ? (
											<Check className="mr-1 h-4 w-4" />
										) : (
											<X className="mr-1 h-4 w-4" />
										)}
										{rangeResult.satisfies ? 'Satisfies' : 'Does not satisfy'}
									</Badge>
									<p className="text-center text-xs text-muted-foreground">
										<code className="font-mono">{rangeResult.version}</code>{' '}
										{rangeResult.satisfies ? 'matches' : 'does not match'}{' '}
										<code className="font-mono">{rangeResult.range}</code>.
									</p>
								</CardContent>
							</Card>

							<Card density="compact">
								<CardHeader className="pb-3">
									<div className="flex items-center gap-2">
										<Sparkles className="h-4 w-4 text-muted-foreground" />
										<CardTitle className="text-sm font-medium">Explanation</CardTitle>
									</div>
								</CardHeader>
								<CardContent className="space-y-2">
									<p className="text-sm">{rangeResult.explanation}</p>
									<div className="flex flex-wrap gap-2">
										<Badge variant="outline" className="font-mono text-2xs">
											normalized: {rangeResult.range}
										</Badge>
										{rangeResult.matchedRange && rangeResult.matchedRange !== rangeResult.range ? (
											<Badge variant="outline" className="font-mono text-2xs">
												matched subrange: {rangeResult.matchedRange}
											</Badge>
										) : null}
										{rangeResult.minVersion ? (
											<Badge variant="outline" className="font-mono text-2xs">
												minVersion: {rangeResult.minVersion}
											</Badge>
										) : null}
									</div>
								</CardContent>
							</Card>
						</>
					) : (
						<Card density="compact" variant="destructive">
							<CardHeader className="pb-3">
								<div className="flex items-center gap-2">
									<X className="h-4 w-4 text-destructive" />
									<CardTitle className="text-sm font-medium text-destructive">
										Range error
									</CardTitle>
								</div>
							</CardHeader>
							<CardContent>
								<FormError message={rangeResult.error} className="text-sm" />
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</div>
	);

	const renderBumpTab = () => {
		const bumpRows: readonly {
			readonly id: keyof typeof BUMP_TONE;
			readonly label: string;
			readonly hint: string;
		}[] = [
			{ id: 'major', label: 'Major', hint: 'Breaking changes' },
			{ id: 'minor', label: 'Minor', hint: 'Backwards-compatible features' },
			{ id: 'patch', label: 'Patch', hint: 'Backwards-compatible fixes' },
			{ id: 'premajor', label: 'Pre-major', hint: 'Next major as prerelease' },
			{ id: 'preminor', label: 'Pre-minor', hint: 'Next minor as prerelease' },
			{ id: 'prepatch', label: 'Pre-patch', hint: 'Next patch as prerelease' },
			{ id: 'prerelease', label: 'Prerelease', hint: 'Advance prerelease counter' },
		];

		return (
			<div className="flex h-full flex-col overflow-hidden">
				<div className="flex-1 overflow-auto p-4">
					<div className="mx-auto flex max-w-5xl flex-col gap-4">
						<Card density="compact">
							<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
								<div className="space-y-1.5">
									<CardTitle className="text-sm font-medium">Current version</CardTitle>
									<CardDescription className="text-xs">
										Provide a version and prerelease identifier — defaults to{' '}
										<code className="rounded bg-muted px-1 font-mono">rc</code>.
									</CardDescription>
								</div>
								<Button
									variant="outline"
									size="sm"
									className="h-7 shrink-0"
									onClick={() => patch({ bumpVersion: SAMPLE_VERSION_A, bumpIdentifier: 'rc' })}
								>
									<FlaskConical className="h-3.5 w-3.5" />
									Sample
								</Button>
							</CardHeader>
							<CardContent className="grid gap-3 sm:grid-cols-[1fr_180px]">
								<FormInput
									label="Version"
									value={prefs.bumpVersion}
									onValueChange={(v) => patch({ bumpVersion: v })}
									placeholder={SAMPLE_VERSION_A}
									className="font-mono"
								/>
								<FormInput
									label="Prerelease identifier"
									value={prefs.bumpIdentifier}
									onValueChange={(v) => patch({ bumpIdentifier: v })}
									placeholder="rc"
									hint="Used by pre-* bumps"
									className="font-mono"
								/>
							</CardContent>
						</Card>

						{prefs.bumpVersion.trim().length === 0 ? (
							<Card density="compact">
								<CardContent className="py-10">
									<EmbeddedEmptyState
										icon={TrendingUp}
										title="Enter a current version"
										description="Bump suggestions appear once a valid version is provided."
									/>
								</CardContent>
							</Card>
						) : bumpResult.ok ? (
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{bumpRows.map((row) => {
									const value = bumpResult[row.id];
									return (
										<Card key={row.id} density="compact">
											<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
												<div className="space-y-0.5">
													<Badge className={cn('text-2xs font-mono', BUMP_TONE[row.id])}>
														{row.label}
													</Badge>
													<CardDescription className="text-2xs">{row.hint}</CardDescription>
												</div>
												<CopyButton text={value} toastLabel={row.label} size="sm" />
											</CardHeader>
											<CardContent>
												<code className="block break-all rounded-md bg-muted p-2 font-mono text-sm tabular-nums">
													{value}
												</code>
											</CardContent>
										</Card>
									);
								})}
							</div>
						) : (
							<Card density="compact" variant="destructive">
								<CardHeader className="pb-3">
									<div className="flex items-center gap-2">
										<X className="h-4 w-4 text-destructive" />
										<CardTitle className="text-sm font-medium text-destructive">
											Bump error
										</CardTitle>
									</div>
								</CardHeader>
								<CardContent>
									<FormError message={bumpResult.error} className="text-sm" />
								</CardContent>
							</Card>
						)}
					</div>
				</div>
			</div>
		);
	};

	const rail = (
		<>
			<FormSection title="Range syntax">
				<FormInfo>
					<ul className="list-inside list-disc space-y-0.5">
						<li>
							<code className="font-mono">^1.2.3</code> — compatible with{' '}
							<code className="font-mono">1.x.x</code>
						</li>
						<li>
							<code className="font-mono">~1.2.3</code> — compatible with{' '}
							<code className="font-mono">1.2.x</code>
						</li>
						<li>
							<code className="font-mono">{'>=1.0.0 <2.0.0'}</code> — explicit lower / upper bound
						</li>
						<li>
							<code className="font-mono">1.0.0 || 2.0.0</code> — alternatives via{' '}
							<code className="font-mono">||</code>
						</li>
						<li>
							<code className="font-mono">1.2.x</code> / <code className="font-mono">1.2.*</code> —
							wildcards
						</li>
					</ul>
				</FormInfo>
			</FormSection>

			<FormSection title="Quick fill">
				<Button
					variant="outline"
					size="sm"
					className="w-full justify-start"
					onClick={loadCurrentTabSample}
				>
					<FlaskConical className="h-3.5 w-3.5" />
					Sample for {activeTab}
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="w-full justify-start"
					onClick={() => patch({ ...DEFAULT_PREFS })}
				>
					<X className="h-3.5 w-3.5" />
					Clear all
				</Button>
			</FormSection>

			<ToolFooter
				relatedItems={[
					{ id: 'diff-viewer', reason: 'Diff two version strings or changelogs' },
					{ id: 'json-formatter', reason: 'Inspect version fields in package manifests' },
					{ id: 'list-comparer', reason: 'Compare two lists of version tags' },
				]}
				aboutText={
					<>
						Parses, compares, range-tests, and bumps versions following Semantic Versioning 2.0.0 —{' '}
						<code className="font-mono">major.minor.patch</code> with an optional{' '}
						<code className="font-mono">-prerelease</code> and{' '}
						<code className="font-mono">+buildmetadata</code>. Major marks breaking changes, minor
						adds backwards-compatible features, and patch covers backwards-compatible fixes. Build
						metadata is ignored when comparing precedence, and a prerelease ranks below the same
						version without one.
					</>
				}
			/>
		</>
	);

	return (
		<ToolShell
			layout="tabbed"
			tabs={TABS}
			activeTab={activeTab}
			onTabChange={handleTabChange}
			valid={currentValid}
			rail={rail}
			statusContent={statusContent}
			renderTabContent={(tab) => {
				if (tab === 'parse') return renderParseTab();
				if (tab === 'compare') return renderCompareTab();
				if (tab === 'range') return renderRangeTab();
				return renderBumpTab();
			}}
		/>
	);
}
