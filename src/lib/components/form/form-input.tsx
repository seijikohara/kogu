import { Eye, EyeOff } from 'lucide-react';
import { useState, type ChangeEvent, type FocusEvent, type ReactNode } from 'react';

import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/lib/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FormInputProps {
	readonly label: string;
	readonly value?: string;
	readonly placeholder?: string;
	readonly type?: 'text' | 'password' | 'email';
	readonly showToggle?: boolean;
	readonly hint?: string;
	readonly size?: 'default' | 'compact';
	readonly className?: string;
	// Render adjacent to the Input on the right (e.g. a Sample / Reset / Copy
	// button). When set, the input + trailing are laid out as a flex row so
	// the trailing element keeps its natural width. Mutually exclusive with
	// `showToggle`; pass one or the other.
	readonly trailing?: ReactNode;
	readonly onValueChange?: (value: string) => void;
	readonly onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
}

export function FormInput({
	label,
	value = '',
	placeholder = '',
	type = 'text',
	showToggle = false,
	hint,
	size = 'default',
	className,
	trailing,
	onValueChange,
	onBlur,
}: FormInputProps) {
	const [showValue, setShowValue] = useState(false);

	const inputType = type === 'password' && !showValue ? 'password' : 'text';

	const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
		onValueChange?.(e.target.value);
	};

	const labelClass = size === 'compact' ? 'text-xs text-muted-foreground' : 'text-sm font-medium';

	const inputClass = cn(
		'bg-background',
		size === 'compact' ? 'h-7 text-xs' : 'h-9 text-sm',
		showToggle && type === 'password' ? 'pr-9' : '',
		className
	);

	const toggleLabel = showValue ? 'Hide password' : 'Show password';

	const input = (
		<Input
			type={inputType}
			placeholder={placeholder}
			value={value}
			onChange={handleInput}
			onBlur={onBlur}
			className={cn(trailing ? 'flex-1' : '', inputClass)}
		/>
	);

	return (
		<div className="space-y-1">
			<Label className={labelClass}>{label}</Label>
			{trailing ? (
				<div className="flex items-center gap-2">
					{input}
					{trailing}
				</div>
			) : (
				<div className="relative">
					{input}
					{showToggle && type === 'password' ? (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon-sm"
									className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									onClick={() => setShowValue((prev) => !prev)}
								>
									{showValue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
									<span className="sr-only">{toggleLabel}</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>{toggleLabel}</TooltipContent>
						</Tooltip>
					) : null}
				</div>
			)}
			{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
		</div>
	);
}

export type { FormInputProps };
