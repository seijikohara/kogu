import { Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="border-b px-4 py-2">
				<h1 className="text-sm font-medium text-muted-foreground">
					Kogu — Developer Tools (React migration in progress)
				</h1>
			</header>
			<main className="p-4">
				<Outlet />
			</main>
		</div>
	);
}
