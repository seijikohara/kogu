import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
	AlertTriangle,
	CalendarClock,
	CalendarDays,
	Clock,
	ExternalLink,
	Globe,
	Pin,
	Plus,
	RefreshCw,
	Sparkles,
	X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ActionButton, CopyButton } from '@/lib/components/action';
import { FormError, FormInfo, FormInput, FormSection, FormSelect } from '@/lib/components/form';
import { RelatedTools, SectionLabel } from '@/lib/components/layout';
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
import { Calendar } from '@/lib/components/ui/calendar';
import { useDocumentTitle } from '@/lib/hooks';
import {
	DEFAULT_TIMEZONES,
	formatInTimezone,
	MAX_TIMEZONES,
	type ParsedInput,
	type Representation,
	QUICK_PRESETS,
	TIMEZONE_OPTIONS,
	formatRelativeTime,
	nextCronFires,
	parseInput,
	representationsOf,
	zonedClock,
} from '@/lib/services/date-timestamp';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import { cn } from '@/lib/utils';

interface DateTimestampOptions {
	readonly timezones: readonly string[];
	readonly cronExpression: string;
	readonly cronFireCount: number;
}

const DEFAULT_OPTIONS: DateTimestampOptions = {
	timezones: DEFAULT_TIMEZONES,
	cronExpression: '',
	cronFireCount: 5,
};

const useDateTimestampOptions = createToolOptionsStore<DateTimestampOptions>(
	'date-timestamp-converter',
	DEFAULT_OPTIONS
);

export const Route = createFileRoute('/date-timestamp-converter')({
	component: DateTimestampConverterPage,
});

const KIND_BADGE: Record<ParsedInput['kind'], { label: string; tone: string }> = {
	'unix-s': { label: 'Unix seconds', tone: 'bg-info/10 text-info border-info/30' },
	'unix-ms': { label: 'Unix milliseconds', tone: 'bg-info/10 text-info border-info/30' },
	'unix-us': { label: 'Unix microseconds', tone: 'bg-info/10 text-info border-info/30' },
	'unix-ns': { label: 'Unix nanoseconds', tone: 'bg-info/10 text-info border-info/30' },
	iso: { label: 'ISO 8601', tone: 'bg-success/10 text-success border-success/30' },
	rfc2822: { label: 'RFC 2822', tone: 'bg-success/10 text-success border-success/30' },
	invalid: {
		label: 'Unrecognized',
		tone: 'bg-destructive/10 text-destructive border-destructive/30',
	},
};

function DateTimestampConverterPage() {
	const { value: options, patch } = useDateTimestampOptions();
	const { timezones, cronExpression, cronFireCount } = options;

	useDocumentTitle('Date / Timestamp Converter');

	const navigate = useNavigate();

	const [stickyNow, setStickyNow] = useState(true);
	const [nowMs, setNowMs] = useState<number>(() => Date.now());
	const [inputText, setInputText] = useState<string>(() => String(Date.now()));
	const [pickedMs, setPickedMs] = useState<number>(() => Date.now());
	const [showRail, setShowRail] = usePersistedRail('date-timestamp-converter');

	// Tick once per second while sticky mode is on. `useEffect` is the correct
	// home for this side effect — every tick is a real wall-clock change, not a
	// derived value.
	useEffect(() => {
		if (!stickyNow) return;
		const id = window.setInterval(() => setNowMs(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, [stickyNow]);

	// In sticky mode the active timestamp tracks the clock; otherwise it stays
	// pinned to whatever the user last typed or picked.
	const activeMs = stickyNow ? nowMs : pickedMs;

	const parsed = useMemo(() => parseInput(inputText), [inputText]);
	const parseError = parsed.kind === 'invalid' && inputText.trim().length > 0;

	// Pushing parsed input into pickedMs would normally happen via useEffect, but
	// derived state is preferred — recompute on every render and only commit
	// when the user explicitly toggles sticky off or selects a calendar date.
	const handleInputChange = (next: string) => {
		setInputText(next);
		const result = parseInput(next);
		if (result.ms !== null) {
			setPickedMs(result.ms);
			if (stickyNow) setStickyNow(false);
		}
	};

	const applyPreset = (resolve: (nowMs: number) => number) => {
		const next = resolve(Date.now());
		setPickedMs(next);
		setInputText(String(next));
		setStickyNow(false);
	};

	const reseedFromNow = () => {
		const next = Date.now();
		setNowMs(next);
		setPickedMs(next);
		setInputText(String(next));
		setStickyNow(true);
	};

	const reps = useMemo<readonly Representation[]>(() => representationsOf(activeMs), [activeMs]);

	const timezoneOptionsForSelect = useMemo(
		() => TIMEZONE_OPTIONS.map((tz) => ({ value: tz.value, label: tz.label })),
		[]
	);

	const replaceTimezone = (index: number, value: string) => {
		// Block duplicate timezones — the row keys depend on tz uniqueness so the
		// React reconciler can track each slot stably across edits.
		if (timezones.some((existing, i) => i !== index && existing === value)) {
			toast.error('Timezone already selected');
			return;
		}
		patch({
			timezones: timezones.map((existing, i) => (i === index ? value : existing)),
		});
	};

	const addTimezone = () => {
		if (timezones.length >= MAX_TIMEZONES) return;
		const candidate = TIMEZONE_OPTIONS.find((tz) => !timezones.includes(tz.value));
		if (!candidate) return;
		patch({ timezones: [...timezones, candidate.value] });
	};

	const removeTimezone = (index: number) => {
		if (timezones.length <= 1) return;
		patch({ timezones: timezones.filter((_, i) => i !== index) });
	};

	const cronResult = useMemo(() => {
		if (cronExpression.trim().length === 0) return null;
		return nextCronFires(cronExpression, activeMs, cronFireCount);
	}, [cronExpression, activeMs, cronFireCount]);

	const handleOpenInCronBuilder = () => {
		navigate({ to: '/cron-expression-builder' }).catch(() => {
			toast.error('Failed to open Cron Expression Builder');
		});
		if (cronExpression.trim().length > 0) {
			navigator.clipboard
				.writeText(cronExpression)
				.then(() => toast.success('Cron expression copied — paste it into the Parse tab.'))
				.catch(() => undefined);
		}
	};

	const activeDate = new Date(activeMs);
	const activeYear = activeDate.getFullYear();
	const activeDay = activeDate.toLocaleDateString(undefined, { weekday: 'long' });

	const statusValid: boolean | null = !parseError;

	const rail = (
		<>
			<FormSection title="Input">
				<FormInput
					label="Timestamp / ISO / RFC"
					value={inputText}
					onValueChange={handleInputChange}
					placeholder="1748000000 or 2026-05-25T12:00:00Z"
					hint="Auto-detect Unix s / ms / μs / ns, ISO 8601, RFC 2822."
					size="compact"
					className="font-mono"
				/>
				<div className="flex items-center gap-2">
					<Badge className={cn('text-2xs', KIND_BADGE[parsed.kind].tone)}>
						{KIND_BADGE[parsed.kind].label}
					</Badge>
					{parsed.ms !== null ? (
						<span className="font-mono text-2xs text-muted-foreground">ms = {parsed.ms}</span>
					) : null}
				</div>
			</FormSection>

			<FormSection title="Presets">
				<div className="flex flex-wrap gap-2">
					{QUICK_PRESETS.map((preset) => (
						<Button
							key={preset.id}
							variant="outline"
							size="sm"
							className="h-7 px-2 text-xs"
							onClick={() => applyPreset(preset.resolve)}
							title={preset.description}
						>
							{preset.label}
						</Button>
					))}
				</div>
				<ActionButton
					label={stickyNow ? 'Sticky now: ON' : 'Sticky now: OFF'}
					icon={stickyNow ? RefreshCw : Pin}
					variant={stickyNow ? 'default' : 'outline'}
					size="sm"
					onClick={() => {
						if (stickyNow) {
							setStickyNow(false);
							setPickedMs(nowMs);
							setInputText(String(nowMs));
						} else {
							reseedFromNow();
						}
					}}
				/>
			</FormSection>

			<FormSection title="Timezones">
				<div className="space-y-2">
					{timezones.map((tz, i) => (
						<div key={tz} className="flex items-center gap-1.5">
							<div className="min-w-0 flex-1">
								<FormSelect
									value={tz}
									options={timezoneOptionsForSelect}
									onValueChange={(value) => replaceTimezone(i, value)}
									size="compact"
								/>
							</div>
							<Button
								variant="ghost"
								size="icon-sm"
								disabled={timezones.length <= 1}
								onClick={() => removeTimezone(i)}
								title="Remove timezone"
							>
								<X className="h-3.5 w-3.5" />
								<span className="sr-only">Remove timezone</span>
							</Button>
						</div>
					))}
					<Button
						variant="outline"
						size="sm"
						className="w-full h-7 gap-1"
						disabled={timezones.length >= MAX_TIMEZONES}
						onClick={addTimezone}
					>
						<Plus className="h-3 w-3" />
						Add timezone ({timezones.length} / {MAX_TIMEZONES})
					</Button>
				</div>
			</FormSection>

			<FormSection title="Cron Preview">
				<FormInput
					label="Cron expression"
					value={cronExpression}
					onValueChange={(v) => patch({ cronExpression: v })}
					placeholder="*/5 * * * *"
					hint="See the next fires from the active timestamp."
					size="compact"
					className="font-mono"
				/>
				<Button
					variant="outline"
					size="sm"
					className="w-full h-7 gap-1"
					onClick={handleOpenInCronBuilder}
				>
					<ExternalLink className="h-3 w-3" />
					Open in Cron Builder
				</Button>
			</FormSection>

			<FormSection title="Related">
				<RelatedTools
					items={[{ id: 'cron-expression-builder', reason: 'Edit the cron expression' }]}
				/>
			</FormSection>

			<FormSection title="About">
				<FormInfo>
					<ul className="list-inside list-disc space-y-0.5">
						<li>All representations of the same instant, computed on every render.</li>
						<li>Pick a date in the calendar to set the active timestamp.</li>
						<li>Multi-timezone cards flag DST boundaries within ±1 hour.</li>
						<li>Cron preview defers to the Cron Expression Builder for editing.</li>
					</ul>
				</FormInfo>
			</FormSection>
		</>
	);

	return (
		<ToolShell
			valid={statusValid}
			error={parseError ? 'Unrecognized timestamp format' : undefined}
			showRail={showRail}
			onShowRailChange={setShowRail}
			rail={rail}
			statusContent={
				<>
					<StatItem label="Unix ms" value={activeMs} />
					<StatItem label="Year" value={activeYear} />
					<StatItem label="Day" value={activeDay} />
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="flex-1 overflow-auto p-4">
					<div className="mx-auto flex max-w-6xl flex-col gap-4">
						<RepresentationsSection reps={reps} nowMs={nowMs} activeMs={activeMs} />

						<CalendarSection
							activeMs={activeMs}
							onPick={(ms) => {
								setPickedMs(ms);
								setInputText(String(ms));
								setStickyNow(false);
							}}
						/>

						<TimezonesSection timezones={timezones} activeMs={activeMs} nowMs={nowMs} />

						<CronSection
							expression={cronExpression}
							result={cronResult}
							fireCount={cronFireCount}
							onFireCountChange={(n) => patch({ cronFireCount: n })}
							onOpenBuilder={handleOpenInCronBuilder}
							primaryTimezone={timezones[0] ?? 'UTC'}
						/>
					</div>
				</div>
			</div>
		</ToolShell>
	);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RepresentationsSectionProps {
	readonly reps: readonly Representation[];
	readonly nowMs: number;
	readonly activeMs: number;
}

function RepresentationsSection({ reps, nowMs, activeMs }: RepresentationsSectionProps) {
	const relative = formatRelativeTime(activeMs, nowMs);
	return (
		<section>
			<SectionLabel icon={Sparkles}>Representations</SectionLabel>
			<Card density="compact">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
					<div className="space-y-0.5">
						<CardTitle className="text-sm font-medium">All formats at once</CardTitle>
						<CardDescription className="text-xs">
							Same instant rendered in every common format. {relative} (vs. now).
						</CardDescription>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
						{reps.map((rep) => (
							<Card key={rep.id} density="compact" className="bg-card/60">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
										{rep.label}
									</CardTitle>
									<CopyButton text={rep.value} toastLabel={rep.label} size="sm" showLabel={false} />
								</CardHeader>
								<CardContent className="space-y-1">
									<code className="block break-all rounded-md bg-muted p-2 font-mono text-xs tabular-nums">
										{rep.value}
									</code>
									<p className="text-2xs text-muted-foreground">{rep.description}</p>
								</CardContent>
							</Card>
						))}
					</div>
				</CardContent>
			</Card>
		</section>
	);
}

interface CalendarSectionProps {
	readonly activeMs: number;
	readonly onPick: (ms: number) => void;
}

function CalendarSection({ activeMs, onPick }: CalendarSectionProps) {
	const selected = new Date(activeMs);
	return (
		<section>
			<SectionLabel icon={CalendarDays}>Calendar</SectionLabel>
			<Card density="compact">
				<CardHeader className="pb-3">
					<CardTitle className="text-sm font-medium">Pick a date</CardTitle>
					<CardDescription className="text-xs">
						Selecting a date sets the active timestamp to 00:00 local time on that day.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Calendar
						mode="single"
						selected={selected}
						onSelect={(date) => {
							if (!date) return;
							const next = new Date(date);
							next.setHours(0, 0, 0, 0);
							onPick(next.getTime());
						}}
						captionLayout="dropdown"
					/>
				</CardContent>
			</Card>
		</section>
	);
}

interface TimezonesSectionProps {
	readonly timezones: readonly string[];
	readonly activeMs: number;
	readonly nowMs: number;
}

function TimezonesSection({ timezones, activeMs, nowMs }: TimezonesSectionProps) {
	if (timezones.length === 0) {
		return (
			<section>
				<SectionLabel icon={Globe}>Timezones</SectionLabel>
				<Card density="compact">
					<CardContent className="py-6">
						<EmbeddedEmptyState
							icon={Globe}
							title="No timezones selected"
							description="Add at least one timezone in the rail to compare the active instant."
						/>
					</CardContent>
				</Card>
			</section>
		);
	}
	return (
		<section>
			<SectionLabel icon={Globe}>Timezones</SectionLabel>
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
				{timezones.map((tz) => {
					const render = formatInTimezone(activeMs, tz, nowMs);
					const clock = zonedClock(activeMs, tz);
					return (
						<Card key={tz} density="compact">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
								<div className="min-w-0 space-y-0.5">
									<CardTitle className="truncate text-sm font-medium">{tz}</CardTitle>
									<CardDescription className="text-2xs">{clock.offsetLabel}</CardDescription>
								</div>
								<CopyButton text={render.absolute} toastLabel={tz} size="sm" showLabel={false} />
							</CardHeader>
							<CardContent className="space-y-2">
								<div className="space-y-0.5">
									<div className="font-mono text-lg tabular-nums">{clock.time}</div>
									<div className="text-xs text-muted-foreground">
										{clock.day} · {clock.date}
									</div>
								</div>
								<div className="flex items-center justify-between text-2xs">
									<Badge className="bg-muted text-muted-foreground border-border">
										{render.relative}
									</Badge>
									{render.isDstBoundary ? (
										<Badge className="bg-warning/10 text-warning border-warning/30 gap-1">
											<AlertTriangle className="h-3 w-3" />
											DST boundary
										</Badge>
									) : null}
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</section>
	);
}

interface CronSectionProps {
	readonly expression: string;
	readonly result: ReturnType<typeof nextCronFires> | null;
	readonly fireCount: number;
	readonly onFireCountChange: (n: number) => void;
	readonly onOpenBuilder: () => void;
	readonly primaryTimezone: string;
}

function CronSection({
	expression,
	result,
	fireCount,
	onFireCountChange,
	onOpenBuilder,
	primaryTimezone,
}: CronSectionProps) {
	return (
		<section>
			<SectionLabel icon={Clock}>Cron preview</SectionLabel>
			<Card density="compact">
				<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
					<div className="min-w-0 space-y-1">
						<CardTitle className="text-sm font-medium">Next {fireCount} fires</CardTitle>
						<CardDescription className="text-xs">
							{expression.trim().length > 0
								? `Resolved from the current moment, rendered in ${primaryTimezone}.`
								: 'Enter a cron expression in the rail to preview upcoming fires.'}
						</CardDescription>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						<FireCountControl value={fireCount} onChange={onFireCountChange} />
						<Button variant="outline" size="sm" className="h-7 gap-1" onClick={onOpenBuilder}>
							<ExternalLink className="h-3 w-3" />
							Open in Cron Builder
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{expression.trim().length === 0 ? (
						<EmbeddedEmptyState
							icon={Clock}
							title="No expression"
							description="Paste a 5-field cron expression in the rail to see the next fires."
						/>
					) : result?.ok ? (
						result.value.length > 0 ? (
							<ul className="space-y-1.5">
								{result.value.map((date, idx) => {
									const clock = zonedClock(date.getTime(), primaryTimezone);
									return (
										<li
											// biome-ignore lint/suspicious/noArrayIndexKey: list is immutable per render
											key={idx}
											className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
										>
											<span className="w-6 text-xs tabular-nums text-muted-foreground">
												{idx + 1}.
											</span>
											<Badge className="bg-info/10 text-info border-info/30 text-2xs font-mono">
												{clock.day}
											</Badge>
											<span className="font-mono text-sm tabular-nums">{clock.date}</span>
											<span className="font-mono text-sm tabular-nums text-muted-foreground">
												{clock.time}
											</span>
											<span className="ml-auto text-2xs text-muted-foreground">
												{formatRelativeTime(date.getTime())}
											</span>
										</li>
									);
								})}
							</ul>
						) : (
							<EmbeddedEmptyState
								icon={Clock}
								title="No upcoming fires"
								description="The expression does not match any future time within the lookahead window."
							/>
						)
					) : (
						<FormError message={result?.error ?? 'Invalid cron expression'} className="text-sm" />
					)}
				</CardContent>
			</Card>
		</section>
	);
}

interface FireCountControlProps {
	readonly value: number;
	readonly onChange: (next: number) => void;
}

const FIRE_COUNT_PRESETS = [3, 5, 10, 20] as const;

function FireCountControl({ value, onChange }: FireCountControlProps) {
	return (
		<div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
			{FIRE_COUNT_PRESETS.map((n) => (
				<Button
					key={n}
					variant={n === value ? 'default' : 'ghost'}
					size="sm"
					className="h-6 px-2 text-2xs"
					onClick={() => onChange(n)}
				>
					{n}
				</Button>
			))}
			<CalendarClock className="ml-1 h-3 w-3 text-muted-foreground" />
		</div>
	);
}
