import type { ComponentType, SVGProps } from 'react';

import { Label } from '@/lib/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/lib/components/ui/select';
import { cn } from '@/lib/utils';

interface SelectOption {
	readonly value: string;
	readonly label: string;
	readonly icon?: ComponentType<SVGProps<SVGSVGElement>>;
	readonly description?: string;
	readonly disabled?: boolean;
}

interface FormSelectProps {
	readonly label?: string;
	readonly value?: string;
	readonly options: readonly SelectOption[] | readonly string[];
	readonly placeholder?: string;
	readonly displayValue?: string;
	readonly size?: 'default' | 'compact';
	readonly onValueChange?: (value: string) => void;
}

export function FormSelect({
	label,
	value = '',
	options,
	placeholder,
	displayValue,
	size = 'default',
	onValueChange,
}: FormSelectProps) {
	const normalizedOptions: readonly SelectOption[] = options.map((opt) =>
		typeof opt === 'string' ? { value: opt, label: opt } : opt
	);

	const selected = normalizedOptions.find((opt) => opt.value === value);
	const display = displayValue ?? selected?.label ?? value;
	const TriggerIcon = selected?.icon;

	const handleChange = (newValue: string) => {
		if (newValue !== undefined && newValue !== '') {
			onValueChange?.(newValue);
		}
	};

	const labelClass = size === 'compact' ? 'text-xs text-muted-foreground' : 'text-sm font-medium';

	const triggerClass = cn(
		'w-full bg-background',
		size === 'compact' ? 'h-7 text-xs' : 'h-9 text-sm'
	);

	return (
		<div className="space-y-1">
			{label ? <Label className={labelClass}>{label}</Label> : null}
			<Select value={value} onValueChange={handleChange}>
				<SelectTrigger className={triggerClass}>
					{TriggerIcon ? <TriggerIcon className="size-4 shrink-0" /> : null}
					{display ? (
						<span className="min-w-0 flex-1 truncate text-left">{display}</span>
					) : placeholder ? (
						<span className="min-w-0 flex-1 truncate text-left text-muted-foreground">
							{placeholder}
						</span>
					) : (
						<SelectValue placeholder={placeholder} />
					)}
				</SelectTrigger>
				<SelectContent>
					{normalizedOptions.map((opt) => {
						const ItemIcon = opt.icon;
						return (
							<SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
								{ItemIcon ? <ItemIcon className="size-4 shrink-0" /> : null}
								{opt.description ? (
									<div className="flex min-w-0 flex-1 flex-col gap-0.5">
										<span className="truncate text-sm">{opt.label}</span>
										<span className="truncate text-xs text-muted-foreground">
											{opt.description}
										</span>
									</div>
								) : (
									<span className="min-w-0 flex-1 truncate">{opt.label}</span>
								)}
							</SelectItem>
						);
					})}
				</SelectContent>
			</Select>
		</div>
	);
}

export type { FormSelectProps, SelectOption };
