<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { CATEGORIES, getPagesByCategory } from '$lib/services/pages.js';
</script>

<svelte:head>
	<title>Dashboard - Kogu</title>
</svelte:head>

<div class="flex h-full flex-col">
	<!-- Main Content -->
	<main class="flex-1 overflow-y-auto p-6">
		<div class="mx-auto max-w-4xl space-y-6">
			<!-- Welcome Section -->
			<section>
				<h2 class="text-xl font-bold">Kogu</h2>
				<p class="text-sm text-muted-foreground">
					A collection of developer tools built with Tauri, Svelte 5, and shadcn-svelte.
				</p>
			</section>

			<!-- Tools by Category -->
			{#each CATEGORIES as category}
				{@const tools = getPagesByCategory(category.id)}
				<section>
					<div class="mb-3 flex items-center gap-2">
						<category.icon class="h-4 w-4 text-muted-foreground" />
						<h3 class="text-sm font-medium text-muted-foreground">{category.label}</h3>
					</div>
					<div class="grid gap-3 sm:grid-cols-2">
						{#each tools as tool}
							<a href={tool.url} class="block">
								<Card.Root class="h-full transition-colors hover:bg-muted/50">
									<Card.Content class="flex h-full items-center gap-3 p-4">
										<div class="shrink-0 rounded-lg bg-muted p-2">
											<tool.icon class="h-5 w-5 {tool.color ?? ''}" />
										</div>
										<div class="min-w-0 flex-1">
											<div class="font-medium">{tool.title}</div>
											<p class="line-clamp-2 text-xs text-muted-foreground">{tool.description}</p>
										</div>
										<ArrowRight class="h-4 w-4 shrink-0 text-muted-foreground" />
									</Card.Content>
								</Card.Root>
							</a>
						{/each}
					</div>
				</section>
			{/each}

			<!-- Quick Tips -->
			<section>
				<h3 class="mb-3 text-sm font-medium text-muted-foreground">Quick Tips</h3>
				<Card.Root>
					<Card.Content class="p-4">
						<ul class="space-y-1.5 text-sm text-muted-foreground">
							<li>Use the sidebar to navigate between tools</li>
							<li>Each tool supports paste and copy to clipboard</li>
							<li>All processing is done locally</li>
						</ul>
					</Card.Content>
				</Card.Root>
			</section>
		</div>
	</main>

	<!-- Footer -->
	<footer class="border-t px-4 py-2">
		<p class="text-xs text-muted-foreground">
			Built with Tauri 2 + Svelte 5 + shadcn-svelte + Tailwind CSS v4
		</p>
	</footer>
</div>
