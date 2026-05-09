/**
 * Cron expression service.
 * Wraps `cron-parser` (next-execution computation) and `cronstrue`
 * (human-readable description) behind a Result-style API so callers
 * never have to handle thrown errors directly.
 */

import { CronExpressionParser } from 'cron-parser';
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
}

export const CRON_PRESETS: readonly CronPreset[] = [
	{ label: 'Every minute', value: '* * * * *' },
	{ label: 'Every 5 minutes', value: '*/5 * * * *' },
	{ label: 'Every hour', value: '0 * * * *' },
	{ label: 'Every day at midnight', value: '0 0 * * *' },
	{ label: 'Every weekday at 9am', value: '0 9 * * 1-5' },
	{ label: 'Every Monday at 8am', value: '0 8 * * 1' },
	{ label: 'First of every month', value: '0 0 1 * *' },
	{ label: 'Every quarter', value: '0 0 1 */3 *' },
	{ label: 'Every year on Jan 1st', value: '0 0 1 1 *' },
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
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
};

export const nextExecutions = (expression: string, count: number): Result<readonly Date[]> => {
	if (count <= 0) return { ok: true, value: [] };
	try {
		const interval = CronExpressionParser.parse(expression, { tz: undefined });
		const dates = Array.from({ length: count }, () => interval.next().toDate());
		return { ok: true, value: dates };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const formatDate = (date: Date): string => {
	const pad = (n: number) => n.toString().padStart(2, '0');
	const yyyy = date.getFullYear();
	const mm = pad(date.getMonth() + 1);
	const dd = pad(date.getDate());
	const hh = pad(date.getHours());
	const mi = pad(date.getMinutes());
	const ss = pad(date.getSeconds());
	const day = DAY_LABELS[date.getDay()] ?? '';
	return `${yyyy}-${mm}-${dd} (${day}) ${hh}:${mi}:${ss}`;
};
