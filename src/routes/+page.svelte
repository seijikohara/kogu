<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { Button } from '$lib/components/ui/button';

	let name = $state('');
	let greetMsg = $state('');

	async function greet(event: Event) {
		event.preventDefault();
		greetMsg = await invoke('greet', { name });
	}
</script>

<div
	class="min-h-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground p-8"
>
	<h1 class="text-3xl font-bold">Welcome to Tauri + Svelte</h1>

	<div class="flex gap-4">
		<a href="https://vite.dev" target="_blank">
			<img
				src="/vite.svg"
				class="h-24 p-4 transition-all hover:drop-shadow-[0_0_2em_#747bff]"
				alt="Vite Logo"
			/>
		</a>
		<a href="https://tauri.app" target="_blank">
			<img
				src="/tauri.svg"
				class="h-24 p-4 transition-all hover:drop-shadow-[0_0_2em_#24c8db]"
				alt="Tauri Logo"
			/>
		</a>
		<a href="https://svelte.dev" target="_blank">
			<img
				src="/svelte.svg"
				class="h-24 p-4 transition-all hover:drop-shadow-[0_0_2em_#ff3e00]"
				alt="Svelte Logo"
			/>
		</a>
	</div>

	<p class="text-muted-foreground">Click on the Tauri, Vite, and Svelte logos to learn more.</p>

	<form class="flex gap-2" onsubmit={greet}>
		<input
			id="greet-input"
			class="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			placeholder="Enter a name..."
			bind:value={name}
		/>
		<Button type="submit">Greet</Button>
	</form>

	{#if greetMsg}
		<p class="text-lg font-medium">{greetMsg}</p>
	{/if}

	<div class="flex gap-2 mt-4">
		<Button variant="default">Default</Button>
		<Button variant="secondary">Secondary</Button>
		<Button variant="outline">Outline</Button>
		<Button variant="ghost">Ghost</Button>
		<Button variant="destructive">Destructive</Button>
	</div>
</div>
