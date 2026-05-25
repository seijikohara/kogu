import { createFileRoute } from '@tanstack/react-router';
import { useMemo, type ChangeEvent } from 'react';
import {
	ArrowLeftRight,
	FlaskConical,
	GitCompareArrows,
	ListChecks,
	Minus,
	Sigma,
	Trash2,
} from 'lucide-react';

import { CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormMode,
	FormSection,
} from '@/lib/components/form';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Textarea } from '@/lib/components/ui/textarea';
import { useDocumentTitle } from '@/lib/hooks';
import {
	compare,
	DEFAULT_OPTIONS,
	type OperationKind,
	type Region,
	regionFor,
	resultFor,
	SAMPLE_LIST_A,
	SAMPLE_LIST_B,
	type SortMode,
} from '@/lib/services/list-compare';
import { createToolOptionsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/list-comparer')({
	component: ListComparerPage,
});

interface ListComparerOptions {
	readonly caseSensitive: boolean;
	readonly trimWhitespace: boolean;
	readonly ignoreEmpty: boolean;
	readonly sortMode: SortMode;
	readonly activeOp: OperationKind;
}

const DEFAULTS: ListComparerOptions = {
	caseSensitive: DEFAULT_OPTIONS.caseSensitive,
	trimWhitespace: DEFAULT_OPTIONS.trimWhitespace,
	ignoreEmpty: DEFAULT_OPTIONS.ignoreEmpty,
	sortMode: DEFAULT_OPTIONS.sortMode,
	activeOp: 'intersection',
};

const useListComparerOptions = createToolOptionsStore<ListComparerOptions>(
	'list-comparer',
	DEFAULTS
);

const useListComparerInputs = createToolOptionsStore<{
	readonly inputA: string;
	readonly inputB: string;
}>('list-comparer-inputs', { inputA: '', inputB: '' });

const SORT_OPTIONS: readonly { readonly value: SortMode; readonly label: string }[] = [
	{ value: 'original', label: 'Original' },
	{ value: 'asc', label: 'A → Z' },
	{ value: 'desc', label: 'Z → A' },
];

const OPERATIONS = [
	{ id: 'intersection' as const, label: 'A ∩ B', icon: Sigma },
	{ id: 'union' as const, label: 'A ∪ B', icon: Sigma },
	{ id: 'difference-a' as const, label: 'A \\ B', icon: Minus },
	{ id: 'difference-b' as const, label: 'B \\ A', icon: Minus },
	{ id: 'symmetric' as const, label: 'A △ B', icon: GitCompareArrows },
] as const satisfies readonly {
	readonly id: OperationKind;
	readonly label: string;
	readonly icon: typeof Sigma;
}[];

const regionRowClass = (region: Region): string => {
	if (region === 'a-only') return 'border-l-blue-500 bg-blue-500/[0.06]';
	if (region === 'b-only') return 'border-l-emerald-500 bg-emerald-500/[0.06]';
	return 'border-l-fuchsia-500 bg-fuchsia-500/[0.06]';
};

const regionBadgeClass = (region: Region): string => {
	if (region === 'a-only') return 'border-blue-500/40 bg-blue-500/10 text-blue-500';
	if (region === 'b-only') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500';
	return 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-500';
};

const regionLabel = (region: Region): string => {
	if (region === 'a-only') return 'A';
	if (region === 'b-only') return 'B';
	return 'A∩B';
};

interface ListInputCardProps {
	readonly title: string;
	readonly subtitle: string;
	readonly value: string;
	readonly count: number;
	readonly placeholder: string;
	readonly onValueChange: (value: string) => void;
	readonly accentClass: string;
}

function ListInputCard({
	title,
	subtitle,
	value,
	count,
	placeholder,
	onValueChange,
	accentClass,
}: ListInputCardProps) {
	const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) =>
		onValueChange(event.target.value);
	return (
		<Card density="compact" className="flex h-full flex-col">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<div className="flex items-center gap-2">
					<span className={cn('h-2.5 w-2.5 rounded-full', accentClass)} aria-hidden />
					<CardTitle className="text-sm font-medium">{title}</CardTitle>
					<span className="text-xs text-muted-foreground">{subtitle}</span>
				</div>
				<Badge variant="outline" className="font-mono">
					{count} {count === 1 ? 'line' : 'lines'}
				</Badge>
			</CardHeader>
			<CardContent className="flex-1">
				<Textarea
					value={value}
					onChange={handleChange}
					placeholder={placeholder}
					className="h-full min-h-32 resize-none font-mono text-xs"
				/>
			</CardContent>
		</Card>
	);
}

interface VennDiagramProps {
	readonly aOnly: number;
	readonly common: number;
	readonly bOnly: number;
}

function VennDiagram({ aOnly, common, bOnly }: VennDiagramProps) {
	// SVG measured in a 240x140 viewBox so callers can size the wrapper with
	// `h-{n} w-full` and the diagram scales without distorting circle radii.
	return (
		<svg
			viewBox="0 0 240 140"
			role="img"
			aria-label={`Venn diagram: A only ${aOnly}, common ${common}, B only ${bOnly}`}
			className="h-32 w-full max-w-md"
		>
			<title>{`A only ${aOnly}, common ${common}, B only ${bOnly}`}</title>
			<circle
				cx="90"
				cy="70"
				r="55"
				className="fill-blue-500/15 stroke-blue-500/60"
				strokeWidth="1.5"
			/>
			<circle
				cx="150"
				cy="70"
				r="55"
				className="fill-emerald-500/15 stroke-emerald-500/60"
				strokeWidth="1.5"
			/>
			<text x="60" y="68" textAnchor="middle" className="fill-blue-500 font-mono text-[11px]">
				A only
			</text>
			<text
				x="60"
				y="84"
				textAnchor="middle"
				className="fill-foreground font-mono text-base font-semibold"
			>
				{aOnly}
			</text>
			<text x="120" y="68" textAnchor="middle" className="fill-fuchsia-500 font-mono text-[11px]">
				Common
			</text>
			<text
				x="120"
				y="84"
				textAnchor="middle"
				className="fill-foreground font-mono text-base font-semibold"
			>
				{common}
			</text>
			<text x="180" y="68" textAnchor="middle" className="fill-emerald-500 font-mono text-[11px]">
				B only
			</text>
			<text
				x="180"
				y="84"
				textAnchor="middle"
				className="fill-foreground font-mono text-base font-semibold"
			>
				{bOnly}
			</text>
		</svg>
	);
}

function ListComparerPage() {
	const { value: options, patch } = useListComparerOptions();
	const { value: inputs, patch: patchInputs } = useListComparerInputs();
	const { inputA, inputB } = inputs;
	const { caseSensitive, trimWhitespace, ignoreEmpty, sortMode, activeOp } = options;

	useDocumentTitle('List Comparer');

	const compareOptions = useMemo(
		() => ({ caseSensitive, trimWhitespace, ignoreEmpty, sortMode }),
		[caseSensitive, trimWhitespace, ignoreEmpty, sortMode]
	);

	const result = useMemo(
		() => compare(inputA, inputB, compareOptions),
		[inputA, inputB, compareOptions]
	);

	const counts = {
		intersection: result.intersection.length,
		union: result.union.length,
		differenceA: result.differenceA.length,
		differenceB: result.differenceB.length,
		symmetric: result.symmetric.length,
	};

	const operationCount = (kind: OperationKind): number => resultFor(kind, result).length;

	const aOnly = counts.differenceA;
	const bOnly = counts.differenceB;
	const common = counts.intersection;
	const aTotal = result.a.normalisedSet.size;
	const bTotal = result.b.normalisedSet.size;

	const activeLines = resultFor(activeOp, result);
	const activeCount = activeLines.length;

	const handleSample = () => patchInputs({ inputA: SAMPLE_LIST_A, inputB: SAMPLE_LIST_B });
	const handleSwap = () => patchInputs({ inputA: inputB, inputB: inputA });
	const handleClear = () => patchInputs({ inputA: '', inputB: '' });
	const setInputA = (value: string) => patchInputs({ inputA: value });
	const setInputB = (value: string) => patchInputs({ inputB: value });

	const hasAnyInput = inputA.length > 0 || inputB.length > 0;
	const validity = hasAnyInput ? true : null;

	const rail = (
		<>
			<FormSection title="Options">
				<FormCheckboxGroup>
					<FormCheckbox
						label="Case-sensitive"
						checked={caseSensitive}
						onCheckedChange={(v) => patch({ caseSensitive: v })}
						size="compact"
					/>
					<FormCheckbox
						label="Trim whitespace"
						checked={trimWhitespace}
						onCheckedChange={(v) => patch({ trimWhitespace: v })}
						size="compact"
					/>
					<FormCheckbox
						label="Ignore empty lines"
						checked={ignoreEmpty}
						onCheckedChange={(v) => patch({ ignoreEmpty: v })}
						size="compact"
					/>
				</FormCheckboxGroup>
			</FormSection>

			<FormSection title="Sort">
				<FormMode
					value={sortMode}
					onValueChange={(v) => patch({ sortMode: v })}
					options={SORT_OPTIONS}
				/>
			</FormSection>

			<FormSection title="Actions">
				<div className="flex flex-col gap-2">
					<Button variant="outline" size="sm" className="justify-start" onClick={handleSample}>
						<FlaskConical className="mr-2 h-3.5 w-3.5" />
						Load sample
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="justify-start"
						onClick={handleSwap}
						disabled={!hasAnyInput}
					>
						<ArrowLeftRight className="mr-2 h-3.5 w-3.5" />
						Swap A ↔ B
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="justify-start"
						onClick={handleClear}
						disabled={!hasAnyInput}
					>
						<Trash2 className="mr-2 h-3.5 w-3.5" />
						Clear
					</Button>
				</div>
			</FormSection>

			<FormSection title="About">
				<FormInfo>
					<ul className="list-inside list-disc space-y-0.5">
						<li>Set operations on two newline-separated lists</li>
						<li>Duplicates are folded; first-seen casing is preserved</li>
						<li>Venn diagram visualises A-only / common / B-only</li>
					</ul>
				</FormInfo>
			</FormSection>
		</>
	);

	const statusContent = (
		<>
			<StatItem label="A" value={aTotal} />
			<StatItem label="B" value={bTotal} />
			<StatItem label="Common" value={common} />
			<StatItem
				label={OPERATIONS.find((op) => op.id === activeOp)?.label ?? 'Result'}
				value={activeCount}
			/>
		</>
	);

	return (
		<ToolShell valid={validity} rail={rail} statusContent={statusContent}>
			<div className="flex h-full flex-col gap-3 overflow-hidden p-3">
				<div className="grid h-1/3 min-h-44 shrink-0 gap-3 sm:grid-cols-2">
					<ListInputCard
						title="List A"
						subtitle="left input"
						value={inputA}
						count={aTotal}
						placeholder={`apple
banana
cherry`}
						onValueChange={setInputA}
						accentClass="bg-blue-500"
					/>
					<ListInputCard
						title="List B"
						subtitle="right input"
						value={inputB}
						count={bTotal}
						placeholder={`banana
cherry
grape`}
						onValueChange={setInputB}
						accentClass="bg-emerald-500"
					/>
				</div>

				<Card density="compact" className="shrink-0">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Venn diagram</CardTitle>
					</CardHeader>
					<CardContent className="flex items-center justify-center">
						<VennDiagram aOnly={aOnly} common={common} bOnly={bOnly} />
					</CardContent>
				</Card>

				<Card density="compact" className="flex min-h-0 flex-1 flex-col">
					<CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
						<div
							role="tablist"
							aria-label="Set operations"
							className="flex flex-wrap items-center gap-1 rounded-lg bg-surface-2 p-1"
						>
							{OPERATIONS.map((op) => {
								const Icon = op.icon;
								const isActive = op.id === activeOp;
								const count = operationCount(op.id);
								return (
									<button
										key={op.id}
										type="button"
										role="tab"
										aria-selected={isActive}
										onClick={() => patch({ activeOp: op.id })}
										className={cn(
											'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
											isActive
												? 'bg-surface-0 text-foreground shadow-sm'
												: 'text-muted-foreground hover:bg-interactive-hover hover:text-foreground'
										)}
									>
										<Icon className="h-3.5 w-3.5" />
										<span className="font-mono">{op.label}</span>
										<Badge variant="outline" className="ml-1 h-4 px-1.5 font-mono text-[10px]">
											{count}
										</Badge>
									</button>
								);
							})}
						</div>
						<CopyButton
							text={activeLines.join('\n')}
							toastLabel={OPERATIONS.find((op) => op.id === activeOp)?.label ?? 'Result'}
							disabled={activeCount === 0}
						/>
					</CardHeader>
					<CardContent className="flex min-h-0 flex-1 flex-col p-0">
						{activeLines.length > 0 ? (
							<div className="flex-1 overflow-auto rounded-b-lg bg-card">
								<ul className="divide-y divide-border/40">
									{activeLines.map((line, index) => {
										const region = regionFor(line, result);
										return (
											<li
												// biome-ignore lint/suspicious/noArrayIndexKey: result list is immutable per render
												key={`${region}-${index}-${line}`}
												className={cn(
													'flex items-center gap-3 border-l-4 px-3 py-1.5 font-mono text-sm',
													regionRowClass(region)
												)}
											>
												<Badge
													variant="outline"
													className={cn(
														'h-5 shrink-0 px-1.5 font-mono text-[10px]',
														regionBadgeClass(region)
													)}
												>
													{regionLabel(region)}
												</Badge>
												<span className="min-w-0 flex-1 truncate">
													{line.length === 0 ? (
														<span className="text-muted-foreground italic">(empty line)</span>
													) : (
														line
													)}
												</span>
											</li>
										);
									})}
								</ul>
							</div>
						) : (
							<EmbeddedEmptyState
								icon={ListChecks}
								title={hasAnyInput ? 'No items in this result' : 'Enter two lists'}
								description={
									hasAnyInput
										? 'Adjust the lists or switch to another operation to see results.'
										: 'Paste newline-separated values into List A and List B to start comparing.'
								}
								fillHeight
							/>
						)}
					</CardContent>
				</Card>
			</div>
		</ToolShell>
	);
}
