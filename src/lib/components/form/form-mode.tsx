import { useId, type ComponentType, type SVGProps } from 'react';

import { Label } from '@/lib/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/lib/components/ui/toggle-group';
import { cn } from '@/lib/utils';

interface ModeOption<T extends string> {
	readonly value: T;
	readonly label: string;
	readonly description?: string;
	readonly icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

interface FormModeProps<T extends string> {
	readonly label?: string;
	readonly value?: T;
	readonly options: readonly ModeOption<T>[];
	readonly onValueChange?: (value: T) => void;
	readonly layout?: 'horizontal' | 'stacked';
	readonly descriptionDisplay?: 'selected' | 'all' | 'none';
}

export function FormMode<T extends string>({
	label,
	value,
	options,
	onValueChange,
	layout = 'horizontal',
	descriptionDisplay = 'selected',
}: FormModeProps<T>) {
	const uid = useId();
	const selected = options.find((o) => o.value === value);

	const gridColsClass =
		layout === 'horizontal'
			? options.length === 2
				? 'grid-cols-2'
				: options.length === 3
					? 'grid-cols-3'
					: 'grid-cols-2'
			: '';

	const isAllowedValue = (v: string): v is T => options.some((o) => o.value === v);

	// Radiogroup semantics: ignore the empty string emitted when the user
	// re-clicks the active item, so one option is always selected. Also
	// guard the cast back to T against unexpected values.
	const handleChange = (v: string) => {
		if (isAllowedValue(v)) {
			onValueChange?.(v);
		}
	};

	return (
		<div className="space-y-2">
			{label ? (
				<Label id={`${uid}-label`} className="text-sm font-medium">
					{label}
				</Label>
			) : null}

			<ToggleGroup
				type="single"
				value={value ?? ''}
				onValueChange={handleChange}
				aria-labelledby={label ? `${uid}-label` : undefined}
				className={cn(
					'w-full rounded-lg bg-muted p-1 ring-1 ring-border',
					layout === 'horizontal' ? `grid ${gridColsClass} gap-1` : 'flex flex-col gap-1'
				)}
			>
				{options.map((option) => {
					const Icon = option.icon;
					return (
						<ToggleGroupItem
							key={option.value}
							value={option.value}
							className={cn(
								// Compact rail rhythm: h-7 + text-xs to align with neighboring
								// rail controls (Inputs, Buttons size="sm") instead of h-9.
								'h-7 w-full min-w-0 rounded-md px-2 text-xs font-medium transition-all',
								'flex items-center gap-1.5',
								layout === 'horizontal' ? 'justify-center' : 'justify-start',
								'data-[state=on]:bg-background data-[state=on]:shadow-sm',
								'data-[state=on]:ring-1 data-[state=on]:ring-border/60',
								'data-[state=off]:bg-background/50 data-[state=off]:text-muted-foreground',
								'data-[state=off]:hover:bg-background/80 data-[state=off]:hover:text-foreground'
							)}
						>
							{Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
							<span className={layout === 'horizontal' ? 'truncate' : ''}>{option.label}</span>
						</ToggleGroupItem>
					);
				})}
			</ToggleGroup>

			{descriptionDisplay === 'selected' && selected?.description ? (
				<p className="text-xs text-muted-foreground">{selected.description}</p>
			) : null}

			{descriptionDisplay === 'all' ? (
				<div className="space-y-0.5">
					{options.map((option) =>
						option.description ? (
							<p key={option.value} className="text-xs text-muted-foreground">
								<span className="font-medium">{option.label}:</span> {option.description}
							</p>
						) : null
					)}
				</div>
			) : null}
		</div>
	);
}

export type { FormModeProps, ModeOption };
