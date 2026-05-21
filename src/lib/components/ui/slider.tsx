import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils/index';

function Slider({
	className,
	defaultValue,
	value,
	min = 0,
	max = 100,
	...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
	const _values = React.useMemo(
		() => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
		[value, defaultValue, min, max]
	);

	return (
		<SliderPrimitive.Root
			data-slot="slider"
			defaultValue={defaultValue}
			value={value}
			min={min}
			max={max}
			className={cn(
				'relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col',
				className
			)}
			{...props}
		>
			<SliderTrack>
				<SliderRange />
			</SliderTrack>
			{Array.from({ length: _values.length }, (_, index) => (
				<SliderThumb key={index} />
			))}
		</SliderPrimitive.Root>
	);
}

function SliderTrack({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Track>) {
	return (
		<SliderPrimitive.Track
			data-slot="slider-track"
			className={cn(
				'relative grow overflow-hidden rounded-full bg-muted data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1',
				className
			)}
			{...props}
		/>
	);
}

function SliderRange({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Range>) {
	return (
		<SliderPrimitive.Range
			data-slot="slider-range"
			className={cn(
				'absolute bg-primary select-none data-horizontal:h-full data-vertical:w-full',
				className
			)}
			{...props}
		/>
	);
}

function SliderThumb({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Thumb>) {
	return (
		<SliderPrimitive.Thumb
			data-slot="slider-thumb"
			className={cn(
				'relative block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50',
				className
			)}
			{...props}
		/>
	);
}

export { Slider };
