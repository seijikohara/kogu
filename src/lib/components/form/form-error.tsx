import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface FormErrorProps {
	readonly message?: string | null;
	readonly icon?: boolean;
	readonly className?: string;
	readonly children?: ReactNode;
}

export function FormError({ message, icon = true, className, children }: FormErrorProps) {
	if (!message && !children) return null;

	return (
		<p
			role="alert"
			className={cn('flex items-start gap-1.5 text-xs leading-snug text-destructive', className)}
		>
			{icon ? <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> : null}
			<span>{children ?? message}</span>
		</p>
	);
}

export type { FormErrorProps };
