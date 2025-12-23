/**
 * Global state for managing language combobox outside ProseMirror NodeView.
 *
 * This approach solves the bits-ui context issue by keeping the Combobox
 * in normal Svelte context while communicating with NodeView via state.
 */

// Language option type
export interface LanguageOption {
	readonly value: string;
	readonly label: string;
}

// Available languages for syntax highlighting (from lowlight common)
export const LANGUAGES: readonly LanguageOption[] = [
	{ value: '', label: 'Plain Text' },
	{ value: 'bash', label: 'Bash' },
	{ value: 'c', label: 'C' },
	{ value: 'cpp', label: 'C++' },
	{ value: 'csharp', label: 'C#' },
	{ value: 'css', label: 'CSS' },
	{ value: 'diff', label: 'Diff' },
	{ value: 'dot', label: 'GraphViz (DOT)' },
	{ value: 'go', label: 'Go' },
	{ value: 'graphql', label: 'GraphQL' },
	{ value: 'graphviz', label: 'GraphViz' },
	{ value: 'ini', label: 'INI' },
	{ value: 'java', label: 'Java' },
	{ value: 'javascript', label: 'JavaScript' },
	{ value: 'json', label: 'JSON' },
	{ value: 'kotlin', label: 'Kotlin' },
	{ value: 'less', label: 'Less' },
	{ value: 'lua', label: 'Lua' },
	{ value: 'makefile', label: 'Makefile' },
	{ value: 'markdown', label: 'Markdown' },
	{ value: 'mermaid', label: 'Mermaid' },
	{ value: 'objectivec', label: 'Objective-C' },
	{ value: 'perl', label: 'Perl' },
	{ value: 'php', label: 'PHP' },
	{ value: 'plantuml', label: 'PlantUML' },
	{ value: 'python', label: 'Python' },
	{ value: 'r', label: 'R' },
	{ value: 'ruby', label: 'Ruby' },
	{ value: 'rust', label: 'Rust' },
	{ value: 'scss', label: 'SCSS' },
	{ value: 'shell', label: 'Shell' },
	{ value: 'sql', label: 'SQL' },
	{ value: 'swift', label: 'Swift' },
	{ value: 'typescript', label: 'TypeScript' },
	{ value: 'wasm', label: 'WebAssembly' },
	{ value: 'xml', label: 'XML' },
	{ value: 'yaml', label: 'YAML' },
] as const;

// State for the active language selector - using class with reactive properties
class LanguageComboboxStore {
	isOpen = $state(false);
	anchorRect = $state<DOMRect | null>(null);
	currentValue = $state('');
	private onSelectCallback: ((value: string) => void) | null = null;

	open(anchorElement: HTMLElement, currentValue: string, onSelect: (value: string) => void): void {
		this.anchorRect = anchorElement.getBoundingClientRect();
		this.currentValue = currentValue;
		this.onSelectCallback = onSelect;
		this.isOpen = true;
	}

	close(): void {
		this.isOpen = false;
		this.anchorRect = null;
		this.onSelectCallback = null;
	}

	select(value: string): void {
		this.onSelectCallback?.(value);
		this.close();
	}
}

// Singleton store instance
export const languageComboboxStore = new LanguageComboboxStore();

/**
 * Open the language combobox for a specific code block.
 * Called from NodeView when user clicks the language trigger.
 */
export const openLanguageCombobox = (
	anchorElement: HTMLElement,
	currentValue: string,
	onSelect: (value: string) => void
): void => {
	languageComboboxStore.open(anchorElement, currentValue, onSelect);
};

/**
 * Close the language combobox.
 */
export const closeLanguageCombobox = (): void => {
	languageComboboxStore.close();
};

/**
 * Select a language value and close the combobox.
 */
export const selectLanguage = (value: string): void => {
	languageComboboxStore.select(value);
};
