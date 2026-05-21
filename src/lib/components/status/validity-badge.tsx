import { Check, CircleCheck, CircleX, X } from 'lucide-react';

import { Badge } from '@/lib/components/ui/badge';
import { cn } from '@/lib/utils';

type ValidityState = 'empty' | 'valid' | 'invalid';

interface ValidityBadgeStateProps {
	readonly state: ValidityState;
	readonly error?: string;
	readonly validLabel?: string;
	readonly invalidLabel?: string;
	readonly emptyLabel?: string;
	readonly className?: string;
}

interface ValidityBadgeLegacyProps {
	// Legacy boolean tri-state: null -> 'empty', true -> 'valid', false -> 'invalid'.
	readonly valid: boolean | null;
	readonly validLabel?: string;
	readonly invalidLabel?: string;
	readonly className?: string;
}

type ValidityBadgeProps = ValidityBadgeStateProps | ValidityBadgeLegacyProps;

const isLegacyProps = (props: ValidityBadgeProps): props is ValidityBadgeLegacyProps =>
	'valid' in props;

const toState = (valid: boolean | null): ValidityState =>
	valid === null ? 'empty' : valid ? 'valid' : 'invalid';

export function ValidityBadge(props: ValidityBadgeProps) {
	const state = isLegacyProps(props) ? toState(props.valid) : props.state;
	const error = isLegacyProps(props) ? undefined : props.error;
	const validLabel = props.validLabel ?? 'Valid';
	const invalidLabel = props.invalidLabel ?? 'Invalid';
	const emptyLabel = isLegacyProps(props) ? undefined : (props.emptyLabel ?? 'empty');
	const className = props.className;

	if (state === 'empty') {
		// Legacy callers expect `null` (no badge rendered) when valid is null.
		if (isLegacyProps(props)) return null;
		return (
			<Badge variant="outline" className={cn('text-muted-foreground', className)}>
				{emptyLabel}
			</Badge>
		);
	}

	if (state === 'valid') {
		// Legacy callers render the pill style for compatibility with StatusBar.
		if (isLegacyProps(props)) {
			return (
				<span
					className={cn(
						'flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success',
						className
					)}
				>
					<CircleCheck className="h-3.5 w-3.5" />
					{validLabel}
				</span>
			);
		}
		return (
			<Badge variant="outline" className={cn('bg-success/10 text-success', className)}>
				<Check className="mr-1 h-3 w-3" aria-hidden="true" />
				{validLabel.toLowerCase()}
			</Badge>
		);
	}

	if (isLegacyProps(props)) {
		return (
			<span
				className={cn(
					'flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive',
					className
				)}
			>
				<CircleX className="h-3.5 w-3.5" />
				{invalidLabel}
			</span>
		);
	}

	return (
		<Badge variant="outline" className={cn('bg-destructive/10 text-destructive', className)}>
			<X className="mr-1 h-3 w-3" aria-hidden="true" />
			{error ? error : invalidLabel.toLowerCase()}
		</Badge>
	);
}

export type { ValidityBadgeProps, ValidityState };
