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
	type LucideIcon,
} from 'lucide-react';

import {
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
} from '@/lib/components/ui/context-menu';
import type { FormatAction } from '@/lib/services/markdown';

interface HeadingOption {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly action: FormatAction['type'];
}

const HEADING_OPTIONS: readonly HeadingOption[] = [
	{ icon: Heading1, label: 'Heading 1', action: 'heading1' },
	{ icon: Heading2, label: 'Heading 2', action: 'heading2' },
	{ icon: Heading3, label: 'Heading 3', action: 'heading3' },
	{ icon: Heading4, label: 'Heading 4', action: 'heading4' },
	{ icon: Heading5, label: 'Heading 5', action: 'heading5' },
	{ icon: Heading6, label: 'Heading 6', action: 'heading6' },
];

interface MarkdownContextMenuItemsProps {
	readonly onFormat: (action: FormatAction['type']) => void;
}

export function MarkdownContextMenuItems({ onFormat }: MarkdownContextMenuItemsProps) {
	return (
		<>
			<ContextMenuSub>
				<ContextMenuSubTrigger>
					<Bold className="mr-2 h-4 w-4" />
					Text Formatting
				</ContextMenuSubTrigger>
				<ContextMenuSubContent>
					<ContextMenuItem onSelect={() => onFormat('bold')}>
						<Bold className="mr-2 h-4 w-4" />
						Bold
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => onFormat('italic')}>
						<Italic className="mr-2 h-4 w-4" />
						Italic
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => onFormat('strikethrough')}>
						<Strikethrough className="mr-2 h-4 w-4" />
						Strikethrough
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => onFormat('code')}>
						<Code className="mr-2 h-4 w-4" />
						Inline Code
					</ContextMenuItem>
				</ContextMenuSubContent>
			</ContextMenuSub>
			<ContextMenuSub>
				<ContextMenuSubTrigger>
					<Heading2 className="mr-2 h-4 w-4" />
					Headings
				</ContextMenuSubTrigger>
				<ContextMenuSubContent>
					{HEADING_OPTIONS.map((heading) => {
						const Icon = heading.icon;
						return (
							<ContextMenuItem key={heading.action} onSelect={() => onFormat(heading.action)}>
								<Icon className="mr-2 h-4 w-4" />
								{heading.label}
							</ContextMenuItem>
						);
					})}
				</ContextMenuSubContent>
			</ContextMenuSub>
			<ContextMenuSub>
				<ContextMenuSubTrigger>
					<List className="mr-2 h-4 w-4" />
					Lists
				</ContextMenuSubTrigger>
				<ContextMenuSubContent>
					<ContextMenuItem onSelect={() => onFormat('bullet')}>
						<List className="mr-2 h-4 w-4" />
						Bullet List
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => onFormat('numbered')}>
						<ListOrdered className="mr-2 h-4 w-4" />
						Numbered List
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => onFormat('task')}>
						<ListTodo className="mr-2 h-4 w-4" />
						Task List
					</ContextMenuItem>
				</ContextMenuSubContent>
			</ContextMenuSub>
			<ContextMenuSeparator />
			<ContextMenuItem onSelect={() => onFormat('link')}>
				<Link className="mr-2 h-4 w-4" />
				Insert Link
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => onFormat('image')}>
				<Image className="mr-2 h-4 w-4" />
				Insert Image
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => onFormat('table')}>
				<Table className="mr-2 h-4 w-4" />
				Insert Table
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => onFormat('codeblock')}>
				<FileCode className="mr-2 h-4 w-4" />
				Code Block
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => onFormat('quote')}>
				<Quote className="mr-2 h-4 w-4" />
				Blockquote
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => onFormat('hr')}>
				<Minus className="mr-2 h-4 w-4" />
				Horizontal Rule
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem onSelect={() => onFormat('clearFormat')}>
				<Eraser className="mr-2 h-4 w-4" />
				Clear Formatting
			</ContextMenuItem>
		</>
	);
}
