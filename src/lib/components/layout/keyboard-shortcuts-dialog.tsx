import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/lib/components/ui/dialog';
import { Input } from '@/lib/components/ui/input';
import { modLabel } from '@/lib/utils/keyboard';

interface ShortcutEntry {
	readonly keys: string;
	readonly description: string;
}

interface ShortcutGroup {
	readonly title: string;
	readonly shortcuts: readonly ShortcutEntry[];
}

const GROUPS: readonly ShortcutGroup[] = [
	{
		title: 'Global',
		shortcuts: [
			{ keys: `${modLabel}+K`, description: 'Open command palette' },
			{ keys: `${modLabel}+B`, description: 'Toggle sidebar' },
			{ keys: '?', description: 'Show keyboard shortcuts' },
		],
	},
	{
		title: 'Navigation',
		shortcuts: [
			{ keys: `${modLabel}+[`, description: 'Navigate back' },
			{ keys: `${modLabel}+]`, description: 'Navigate forward' },
		],
	},
	{
		title: 'Page',
		shortcuts: [
			{ keys: `${modLabel}+,`, description: 'Toggle options panel' },
			{ keys: `${modLabel}+1-9`, description: 'Switch to tab N' },
			{ keys: `${modLabel}+Enter`, description: 'Execute primary action' },
		],
	},
	{
		title: 'Lists',
		shortcuts: [
			{ keys: '↑ / ↓', description: 'Move selection up / down' },
			{ keys: 'Home / End', description: 'Jump to first / last item' },
		],
	},
	{
		title: 'Tree View',
		shortcuts: [
			{ keys: '↑ / ↓', description: 'Move to previous / next node' },
			{ keys: '→', description: 'Expand node' },
			{ keys: '←', description: 'Collapse node' },
			{ keys: 'Enter', description: 'Select node' },
			{ keys: 'Home / End', description: 'Jump to first / last node' },
		],
	},
];

export function KeyboardShortcutsDialog({
	open = false,
	onOpenChange,
}: KeyboardShortcutsDialogProps) {
	const [query, setQuery] = useState('');
	const searchInputRef = useRef<HTMLInputElement | null>(null);

	const filteredGroups = useMemo(() => {
		const trimmed = query.trim().toLowerCase();
		if (!trimmed) return GROUPS;
		return GROUPS.map((group) => ({
			...group,
			shortcuts: group.shortcuts.filter(
				(shortcut) =>
					shortcut.description.toLowerCase().includes(trimmed) ||
					shortcut.keys.toLowerCase().includes(trimmed)
			),
		})).filter((group) => group.shortcuts.length > 0);
	}, [query]);

	// Reset the query and focus the input each time the dialog opens so the next
	// keystroke filters from a clean state.
	useEffect(() => {
		if (!open) return;
		setQuery('');
		// Defer focus until after the dialog has mounted its content.
		queueMicrotask(() => {
			searchInputRef.current?.focus();
		});
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Keyboard Shortcuts</DialogTitle>
					<DialogDescription>Available keyboard shortcuts in Kogu.</DialogDescription>
				</DialogHeader>
				<div className="relative">
					<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						ref={searchInputRef}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search shortcuts..."
						className="pl-8"
					/>
				</div>
				<div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
					{filteredGroups.map((group) => (
						<div key={group.title}>
							<h3 className="mb-2 text-xs font-semibold text-muted-foreground">{group.title}</h3>
							<div className="space-y-1">
								{group.shortcuts.map((shortcut) => (
									<div
										key={shortcut.description}
										className="flex items-center justify-between py-1"
									>
										<span className="text-sm">{shortcut.description}</span>
										<div className="flex items-center gap-1">
											{shortcut.keys.split('+').map((part) => (
												<kbd
													key={part}
													className="rounded border border-border/40 bg-card px-1.5 py-0.5 font-mono text-2xs text-muted-foreground"
												>
													{part.trim()}
												</kbd>
											))}
										</div>
									</div>
								))}
							</div>
						</div>
					))}
					{filteredGroups.length === 0 && (
						<p className="py-6 text-center text-sm text-muted-foreground">
							No shortcuts match "{query}"
						</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

export type KeyboardShortcutsDialogProps = {
	readonly open?: boolean;
	readonly onOpenChange?: (open: boolean) => void;
};
