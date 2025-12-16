import { toast } from 'svelte-sonner';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';

// ============================================================================
// Types
// ============================================================================

interface FileTypeInfo {
	description: string;
	mimeType: string;
	extensions: string[];
}

// ============================================================================
// Constants
// ============================================================================

const FILE_TYPE_MAP = {
	json: { description: 'JSON file', mimeType: 'application/json', extensions: ['.json'] },
	yaml: { description: 'YAML file', mimeType: 'text/yaml', extensions: ['.yaml', '.yml'] },
	yml: { description: 'YAML file', mimeType: 'text/yaml', extensions: ['.yaml', '.yml'] },
	xml: { description: 'XML file', mimeType: 'application/xml', extensions: ['.xml'] },
	ts: { description: 'TypeScript file', mimeType: 'text/typescript', extensions: ['.ts'] },
	js: { description: 'JavaScript file', mimeType: 'text/javascript', extensions: ['.js'] },
	go: { description: 'Go file', mimeType: 'text/x-go', extensions: ['.go'] },
	py: { description: 'Python file', mimeType: 'text/x-python', extensions: ['.py'] },
	rs: { description: 'Rust file', mimeType: 'text/x-rust', extensions: ['.rs'] },
	java: { description: 'Java file', mimeType: 'text/x-java', extensions: ['.java'] },
	cs: { description: 'C# file', mimeType: 'text/x-csharp', extensions: ['.cs'] },
	kt: { description: 'Kotlin file', mimeType: 'text/x-kotlin', extensions: ['.kt'] },
	swift: { description: 'Swift file', mimeType: 'text/x-swift', extensions: ['.swift'] },
	php: { description: 'PHP file', mimeType: 'text/x-php', extensions: ['.php'] },
} as const satisfies Record<string, FileTypeInfo>;

const DEFAULT_FILE_TYPE = {
	description: 'Text file',
	mimeType: 'text/plain',
	extensions: ['.txt'],
} as const satisfies FileTypeInfo;

// ============================================================================
// File Type Utilities
// ============================================================================

type FileExtension = keyof typeof FILE_TYPE_MAP;

const isKnownExtension = (ext: string): ext is FileExtension => ext in FILE_TYPE_MAP;

export const getFileTypeInfo = (filename: string): FileTypeInfo => {
	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	if (!isKnownExtension(ext)) return DEFAULT_FILE_TYPE;
	return FILE_TYPE_MAP[ext];
};

// ============================================================================
// File System Access API Helpers
// ============================================================================

const hasFileSystemAccessAPI = (): boolean => 'showSaveFilePicker' in window;

const saveWithFileSystemAPI = async (
	content: string,
	filename: string,
	fileInfo: FileTypeInfo
): Promise<void> => {
	const options = {
		suggestedName: filename,
		types: [
			{
				description: fileInfo.description,
				accept: { [fileInfo.mimeType]: fileInfo.extensions },
			},
		],
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const handle = await (window as any).showSaveFilePicker(options);
	const writable = await handle.createWritable();
	await writable.write(content);
	await writable.close();
	toast.success(`Saved ${handle.name}`);
};

const saveWithFallback = (content: string, filename: string, fileInfo: FileTypeInfo): void => {
	const blob = new Blob([content], { type: fileInfo.mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
	toast.success(`Downloaded ${filename}`);
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Download text content as a file.
 */
export const downloadTextFile = async (content: string, filename: string): Promise<void> => {
	const fileInfo = getFileTypeInfo(filename);

	if (!hasFileSystemAccessAPI()) {
		saveWithFallback(content, filename, fileInfo);
		return;
	}

	try {
		await saveWithFileSystemAPI(content, filename, fileInfo);
	} catch (e) {
		if (e instanceof Error && e.name === 'AbortError') return;
		toast.error('Save failed');
	}
};

/**
 * Copy text content to clipboard.
 */
export const copyToClipboard = async (content: string): Promise<void> => {
	if (!content) return;

	try {
		await writeText(content);
		toast.success('Copied');
	} catch {
		toast.error('Copy failed');
	}
};

/**
 * Paste text content from clipboard.
 */
export const pasteFromClipboard = async (): Promise<string | null> => {
	try {
		const text = await readText();
		toast.success('Pasted');
		return text;
	} catch {
		toast.error('Paste failed');
		return null;
	}
};
