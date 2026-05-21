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
					// Layout language depends on orientation:
					//   horizontal — segmented switch (TabsList rhythm): bg-muted container,
					//     inner items packed gap-0.5, active segment floats with bg-background.
					//     Reads as a single switch because horizontal segments share a baseline.
					//   stacked — independent list-of-buttons: no container shell, each item
					//     is an outline radio chip with its own border and rounding. Vertical
					//     segmented switches read as a list rather than a switch, so we drop
					//     the container metaphor entirely.
					layout === 'horizontal'
						? `grid w-full ${gridColsClass} gap-0.5 rounded-lg bg-muted p-0.5 ring-1 ring-border`
						: 'flex w-full flex-col gap-1'
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
								// Horizontal: segmented-control treatment.
								layout === 'horizontal' && [
									'data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm',
									'data-[state=off]:bg-transparent data-[state=off]:text-muted-foreground',
									'data-[state=off]:hover:bg-background/60 data-[state=off]:hover:text-foreground',
								],
								// Stacked: each item is its own outline-radio chip — border on the
								// item itself (not on a wrapping container), with bg-background base
								// and a tinted active state.
								layout === 'stacked' && [
									'border bg-background',
									'data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:text-foreground',
									'data-[state=off]:border-border data-[state=off]:text-muted-foreground',
									'data-[state=off]:hover:border-border/80 data-[state=off]:hover:bg-muted/40 data-[state=off]:hover:text-foreground',
								]
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
