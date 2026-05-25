import { Link, createFileRoute } from '@tanstack/react-router';

import { Card, CardContent } from '@/lib/components/ui/card';
import {
	CATEGORIES,
	getPagesByCategory,
	type CategoryInfo,
	type PageDefinition,
} from '@/lib/services/pages';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/')({
	component: HomePage,
});

function HomePage() {
	return (
		<div className="flex h-full flex-col">
			<main className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-5xl space-y-8 px-6 py-8 sm:px-8 sm:py-10">
					<Welcome />
					{CATEGORIES.map((category) => (
						<CategorySection key={category.id} category={category} />
					))}
				</div>
			</main>
			<Footer />
		</div>
	);
}

function Welcome() {
	return (
		<section className="rounded-lg border border-border/60 px-6 py-7 sm:px-8">
			<div className="flex items-center gap-3">
				<img src="/logo.svg" alt="" className="size-11" />
				<div>
					<h2 className="text-xl font-semibold tracking-tight">Kogu</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Developer tools suite. All processing is local.
					</p>
				</div>
			</div>
		</section>
	);
}

interface CategorySectionProps {
	readonly category: CategoryInfo;
}

function CategorySection({ category }: CategorySectionProps) {
	const CategoryIcon = category.icon;
	const tools = getPagesByCategory(category.id);
	return (
		<section>
			<div className="mb-4 flex items-center gap-2">
				<CategoryIcon className={cn('size-4', category.iconClass)} />
				<h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
					{category.label}
				</h3>
			</div>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{tools.map((tool) => (
					<ToolCard key={tool.id} tool={tool} />
				))}
			</div>
		</section>
	);
}

interface ToolCardProps {
	readonly tool: PageDefinition;
}

function ToolCard({ tool }: ToolCardProps) {
	const ToolIcon = tool.icon;
	return (
		<Link
			to={tool.url as never}
			className="group block rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/30"
		>
			<Card
				density="compact"
				className="h-full border-border/60 transition-colors duration-150 hover:border-border hover:bg-surface-2/60"
			>
				<CardContent className="flex h-full items-center gap-3">
					<div className="shrink-0 rounded-md bg-muted/60 p-2">
						<ToolIcon className={cn('size-5', tool.color)} />
					</div>
					<div className="min-w-0 flex-1">
						<div className="text-sm font-medium">{tool.title}</div>
						<p className="line-clamp-2 text-xs text-muted-foreground">{tool.description}</p>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}

function Footer() {
	return (
		<footer className="border-t border-border/40 px-6 py-2">
			<p className="text-xs text-muted-foreground/50">
				Built with Tauri 2 + React 19 + shadcn-ui + Tailwind CSS v4
			</p>
		</footer>
	);
}
