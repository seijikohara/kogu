import { Eye, EyeOff } from 'lucide-react';
import { useState, type ChangeEvent, type FocusEvent } from 'react';

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
	onValueChange,
	onBlur,
}: FormInputProps) {
	const [showValue, setShowValue] = useState(false);

	const inputType = type === 'password' && !showValue ? 'password' : 'text';

	const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
		onValueChange?.(e.target.value);
	};

	const labelClass =
		size === 'compact'
			? 'text-xs uppercase tracking-wide text-muted-foreground'
			: 'text-sm font-medium';

	const inputClass = cn(
		'bg-background',
		size === 'compact' ? 'h-7 text-xs' : 'h-9 text-sm',
		showToggle && type === 'password' ? 'pr-9' : '',
		className
	);

	const toggleLabel = showValue ? 'Hide password' : 'Show password';

	return (
		<div className="space-y-1">
			<Label className={labelClass}>{label}</Label>
			<div className="relative">
				<Input
					type={inputType}
					placeholder={placeholder}
					value={value}
					onChange={handleInput}
					onBlur={onBlur}
					className={inputClass}
				/>
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
			{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
		</div>
	);
}

export type { FormInputProps };
