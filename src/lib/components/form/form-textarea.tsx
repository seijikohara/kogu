import type { ChangeEvent } from 'react';

import { Label } from '@/lib/components/ui/label';
import { Textarea } from '@/lib/components/ui/textarea';
import { cn } from '@/lib/utils';

interface FormTextareaProps {
	readonly label: string;
	readonly value?: string;
	readonly placeholder?: string;
	readonly rows?: number;
	readonly hint?: string;
	readonly size?: 'default' | 'compact';
	readonly className?: string;
	readonly onValueChange?: (value: string) => void;
}

export function FormTextarea({
	label,
	value = '',
	placeholder = '',
	rows = 4,
	hint,
	size = 'default',
	className,
	onValueChange,
}: FormTextareaProps) {
	const labelClass =
		size === 'compact'
			? 'text-xs uppercase tracking-wide text-muted-foreground'
			: 'text-sm font-medium';

	const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
		onValueChange?.(e.target.value);
	};

	return (
		<div className="space-y-1.5">
			<Label className={labelClass}>{label}</Label>
			<Textarea
				placeholder={placeholder}
				rows={rows}
				value={value}
				onChange={handleChange}
				className={cn(className)}
			/>
			{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
		</div>
	);
}

export type { FormTextareaProps };
