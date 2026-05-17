import { useId } from 'react';

import { Checkbox } from '@/lib/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface FormCheckboxProps {
	readonly label: string;
	readonly checked?: boolean;
	readonly disabled?: boolean;
	readonly hint?: string;
	readonly onCheckedChange?: (checked: boolean) => void;
}

export function FormCheckbox({
	label,
	checked = false,
	disabled = false,
	hint,
	onCheckedChange,
}: FormCheckboxProps) {
	const id = useId();

	const handleChange = (value: boolean | 'indeterminate') => {
		onCheckedChange?.(value === true);
	};

	return (
		<label
			htmlFor={id}
			className={cn(
				'flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors',
				disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-interactive-hover'
			)}
		>
			<Checkbox
				id={id}
				checked={checked}
				disabled={disabled}
				onCheckedChange={handleChange}
				className="mt-0.5 h-4 w-4 shrink-0 bg-background"
			/>
			<span className="min-w-0 text-sm font-medium leading-snug">{label}</span>
			{hint ? <span className="shrink-0 text-xs text-muted-foreground">({hint})</span> : null}
		</label>
	);
}

export type { FormCheckboxProps };
