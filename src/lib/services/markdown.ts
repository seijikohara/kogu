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
export const SAMPLE_MARKDOWN = `# Markdown Feature Showcase

This document demonstrates **all Markdown features** supported by the editor.

## Text Formatting

### Emphasis Styles

- **Bold text** using double asterisks
- __Bold text__ using double underscores
- *Italic text* using single asterisks
- _Italic text_ using single underscores
- ***Bold and italic*** combined
- ___Bold and italic___ with underscores
- ~~Strikethrough text~~ using tildes

### Inline Elements

Use \`inline code\` for code snippets within text.

Visit the [Kogu GitHub Repository](https://github.com/seijikohara/kogu) for more information.

Here's an image: ![Placeholder](https://via.placeholder.com/150x50?text=Sample+Image)

## Headings (H1-H6)

# Heading Level 1
## Heading Level 2
### Heading Level 3
#### Heading Level 4
##### Heading Level 5
###### Heading Level 6

## Lists

### Unordered Lists

- First item
- Second item
  - Nested item 2.1
  - Nested item 2.2
    - Deep nested item
- Third item

* Alternative syntax with asterisks
* Another item

### Ordered Lists

1. First step
2. Second step
   1. Sub-step 2.1
   2. Sub-step 2.2
3. Third step

### Task Lists

- [x] Completed task
- [x] Another completed task
- [ ] Pending task
- [ ] Future task

## Code Blocks

### JavaScript

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}

const result = greet('World');
console.log(result); // Hello, World!
\`\`\`

### TypeScript

\`\`\`typescript
interface User {
  readonly id: number;
  readonly name: string;
  readonly email: string;
}

const getUser = (id: number): User => ({
  id,
  name: 'John Doe',
  email: 'john@example.com',
});
\`\`\`

### Python

\`\`\`python
def fibonacci(n: int) -> list[int]:
    """Generate Fibonacci sequence."""
    if n <= 0:
        return []
    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])
    return sequence[:n]
\`\`\`

### Rust

\`\`\`rust
fn main() {
    let numbers: Vec<i32> = (1..=10).collect();
    let sum: i32 = numbers.iter().sum();
    println!("Sum: {}", sum);
}
\`\`\`

## Blockquotes

> This is a simple blockquote.
> It can span multiple lines.

> **Nested formatting** works inside blockquotes.
>
> - Lists work too
> - Inside blockquotes

## Horizontal Rules

Content above the line.

---

Content below the line.

***

Another separator style.

## Tables (Extended Markdown)

| Feature | Status | Notes |
|---------|--------|-------|
| Bold | ✅ | Fully supported |
| Italic | ✅ | Fully supported |
| Links | ✅ | Opens in new tab |
| Images | ✅ | With alt text |
| Code | ✅ | Syntax highlighting |

## Special Characters

- Ampersand: &
- Less than: <
- Greater than: >
- Backslash escape: \\*not italic\\*

## Mathematics (TeX/LaTeX)

### Inline Math

The quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$ which solves $ax^2 + bx + c = 0$.

Einstein's famous equation: $E = mc^2$

### Display Math

The Gaussian integral:

$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

Maxwell's equations in differential form:

$$\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}$$

$$\\nabla \\times \\mathbf{B} - \\frac{1}{c^2}\\frac{\\partial \\mathbf{E}}{\\partial t} = \\mu_0 \\mathbf{J}$$

## Diagrams

### Mermaid Flowchart

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
\`\`\`

### Mermaid Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant User
    participant App
    participant API
    User->>App: Click button
    App->>API: Send request
    API-->>App: Return data
    App-->>User: Display result
\`\`\`

### GraphViz (DOT)

\`\`\`graphviz
digraph G {
    rankdir=LR;
    node [shape=box, style=rounded];

    A -> B -> C;
    B -> D;
    C -> E;
    D -> E;
}
\`\`\`

### PlantUML Class Diagram

\`\`\`plantuml
@startuml
class User {
  +id: number
  +name: string
  +email: string
  +login(): void
}

class Admin extends User {
  +permissions: string[]
  +manageUsers(): void
}

User --> Admin
@enduml
\`\`\`

## Summary

This sample covers:

1. **Text formatting**: bold, italic, strikethrough
2. **Headings**: H1 through H6
3. **Lists**: ordered, unordered, task lists, nested
4. **Code**: inline and fenced blocks with syntax highlighting
5. **Links and images**: clickable links, embedded images
6. **Blockquotes**: single and multi-line
7. **Horizontal rules**: section separators
8. **Tables**: formatted data display
9. **Mathematics**: inline and display TeX/LaTeX expressions
10. **Diagrams**: Mermaid, GraphViz, and PlantUML
`;

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
	let html = escapeHtml(markdown);

	// Code blocks (must be processed first to prevent other transformations)
	html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
		const langClass = lang ? ` class="language-${lang}"` : '';
		return `<pre><code${langClass}>${code.trim()}</code></pre>`;
	});

	// Inline code
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

	// Headers
	html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
	html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
	html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
	html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
	html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
	html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

	// Horizontal rule
	html = html.replace(/^---$/gm, '<hr>');

	// Bold and italic
	html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
	html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
	html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
	html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
	html = html.replace(/_(.+?)_/g, '<em>$1</em>');

	// Strikethrough
	html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

	// Links and images
	html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
	html = html.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a href="$2" target="_blank" rel="noopener">$1</a>'
	);

	// Blockquotes
	html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

	// Task lists
	html = html.replace(
		/^- \[x\] (.+)$/gm,
		'<li class="task-item checked"><input type="checkbox" checked disabled> $1</li>'
	);
	html = html.replace(
		/^- \[ \] (.+)$/gm,
		'<li class="task-item"><input type="checkbox" disabled> $1</li>'
	);

	// Unordered lists
	html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
	html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');

	// Ordered lists
	html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

	// Wrap consecutive list items in ul/ol (simplified)
	html = html.replace(/(<li>[\s\S]*?<\/li>)(\n<li>[\s\S]*?<\/li>)*/g, (match) => {
		if (match.includes('task-item')) {
			return `<ul class="task-list">${match}</ul>`;
		}
		return `<ul>${match}</ul>`;
	});

	// Paragraphs (wrap text blocks)
	html = html
		.split('\n\n')
		.map((block) => {
			const trimmed = block.trim();
			if (!trimmed) return '';
			// Skip if already wrapped in a block element
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
		.join('\n');

	return html;
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
	// Extract code blocks first to protect them from other transformations
	const codeBlocks: CodeBlockPlaceholder[] = [];
	let blockId = 0;

	// Replace code blocks with placeholders
	let processedMarkdown = markdown.replace(
		/```(\w*)\n([\s\S]*?)```/g,
		(_match, lang: string, code: string) => {
			const id = `__CODE_BLOCK_${blockId++}__`;
			const language = lang.trim().toLowerCase();
			const isDiagram = detectDiagramType(language) !== null;
			codeBlocks.push({ id, language, code: code.trim(), isDiagram });
			return id;
		}
	);

	// Extract and render TeX expressions
	const texExpressions: Array<{ id: string; expression: string; displayMode: boolean }> = [];
	let texId = 0;

	// Display math: $$...$$ or \[...\]
	processedMarkdown = processedMarkdown.replace(
		/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g,
		(_, expr1: string | undefined, expr2: string | undefined) => {
			const expression = (expr1 ?? expr2 ?? '').trim();
			const id = `__TEX_DISPLAY_${texId++}__`;
			texExpressions.push({ id, expression, displayMode: true });
			return id;
		}
	);

	// Inline math: $...$ or \(...\) (but not $$)
	processedMarkdown = processedMarkdown.replace(
		/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)|\\\(([^)]+?)\\\)/g,
		(_, expr1: string | undefined, expr2: string | undefined) => {
			const expression = (expr1 ?? expr2 ?? '').trim();
			const id = `__TEX_INLINE_${texId++}__`;
			texExpressions.push({ id, expression, displayMode: false });
			return id;
		}
	);

	// Escape HTML and apply markdown transformations
	let html = escapeHtml(processedMarkdown);

	// Headers
	html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
	html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
	html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
	html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
	html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
	html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

	// Horizontal rule
	html = html.replace(/^---$/gm, '<hr>');

	// Bold and italic
	html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
	html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
	html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
	html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
	html = html.replace(/_(.+?)_/g, '<em>$1</em>');

	// Strikethrough
	html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

	// Inline code
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

	// Links and images
	html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
	html = html.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a href="$2" target="_blank" rel="noopener">$1</a>'
	);

	// Blockquotes
	html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

	// Task lists
	html = html.replace(
		/^- \[x\] (.+)$/gm,
		'<li class="task-item checked"><input type="checkbox" checked disabled> $1</li>'
	);
	html = html.replace(
		/^- \[ \] (.+)$/gm,
		'<li class="task-item"><input type="checkbox" disabled> $1</li>'
	);

	// Unordered lists
	html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
	html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');

	// Ordered lists
	html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

	// Wrap consecutive list items
	html = html.replace(/(<li>[\s\S]*?<\/li>)(\n<li>[\s\S]*?<\/li>)*/g, (match) => {
		if (match.includes('task-item')) {
			return `<ul class="task-list">${match}</ul>`;
		}
		return `<ul>${match}</ul>`;
	});

	// Paragraphs
	html = html
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
		.join('\n');

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

	// Replace TeX placeholders
	for (const { id, html: texHtml } of texResults) {
		html = html.replace(id, texHtml);
	}

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

	// Replace code block placeholders
	for (const { id, html: blockHtml } of diagramResults) {
		html = html.replace(id, blockHtml);
	}

	return html;
};
