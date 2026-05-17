import { CircleCheck, CircleX } from 'lucide-react';

interface ValidityBadgeProps {
	readonly valid: boolean | null;
	readonly validLabel?: string;
	readonly invalidLabel?: string;
}

export function ValidityBadge({
	valid,
	validLabel = 'Valid',
	invalidLabel = 'Invalid',
}: ValidityBadgeProps) {
	if (valid === true) {
		return (
			<span className="flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">
				<CircleCheck className="h-3.5 w-3.5" />
				{validLabel}
			</span>
		);
	}

	if (valid === false) {
		return (
			<span className="flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
				<CircleX className="h-3.5 w-3.5" />
				{invalidLabel}
			</span>
		);
	}

	return null;
}

export type { ValidityBadgeProps };
