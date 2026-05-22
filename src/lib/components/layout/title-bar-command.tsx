import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
	type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';

import {
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from '@/lib/components/ui/command';
import { CATEGORIES, getPagesByCategory } from '@/lib/services/pages';
import { cn } from '@/lib/utils';
import { formatShortcut } from '@/lib/utils/keyboard';

export interface TitleBarCommandHandle {
	readonly focusInput: () => void;
}

export const TitleBarCommand = forwardRef<TitleBarCommandHandle, TitleBarCommandProps>(
	function TitleBarCommand(_props, ref) {
		const navigate = useNavigate();

		const [open, setOpen] = useState(false);
		const [query, setQuery] = useState('');
		const containerRef = useRef<HTMLDivElement | null>(null);
		const inputRef = useRef<HTMLInputElement | null>(null);

		const close = useCallback(() => {
			setOpen(false);
			setQuery('');
			inputRef.current?.blur();
		}, []);

		useImperativeHandle(
			ref,
			() => ({
				focusInput: () => {
					inputRef.current?.focus();
					setOpen(true);
				},
			}),
			[]
		);

		const handleNavigate = (url: string) => {
			close();
			// `navigate` accepts a typed `to` path; the page registry uses string URLs that
			// are validated by the validate-pages script, so we cast to satisfy the typed
			// router without weakening callers.
			navigate({ to: url as never });
		};

		const handleAction = (fn: () => void) => {
			close();
			fn();
		};

		const handleInputKeydown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				close();
			}
		};

		useEffect(() => {
			if (!open) return;
			const handleDocPointer = (e: MouseEvent) => {
				const container = containerRef.current;
				if (!container) return;
				if (!container.contains(e.target as Node)) {
					close();
				}
			};
			document.addEventListener('mousedown', handleDocPointer);
			return () => document.removeEventListener('mousedown', handleDocPointer);
		}, [open, close]);

		return (
			<div ref={containerRef} className="relative w-full max-w-md">
				<CommandPrimitive
					loop
					shouldFilter
					label="Search pages and actions"
					className="overflow-visible bg-transparent"
				>
					<div
						className={cn(
							'flex h-6 items-center gap-2 rounded-md border px-3 transition-colors',
							open
								? 'border-ring bg-background ring-2 ring-ring/30'
								: 'border-border/60 bg-background hover:bg-accent/50'
						)}
					>
						<Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						<CommandPrimitive.Input
							ref={inputRef}
							value={query}
							onValueChange={setQuery}
							placeholder="Search pages..."
							onFocus={() => setOpen(true)}
							onKeyDown={handleInputKeydown}
							className="h-full flex-1 bg-transparent text-xs font-normal text-foreground outline-none placeholder:text-muted-foreground"
						/>
						<kbd className="pointer-events-none hidden shrink-0 rounded border border-border/40 bg-card px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:inline">
							{formatShortcut('K', true)}
						</kbd>
					</div>

					{open && (
						<div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-xl">
							<CommandList className="max-h-96 overflow-auto">
								<CommandEmpty>No results found.</CommandEmpty>
								{CATEGORIES.map((category) => {
									const pages = getPagesByCategory(category.id);
									if (pages.length === 0) return null;
									return (
										<CommandGroup key={category.id} heading={category.label}>
											{pages.map((page) => {
												const PageIcon = page.icon;
												return (
													<CommandItem
														key={page.id}
														value={`${page.title} ${page.description}`}
														onSelect={() => handleNavigate(page.url)}
													>
														<PageIcon />
														<span className="whitespace-nowrap font-medium">{page.title}</span>
														<span className="ml-auto min-w-0 truncate text-xs text-muted-foreground">
															{page.description}
														</span>
													</CommandItem>
												);
											})}
										</CommandGroup>
									);
								})}
								<CommandSeparator />
								<CommandGroup heading="Actions">
									<CommandItem value="Settings" onSelect={() => handleNavigate('/settings')}>
										<span>Settings</span>
									</CommandItem>
									<CommandItem
										value="Reset All Settings"
										onSelect={() =>
											handleAction(() =>
												window.dispatchEvent(new CustomEvent('reset-all-settings'))
											)
										}
									>
										<span>Reset All Settings</span>
									</CommandItem>
									<CommandItem
										value="Keyboard Shortcuts"
										onSelect={() =>
											handleAction(() =>
												window.dispatchEvent(new CustomEvent('open-shortcuts-help'))
											)
										}
									>
										<span>Keyboard Shortcuts</span>
										<CommandShortcut>{formatShortcut('?')}</CommandShortcut>
									</CommandItem>
								</CommandGroup>
							</CommandList>
						</div>
					)}
				</CommandPrimitive>
			</div>
		);
	}
);

export type TitleBarCommandProps = {
	readonly className?: string;
};
