<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import { Settings, Check, ChevronsUpDown, RotateCcw } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		type AppSettings,
		type FontSettings,
		DEFAULT_SETTINGS,
		getSettings,
		getSystemFonts,
		getSettingsFilePath,
		updateSettings,
		resetSettings,
		applyAllSettings,
	} from '$lib/services/settings.js';

	// State
	let fontSettings = $state<FontSettings>({ ...DEFAULT_SETTINGS.font });
	let systemFonts = $state<string[]>([]);
	let settingsFilePath = $state('');

	// Combobox open states
	let uiFontOpen = $state(false);
	let codeFontOpen = $state(false);

	// Debounce timer for auto-save
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	// Build full AppSettings from current state
	const currentSettings = $derived<AppSettings>({
		font: fontSettings,
	});

	// Auto-save on settings change (300ms debounce)
	$effect(() => {
		// Access the derived value to subscribe
		const settings = currentSettings;

		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			updateSettings(settings)
				.then(() => applyAllSettings(settings))
				.catch(() => toast.error('Failed to save settings'));
		}, 300);
	});

	// Cleanup timer on unmount
	$effect(() => {
		return () => {
			clearTimeout(saveTimer);
		};
	});

	// Load settings and system fonts on mount
	onMount(() => {
		getSettings()
			.then((settings) => {
				fontSettings = { ...settings.font };
			})
			.catch(() => {});

		getSystemFonts()
			.then((fonts) => {
				systemFonts = fonts;
			})
			.catch(() => {});

		getSettingsFilePath()
			.then((path) => {
				settingsFilePath = path;
			})
			.catch(() => {});
	});

	// Reset all settings
	const handleReset = async () => {
		const confirmed = await confirm(
			'This will reset all settings including fonts and window position.',
			{
				title: 'Reset All Settings',
				kind: 'warning',
				okLabel: 'Reset',
				cancelLabel: 'Cancel',
			}
		);
		if (!confirmed) return;

		const defaults = await resetSettings();
		fontSettings = { ...defaults.font };
		applyAllSettings(defaults);
		toast.success('All settings have been reset');
	};
</script>

<svelte:head>
	<title>Settings - Kogu</title>
</svelte:head>

<div class="flex h-full flex-col">
	<main class="flex-1 overflow-y-auto p-6">
		<div class="mx-auto max-w-2xl space-y-6">
			<!-- Header -->
			<div class="flex items-center gap-3">
				<Settings class="h-6 w-6 text-muted-foreground" />
				<h1 class="text-xl font-bold">Settings</h1>
			</div>

			<!-- Appearance Card -->
			<Card.Root id="appearance">
				<Card.Header>
					<Card.Title>Appearance</Card.Title>
					<Card.Description>Customize fonts used throughout the application</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-6">
					<!-- UI Font Family -->
					<div class="space-y-1.5">
						<Label class="text-sm font-medium">UI Font Family</Label>
						<Popover.Root bind:open={uiFontOpen}>
							<Popover.Trigger>
								{#snippet child({ props })}
									<Button variant="outline" class="w-full justify-between font-normal" {...props}>
										<span
											class="truncate"
											style:font-family={fontSettings.ui_family
												? `"${fontSettings.ui_family}"`
												: undefined}
										>
											{fontSettings.ui_family || 'System Default'}
										</span>
										<ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
									</Button>
								{/snippet}
							</Popover.Trigger>
							<Popover.Content class="w-[var(--bits-popover-anchor-width)] p-0" align="start">
								<Command.Root>
									<Command.Input placeholder="Search fonts..." />
									<Command.List class="max-h-48">
										<Command.Empty>No fonts found.</Command.Empty>
										<Command.Group>
											<Command.Item
												value="System Default"
												onSelect={() => {
													fontSettings = { ...fontSettings, ui_family: '' };
													uiFontOpen = false;
												}}
											>
												<span>System Default</span>
												{#if !fontSettings.ui_family}
													<Check class="ml-auto h-4 w-4" />
												{/if}
											</Command.Item>
											{#each systemFonts as font (font)}
												<Command.Item
													value={font}
													onSelect={() => {
														fontSettings = { ...fontSettings, ui_family: font };
														uiFontOpen = false;
													}}
												>
													<span style:font-family={`"${font}"`}>{font}</span>
													{#if fontSettings.ui_family === font}
														<Check class="ml-auto h-4 w-4" />
													{/if}
												</Command.Item>
											{/each}
										</Command.Group>
									</Command.List>
								</Command.Root>
							</Popover.Content>
						</Popover.Root>
					</div>

					<!-- UI Font Size -->
					<div class="space-y-1.5">
						<div class="flex items-center justify-between gap-2">
							<Label class="text-sm font-medium">UI Font Size</Label>
							<span class="text-sm font-medium tabular-nums">{fontSettings.ui_size}px</span>
						</div>
						<input
							type="range"
							value={fontSettings.ui_size}
							min={10}
							max={24}
							step={1}
							oninput={(e) => {
								fontSettings = {
									...fontSettings,
									ui_size: Number((e.target as HTMLInputElement).value),
								};
							}}
							class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
						/>
					</div>

					<!-- Code Font Family -->
					<div class="space-y-1.5">
						<Label class="text-sm font-medium">Code Font Family</Label>
						<Popover.Root bind:open={codeFontOpen}>
							<Popover.Trigger>
								{#snippet child({ props })}
									<Button variant="outline" class="w-full justify-between font-normal" {...props}>
										<span
											class="truncate"
											style:font-family={fontSettings.code_family
												? `"${fontSettings.code_family}"`
												: undefined}
										>
											{fontSettings.code_family || 'System Default'}
										</span>
										<ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
									</Button>
								{/snippet}
							</Popover.Trigger>
							<Popover.Content class="w-[var(--bits-popover-anchor-width)] p-0" align="start">
								<Command.Root>
									<Command.Input placeholder="Search fonts..." />
									<Command.List class="max-h-48">
										<Command.Empty>No fonts found.</Command.Empty>
										<Command.Group>
											<Command.Item
												value="System Default"
												onSelect={() => {
													fontSettings = { ...fontSettings, code_family: '' };
													codeFontOpen = false;
												}}
											>
												<span>System Default</span>
												{#if !fontSettings.code_family}
													<Check class="ml-auto h-4 w-4" />
												{/if}
											</Command.Item>
											{#each systemFonts as font (font)}
												<Command.Item
													value={font}
													onSelect={() => {
														fontSettings = { ...fontSettings, code_family: font };
														codeFontOpen = false;
													}}
												>
													<span style:font-family={`"${font}"`}>{font}</span>
													{#if fontSettings.code_family === font}
														<Check class="ml-auto h-4 w-4" />
													{/if}
												</Command.Item>
											{/each}
										</Command.Group>
									</Command.List>
								</Command.Root>
							</Popover.Content>
						</Popover.Root>
					</div>

					<!-- Code Font Size -->
					<div class="space-y-1.5">
						<div class="flex items-center justify-between gap-2">
							<Label class="text-sm font-medium">Code Font Size</Label>
							<span class="text-sm font-medium tabular-nums">{fontSettings.code_size}px</span>
						</div>
						<input
							type="range"
							value={fontSettings.code_size}
							min={10}
							max={24}
							step={1}
							oninput={(e) => {
								fontSettings = {
									...fontSettings,
									code_size: Number((e.target as HTMLInputElement).value),
								};
							}}
							class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
						/>
					</div>

					<!-- Preview -->
					<div class="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
						<p class="text-xs font-medium text-muted-foreground">Preview</p>
						<p
							style:font-family={fontSettings.ui_family
								? `"${fontSettings.ui_family}", system-ui, sans-serif`
								: undefined}
							style:font-size={fontSettings.ui_size !== DEFAULT_SETTINGS.font.ui_size
								? `${fontSettings.ui_size}px`
								: undefined}
						>
							The quick brown fox jumps over the lazy dog.
						</p>
						<pre
							class="rounded-md bg-muted p-2"
							style:font-family={fontSettings.code_family
								? `"${fontSettings.code_family}", ui-monospace, monospace`
								: undefined}
							style:font-size={fontSettings.code_size !== DEFAULT_SETTINGS.font.code_size
								? `${fontSettings.code_size}px`
								: undefined}><code>const hello = "world"; // 0123456789</code></pre>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Data Card -->
			<Card.Root id="data">
				<Card.Header>
					<Card.Title>Data</Card.Title>
					<Card.Description>Settings file location and reset options</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if settingsFilePath}
						<div class="space-y-1">
							<Label class="text-xs text-muted-foreground">Settings file</Label>
							<p class="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
								{settingsFilePath}
							</p>
						</div>
					{/if}
					<div class="space-y-2">
						<Button variant="destructive" size="sm" onclick={handleReset}>
							<RotateCcw class="mr-2 h-4 w-4" />
							Reset All Settings
						</Button>
						<p class="text-xs text-muted-foreground">
							Resets all preferences including fonts and window position to defaults.
						</p>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</main>
</div>
