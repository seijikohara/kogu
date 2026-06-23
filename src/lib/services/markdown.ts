/**
 * Markdown processing utilities.
 * Provides pure functions for parsing and manipulating Markdown content.
 * Supports TeX/LaTeX math expressions and diagrams (Mermaid, PlantUML, GraphViz).
 */

import {
	type DiagramRenderResult,
	detectDiagramType,
	renderDiagram,
	renderTex,
} from './diagram.js';

// Types
export interface TocItem {
	readonly id: string;
	readonly level: number;
	readonly text: string;
	readonly line: number;
	readonly children: readonly TocItem[];
}

export interface MarkdownStats {
	readonly chars: number;
	readonly words: number;
	readonly lines: number;
	readonly paragraphs: number;
	readonly headers: number;
	readonly links: number;
	readonly images: number;
	readonly codeBlocks: number;
}

export interface FormatAction {
	readonly type:
		| 'bold'
		| 'italic'
		| 'strikethrough'
		| 'code'
		| 'link'
		| 'image'
		| 'heading1'
		| 'heading2'
		| 'heading3'
		| 'heading4'
		| 'heading5'
		| 'heading6'
		| 'quote'
		| 'bullet'
		| 'numbered'
		| 'task'
		| 'hr'
		| 'codeblock'
		| 'table'
		| 'clearFormat';
	readonly prefix: string;
	readonly suffix: string;
	readonly placeholder: string;
}

// Constants

// Shared skeleton for the per-flavor samples: formatting, a heading, a quote, a
// code block, math, and a diagram — all flavor-independent. `distinctive` adds
// the syntax that the selected flavor renders idiomatically.
const buildFlavorSample = (title: string, distinctive: string): string =>
	`# ${title}

Text supports **bold**, _italic_, \`inline code\`, and a [link](https://example.com).

## Headings

### A subsection

> A short blockquote for context.

## Code

\`\`\`ts
const greet = (name: string) => \`Hello, \${name}\`;
\`\`\`

## Math

Inline $a^2 + b^2 = c^2$ and a display block:

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

## Diagram

\`\`\`mermaid
flowchart LR
  A[Edit] --> B[Preview]
\`\`\`

${distinctive}
`;

/**
 * Per-flavor sample documents. Each pairs the shared skeleton with the syntax
 * the selected Vizel flavor serializes idiomatically, so loading a sample after
 * picking a flavor demonstrates that flavor's distinctive Markdown.
 */
export const SAMPLE_MARKDOWN_BY_FLAVOR = {
	commonmark: buildFlavorSample(
		'CommonMark Sample',
		`## Lists

1. Ordered item
2. Second item
   - Nested bullet
   - Another nested bullet

---

CommonMark keeps to the core syntax: headings, emphasis, lists, blockquotes, code, links, images, and thematic breaks.`
	),
	gfm: buildFlavorSample(
		'GitHub Flavored Markdown Sample',
		`## Task List

- [x] Build the editor
- [ ] Write the docs

## Table

| Feature     | Supported     |
| ----------- | ------------- |
| Tables      | Yes           |
| Task lists  | Yes           |
| ~~Old way~~ | Strikethrough |

## Alerts

> [!NOTE]
> GitHub-style alerts are a GFM extension.

> [!WARNING]
> Use them sparingly.`
	),
	obsidian: buildFlavorSample(
		'Obsidian Sample',
		`## Wiki Links

Link to [[Getting Started]], or use an alias with [[Reference Guide|the reference]].

## Callouts

> [!note]
> Linked notes form a knowledge graph.

> [!tip]
> Wrap a page name in [[double brackets]] to link it.`
	),
	docusaurus: buildFlavorSample(
		'Docusaurus Sample',
		`## Admonitions

:::note
General information worth highlighting.
:::

:::tip
A helpful tip for the reader.
:::

:::warning
Proceed with caution here.
:::`
	),
	pandoc: buildFlavorSample(
		'Pandoc Sample',
		`## Footnotes

Pandoc adds footnotes[^1] to the prose.

[^1]: And the footnote text lives down here.

## Definition List

Markdown
: A lightweight markup language.

Pandoc
: A universal document converter.

## Sub / Superscript

Water is H~2~O, and energy scales like x^2^.`
	),
} as const satisfies Record<string, string>;

// Backward-compatible default sample (GitHub Flavored Markdown).
export const SAMPLE_MARKDOWN = SAMPLE_MARKDOWN_BY_FLAVOR.gfm;

export const FORMAT_ACTIONS: Record<FormatAction['type'], FormatAction> = {
	bold: { type: 'bold', prefix: '**', suffix: '**', placeholder: 'bold text' },
	italic: { type: 'italic', prefix: '*', suffix: '*', placeholder: 'italic text' },
	strikethrough: {
		type: 'strikethrough',
		prefix: '~~',
		suffix: '~~',
		placeholder: 'strikethrough text',
	},
	code: { type: 'code', prefix: '`', suffix: '`', placeholder: 'code' },
	link: { type: 'link', prefix: '[', suffix: '](url)', placeholder: 'link text' },
	image: { type: 'image', prefix: '![', suffix: '](url)', placeholder: 'alt text' },
	heading1: { type: 'heading1', prefix: '# ', suffix: '', placeholder: 'Heading 1' },
	heading2: { type: 'heading2', prefix: '## ', suffix: '', placeholder: 'Heading 2' },
	heading3: { type: 'heading3', prefix: '### ', suffix: '', placeholder: 'Heading 3' },
	heading4: { type: 'heading4', prefix: '#### ', suffix: '', placeholder: 'Heading 4' },
	heading5: { type: 'heading5', prefix: '##### ', suffix: '', placeholder: 'Heading 5' },
	heading6: { type: 'heading6', prefix: '###### ', suffix: '', placeholder: 'Heading 6' },
	quote: { type: 'quote', prefix: '> ', suffix: '', placeholder: 'quote' },
	bullet: { type: 'bullet', prefix: '- ', suffix: '', placeholder: 'list item' },
	numbered: { type: 'numbered', prefix: '1. ', suffix: '', placeholder: 'list item' },
	task: { type: 'task', prefix: '- [ ] ', suffix: '', placeholder: 'task' },
	hr: {
		type: 'hr',
		prefix: `
---
`,
		suffix: '',
		placeholder: '',
	},
	codeblock: {
		type: 'codeblock',
		prefix: `\`\`\`
`,
		suffix: `
\`\`\``,
		placeholder: 'code',
	},
	table: {
		type: 'table',
		prefix: `
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| `,
		suffix: ` |  |  |
`,
		placeholder: 'Cell',
	},
	clearFormat: { type: 'clearFormat', prefix: '', suffix: '', placeholder: '' },
};

// Pure functions

/**
 * Generate a slug from heading text for anchor links.
 */
const generateSlug = (text: string): string =>
	text
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();

/**
 * Escape HTML special characters.
 */
const escapeHtml = (text: string): string =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

/**
 * Extract headings from markdown text.
 */
interface HeadingInfo {
	readonly level: number;
	readonly text: string;
	readonly id: string;
	readonly line: number;
}

const extractHeadings = (markdown: string): readonly HeadingInfo[] => {
	const headingRegex = /^(#{1,6})\s+(.+)$/gm;
	const matches = Array.from(markdown.matchAll(headingRegex));

	// Calculate line number from character offset
	const getLineNumber = (offset: number): number => {
		const textBefore = markdown.slice(0, offset);
		return textBefore.split('\n').length;
	};

	const { headings } = matches.reduce<{
		headings: HeadingInfo[];
		idCounts: Map<string, number>;
	}>(
		(acc, match) => {
			const hashPart = match[1];
			const textPart = match[2];
			if (!hashPart || !textPart) return acc;

			const level = hashPart.length;
			const text = textPart.trim();
			const baseId = generateSlug(text);
			const line = match.index !== undefined ? getLineNumber(match.index) : 1;

			// Handle duplicate IDs
			const count = acc.idCounts.get(baseId) ?? 0;
			const id = count > 0 ? `${baseId}-${count}` : baseId;
			acc.idCounts.set(baseId, count + 1);

			acc.headings.push({ level, text, id, line });
			return acc;
		},
		{ headings: [], idCounts: new Map<string, number>() }
	);

	return headings;
};

/**
 * Build TOC tree from flat headings list.
 */
const buildTocTree = (headings: readonly HeadingInfo[]): readonly TocItem[] => {
	const root: TocItem[] = [];
	const stack: { item: TocItem; level: number }[] = [];

	headings.forEach((heading) => {
		const item: TocItem = {
			id: heading.id,
			level: heading.level,
			text: heading.text,
			line: heading.line,
			children: [],
		};

		// Find parent
		while (stack.length > 0) {
			const last = stack[stack.length - 1];
			if (!last || last.level < heading.level) break;
			stack.pop();
		}

		if (stack.length === 0) {
			root.push(item);
		} else {
			const parentEntry = stack[stack.length - 1];
			if (parentEntry) {
				(parentEntry.item.children as TocItem[]).push(item);
			}
		}

		stack.push({ item, level: heading.level });
	});

	return root;
};

/**
 * Generate Table of Contents from markdown.
 */
export const generateToc = (markdown: string): readonly TocItem[] => {
	const headings = extractHeadings(markdown);
	return buildTocTree(headings);
};

// Code block placeholder for async rendering
interface CodeBlockPlaceholder {
	readonly id: string;
	readonly language: string;
	readonly code: string;
	readonly isDiagram: boolean;
}

/**
 * Convert markdown to HTML (basic synchronous implementation).
 * For TeX and diagram support, use markdownToHtmlAsync instead.
 */
export const markdownToHtml = (markdown: string): string => {
	// Apply transforms as a const pipeline. Each step receives the previous
	// output and returns a new string; reduce composes them in order.
	type Transform = (input: string) => string;
	const transforms: readonly Transform[] = [
		// Code blocks (must be processed first to prevent other transformations)
		(input) =>
			input.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
				const langClass = lang ? ` class="language-${lang}"` : '';
				return `<pre><code${langClass}>${code.trim()}</code></pre>`;
			}),
		// Inline code
		(input) => input.replace(/`([^`]+)`/g, '<code>$1</code>'),
		// Headers
		(input) => input.replace(/^###### (.+)$/gm, '<h6>$1</h6>'),
		(input) => input.replace(/^##### (.+)$/gm, '<h5>$1</h5>'),
		(input) => input.replace(/^#### (.+)$/gm, '<h4>$1</h4>'),
		(input) => input.replace(/^### (.+)$/gm, '<h3>$1</h3>'),
		(input) => input.replace(/^## (.+)$/gm, '<h2>$1</h2>'),
		(input) => input.replace(/^# (.+)$/gm, '<h1>$1</h1>'),
		// Horizontal rule
		(input) => input.replace(/^---$/gm, '<hr>'),
		// Bold and italic
		(input) => input.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>'),
		(input) => input.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'),
		(input) => input.replace(/\*(.+?)\*/g, '<em>$1</em>'),
		(input) => input.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>'),
		(input) => input.replace(/__(.+?)__/g, '<strong>$1</strong>'),
		(input) => input.replace(/_(.+?)_/g, '<em>$1</em>'),
		// Strikethrough
		(input) => input.replace(/~~(.+?)~~/g, '<del>$1</del>'),
		// Links and images
		(input) => input.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">'),
		(input) =>
			input.replace(
				/\[([^\]]+)\]\(([^)]+)\)/g,
				'<a href="$2" target="_blank" rel="noopener">$1</a>'
			),
		// Blockquotes
		(input) => input.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>'),
		// Task lists
		(input) =>
			input.replace(
				/^- \[x\] (.+)$/gm,
				'<li class="task-item checked"><input type="checkbox" checked disabled> $1</li>'
			),
		(input) =>
			input.replace(
				/^- \[ \] (.+)$/gm,
				'<li class="task-item"><input type="checkbox" disabled> $1</li>'
			),
		// Unordered lists
		(input) => input.replace(/^- (.+)$/gm, '<li>$1</li>'),
		(input) => input.replace(/^\* (.+)$/gm, '<li>$1</li>'),
		// Ordered lists
		(input) => input.replace(/^\d+\. (.+)$/gm, '<li>$1</li>'),
		// Wrap consecutive list items in ul/ol (simplified)
		(input) =>
			input.replace(/(<li>[\s\S]*?<\/li>)(\n<li>[\s\S]*?<\/li>)*/g, (match) =>
				match.includes('task-item') ? `<ul class="task-list">${match}</ul>` : `<ul>${match}</ul>`
			),
		// Paragraphs (wrap text blocks)
		(input) =>
			input
				.split('\n\n')
				.map((block) => {
					const trimmed = block.trim();
					if (!trimmed) return '';
					// Skip if already wrapped in a block element.
					if (
						trimmed.startsWith('<h') ||
						trimmed.startsWith('<ul') ||
						trimmed.startsWith('<ol') ||
						trimmed.startsWith('<pre') ||
						trimmed.startsWith('<blockquote') ||
						trimmed.startsWith('<hr')
					) {
						return trimmed;
					}
					return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
				})
				.join('\n'),
	];

	return transforms.reduce((acc, transform) => transform(acc), escapeHtml(markdown));
};

/**
 * Get markdown statistics.
 */
export const getMarkdownStats = (markdown: string): MarkdownStats => {
	const text = markdown.trim();

	// Count various elements
	const headerMatches = text.match(/^#{1,6}\s+.+$/gm);
	const linkMatches = text.match(/\[([^\]]+)\]\(([^)]+)\)/g);
	const imageMatches = text.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
	const codeBlockMatches = text.match(/```[\s\S]*?```/g);
	const paragraphMatches = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

	// Word count (excluding code blocks)
	const textWithoutCode = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
	const words = textWithoutCode
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0);

	return {
		chars: text.length,
		words: words.length,
		lines: text ? text.split('\n').length : 0,
		paragraphs: paragraphMatches.length,
		headers: headerMatches?.length ?? 0,
		links: linkMatches?.length ?? 0,
		images: imageMatches?.length ?? 0,
		codeBlocks: codeBlockMatches?.length ?? 0,
	};
};

/**
 * Apply formatting to selected text.
 */
export interface FormatResult {
	readonly text: string;
	readonly selectionStart: number;
	readonly selectionEnd: number;
}

export const applyFormat = (
	text: string,
	selectionStart: number,
	selectionEnd: number,
	action: FormatAction['type']
): FormatResult => {
	const format = FORMAT_ACTIONS[action];
	const selectedText = text.substring(selectionStart, selectionEnd);
	const textToInsert = selectedText || format.placeholder;
	const formattedText = `${format.prefix}${textToInsert}${format.suffix}`;

	const newText = text.substring(0, selectionStart) + formattedText + text.substring(selectionEnd);

	// Calculate new cursor position
	const newStart = selectionStart + format.prefix.length;
	const newEnd = newStart + textToInsert.length;

	return {
		text: newText,
		selectionStart: newStart,
		selectionEnd: newEnd,
	};
};

/**
 * Export markdown to different formats.
 */
export const exportAsHtml = (markdown: string, title = 'Markdown Export'): string => {
	const htmlContent = markdownToHtml(markdown);
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
        }
        pre {
            background: #f4f4f4;
            padding: 1rem;
            overflow-x: auto;
            border-radius: 4px;
        }
        code {
            background: #f4f4f4;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', monospace;
        }
        pre code {
            background: none;
            padding: 0;
        }
        blockquote {
            border-left: 4px solid #ddd;
            margin: 1rem 0;
            padding-left: 1rem;
            color: #666;
        }
        img {
            max-width: 100%;
            height: auto;
        }
        a {
            color: #0066cc;
        }
        .task-list {
            list-style: none;
            padding-left: 0;
        }
        .task-item input {
            margin-right: 0.5rem;
        }
    </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
};

/**
 * Generate TOC as markdown.
 */
const tocItemToMarkdown = (item: TocItem, depth = 0): string => {
	const indent = '  '.repeat(depth);
	const link = `${indent}- [${item.text}](#${item.id})`;
	const childLinks = item.children.map((child) => tocItemToMarkdown(child, depth + 1));
	return [link, ...childLinks].join('\n');
};

export const tocToMarkdown = (toc: readonly TocItem[]): string =>
	toc.map((item) => tocItemToMarkdown(item)).join('\n');

/**
 * Convert markdown to HTML with TeX and diagram support (async).
 * Renders:
 * - Inline TeX: $expression$ or \(expression\)
 * - Display TeX: $$expression$$ or \[expression\]
 * - Mermaid diagrams: ```mermaid
 * - PlantUML diagrams: ```plantuml or ```puml
 * - GraphViz diagrams: ```graphviz or ```dot
 */
export const markdownToHtmlAsync = async (markdown: string): Promise<string> => {
	// Counters for placeholder ids live in a const cursor object so neither
	// the binding nor the field requires `let`. Placeholder collections are
	// const arrays mutated by the replace callbacks.
	const codeBlocks: CodeBlockPlaceholder[] = [];
	const texExpressions: { id: string; expression: string; displayMode: boolean }[] = [];
	const idCounters = { block: 0, tex: 0 };

	// Replace code blocks with placeholders, then display/inline TeX, then
	// regular markdown -> HTML. The pipeline is built as a const reduce.
	type Transform = (input: string) => string;
	const preTransforms: readonly Transform[] = [
		// Replace code blocks with placeholders.
		(input) =>
			input.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
				const id = `__CODE_BLOCK_${idCounters.block}__`;
				idCounters.block += 1;
				const language = lang.trim().toLowerCase();
				const isDiagram = detectDiagramType(language) !== null;
				codeBlocks.push({ id, language, code: code.trim(), isDiagram });
				return id;
			}),
		// Display math: $$...$$ or \[...\]
		(input) =>
			input.replace(
				/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g,
				(_, expr1: string | undefined, expr2: string | undefined) => {
					const expression = (expr1 ?? expr2 ?? '').trim();
					const id = `__TEX_DISPLAY_${idCounters.tex}__`;
					idCounters.tex += 1;
					texExpressions.push({ id, expression, displayMode: true });
					return id;
				}
			),
		// Inline math: $...$ or \(...\) (but not $$)
		(input) =>
			input.replace(
				/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)|\\\(([^)]+?)\\\)/g,
				(_, expr1: string | undefined, expr2: string | undefined) => {
					const expression = (expr1 ?? expr2 ?? '').trim();
					const id = `__TEX_INLINE_${idCounters.tex}__`;
					idCounters.tex += 1;
					texExpressions.push({ id, expression, displayMode: false });
					return id;
				}
			),
	];

	const processedMarkdown = preTransforms.reduce((acc, transform) => transform(acc), markdown);

	const htmlTransforms: readonly Transform[] = [
		// Headers
		(input) => input.replace(/^###### (.+)$/gm, '<h6>$1</h6>'),
		(input) => input.replace(/^##### (.+)$/gm, '<h5>$1</h5>'),
		(input) => input.replace(/^#### (.+)$/gm, '<h4>$1</h4>'),
		(input) => input.replace(/^### (.+)$/gm, '<h3>$1</h3>'),
		(input) => input.replace(/^## (.+)$/gm, '<h2>$1</h2>'),
		(input) => input.replace(/^# (.+)$/gm, '<h1>$1</h1>'),
		// Horizontal rule
		(input) => input.replace(/^---$/gm, '<hr>'),
		// Bold and italic
		(input) => input.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>'),
		(input) => input.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'),
		(input) => input.replace(/\*(.+?)\*/g, '<em>$1</em>'),
		(input) => input.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>'),
		(input) => input.replace(/__(.+?)__/g, '<strong>$1</strong>'),
		(input) => input.replace(/_(.+?)_/g, '<em>$1</em>'),
		// Strikethrough
		(input) => input.replace(/~~(.+?)~~/g, '<del>$1</del>'),
		// Inline code
		(input) => input.replace(/`([^`]+)`/g, '<code>$1</code>'),
		// Links and images
		(input) => input.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">'),
		(input) =>
			input.replace(
				/\[([^\]]+)\]\(([^)]+)\)/g,
				'<a href="$2" target="_blank" rel="noopener">$1</a>'
			),
		// Blockquotes
		(input) => input.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>'),
		// Task lists
		(input) =>
			input.replace(
				/^- \[x\] (.+)$/gm,
				'<li class="task-item checked"><input type="checkbox" checked disabled> $1</li>'
			),
		(input) =>
			input.replace(
				/^- \[ \] (.+)$/gm,
				'<li class="task-item"><input type="checkbox" disabled> $1</li>'
			),
		// Unordered lists
		(input) => input.replace(/^- (.+)$/gm, '<li>$1</li>'),
		(input) => input.replace(/^\* (.+)$/gm, '<li>$1</li>'),
		// Ordered lists
		(input) => input.replace(/^\d+\. (.+)$/gm, '<li>$1</li>'),
		// Wrap consecutive list items
		(input) =>
			input.replace(/(<li>[\s\S]*?<\/li>)(\n<li>[\s\S]*?<\/li>)*/g, (match) =>
				match.includes('task-item') ? `<ul class="task-list">${match}</ul>` : `<ul>${match}</ul>`
			),
		// Paragraphs
		(input) =>
			input
				.split('\n\n')
				.map((block) => {
					const trimmed = block.trim();
					if (!trimmed) return '';
					if (
						trimmed.startsWith('<h') ||
						trimmed.startsWith('<ul') ||
						trimmed.startsWith('<ol') ||
						trimmed.startsWith('<pre') ||
						trimmed.startsWith('<blockquote') ||
						trimmed.startsWith('<hr') ||
						trimmed.startsWith('__CODE_BLOCK_') ||
						trimmed.startsWith('__TEX_')
					) {
						return trimmed;
					}
					return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
				})
				.join('\n'),
	];

	const baseHtml = htmlTransforms.reduce(
		(acc, transform) => transform(acc),
		escapeHtml(processedMarkdown)
	);

	// Render TeX expressions in parallel
	const texResults = await Promise.all(
		texExpressions.map(async ({ id, expression, displayMode }) => {
			const result = await renderTex(expression, displayMode);
			const wrapperClass = displayMode ? 'tex-display' : 'tex-inline';
			const renderedHtml = result.success
				? `<span class="${wrapperClass}">${result.html}</span>`
				: `<span class="tex-error" title="${escapeHtml(result.error ?? '')}">${escapeHtml(expression)}</span>`;
			return { id, html: renderedHtml };
		})
	);

	const htmlWithTex = texResults.reduce(
		(acc, { id, html: texHtml }) => acc.replace(id, texHtml),
		baseHtml
	);

	// Render diagrams in parallel
	const diagramResults = await Promise.all(
		codeBlocks.map(async ({ id, language, code, isDiagram }) => {
			if (isDiagram) {
				const diagramType = detectDiagramType(language);
				if (diagramType) {
					const result: DiagramRenderResult = await renderDiagram(diagramType, code);
					const wrapperHtml = result.success
						? `<div class="diagram-container diagram-${diagramType}">${result.html}</div>`
						: `<div class="diagram-error"><pre>${escapeHtml(code)}</pre><p class="error-message">${result.error}</p></div>`;
					return { id, html: wrapperHtml };
				}
			}
			// Regular code block
			const langClass = language ? ` class="language-${language}"` : '';
			return { id, html: `<pre><code${langClass}>${escapeHtml(code)}</code></pre>` };
		})
	);

	return diagramResults.reduce(
		(acc, { id, html: blockHtml }) => acc.replace(id, blockHtml),
		htmlWithTex
	);
};
