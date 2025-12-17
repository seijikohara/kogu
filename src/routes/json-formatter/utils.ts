// Re-export shared utilities for backward compatibility
export {
	copyToClipboard,
	downloadTextFile,
	getFileTypeInfo,
	pasteFromClipboard,
} from '$lib/utils/file-operations.js';

export type { TabStats } from '$lib/utils/tab-manager.svelte.js';
