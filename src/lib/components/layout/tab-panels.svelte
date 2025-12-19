<script lang="ts" generics="T extends string">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Currently active tab identifier */
		readonly activeTab: T;
		/** Array of tab identifiers */
		readonly tabs: readonly T[];
		/** Tab content renderer - receives tab value */
		readonly children: Snippet<[T]>;
		/** Additional CSS classes */
		readonly class?: string;
	}

	let { activeTab, tabs, children, class: className = '' }: Props = $props();
</script>

<!--
  CSS hidden/visible pattern for tab state preservation.
  All tabs are rendered to DOM but only active one is visible.
  This preserves scroll position, focus, and component state.
-->
{#each tabs as tab (tab)}
	<div
		class="flex-1 overflow-hidden {activeTab === tab ? 'flex' : 'hidden'} {className}"
		role="tabpanel"
		aria-labelledby="tab-{tab}"
		aria-hidden={activeTab !== tab}
	>
		{@render children(tab)}
	</div>
{/each}
