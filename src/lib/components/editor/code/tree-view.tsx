import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
	Braces,
	Brackets,
	Check,
	ChevronRight,
	CircleSlash,
	Code,
	Copy,
	Database,
	FileCode,
	FileText,
	Hash,
	Heading,
	List,
	ListChecks,
	type LucideIcon,
	Minus,
	Pilcrow,
	Quote,
	Table,
	Tag,
	Terminal,
	ToggleLeft,
	Type,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/lib/components/ui/button';
import { ListItemButton } from '@/lib/components/ui/list-item-button';
import { IconTooltip } from '@/lib/components/ui/icon-tooltip';
import type { AstNode, AstNodeType } from '@/lib/services/ast';

const TYPE_ICON_MAP: Partial<Record<AstNodeType, LucideIcon>> = {
	root: FileCode,
	object: Braces,
	array: Brackets,
	property: Code,
	string: Type,
	number: Hash,
	boolean: ToggleLeft,
	null: CircleSlash,
	element: Tag,
	attribute: Code,
	text: Type,
	comment: Code,
	statement: Database,
	clause: Terminal,
	expression: Code,
	identifier: Type,
	literal: Hash,
	operator: Code,
	keyword: Terminal,
	function: Code,
	document: FileText,
	heading: Heading,
	paragraph: Pilcrow,
	code_block: Code,
	blockquote: Quote,
	list: List,
	list_item: Minus,
	task_item: ListChecks,
	table: Table,
	table_row: Minus,
	horizontal_rule: Minus,
};

interface TypeStyle {
	readonly text: string;
	readonly bg: string;
	readonly icon: string;
}

const getTypeStyles = (t: AstNodeType): TypeStyle => {
	switch (t) {
		case 'string':
		case 'paragraph':
		case 'text':
			return {
				text: 'text-syntax-string',
				bg: 'bg-syntax-string/10',
				icon: 'text-syntax-string',
			};
		case 'number':
		case 'literal':
			return {
				text: 'text-syntax-number',
				bg: 'bg-syntax-number/10',
				icon: 'text-syntax-number',
			};
		case 'boolean':
		case 'table':
		case 'table_row':
			return {
				text: 'text-syntax-boolean',
				bg: 'bg-syntax-boolean/10',
				icon: 'text-syntax-boolean',
			};
		case 'null':
		case 'horizontal_rule':
			return {
				text: 'text-syntax-null',
				bg: 'bg-syntax-null/10',
				icon: 'text-syntax-null',
			};
		case 'object':
		case 'element':
		case 'code_block':
			return {
				text: 'text-syntax-object',
				bg: 'bg-syntax-object/10',
				icon: 'text-syntax-object',
			};
		case 'array':
		case 'list':
		case 'list_item':
			return {
				text: 'text-syntax-array',
				bg: 'bg-syntax-array/10',
				icon: 'text-syntax-array',
			};
		case 'root':
		case 'document':
			return {
				text: 'text-syntax-root',
				bg: 'bg-syntax-root/10',
				icon: 'text-syntax-root',
			};
		case 'statement':
		case 'heading':
			return {
				text: 'text-syntax-statement',
				bg: 'bg-syntax-statement/10',
				icon: 'text-syntax-statement',
			};
		case 'clause':
		case 'keyword':
		case 'blockquote':
			return {
				text: 'text-syntax-clause',
				bg: 'bg-syntax-clause/10',
				icon: 'text-syntax-clause',
			};
		case 'expression':
		case 'operator':
			return {
				text: 'text-syntax-expression',
				bg: 'bg-syntax-expression/10',
				icon: 'text-syntax-expression',
			};
		case 'identifier':
		case 'function':
		case 'task_item':
			return {
				text: 'text-syntax-identifier',
				bg: 'bg-syntax-identifier/10',
				icon: 'text-syntax-identifier',
			};
		case 'property':
		case 'attribute':
			return {
				text: 'text-syntax-property',
				bg: 'bg-syntax-property/10',
				icon: 'text-syntax-property',
			};
		default:
			return {
				text: 'text-foreground',
				bg: 'bg-muted',
				icon: 'text-muted-foreground',
			};
	}
};

const formatValue = (raw: unknown): string | null => {
	if (raw === undefined) return null;
	if (raw === null) return 'null';
	if (typeof raw === 'string') {
		const maxLen = 100;
		if (raw.length > maxLen) {
			return `"${raw.slice(0, maxLen)}…"`;
		}
		return `"${raw}"`;
	}
	return String(raw);
};

const getVisibleTreeItems = (el: HTMLElement): HTMLElement[] => {
	const root = el.closest('[role="tree"]') ?? document.body;
	return Array.from(root.querySelectorAll<HTMLElement>('[role="treeitem"]'));
};

const focusSiblingItem = (target: HTMLElement, delta: number) => {
	const items = getVisibleTreeItems(target);
	const idx = items.indexOf(target);
	items[idx + delta]?.focus();
};

const focusEdgeItem = (target: HTMLElement, edge: 'first' | 'last') => {
	const items = getVisibleTreeItems(target);
	const next = edge === 'first' ? items[0] : items[items.length - 1];
	next?.focus();
};

interface RowContentProps {
	readonly node: AstNode;
	readonly hasChildren: boolean;
	readonly styles: TypeStyle;
	readonly displayValue: string | null;
	readonly badgeText: string;
}

function RowContent({ node, hasChildren, styles, displayValue, badgeText }: RowContentProps) {
	const badgeClass = `rounded px-1.5 py-0.5 text-xs font-medium tracking-wide uppercase ${styles.bg} ${styles.text}`;
	if (hasChildren) {
		return (
			<>
				{node.label && node.type !== 'root' ? (
					<>
						<span className="font-medium text-foreground">{node.label}</span>
						<span className="text-muted-foreground">:</span>
					</>
				) : null}
				<span className={badgeClass}>{badgeText}</span>
			</>
		);
	}
	return (
		<>
			{node.label ? (
				<>
					<span className="font-medium text-foreground">{node.label}</span>
					{displayValue ? <span className="text-muted-foreground">:</span> : null}
				</>
			) : null}
			{displayValue ? (
				<span className={`truncate ${styles.text}`} title={displayValue}>
					{displayValue}
				</span>
			) : (
				<span className={badgeClass}>{node.type}</span>
			)}
		</>
	);
}

export function TreeView({
	node,
	expanded: expandedProp,
	level = 0,
	maxInitialDepth = 3,
	selectedPath = null,
	onSelect,
}: TreeViewProps) {
	const hasChildren = !!node.children && node.children.length > 0;
	const [expandedState, setExpandedState] = useState<boolean>(expandedProp ?? true);
	const expanded = expandedProp ?? expandedState;
	const setExpanded = (next: boolean) => setExpandedState(next);

	const [justCopied, setJustCopied] = useState<string | null>(null);
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		return () => {
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		};
	}, []);

	const TypeIcon = useMemo<LucideIcon>(() => TYPE_ICON_MAP[node.type] ?? Code, [node.type]);
	const styles = useMemo(() => getTypeStyles(node.type), [node.type]);
	const displayValue = useMemo(() => formatValue(node.value), [node.value]);

	const initialExpandedStates = useMemo<Record<string, boolean>>(
		() =>
			Object.fromEntries(
				(node.children ?? []).map((_child, i) => [String(i), level + 1 < maxInitialDepth])
			),
		[node.children, level, maxInitialDepth]
	);

	const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});
	useEffect(() => {
		setExpandedStates((prev) => {
			// Compute the diff first; only allocate a new object when at least
			// one initial key is missing. reduce avoids the `changed` let flag.
			const missingKeys = Object.keys(initialExpandedStates).filter((key) => !(key in prev));
			if (missingKeys.length === 0) return prev;
			return missingKeys.reduce<Record<string, boolean>>(
				(acc, key) => {
					acc[key] = initialExpandedStates[key] ?? false;
					return acc;
				},
				{ ...prev }
			);
		});
	}, [initialExpandedStates]);

	const getChildExpanded = (index: number): boolean => {
		const key = String(index);
		if (key in expandedStates) return expandedStates[key] ?? false;
		return level + 1 < maxInitialDepth;
	};

	const childCount = node.children?.length ?? 0;
	const getBadgeText = (): string => {
		switch (node.type) {
			case 'array':
				return `array[${childCount}]`;
			case 'object':
				return `object{${childCount}}`;
			case 'element':
				return `<${node.label}>`;
			case 'statement':
				return node.label;
			case 'clause':
				return node.label.toUpperCase();
			case 'root':
				return `root(${childCount})`;
			case 'document':
				return `doc(${childCount})`;
			case 'heading':
				return node.label;
			case 'list':
				return `list[${childCount}]`;
			case 'table':
				return `table(${childCount})`;
			case 'blockquote':
				return `quote(${childCount})`;
			default:
				return hasChildren ? `${node.type}(${childCount})` : node.type;
		}
	};

	const isSelected = selectedPath === node.path;
	const chevronLabel = expanded ? 'Collapse' : 'Expand';

	const handleClick = () => {
		onSelect?.(node.path, node);
	};

	const handleCopyValue = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		try {
			const text =
				node.value !== undefined
					? typeof node.value === 'string'
						? node.value
						: JSON.stringify(node.value, null, 2)
					: node.label;
			await navigator.clipboard.writeText(text);
			setJustCopied(node.path);
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
			copyTimerRef.current = setTimeout(() => setJustCopied(null), 1500);
		} catch {
			toast.error('Copy failed');
		}
	};

	const handleCopyPath = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(node.path);
			toast.success(`Copied: ${node.path}`);
		} catch {
			toast.error('Copy failed');
		}
	};

	const handleTreeKeydown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
		const target = e.currentTarget;
		const handlers: Record<string, () => void> = {
			ArrowRight: () => {
				if (!hasChildren || expanded) return;
				e.preventDefault();
				e.stopPropagation();
				setExpanded(true);
			},
			ArrowLeft: () => {
				if (!hasChildren || !expanded) return;
				e.preventDefault();
				e.stopPropagation();
				setExpanded(false);
			},
			ArrowDown: () => {
				e.preventDefault();
				e.stopPropagation();
				focusSiblingItem(target, 1);
			},
			ArrowUp: () => {
				e.preventDefault();
				e.stopPropagation();
				focusSiblingItem(target, -1);
			},
			Home: () => {
				e.preventDefault();
				e.stopPropagation();
				focusEdgeItem(target, 'first');
			},
			End: () => {
				e.preventDefault();
				e.stopPropagation();
				focusEdgeItem(target, 'last');
			},
			Enter: () => {
				e.stopPropagation();
				handleClick();
			},
		};
		handlers[e.key]?.();
	};

	// CSS variable propagates depth so the row and chevron share one numeric source of truth.
	const wrapperStyle = {
		'--tree-depth': level,
		paddingLeft: 'calc(var(--tree-depth) * 16px)',
	} as CSSProperties;

	return (
		<>
			<div
				className="group/tree relative select-none font-mono text-sm leading-[1.5]"
				style={wrapperStyle}
			>
				{hasChildren ? (
					<IconTooltip label={chevronLabel}>
						<Button
							variant="ghost"
							size="icon-sm"
							className="absolute top-1/2 left-[calc(var(--tree-depth)*16px+4px)] z-10 h-5 w-5 -translate-y-1/2 rounded transition-all hover:bg-muted-foreground/20"
							tabIndex={-1}
							onClick={(e) => {
								e.stopPropagation();
								setExpanded(!expanded);
							}}
						>
							<ChevronRight
								className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
							/>
							<span className="sr-only">{chevronLabel}</span>
						</Button>
					</IconTooltip>
				) : null}

				<ListItemButton
					variant="tree-node"
					size="sm"
					selected={isSelected}
					role="treeitem"
					aria-expanded={hasChildren ? expanded : undefined}
					tabIndex={isSelected ? 0 : -1}
					className={hasChildren ? 'pl-7' : ''}
					onClick={handleClick}
					onKeyDown={handleTreeKeydown}
					leading={
						<>
							{!hasChildren ? <span className="h-5 w-5 shrink-0" /> : null}
							<span
								className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${styles.bg}`}
							>
								<TypeIcon className={`h-3 w-3 ${styles.icon}`} />
							</span>
						</>
					}
				>
					<RowContent
						node={node}
						hasChildren={hasChildren}
						styles={styles}
						displayValue={displayValue}
						badgeText={getBadgeText()}
					/>
				</ListItemButton>

				<div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/tree:opacity-100">
					<IconTooltip label="Copy path">
						<Button
							variant="ghost"
							size="icon-sm"
							className="h-5 w-5 text-muted-foreground hover:bg-muted hover:text-foreground"
							tabIndex={-1}
							onClick={handleCopyPath}
						>
							<span className="font-mono text-xs">$</span>
							<span className="sr-only">Copy path</span>
						</Button>
					</IconTooltip>
					<IconTooltip label="Copy value">
						<Button
							variant="ghost"
							size="icon-sm"
							className="h-5 w-5 text-muted-foreground hover:bg-muted hover:text-foreground"
							tabIndex={-1}
							onClick={handleCopyValue}
						>
							{justCopied === node.path ? (
								<Check className="h-3 w-3 text-success" />
							) : (
								<Copy className="h-3 w-3" />
							)}
							<span className="sr-only">Copy value</span>
						</Button>
					</IconTooltip>
				</div>
			</div>

			{hasChildren && expanded ? (
				// biome-ignore lint/a11y/useSemanticElements: WAI-ARIA tree pattern requires role="group" on the descendant container of a treeitem; <fieldset> is incorrect here.
				<div role="group" className="relative ml-2.5 border-l border-border/50 pl-0.5">
					{(node.children ?? []).map((child, index) => (
						<TreeView
							key={child.path}
							node={child}
							level={level + 1}
							maxInitialDepth={maxInitialDepth}
							selectedPath={selectedPath}
							onSelect={onSelect}
							expanded={getChildExpanded(index)}
						/>
					))}
				</div>
			) : null}
		</>
	);
}

export type TreeViewProps = {
	readonly node: AstNode;
	readonly expanded?: boolean;
	readonly level?: number;
	readonly maxInitialDepth?: number;
	readonly selectedPath?: string | null;
	readonly onSelect?: (path: string, node: AstNode) => void;
};
