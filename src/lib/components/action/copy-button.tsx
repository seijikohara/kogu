import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/lib/components/ui/button';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
	readonly text: string;
	readonly label?: string;
	readonly toastLabel?: string;
	readonly variant?: 'default' | 'ghost' | 'outline';
	readonly size?: 'default' | 'sm' | 'icon';
	readonly className?: string;
	readonly showLabel?: boolean;
	readonly disabled?: boolean;
}

export function CopyButton({
	text,
	label = 'Copy',
	toastLabel,
	variant = 'ghost',
	size = 'sm',
	className,
	showLabel = true,
	disabled = false,
}: CopyButtonProps) {
	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${toastLabel ?? label} copied to clipboard`);
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	return (
		<Button
			variant={variant}
			size={size}
			disabled={disabled}
			className={cn(size === 'sm' && 'h-7 gap-1 px-2 text-xs', className)}
			onClick={handleCopy}
		>
			<Copy className={size === 'icon' ? 'h-4 w-4' : 'h-3 w-3'} />
			{showLabel && size !== 'icon' ? label : null}
		</Button>
	);
}

export type { CopyButtonProps };
