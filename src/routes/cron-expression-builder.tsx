import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Calendar, Check, Clock, FlaskConical, Pencil, Search, Sparkles, X } from 'lucide-react';

import { CopyButton } from '@/lib/components/action';
import { FormError, FormInfo, FormInput, FormSection } from '@/lib/components/form';
import { ToolShell } from '@/lib/components/shell';
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
import { useActiveTab, useTabStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/hooks';
import {
	buildExpression,
	CRON_FIELDS,
	CRON_PRESET_CATEGORIES,
	type CronParts,
	DEFAULT_CRON_PARTS,
	explainExpression,
	formatDateParts,
	nextExecutions,
	parseExpression,
	SAMPLE_CRON_EXPRESSION,
	validateField,
} from '@/lib/services/cron';

type CronTab = 'build' | 'parse';

const TABS = [
	{ id: 'build' as const, label: 'Build', icon: Pencil },
	{ id: 'parse' as const, label: 'Parse', icon: Search },
] as const;

const PERSIST_KEY = 'cron-expression-builder';

export const Route = createFileRoute('/cron-expression-builder')({
	component: CronExpressionBuilderPage,
});

const dayBadgeClass = (dayIndex: number, isWeekend: boolean): string => {
	if (isWeekend) return 'bg-warning/10 text-warning border-warning/30';
	if (dayIndex === 1) return 'bg-info/10 text-info border-info/30';
	return 'bg-success/10 text-success border-success/30';
};

function CronExpressionBuilderPage() {
	const persistedTab = useActiveTab(PERSIST_KEY);
	const setActive = useTabStore((s) => s.setActive);
	const activeTab: CronTab = (persistedTab as CronTab | undefined) ?? 'build';
	const handleTabChange = (tab: string) => {
		if (tab === 'build' || tab === 'parse') setActive(PERSIST_KEY, tab);
	};

	const [buildParts, setBuildParts] = useState<CronParts>({ ...DEFAULT_CRON_PARTS });
	const [parseInput, setParseInput] = useState<string>('');

	useDocumentTitle('Cron Expression Builder');

	const buildExpr = buildExpression(buildParts);
	const buildFieldValidations = Object.fromEntries(
		CRON_FIELDS.map((field) => [field.id, validateField(field.id, buildParts[field.id])])
	) as Record<keyof CronParts, ReturnType<typeof validateField>>;
	const buildAllValid = (
		Object.values(buildFieldValidations) as ReturnType<typeof validateField>[]
	).every((v) => v.ok);
	const buildDescription = explainExpression(buildExpr);
	const buildNextRuns = nextExecutions(buildExpr, 8);
	const buildValid = buildAllValid && buildDescription.ok && buildNextRuns.ok;

	const parseResult = parseExpression(parseInput);
	const parseDescription = explainExpression(parseInput);
	const parseNextRuns = nextExecutions(parseInput, 8);
	const parseValid = parseResult.ok && parseDescription.ok && parseNextRuns.ok;

	const currentStats =
		activeTab === 'build'
			? { expression: buildExpr, valid: buildValid }
			: { expression: parseInput || '*/5 * * * *', valid: parseValid };

	const setBuildPart = (id: keyof CronParts, value: string) =>
		setBuildParts((prev) => ({ ...prev, [id]: value }));

	const applyPresetBuild = (value: string) => {
		const fields = value.split(/\s+/);
		if (fields.length !== 5) return;
		const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
		if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return;
		setBuildParts({ minute, hour, dayOfMonth, month, dayOfWeek });
	};

	const renderBuildTab = () => (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex-1 overflow-auto p-4">
				<div className="mx-auto flex max-w-5xl flex-col gap-4">
					<Card density="compact">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-medium">Fields</CardTitle>
							<CardDescription className="text-xs">
								Cron syntax: <code className="rounded bg-muted px-1 font-mono">*</code> any,{' '}
								<code className="rounded bg-muted px-1 font-mono">*/n</code> step,{' '}
								<code className="rounded bg-muted px-1 font-mono">a-b</code> range,{' '}
								<code className="rounded bg-muted px-1 font-mono">a,b,c</code> list.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
							{CRON_FIELDS.map((field) => {
								const validation = buildFieldValidations[field.id];
								return (
									<div key={field.id} className="space-y-1.5">
										<div className="flex items-center justify-between">
											<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
												{field.label}
											</span>
											{validation.ok ? (
												<Check className="h-3 w-3 text-success" />
											) : (
												<X className="h-3 w-3 text-destructive" />
											)}
										</div>
										<FormInput
											label=""
											value={buildParts[field.id]}
											onValueChange={(v) => setBuildPart(field.id, v)}
											placeholder="*"
											hint={field.hint}
											size="compact"
											className={cn('font-mono', !validation.ok && 'border-destructive')}
										/>
									</div>
								);
							})}
						</CardContent>
					</Card>

					<div className="grid gap-4 lg:grid-cols-2">
						<Card density="compact">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
								<div className="flex items-center gap-2">
									<Clock className="h-4 w-4 text-muted-foreground" />
									<CardTitle className="text-sm font-medium">Expression</CardTitle>
								</div>
								<CopyButton text={buildExpr} toastLabel="Expression" size="sm" />
							</CardHeader>
							<CardContent role="status" aria-live="polite" aria-atomic="true">
								<code className="block break-all rounded-md bg-muted p-3 font-mono text-base tabular-nums">
									{buildExpr}
								</code>
							</CardContent>
						</Card>

						<Card density="compact">
							<CardHeader className="pb-3">
								<div className="flex items-center gap-2">
									<Sparkles className="h-4 w-4 text-muted-foreground" />
									<CardTitle className="text-sm font-medium">Description</CardTitle>
								</div>
							</CardHeader>
							<CardContent role="status" aria-live="polite" aria-atomic="true">
								{buildDescription.ok ? (
									<p className="text-sm">{buildDescription.value}</p>
								) : (
									<FormError message={buildDescription.error} className="text-sm" />
								)}
							</CardContent>
						</Card>
					</div>

					<Card density="compact">
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<Calendar className="h-4 w-4 text-muted-foreground" />
								<CardTitle className="text-sm font-medium">Next 8 executions</CardTitle>
							</div>
						</CardHeader>
						<CardContent role="status" aria-live="polite" aria-atomic="false">
							{buildNextRuns.ok ? (
								buildNextRuns.value.length > 0 ? (
									<ul className="space-y-1.5">
										{buildNextRuns.value.map((date, idx) => {
											const fmt = formatDateParts(date);
											return (
												<li
													// biome-ignore lint/suspicious/noArrayIndexKey: next-execution list is immutable per render
													key={idx}
													className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
												>
													<span className="w-6 text-xs tabular-nums text-muted-foreground">
														{idx + 1}.
													</span>
													<Badge
														className={cn(
															'text-2xs font-mono',
															dayBadgeClass(fmt.dayIndex, fmt.isWeekend)
														)}
													>
														{fmt.dayLabel}
													</Badge>
													<span className="font-mono text-sm tabular-nums">{fmt.date}</span>
													<span className="font-mono text-sm tabular-nums text-muted-foreground">
														{fmt.time}
													</span>
													<span className="ml-auto text-xs text-muted-foreground">
														{fmt.relative}
													</span>
												</li>
											);
										})}
									</ul>
								) : (
									<EmbeddedEmptyState
										icon={Calendar}
										title="No upcoming executions"
										description="The current expression does not match any future time within the lookahead window."
									/>
								)
							) : (
								<p className="text-sm text-destructive">{buildNextRuns.error}</p>
							)}
						</CardContent>
					</Card>

					<Card density="compact">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-medium">Presets</CardTitle>
							<CardDescription className="text-xs">
								Click any preset to load it into the fields above.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{CRON_PRESET_CATEGORIES.map((category) => (
								<div key={category.label}>
									<h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										{category.label}
									</h4>
									<div className="flex flex-wrap gap-2">
										{category.presets.map((preset) => (
											<Button
												key={preset.value}
												variant="outline"
												size="sm"
												className={cn(
													'h-auto justify-start gap-2 px-3 py-1.5 text-xs',
													buildExpr === preset.value && 'border-primary bg-primary/5'
												)}
												onClick={() => applyPresetBuild(preset.value)}
											>
												<span>{preset.label}</span>
												<code className="font-mono text-2xs text-muted-foreground">
													{preset.value}
												</code>
											</Button>
										))}
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);

	const renderParseTab = () => (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex-1 overflow-auto p-4">
				<div className="mx-auto flex max-w-5xl flex-col gap-4">
					<Card density="compact">
						<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
							<div className="space-y-1.5">
								<CardTitle className="text-sm font-medium">Expression</CardTitle>
								<CardDescription className="text-xs">
									Paste a 5-field cron expression — minute, hour, day-of-month, month, day-of-week.
								</CardDescription>
							</div>
							<div className="flex shrink-0 items-center gap-1">
								<Button
									variant="outline"
									size="sm"
									className="h-7"
									onClick={() => setParseInput(SAMPLE_CRON_EXPRESSION)}
								>
									<FlaskConical className="h-3.5 w-3.5" />
									Sample
								</Button>
								<CopyButton text={parseInput} toastLabel="Expression" variant="outline" size="sm" />
							</div>
						</CardHeader>
						<CardContent>
							<FormInput
								label=""
								value={parseInput}
								onValueChange={setParseInput}
								placeholder="*/5 * * * *"
								className="font-mono"
							/>
						</CardContent>
					</Card>

					{parseInput.trim().length === 0 ? (
						<Card density="compact">
							<CardContent className="py-10">
								<EmbeddedEmptyState
									icon={Clock}
									title="Enter a cron expression"
									description="Click Sample to load a representative expression, choose a preset below, or type your own."
								/>
							</CardContent>
						</Card>
					) : (
						<>
							<Card density="compact">
								<CardHeader className="pb-3">
									<div className="flex items-center gap-2">
										<Clock className="h-4 w-4 text-muted-foreground" />
										<CardTitle className="text-sm font-medium">Fields</CardTitle>
									</div>
								</CardHeader>
								<CardContent>
									{parseResult.ok ? (
										<div className="grid gap-2 sm:grid-cols-5">
											{CRON_FIELDS.map((field, idx) => {
												const value = [
													parseResult.value.minute,
													parseResult.value.hour,
													parseResult.value.dayOfMonth,
													parseResult.value.month,
													parseResult.value.dayOfWeek,
												][idx];
												return (
													<div key={field.id} className="rounded-md border bg-card p-3">
														<div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
															{field.label}
														</div>
														<div className="mt-1 font-mono text-sm">{value}</div>
														<div className="mt-0.5 text-2xs text-muted-foreground">
															{field.hint}
														</div>
													</div>
												);
											})}
										</div>
									) : (
										<FormError message={parseResult.error} className="text-sm" />
									)}
								</CardContent>
							</Card>

							<Card density="compact">
								<CardHeader className="pb-3">
									<div className="flex items-center gap-2">
										<Sparkles className="h-4 w-4 text-muted-foreground" />
										<CardTitle className="text-sm font-medium">Description</CardTitle>
									</div>
								</CardHeader>
								<CardContent role="status" aria-live="polite" aria-atomic="true">
									{parseDescription.ok ? (
										<p className="text-sm">{parseDescription.value}</p>
									) : (
										<p className="text-sm text-destructive">{parseDescription.error}</p>
									)}
								</CardContent>
							</Card>

							<Card density="compact">
								<CardHeader className="pb-3">
									<div className="flex items-center gap-2">
										<Calendar className="h-4 w-4 text-muted-foreground" />
										<CardTitle className="text-sm font-medium">Next 8 executions</CardTitle>
									</div>
								</CardHeader>
								<CardContent role="status" aria-live="polite" aria-atomic="false">
									{parseNextRuns.ok ? (
										parseNextRuns.value.length > 0 ? (
											<ul className="space-y-1.5">
												{parseNextRuns.value.map((date, idx) => {
													const fmt = formatDateParts(date);
													return (
														<li
															// biome-ignore lint/suspicious/noArrayIndexKey: next-execution list is immutable per render
															key={idx}
															className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
														>
															<span className="w-6 text-xs tabular-nums text-muted-foreground">
																{idx + 1}.
															</span>
															<Badge
																className={cn(
																	'text-2xs font-mono',
																	dayBadgeClass(fmt.dayIndex, fmt.isWeekend)
																)}
															>
																{fmt.dayLabel}
															</Badge>
															<span className="font-mono text-sm tabular-nums">{fmt.date}</span>
															<span className="font-mono text-sm tabular-nums text-muted-foreground">
																{fmt.time}
															</span>
															<span className="ml-auto text-xs text-muted-foreground">
																{fmt.relative}
															</span>
														</li>
													);
												})}
											</ul>
										) : (
											<p className="text-sm text-muted-foreground">No upcoming executions.</p>
										)
									) : (
										<p className="text-sm text-destructive">{parseNextRuns.error}</p>
									)}
								</CardContent>
							</Card>
						</>
					)}

					<Card density="compact">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-medium">Presets</CardTitle>
							<CardDescription className="text-xs">
								Click any preset to load it into the expression input.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{CRON_PRESET_CATEGORIES.map((category) => (
								<div key={category.label}>
									<h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										{category.label}
									</h4>
									<div className="flex flex-wrap gap-2">
										{category.presets.map((preset) => (
											<Button
												key={preset.value}
												variant="outline"
												size="sm"
												className={cn(
													'h-auto justify-start gap-2 px-3 py-1.5 text-xs',
													parseInput === preset.value && 'border-primary bg-primary/5'
												)}
												onClick={() => setParseInput(preset.value)}
											>
												<span>{preset.label}</span>
												<code className="font-mono text-2xs text-muted-foreground">
													{preset.value}
												</code>
											</Button>
										))}
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);

	const rail = (
		<>
			<FormSection title="Cron syntax">
				<FormInfo>
					A cron expression has five space-separated fields. From left to right:
					<ul className="mt-1 list-inside list-disc space-y-0.5">
						<li>
							<code className="font-mono">minute</code> — 0–59
						</li>
						<li>
							<code className="font-mono">hour</code> — 0–23
						</li>
						<li>
							<code className="font-mono">day of month</code> — 1–31
						</li>
						<li>
							<code className="font-mono">month</code> — 1–12 or JAN–DEC
						</li>
						<li>
							<code className="font-mono">day of week</code> — 0–6 or SUN–SAT
						</li>
					</ul>
				</FormInfo>
			</FormSection>

			<FormSection title="Special characters">
				<FormInfo>
					<ul className="list-inside list-disc space-y-0.5">
						<li>
							<code className="font-mono">*</code> — any value
						</li>
						<li>
							<code className="font-mono">,</code> — value list (e.g., <code>1,15</code>)
						</li>
						<li>
							<code className="font-mono">-</code> — range (e.g., <code>9-17</code>)
						</li>
						<li>
							<code className="font-mono">/</code> — step (e.g., <code>*/5</code>)
						</li>
						<li>
							<code className="font-mono">?</code> — no specific value (day fields)
						</li>
					</ul>
				</FormInfo>
			</FormSection>

			<FormSection title="Common patterns">
				<FormInfo>
					<ul className="list-inside list-disc space-y-0.5">
						<li>
							<code className="font-mono">* * * * *</code> — every minute
						</li>
						<li>
							<code className="font-mono">*/5 * * * *</code> — every 5 minutes
						</li>
						<li>
							<code className="font-mono">0 * * * *</code> — top of every hour
						</li>
						<li>
							<code className="font-mono">0 0 * * *</code> — daily at midnight
						</li>
						<li>
							<code className="font-mono">0 9 * * 1-5</code> — weekdays at 9 AM
						</li>
					</ul>
				</FormInfo>
			</FormSection>

			<FormSection title="Tips">
				<FormInfo>
					When both <code className="font-mono">day of month</code> and{' '}
					<code className="font-mono">day of week</code> are restricted, most engines run on either
					match, not both. Schedules are evaluated in UTC unless your runtime says otherwise.
				</FormInfo>
			</FormSection>
		</>
	);

	return (
		<ToolShell
			layout="tabbed"
			tabs={TABS}
			activeTab={activeTab}
			onTabChange={handleTabChange}
			valid={currentStats.valid}
			rail={rail}
			statusContent={<StatItem label="Expression" value={currentStats.expression} />}
			renderTabContent={(tab) => (tab === 'build' ? renderBuildTab() : renderParseTab())}
		/>
	);
}
