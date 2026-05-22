/**
 * Cron expression service.
 * Wraps `cron-parser` (next-execution computation) and `cronstrue`
 * (human-readable description) behind a Result-style API so callers
 * never have to handle thrown errors directly.
 */

import { CronExpressionParser } from 'cron-parser';
import { getErrorMessage } from '@/lib/utils';
import cronstrue from 'cronstrue';

export type Result<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: string };

export interface CronParts {
	readonly minute: string;
	readonly hour: string;
	readonly dayOfMonth: string;
	readonly month: string;
	readonly dayOfWeek: string;
}

export const DEFAULT_CRON_PARTS: CronParts = {
	minute: '*',
	hour: '*',
	dayOfMonth: '*',
	month: '*',
	dayOfWeek: '*',
};

export interface CronFieldInfo {
	readonly id: keyof CronParts;
	readonly label: string;
	readonly hint: string;
	readonly examples: readonly string[];
}

export const CRON_FIELDS: readonly CronFieldInfo[] = [
	{ id: 'minute', label: 'Minute', hint: '0-59', examples: ['*', '*/5', '0,15,30,45'] },
	{ id: 'hour', label: 'Hour', hint: '0-23', examples: ['*', '0', '9-17'] },
	{ id: 'dayOfMonth', label: 'Day of month', hint: '1-31', examples: ['*', '1', '1,15'] },
	{ id: 'month', label: 'Month', hint: '1-12 or JAN-DEC', examples: ['*', '1', 'JAN,JUL'] },
	{
		id: 'dayOfWeek',
		label: 'Day of week',
		hint: '0-6 or SUN-SAT',
		examples: ['*', '1-5', 'MON,FRI'],
	},
];

export interface CronPreset {
	readonly label: string;
	readonly value: string;
	readonly description?: string;
}

export interface CronPresetCategory {
	readonly label: string;
	readonly presets: readonly CronPreset[];
}

export const CRON_PRESET_CATEGORIES: readonly CronPresetCategory[] = [
	{
		label: 'Frequency',
		presets: [
			{ label: 'Every minute', value: '* * * * *' },
			{ label: 'Every 5 minutes', value: '*/5 * * * *' },
			{ label: 'Every 10 minutes', value: '*/10 * * * *' },
			{ label: 'Every 15 minutes', value: '*/15 * * * *' },
			{ label: 'Every 30 minutes', value: '*/30 * * * *' },
			{ label: 'Every hour', value: '0 * * * *' },
			{ label: 'Every 2 hours', value: '0 */2 * * *' },
			{ label: 'Every 6 hours', value: '0 */6 * * *' },
			{ label: 'Every 12 hours', value: '0 */12 * * *' },
		],
	},
	{
		label: 'Time of day',
		presets: [
			{ label: 'Daily at midnight', value: '0 0 * * *' },
			{ label: 'Daily at 6am', value: '0 6 * * *' },
			{ label: 'Daily at noon', value: '0 12 * * *' },
			{ label: 'Daily at 6pm', value: '0 18 * * *' },
			{ label: 'Twice daily (6am & 6pm)', value: '0 6,18 * * *' },
			{ label: 'Business hours every hour', value: '0 9-17 * * 1-5' },
		],
	},
	{
		label: 'Day of week',
		presets: [
			{ label: 'Every weekday at 9am', value: '0 9 * * 1-5' },
			{ label: 'Every weekend at 10am', value: '0 10 * * 6,0' },
			{ label: 'Every Monday at 8am', value: '0 8 * * 1' },
			{ label: 'Every Friday at 5pm', value: '0 17 * * 5' },
			{ label: 'Every Sunday at midnight', value: '0 0 * * 0' },
		],
	},
	{
		label: 'Day of month',
		presets: [
			{ label: 'First of every month', value: '0 0 1 * *' },
			{ label: 'Last day attempt (28th)', value: '0 0 28 * *' },
			{ label: 'Mid-month at 9am', value: '0 9 15 * *' },
			{ label: 'Every quarter', value: '0 0 1 */3 *' },
		],
	},
	{
		label: 'Yearly',
		presets: [
			{ label: 'New Year (Jan 1)', value: '0 0 1 1 *' },
			{ label: 'Spring (Mar 1)', value: '0 0 1 3 *' },
			{ label: 'Summer (Jun 1)', value: '0 0 1 6 *' },
			{ label: 'Fall (Sep 1)', value: '0 0 1 9 *' },
			{ label: 'Christmas (Dec 25)', value: '0 0 25 12 *' },
		],
	},
];

export const buildExpression = (parts: CronParts): string =>
	[parts.minute, parts.hour, parts.dayOfMonth, parts.month, parts.dayOfWeek].join(' ');

export const parseExpression = (expression: string): Result<CronParts> => {
	const fields = expression.trim().split(/\s+/);
	if (fields.length !== 5) {
		return { ok: false, error: 'Cron expression must have exactly 5 fields' };
	}
	const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
	if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
		return { ok: false, error: 'All 5 fields are required' };
	}
	return { ok: true, value: { minute, hour, dayOfMonth, month, dayOfWeek } };
};

export const explainExpression = (expression: string): Result<string> => {
	try {
		return { ok: true, value: cronstrue.toString(expression, { use24HourTimeFormat: true }) };
	} catch (e) {
		return { ok: false, error: getErrorMessage(e) };
	}
};

export const validateField = (field: keyof CronParts, value: string): Result<true> => {
	const trimmed = value.trim();
	if (trimmed.length === 0) return { ok: false, error: 'Required' };
	// Build a synthetic expression with the candidate field and validate via cron-parser.
	const placeholders: CronParts = { ...DEFAULT_CRON_PARTS, [field]: trimmed };
	const candidate = buildExpression(placeholders);
	try {
		CronExpressionParser.parse(candidate);
		return { ok: true, value: true };
	} catch (e) {
		return { ok: false, error: getErrorMessage(e) };
	}
};

export const nextExecutions = (expression: string, count: number): Result<readonly Date[]> => {
	if (count <= 0) return { ok: true, value: [] };
	if (expression.trim().length === 0) return { ok: false, error: 'Empty expression' };
	try {
		const interval = CronExpressionParser.parse(expression);
		const dates = Array.from({ length: count }, () => interval.next().toDate());
		return { ok: true, value: dates };
	} catch (e) {
		return { ok: false, error: getErrorMessage(e) };
	}
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export type DayLabel = (typeof DAY_LABELS)[number];

export interface FormattedDate {
	readonly date: string;
	readonly time: string;
	readonly dayLabel: DayLabel;
	readonly dayIndex: number;
	readonly isWeekend: boolean;
	readonly relative: string;
}

const padTwo = (value: number): string => value.toString().padStart(2, '0');

const formatRelative = (target: Date, base: Date): string => {
	const diff = target.getTime() - base.getTime();
	if (diff < 0) return 'past';
	const seconds = Math.floor(diff / 1000);
	if (seconds < 60) return 'in seconds';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `in ${minutes} min`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `in ${hours} h`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `in ${days} d`;
	const months = Math.floor(days / 30);
	if (months < 12) return `in ${months} mo`;
	return `in ${Math.floor(months / 12)} y`;
};

export const formatDateParts = (date: Date, base: Date = new Date()): FormattedDate => {
	const dayIndex = date.getDay();
	const dayLabel = DAY_LABELS[dayIndex] ?? 'Sun';
	return {
		date: `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`,
		time: `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}:${padTwo(date.getSeconds())}`,
		dayLabel,
		dayIndex,
		isWeekend: dayIndex === 0 || dayIndex === 6,
		relative: formatRelative(date, base),
	};
};

export const formatDate = (date: Date): string => {
	const parts = formatDateParts(date);
	return `${parts.date} (${parts.dayLabel}) ${parts.time}`;
};

export const SAMPLE_CRON_EXPRESSION = '*/5 * * * *';
