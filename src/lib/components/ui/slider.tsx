import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils/index';

// Forward refs so Tooltip.Trigger asChild and other Slot-based wrappers
// can correctly attach refs onto the underlying Radix Root/Track/Range/Thumb elements.
const Slider = React.forwardRef<
	React.ElementRef<typeof SliderPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, defaultValue, value, min = 0, max = 100, ...props }, ref) => {
	const _values = React.useMemo(
		() => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
		[value, defaultValue, min, max]
	);

	return (
		<SliderPrimitive.Root
			ref={ref}
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
});
Slider.displayName = SliderPrimitive.Root.displayName;

const SliderTrack = React.forwardRef<
	React.ElementRef<typeof SliderPrimitive.Track>,
	React.ComponentPropsWithoutRef<typeof SliderPrimitive.Track>
>(({ className, ...props }, ref) => (
	<SliderPrimitive.Track
		ref={ref}
		data-slot="slider-track"
		className={cn(
			'relative grow overflow-hidden rounded-full bg-muted data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1',
			className
		)}
		{...props}
	/>
));
SliderTrack.displayName = SliderPrimitive.Track.displayName;

const SliderRange = React.forwardRef<
	React.ElementRef<typeof SliderPrimitive.Range>,
	React.ComponentPropsWithoutRef<typeof SliderPrimitive.Range>
>(({ className, ...props }, ref) => (
	<SliderPrimitive.Range
		ref={ref}
		data-slot="slider-range"
		className={cn(
			'absolute bg-primary select-none data-horizontal:h-full data-vertical:w-full',
			className
		)}
		{...props}
	/>
));
SliderRange.displayName = SliderPrimitive.Range.displayName;

const SliderThumb = React.forwardRef<
	React.ElementRef<typeof SliderPrimitive.Thumb>,
	React.ComponentPropsWithoutRef<typeof SliderPrimitive.Thumb>
>(({ className, ...props }, ref) => (
	<SliderPrimitive.Thumb
		ref={ref}
		data-slot="slider-thumb"
		className={cn(
			'relative block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50',
			className
		)}
		{...props}
	/>
));
SliderThumb.displayName = SliderPrimitive.Thumb.displayName;

export { Slider };
