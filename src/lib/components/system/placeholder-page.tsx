import { Link } from '@tanstack/react-router';

interface PlaceholderPageProps {
	tool: string;
}

export function PlaceholderPage({ tool }: PlaceholderPageProps) {
	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
			<h2 className="text-2xl font-medium">{tool}</h2>
			<p className="text-muted-foreground">
				This tool is being rebuilt as part of the React migration.
			</p>
			<p className="text-sm text-muted-foreground">
				Check back soon. See{' '}
				<code className="rounded bg-muted px-1 py-0.5 text-xs">
					docs/superpowers/plans/2026-05-16-react-migration.md
				</code>{' '}
				for the migration plan.
			</p>
			<Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
				Back to home
			</Link>
		</div>
	);
}
