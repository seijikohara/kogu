<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { CATEGORIES, getPagesByCategory } from '$lib/services/pages.js';
</script>

<svelte:head>
	<title>Dashboard - Kogu</title>
</svelte:head>

<div class="flex h-full flex-col">
	<!-- Main Content -->
	<main class="flex-1 overflow-y-auto p-6">
		<div class="mx-auto max-w-5xl space-y-6">
			<!-- Welcome Section -->
			<section class="rounded-xl border bg-gradient-to-br from-accent-brand/5 to-transparent p-6">
				<div class="flex items-center gap-3">
					<img src="/logo.svg" alt="" class="h-10 w-10" />
					<div>
						<h2 class="text-xl font-bold">Kogu</h2>
						<p class="text-sm text-muted-foreground">
							Developer tools suite. All processing is local.
						</p>
					</div>
				</div>
			</section>

			<!-- Tools by Category -->
			{#each CATEGORIES as category}
				{@const tools = getPagesByCategory(category.id)}
				<section>
					<div class="mb-3 flex items-center gap-2 border-l-2 {category.borderClass} pl-2">
						<category.icon class="h-4 w-4 {category.iconClass}" />
						<h3 class="text-sm font-bold text-muted-foreground">{category.label}</h3>
					</div>
					<div class="grid gap-3 sm:grid-cols-2">
						{#each tools as tool}
							<a
								href={tool.url}
								class="group block rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
							>
								<Card.Root
									class="h-full border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
								>
									<Card.Content class="flex h-full items-center gap-3 p-4">
										<div class="shrink-0 rounded-lg bg-muted/50 p-2">
											<tool.icon class="h-6 w-6 {tool.color ?? ''}" />
										</div>
										<div class="min-w-0 flex-1">
											<div
												class="font-medium transition-transform duration-150 group-hover:translate-x-0.5"
											>
												{tool.title}
											</div>
											<p class="line-clamp-2 text-xs text-muted-foreground">
												{tool.description}
											</p>
										</div>
									</Card.Content>
								</Card.Root>
							</a>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</main>

	<!-- Footer -->
	<footer class="border-t border-border/60 px-4 py-1.5">
		<p class="text-2xs text-muted-foreground/40">
			Built with Tauri 2 + Svelte 5 + shadcn-svelte + Tailwind CSS v4
		</p>
	</footer>
</div>
