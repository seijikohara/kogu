/**
 * Renders a Vizel icon name with a Lucide React component.
 *
 * Vizel commands and menu actions carry a semantic `VizelIconName`
 * (`bold`, `heading1`, …). `getVizelIconId` resolves each to an Iconify id,
 * and every default icon in the catalogue is a `lucide:*` id. Rather than pull
 * the whole Iconify runtime, map the `lucide:*` ids to the `lucide-react`
 * components Kogu already depends on. The map is explicit so Vite tree-shakes
 * to only the icons the slash / bubble menus actually use.
 */
import type { ComponentType } from 'react';
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ArrowRightLeft,
	ArrowUp,
	AtSign,
	Baseline,
	Bold,
	Check,
	ChevronDown,
	ChevronRight,
	Circle,
	Clipboard,
	Code,
	Copy,
	CopyPlus,
	Ellipsis,
	ExternalLink,
	GitGraph,
	GripHorizontal,
	GripVertical,
	Heading1,
	Heading2,
	Heading3,
	Heading4,
	Heading5,
	Heading6,
	Highlighter,
	Image,
	ImageUp,
	Italic,
	Link,
	List,
	ListChecks,
	ListOrdered,
	ListTree,
	Loader2,
	MessageSquareWarning,
	Minus,
	Pilcrow,
	Plus,
	Quote,
	Redo2,
	Scissors,
	Sigma,
	Strikethrough,
	Subscript,
	Superscript,
	Table,
	Trash2,
	TriangleAlert,
	Underline,
	Undo2,
	Workflow,
	X,
} from 'lucide-react';
import { getVizelIconId, type VizelIconName } from '@vizel/core';

type IconComponent = ComponentType<{ className?: string }>;

// Keyed by the Lucide id Vizel resolves to (the `lucide:` prefix stripped).
const LUCIDE_BY_ID: Record<string, IconComponent> = {
	'align-center': AlignCenter,
	'align-left': AlignLeft,
	'align-right': AlignRight,
	'arrow-down': ArrowDown,
	'arrow-left': ArrowLeft,
	'arrow-right': ArrowRight,
	'arrow-right-left': ArrowRightLeft,
	'arrow-up': ArrowUp,
	'at-sign': AtSign,
	baseline: Baseline,
	bold: Bold,
	check: Check,
	'chevron-down': ChevronDown,
	'chevron-right': ChevronRight,
	circle: Circle,
	clipboard: Clipboard,
	code: Code,
	copy: Copy,
	'copy-plus': CopyPlus,
	ellipsis: Ellipsis,
	'external-link': ExternalLink,
	'git-graph': GitGraph,
	'grip-horizontal': GripHorizontal,
	'grip-vertical': GripVertical,
	'heading-1': Heading1,
	'heading-2': Heading2,
	'heading-3': Heading3,
	'heading-4': Heading4,
	'heading-5': Heading5,
	'heading-6': Heading6,
	highlighter: Highlighter,
	image: Image,
	'image-up': ImageUp,
	italic: Italic,
	link: Link,
	list: List,
	'list-checks': ListChecks,
	'list-ordered': ListOrdered,
	'list-tree': ListTree,
	'loader-2': Loader2,
	'message-square-warning': MessageSquareWarning,
	minus: Minus,
	pilcrow: Pilcrow,
	plus: Plus,
	quote: Quote,
	'redo-2': Redo2,
	scissors: Scissors,
	sigma: Sigma,
	strikethrough: Strikethrough,
	subscript: Subscript,
	superscript: Superscript,
	table: Table,
	'trash-2': Trash2,
	'alert-triangle': TriangleAlert,
	underline: Underline,
	'undo-2': Undo2,
	workflow: Workflow,
	x: X,
};

interface VizelMenuIconProps {
	readonly name?: VizelIconName;
	readonly className?: string;
}

export function VizelMenuIcon({ name, className = 'h-4 w-4' }: VizelMenuIconProps) {
	// Unknown / unmapped icons fall back to a neutral dot so the row keeps its
	// leading-icon column alignment instead of collapsing.
	const id = name ? getVizelIconId(name).replace(/^lucide:/, '') : '';
	const Icon = LUCIDE_BY_ID[id] ?? Circle;
	return <Icon className={className} />;
}
