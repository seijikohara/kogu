<script lang="ts">
	import OptionsSection from '$lib/components/options/options-section.svelte';
</script>

<OptionsSection title="Legend">
	<div class="space-y-1.5 rounded-md bg-muted/50 p-2">
		<div class="flex items-center gap-2 text-xs">
			<span class="h-2.5 w-2.5 rounded-sm bg-green-500/40"></span>
			<span class="text-muted-foreground">Added</span>
		</div>
		<div class="flex items-center gap-2 text-xs">
			<span class="h-2.5 w-2.5 rounded-sm bg-red-500/40"></span>
			<span class="text-muted-foreground">Removed</span>
		</div>
		<div class="flex items-center gap-2 text-xs">
			<span class="h-2.5 w-2.5 rounded-sm bg-yellow-500/40"></span>
			<span class="text-muted-foreground">Changed</span>
		</div>
	</div>
</OptionsSection>
