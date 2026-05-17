import { Label } from '@/lib/components/ui/label';
import { Slider } from '@/lib/components/ui/slider';

interface FormSliderProps {
	readonly label: string;
	readonly value?: number;
	readonly min?: number;
	readonly max?: number;
	readonly step?: number;
	readonly showValue?: boolean;
	readonly valueLabel?: string;
	readonly hint?: string;
	readonly onValueChange?: (value: number) => void;
}

export function FormSlider({
	label,
	value = 0,
	min = 0,
	max = 100,
	step = 1,
	showValue = true,
	valueLabel,
	hint,
	onValueChange,
}: FormSliderProps) {
	const displayValue = valueLabel ?? String(value);

	const handleChange = (next: readonly number[]) => {
		const first = next[0];
		if (first !== undefined) {
			onValueChange?.(first);
		}
	};

	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between gap-2">
				<Label className="min-w-0 truncate text-sm font-medium">{label}</Label>
				{showValue ? (
					<span className="shrink-0 text-sm font-medium tabular-nums">{displayValue}</span>
				) : null}
			</div>
			<Slider value={[value]} onValueChange={handleChange} min={min} max={max} step={step} />
			{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
		</div>
	);
}

export type { FormSliderProps };
