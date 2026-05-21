import { Link, createFileRoute } from '@tanstack/react-router';

import { Card, CardContent } from '@/lib/components/ui/card';
import { CATEGORIES, getPagesByCategory } from '@/lib/services/pages';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/')({
	component: HomePage,
});

function HomePage() {
	return (
		<div className="flex h-full flex-col">
			<main className="flex-1 overflow-y-auto p-6">
				<div className="mx-auto max-w-5xl space-y-6">
					{/* Welcome Section */}
					<section className="rounded-xl border bg-gradient-to-br from-accent-brand/5 to-transparent p-6">
						<div className="flex items-center gap-3">
							<img src="/logo.svg" alt="" className="h-10 w-10" />
							<div>
								<h2 className="text-xl font-bold">Kogu</h2>
								<p className="text-sm text-muted-foreground">
									Developer tools suite. All processing is local.
								</p>
							</div>
						</div>
					</section>

					{/* Tools by Category */}
					{CATEGORIES.map((category) => {
						const CategoryIcon = category.icon;
						const tools = getPagesByCategory(category.id);
						return (
							<section key={category.id}>
								<div
									className={cn(
										'mb-3 flex items-center gap-2 border-l-2 pl-2',
										category.borderClass
									)}
								>
									<CategoryIcon className={cn('h-4 w-4', category.iconClass)} />
									<h3 className="text-sm font-bold text-muted-foreground">{category.label}</h3>
								</div>
								<div className="grid gap-4 sm:grid-cols-2">
									{tools.map((tool) => {
										const ToolIcon = tool.icon;
										return (
											<Link
												key={tool.id}
												to={tool.url as never}
												className="group block rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/30"
											>
												<Card className="h-full border-border/50 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md">
													<CardContent className="flex h-full items-center gap-4 p-5">
														<div className="shrink-0 rounded-lg bg-accent-soft p-2.5">
															<ToolIcon className={cn('h-7 w-7', tool.color)} />
														</div>
														<div className="min-w-0 flex-1">
															<div className="font-semibold transition-transform duration-150 group-hover:translate-x-0.5">
																{tool.title}
															</div>
															<p className="line-clamp-2 text-xs text-muted-foreground/80">
																{tool.description}
															</p>
														</div>
													</CardContent>
												</Card>
											</Link>
										);
									})}
								</div>
							</section>
						);
					})}
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t border-border/50 px-4 py-1.5">
				<p className="text-xs text-muted-foreground/50">
					Built with Tauri 2 + React 19 + shadcn-ui + Tailwind CSS v4
				</p>
			</footer>
		</div>
	);
}
