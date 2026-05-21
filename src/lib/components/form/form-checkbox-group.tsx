import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface FormCheckboxGroupProps {
	readonly className?: string;
	readonly children?: ReactNode;
}

export function FormCheckboxGroup({ className, children }: FormCheckboxGroupProps) {
	return <fieldset className={cn('space-y-1.5 border-0 p-0', className)}>{children}</fieldset>;
}

export type { FormCheckboxGroupProps };
