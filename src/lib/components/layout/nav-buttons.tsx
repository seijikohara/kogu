import { useEffect, useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/lib/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/lib/components/ui/tooltip';

export function NavButtons(_: NavButtonsProps = {}) {
	const router = useRouter();

	// TanStack Router's history object does not surface a reactive canGoBack /
	// canGoForward, so subscribe to history changes and recompute on every
	// navigation event.
	const [navState, setNavState] = useState(() => readNavState(router.history));

	useEffect(() => {
		const unsubscribe = router.history.subscribe(() => {
			setNavState(readNavState(router.history));
		});
		return unsubscribe;
	}, [router.history]);

	const handleBack = () => {
		router.history.back();
	};

	const handleForward = () => {
		router.history.forward();
	};

	return (
		<div className="flex items-center gap-0.5">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						disabled={!navState.canGoBack}
						onClick={handleBack}
						// TitleBar sits on bg-surface-2; restore visible hover affordance.
						className="h-7 w-7 hover:bg-interactive-hover"
					>
						<ChevronLeft className="h-4 w-4" />
						<span className="sr-only">Go back</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent>Go back</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						disabled={!navState.canGoForward}
						onClick={handleForward}
						// TitleBar sits on bg-surface-2; restore visible hover affordance.
						className="h-7 w-7 hover:bg-interactive-hover"
					>
						<ChevronRight className="h-4 w-4" />
						<span className="sr-only">Go forward</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent>Go forward</TooltipContent>
			</Tooltip>
		</div>
	);
}

type RouterHistory = ReturnType<typeof useRouter>['history'];

type NavState = {
	readonly canGoBack: boolean;
	readonly canGoForward: boolean;
};

const readNavState = (history: RouterHistory): NavState => {
	const index = history.location.state.__TSR_index;
	return {
		canGoBack: history.canGoBack(),
		canGoForward: index < history.length - 1,
	};
};

export type NavButtonsProps = {
	readonly className?: string;
};
