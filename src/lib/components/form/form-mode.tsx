import { useId, type ComponentType, type SVGProps } from 'react';

import { Label } from '@/lib/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/lib/components/ui/radio-group';
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

	const gridColsClass =
		layout === 'horizontal'
			? options.length === 2
				? 'grid-cols-2'
				: options.length === 3
					? 'grid-cols-3'
					: 'grid-cols-2'
			: '';

	const isAllowedValue = (v: string): v is T => options.some((o) => o.value === v);

	// Radiogroup semantics: guard the cast back to T against unexpected
	// values so one option always remains selected.
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

			<RadioGroup
				value={value}
				onValueChange={handleChange}
				aria-labelledby={label ? `${uid}-label` : undefined}
				className={cn(
					// Choice Card layout: each option is its own card with full
					// rounding regardless of orientation. Drop the horizontal
					// segmented-control language so vertical groups read as a
					// list of independent radio cards rather than a connected
					// segmented switch.
					'gap-2',
					layout === 'horizontal' ? `grid ${gridColsClass}` : 'flex flex-col'
				)}
			>
				{options.map((option) => {
					const Icon = option.icon;
					const itemId = `${uid}-${option.value}`;
					const showDescription =
						option.description &&
						(descriptionDisplay === 'all' ||
							(descriptionDisplay === 'selected' && value === option.value));
					return (
						<Label
							key={option.value}
							htmlFor={itemId}
							className={cn(
								// Choice card surface: bordered, rounded, same shape in
								// either orientation. Selected state tints the border
								// and background with the primary color.
								'flex cursor-pointer items-start gap-2.5 rounded-md border bg-background p-2.5 text-xs font-medium transition-colors',
								'has-data-checked:border-primary has-data-checked:bg-primary/5',
								'hover:bg-muted/40 has-data-checked:hover:bg-primary/10'
							)}
						>
							<RadioGroupItem id={itemId} value={option.value} className="mt-0.5" />
							<div className="flex min-w-0 flex-1 flex-col gap-0.5">
								<div className="flex items-center gap-1.5">
									{Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
									<span className="leading-snug">{option.label}</span>
								</div>
								{showDescription ? (
									<span className="text-2xs leading-snug font-normal text-muted-foreground">
										{option.description}
									</span>
								) : null}
							</div>
						</Label>
					);
				})}
			</RadioGroup>
		</div>
	);
}

export type { FormModeProps, ModeOption };
