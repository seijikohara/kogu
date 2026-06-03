/**
 * Folder Tree Visualizer service.
 *
 * Bridges the `folder_walk` / `folder_largest_files` Tauri commands and
 * provides framework-agnostic helpers used by the route: tree
 * flattening for virtualised rendering, ASCII / JSON export, and
 * heatmap-tint selection driven by per-row size ratios.
 */
import { invoke } from '@tauri-apps/api/core';

export interface WalkRequest {
	readonly root: string;
	readonly includeGlobs: readonly string[];
	readonly excludeGlobs: readonly string[];
	readonly maxDepth: number;
	readonly showHidden: boolean;
}

export interface TreeNode {
	readonly name: string;
	readonly path: string;
	readonly isDir: boolean;
	readonly sizeBytes: number;
	readonly modifiedMs: number | null;
	readonly children: readonly TreeNode[];
	readonly truncated: boolean;
}

export interface LargestFile {
	readonly path: string;
	readonly sizeBytes: number;
}

/** Invoke the Tauri command that walks the folder tree. */
export const walkFolder = (opId: string, req: WalkRequest): Promise<TreeNode> =>
	invoke<TreeNode>('folder_walk', { opId, req });

/** Cancel an in-flight folder_walk / folder_largest_files run by its op id. */
export const cancelFolderScan = (opId: string): Promise<boolean> =>
	invoke<boolean>('cancel_op', { opId });

/** Invoke the Tauri command that returns the largest individual files. */
export const findLargestFiles = (
	opId: string,
	root: string,
	limit: number,
	includeGlobs: readonly string[],
	excludeGlobs: readonly string[]
): Promise<readonly LargestFile[]> =>
	invoke<readonly LargestFile[]>('folder_largest_files', {
		opId,
		root,
		limit,
		includeGlobs,
		excludeGlobs,
	});

/** Sort keys exposed to the route's rail. */
export type SortKey = 'name' | 'size' | 'modified';

/** Direction toggle for the sort key. */
export type SortDir = 'asc' | 'desc';

/**
 * Recursively sort a tree by the supplied key. Directories always lead
 * files within the same parent so the tree stays scannable even when
 * sorting by size.
 */
export const sortTree = (root: TreeNode, key: SortKey, dir: SortDir): TreeNode => {
	const compare = (a: TreeNode, b: TreeNode): number => {
		if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
		const base = (() => {
			if (key === 'name') return a.name.localeCompare(b.name, undefined, { numeric: true });
			if (key === 'size') return a.sizeBytes - b.sizeBytes;
			return (a.modifiedMs ?? 0) - (b.modifiedMs ?? 0);
		})();
		return dir === 'asc' ? base : -base;
	};
	const sortedChildren = [...root.children].map((c) => sortTree(c, key, dir)).sort(compare);
	return { ...root, children: sortedChildren };
};

/** Flat row used by the virtual list. `depth` drives indentation. */
export interface FlatRow {
	readonly node: TreeNode;
	readonly depth: number;
	/** Path of the parent — empty string for the root row. */
	readonly parentPath: string;
	/** Ratio of this node's size to the largest sibling in its parent. */
	readonly siblingRatio: number;
}

/**
 * Flatten a tree in pre-order, but only descend into directories that
 * appear in `expanded`. The root row is always included.
 */
export const flattenTree = (root: TreeNode, expanded: ReadonlySet<string>): readonly FlatRow[] => {
	const rows: FlatRow[] = [];
	const visit = (node: TreeNode, depth: number, parentPath: string, siblingMax: number): void => {
		const ratio = siblingMax > 0 ? Math.min(1, node.sizeBytes / siblingMax) : 0;
		rows.push({ node, depth, parentPath, siblingRatio: ratio });
		if (!node.isDir) return;
		if (depth > 0 && !expanded.has(node.path)) return;
		const childMax = node.children.reduce((acc, c) => Math.max(acc, c.sizeBytes), 0);
		for (const child of node.children) {
			visit(child, depth + 1, node.path, childMax);
		}
	};
	visit(root, 0, '', root.sizeBytes);
	return rows;
};

/** Count entries in the subtree (files + directories). */
export const countEntries = (root: TreeNode): { readonly files: number; readonly dirs: number } => {
	let files = 0;
	let dirs = 0;
	const visit = (node: TreeNode) => {
		if (node.isDir) {
			dirs += 1;
			node.children.forEach(visit);
		} else {
			files += 1;
		}
	};
	visit(root);
	// Discount the root directory itself from the dir count when reporting
	// "Directories inside root", but keep the root if the tree is just a
	// file (the Rust side only emits a directory root so this is safe).
	return { files, dirs: Math.max(0, dirs - 1) };
};

/** IEC-style human-readable byte formatter (mirrors `file-inspect.ts`). */
export const humanSize = (bytes: number): string => {
	if (!Number.isFinite(bytes) || bytes < 0) return '—';
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let unit = units[0] ?? 'KB';
	for (let i = 0; i < units.length - 1 && value >= 1024; i += 1) {
		value /= 1024;
		unit = units[i + 1] ?? unit;
	}
	const formatted = value >= 100 ? value.toFixed(0) : value.toFixed(1);
	return `${formatted} ${unit}`;
};

/**
 * Render a tree as a classic ASCII tree (├── / └── / │). Mirrors the
 * output of Unix `tree(1)` so the export is paste-friendly into shell
 * sessions and Markdown.
 */
const childPrefix = (isLast: boolean): string => (isLast ? '    ' : '│   ');

const writeChildLines = (
	child: TreeNode,
	prefix: string,
	isLast: boolean,
	lines: string[]
): void => {
	const connector = isLast ? '└── ' : '├── ';
	const suffix = child.isDir ? '/' : '';
	lines.push(`${prefix}${connector}${child.name}${suffix}`);
	if (!child.isDir) return;
	const nestedPrefix = `${prefix}${childPrefix(isLast)}`;
	if (child.children.length > 0) writeNodeChildren(child, nestedPrefix, lines);
	if (child.truncated) lines.push(`${nestedPrefix}…`);
};

const writeNodeChildren = (node: TreeNode, prefix: string, lines: string[]): void => {
	const children = node.children;
	children.forEach((child, idx) => {
		writeChildLines(child, prefix, idx === children.length - 1, lines);
	});
	if (node.truncated && children.length === 0) lines.push(`${prefix}…`);
};

export const exportAsText = (root: TreeNode): string => {
	const lines: string[] = [`${root.name}/`];
	writeNodeChildren(root, '', lines);
	return lines.join('\n');
};

/** Pretty-printed JSON representation of the tree. */
export const exportAsJson = (root: TreeNode): string => JSON.stringify(root, null, 2);

/**
 * Pick a Tailwind background tint class from a 0..1 size ratio. The
 * ramp uses the existing `info` semantic token so the heatmap remains
 * consistent across themes.
 */
export const ratioToHeatClass = (ratio: number): string => {
	if (!Number.isFinite(ratio) || ratio <= 0) return '';
	if (ratio < 0.05) return 'bg-info/5';
	if (ratio < 0.15) return 'bg-info/10';
	if (ratio < 0.3) return 'bg-info/15';
	if (ratio < 0.5) return 'bg-info/20';
	if (ratio < 0.75) return 'bg-info/25';
	return 'bg-info/30';
};

/** Format a Unix-millisecond timestamp as a locale string. */
export const formatTimestamp = (ms: number | null | undefined): string => {
	if (ms == null || !Number.isFinite(ms)) return '—';
	return new Date(ms).toLocaleString();
};
