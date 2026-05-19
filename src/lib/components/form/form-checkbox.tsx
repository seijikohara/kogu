import { useId } from 'react';

import { Checkbox } from '@/lib/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface FormCheckboxProps {
	readonly label: string;
	readonly checked?: boolean;
	readonly disabled?: boolean;
	readonly hint?: string;
	readonly size?: 'default' | 'compact';
	readonly onCheckedChange?: (checked: boolean) => void;
}

export function FormCheckbox({
	label,
	checked = false,
	disabled = false,
	hint,
	size = 'default',
	onCheckedChange,
}: FormCheckboxProps) {
	const id = useId();

	const handleChange = (value: boolean | 'indeterminate') => {
		onCheckedChange?.(value === true);
	};

	const wrapperClass =
		size === 'compact'
			? 'flex items-start gap-2 rounded-md px-2 py-1 transition-colors'
			: 'flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors';

	const checkboxClass =
		size === 'compact'
			? 'mt-0 h-3.5 w-3.5 shrink-0 bg-background'
			: 'mt-0.5 h-4 w-4 shrink-0 bg-background';

	const labelClass =
		size === 'compact'
			? 'min-w-0 text-xs font-medium leading-snug'
			: 'min-w-0 text-sm font-medium leading-snug';

	return (
		<label
			htmlFor={id}
			className={cn(
				wrapperClass,
				disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-interactive-hover'
			)}
		>
			<Checkbox
				id={id}
				checked={checked}
				disabled={disabled}
				onCheckedChange={handleChange}
				className={checkboxClass}
			/>
			<span className={labelClass}>{label}</span>
			{hint ? <span className="shrink-0 text-xs text-muted-foreground">({hint})</span> : null}
		</label>
	);
}

export type { FormCheckboxProps };
