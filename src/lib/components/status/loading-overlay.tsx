import { Loader2, X } from 'lucide-react';

import { Button } from '@/lib/components/ui/button';
import { Card, CardContent } from '@/lib/components/ui/card';

interface LoadingOverlayProps {
	readonly show: boolean;
	readonly title?: string;
	readonly message?: string;
	readonly estimatedTime?: string;
	readonly elapsedTime?: string;
	readonly progress?: number | null;
	readonly cancellable?: boolean;
	readonly onCancel?: () => void;
}

export function LoadingOverlay({
	show,
	title = 'Processing...',
	message,
	estimatedTime,
	elapsedTime,
	progress = null,
	cancellable = true,
	onCancel,
}: LoadingOverlayProps) {
	if (!show) return null;

	const showProgress = progress !== null && progress !== undefined;
	const clampedProgress = showProgress ? Math.min(100, Math.max(0, progress)) : 0;
	const showTimes = Boolean(estimatedTime || elapsedTime);
	const showCancel = cancellable && onCancel;

	return (
		<div
			className="absolute inset-0 z-50 flex animate-fade-in items-center justify-center bg-background/80 backdrop-blur-sm"
			role="dialog"
			aria-modal="true"
			aria-labelledby="loading-title"
		>
			<Card density="compact" className="shadow-lg">
				<CardContent className="flex flex-col items-center gap-4 px-8 py-4">
					<Loader2 className="h-10 w-10 animate-spin text-primary" />

					<div className="text-center">
						<h3 id="loading-title" className="text-lg font-semibold">
							{title}
						</h3>
						{message ? <p className="mt-1 text-sm text-muted-foreground">{message}</p> : null}
					</div>

					{showProgress ? (
						<div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary transition-all duration-300"
								style={{ width: `${clampedProgress}%` }}
							/>
						</div>
					) : null}

					{showTimes ? (
						<div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
							{elapsedTime ? (
								<span>
									Elapsed: <strong className="text-foreground">{elapsedTime}</strong>
								</span>
							) : null}
							{estimatedTime ? (
								<span>
									Estimated: <strong className="text-foreground">{estimatedTime}</strong>
								</span>
							) : null}
						</div>
					) : null}

					{showCancel ? (
						<Button variant="outline" size="sm" onClick={onCancel}>
							<X className="h-4 w-4" />
							Cancel
						</Button>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}

export type { LoadingOverlayProps };
