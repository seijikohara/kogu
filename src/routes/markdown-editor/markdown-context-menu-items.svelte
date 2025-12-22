<script lang="ts">
	import {
		Bold,
		Code,
		Eraser,
		FileCode,
		Heading1,
		Heading2,
		Heading3,
		Heading4,
		Heading5,
		Heading6,
		Image,
		Italic,
		Link,
		List,
		ListOrdered,
		ListTodo,
		Minus,
		Quote,
		Strikethrough,
		Table,
	} from '@lucide/svelte';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import type { FormatAction } from '$lib/services/markdown.js';

	interface HeadingOption {
		readonly level: 1 | 2 | 3 | 4 | 5 | 6;
		readonly icon: typeof Heading1;
		readonly label: string;
		readonly action: FormatAction['type'];
	}

	const HEADING_OPTIONS: readonly HeadingOption[] = [
		{ level: 1, icon: Heading1, label: 'Heading 1', action: 'heading1' },
		{ level: 2, icon: Heading2, label: 'Heading 2', action: 'heading2' },
		{ level: 3, icon: Heading3, label: 'Heading 3', action: 'heading3' },
		{ level: 4, icon: Heading4, label: 'Heading 4', action: 'heading4' },
		{ level: 5, icon: Heading5, label: 'Heading 5', action: 'heading5' },
		{ level: 6, icon: Heading6, label: 'Heading 6', action: 'heading6' },
	];

	interface Props {
		readonly onformat: (action: FormatAction['type']) => void;
	}

	const { onformat }: Props = $props();
</script>

<ContextMenu.Sub>
	<ContextMenu.SubTrigger>
		<Bold class="mr-2 h-4 w-4" />
		Text Formatting
	</ContextMenu.SubTrigger>
	<ContextMenu.SubContent>
		<ContextMenu.Item onclick={() => onformat('bold')}>
			<Bold class="mr-2 h-4 w-4" />
			Bold
		</ContextMenu.Item>
		<ContextMenu.Item onclick={() => onformat('italic')}>
			<Italic class="mr-2 h-4 w-4" />
			Italic
		</ContextMenu.Item>
		<ContextMenu.Item onclick={() => onformat('strikethrough')}>
			<Strikethrough class="mr-2 h-4 w-4" />
			Strikethrough
		</ContextMenu.Item>
		<ContextMenu.Item onclick={() => onformat('code')}>
			<Code class="mr-2 h-4 w-4" />
			Inline Code
		</ContextMenu.Item>
	</ContextMenu.SubContent>
</ContextMenu.Sub>
<ContextMenu.Sub>
	<ContextMenu.SubTrigger>
		<Heading2 class="mr-2 h-4 w-4" />
		Headings
	</ContextMenu.SubTrigger>
	<ContextMenu.SubContent>
		{#each HEADING_OPTIONS as heading}
			<ContextMenu.Item onclick={() => onformat(heading.action)}>
				<heading.icon class="mr-2 h-4 w-4" />
				{heading.label}
			</ContextMenu.Item>
		{/each}
	</ContextMenu.SubContent>
</ContextMenu.Sub>
<ContextMenu.Sub>
	<ContextMenu.SubTrigger>
		<List class="mr-2 h-4 w-4" />
		Lists
	</ContextMenu.SubTrigger>
	<ContextMenu.SubContent>
		<ContextMenu.Item onclick={() => onformat('bullet')}>
			<List class="mr-2 h-4 w-4" />
			Bullet List
		</ContextMenu.Item>
		<ContextMenu.Item onclick={() => onformat('numbered')}>
			<ListOrdered class="mr-2 h-4 w-4" />
			Numbered List
		</ContextMenu.Item>
		<ContextMenu.Item onclick={() => onformat('task')}>
			<ListTodo class="mr-2 h-4 w-4" />
			Task List
		</ContextMenu.Item>
	</ContextMenu.SubContent>
</ContextMenu.Sub>
<ContextMenu.Separator />
<ContextMenu.Item onclick={() => onformat('link')}>
	<Link class="mr-2 h-4 w-4" />
	Insert Link
</ContextMenu.Item>
<ContextMenu.Item onclick={() => onformat('image')}>
	<Image class="mr-2 h-4 w-4" />
	Insert Image
</ContextMenu.Item>
<ContextMenu.Item onclick={() => onformat('table')}>
	<Table class="mr-2 h-4 w-4" />
	Insert Table
</ContextMenu.Item>
<ContextMenu.Item onclick={() => onformat('codeblock')}>
	<FileCode class="mr-2 h-4 w-4" />
	Code Block
</ContextMenu.Item>
<ContextMenu.Item onclick={() => onformat('quote')}>
	<Quote class="mr-2 h-4 w-4" />
	Blockquote
</ContextMenu.Item>
<ContextMenu.Item onclick={() => onformat('hr')}>
	<Minus class="mr-2 h-4 w-4" />
	Horizontal Rule
</ContextMenu.Item>
<ContextMenu.Separator />
<ContextMenu.Item onclick={() => onformat('clearFormat')}>
	<Eraser class="mr-2 h-4 w-4" />
	Clear Formatting
</ContextMenu.Item>
