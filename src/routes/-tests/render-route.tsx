import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	type ErrorComponentProps,
	type RouteComponent,
	RouterProvider,
} from '@tanstack/react-router';
import { act, render } from '@testing-library/react';

import { TooltipProvider } from '@/lib/components/ui/tooltip';

interface RouteWithComponent {
	readonly options: { readonly component?: RouteComponent };
}

// jsdom lacks ResizeObserver, which the tool shell's panels observe. The tests
// do not depend on layout, so an observer that never fires is enough.
class NoopResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

// The router would otherwise render its default error screen and the test
// would fail later on a missing element instead of on the actual error.
function RethrowError({ error }: ErrorComponentProps): never {
	throw error;
}

/**
 * Render a file route's page component in a memory router, inside the
 * providers that `__root.tsx` supplies to every page.
 */
export const renderRoute = async (route: RouteWithComponent) => {
	const Page = route.options.component;
	if (!Page) throw new Error('Route has no component');
	if (!('ResizeObserver' in globalThis)) {
		Object.defineProperty(globalThis, 'ResizeObserver', {
			configurable: true,
			value: NoopResizeObserver,
		});
	}
	const router = createRouter({
		routeTree: createRootRoute({ component: Page }),
		history: createMemoryHistory({ initialEntries: ['/'] }),
		defaultErrorComponent: RethrowError,
	});
	await act(() => router.load());
	return render(
		<TooltipProvider>
			<RouterProvider router={router} />
		</TooltipProvider>
	);
};
