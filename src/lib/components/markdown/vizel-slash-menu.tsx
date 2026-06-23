/**
 * Slash command menu for the Vizel editor.
 *
 * Vizel ships no React binding, so this module supplies the
 * `createSlashMenuRenderer` factory the editor instance expects. The factory
 * returns a Tiptap suggestion `render()` that mounts a React popup with its own
 * root, driven by `buildVizelSlashMenuSpecFromCommands`. The `VizelSlashCommand`
 * extension owns `items` / `command` / `char`; this renderer only owns the popup
 * lifecycle and keyboard navigation.
 */
import { createRoot, type Root } from 'react-dom/client';
import type {
	SuggestionKeyDownProps,
	SuggestionOptions,
	SuggestionProps,
} from '@tiptap/suggestion';
import {
	buildVizelSlashMenuSpecFromCommands,
	createVizelSuggestionContainer,
	formatVizelShortcut,
	getNextVizelSlashMenuGroupIndex,
	getVizelSlashCommandLocale,
	handleVizelSuggestionEscape,
	type Editor as VizelEditor,
	type VizelCommand,
	type VizelCommandSpec,
	type VizelMenuItemSpec,
	type VizelMenuSpec,
	type VizelSuggestionContainer,
} from '@vizel/core';
import { cn } from '@/lib/utils';
import { VizelMenuIcon } from './vizel-icon';

type CommandMenuSpec = VizelMenuSpec<VizelCommandSpec>;

const flattenItems = (spec: CommandMenuSpec): readonly VizelMenuItemSpec<VizelCommandSpec>[] =>
	spec.sections.flatMap((section) => section.items);

interface SlashMenuProps {
	readonly spec: CommandMenuSpec;
	readonly selectedIndex: number;
	readonly onSelect: (flatIndex: number) => void;
}

function SlashMenu({ spec, selectedIndex, onSelect }: SlashMenuProps) {
	if (spec.sections.length === 0) {
		return (
			<div className="min-w-[16rem] rounded-md border bg-popover p-3 text-sm text-muted-foreground shadow-md">
				No matching commands
			</div>
		);
	}
	// Running counter assigns each item its flat position across all sections so
	// the keyboard selection (a single flat index) maps to the right row.
	const flatCounter = { value: -1 };
	return (
		<div className="max-h-80 min-w-[16rem] max-w-[20rem] overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
			{spec.sections.map((section) => (
				<div key={section.key}>
					{section.header ? (
						<div className="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							{section.header.label}
						</div>
					) : null}
					{section.items.map((item) => {
						flatCounter.value += 1;
						const flatIndex = flatCounter.value;
						const selected = flatIndex === selectedIndex;
						const { data } = item;
						return (
							<button
								key={item.key}
								type="button"
								// Mouse hover does not drive selection here; click activates
								// directly via the flat index to keep keyboard state simple.
								className={cn(
									'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
									selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
								)}
								onMouseDown={(event) => {
									// Prevent the editor from losing the selection before the
									// command runs.
									event.preventDefault();
									onSelect(flatIndex);
								}}
							>
								<VizelMenuIcon
									name={data.icon}
									className="h-4 w-4 shrink-0 text-muted-foreground"
								/>
								<span className="flex-1 truncate">{data.label}</span>
								{data.shortcut ? (
									<span className="shrink-0 text-xs text-muted-foreground">
										{formatVizelShortcut(data.shortcut)}
									</span>
								) : null}
							</button>
						);
					})}
				</div>
			))}
		</div>
	);
}

/**
 * Build the Tiptap suggestion renderer for the slash menu. Returns only
 * `{ render }`; the extension supplies `items` / `command` / `char`.
 */
export const createReactSlashMenuRenderer = (): Partial<SuggestionOptions<VizelCommand>> => ({
	render: () => {
		// Mutable closure state for one open/close cycle.
		const state: {
			root: Root | null;
			suggestion: VizelSuggestionContainer | null;
			items: readonly VizelCommand[];
			command: ((item: VizelCommand) => void) | null;
			editor: VizelEditor | null;
			query: string;
			selectedIndex: number;
		} = {
			root: null,
			suggestion: null,
			items: [],
			command: null,
			editor: null,
			query: '',
			selectedIndex: 0,
		};

		const buildSpec = (): CommandMenuSpec => {
			if (!state.editor) return { root: {}, sections: [] };
			return buildVizelSlashMenuSpecFromCommands(state.items, {
				editor: state.editor,
				locale: getVizelSlashCommandLocale(state.editor),
				query: state.query,
				selectedIndex: state.selectedIndex,
				showGroups: true,
			});
		};

		const selectByFlatIndex = (flatIndex: number) => {
			const target = flattenItems(buildSpec())[flatIndex];
			if (!target || !state.command) return;
			const command = state.items[target.index];
			if (command) state.command(command);
		};

		const renderMenu = () => {
			if (!state.root) return;
			const spec = buildSpec();
			const flat = flattenItems(spec);
			if (state.selectedIndex >= flat.length) {
				state.selectedIndex = Math.max(0, flat.length - 1);
			}
			state.root.render(
				<SlashMenu spec={spec} selectedIndex={state.selectedIndex} onSelect={selectByFlatIndex} />
			);
		};

		const move = (delta: number) => {
			const total = flattenItems(buildSpec()).length;
			if (total === 0) return;
			state.selectedIndex = (state.selectedIndex + delta + total) % total;
			renderMenu();
		};

		return {
			onStart: (props: SuggestionProps<VizelCommand>) => {
				state.items = props.items;
				state.command = props.command;
				state.editor = props.editor as unknown as VizelEditor;
				state.query = props.query;
				state.selectedIndex = 0;
				state.suggestion = createVizelSuggestionContainer();
				state.root = createRoot(state.suggestion.menuContainer);
				renderMenu();
				state.suggestion.updatePosition(props.clientRect);
			},
			onUpdate: (props: SuggestionProps<VizelCommand>) => {
				state.items = props.items;
				state.command = props.command;
				state.editor = props.editor as unknown as VizelEditor;
				state.query = props.query;
				renderMenu();
				state.suggestion?.updatePosition(props.clientRect);
			},
			onKeyDown: (props: SuggestionKeyDownProps): boolean => {
				if (handleVizelSuggestionEscape(props.event)) {
					return true;
				}
				const { key } = props.event;
				if (key === 'ArrowDown') {
					move(1);
					return true;
				}
				if (key === 'ArrowUp') {
					move(-1);
					return true;
				}
				if (key === 'Enter') {
					selectByFlatIndex(state.selectedIndex);
					return true;
				}
				if (key === 'Tab') {
					state.selectedIndex = getNextVizelSlashMenuGroupIndex(buildSpec(), state.selectedIndex);
					renderMenu();
					return true;
				}
				return false;
			},
			onExit: () => {
				state.root?.unmount();
				state.suggestion?.destroy();
				state.root = null;
				state.suggestion = null;
				state.command = null;
				state.editor = null;
			},
		};
	},
});
