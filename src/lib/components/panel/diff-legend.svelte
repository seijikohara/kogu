<script lang="ts">
	import { FormSection } from '$lib/components/form';
	import * as Card from '$lib/components/ui/card';
</script>

<FormSection title="Legend">
	<Card.Root>
		<Card.Content class="space-y-1.5 p-2">
			<div class="flex items-center gap-2 text-xs">
				<span class="h-2.5 w-2.5 rounded-sm bg-success/40"></span>
				<span class="text-muted-foreground">Added</span>
			</div>
			<div class="flex items-center gap-2 text-xs">
				<span class="h-2.5 w-2.5 rounded-sm bg-destructive/40"></span>
				<span class="text-muted-foreground">Removed</span>
			</div>
			<div class="flex items-center gap-2 text-xs">
				<span class="h-2.5 w-2.5 rounded-sm bg-warning/40"></span>
				<span class="text-muted-foreground">Changed</span>
			</div>
		</Card.Content>
	</Card.Root>
</FormSection>
