/**
 * Diagram and TeX rendering service.
 * Provides pure functions for rendering diagrams and mathematical expressions.
 */

import type { RenderResult as MermaidRenderResult } from 'mermaid';

// Types
export type DiagramType = 'mermaid' | 'plantuml' | 'graphviz';

export interface DiagramRenderResult {
	readonly success: boolean;
	readonly html: string;
	readonly error?: string;
}

export interface TexRenderResult {
	readonly success: boolean;
	readonly html: string;
	readonly error?: string;
}

// PlantUML encoding for online preview
const PLANTUML_ENCODE_TABLE = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

/**
 * Encode a single 6-bit value to PlantUML character.
 */
const encode6bit = (b: number): string => PLANTUML_ENCODE_TABLE.charAt(b & 0x3f);

/**
 * Encode 3 bytes to 4 PlantUML characters.
 */
const encode3bytes = (b1: number, b2: number, b3: number): string => {
	const c1 = b1 >> 2;
	const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
	const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
	const c4 = b3 & 0x3f;
	return encode6bit(c1) + encode6bit(c2) + encode6bit(c3) + encode6bit(c4);
};

/**
 * Encode PlantUML source to URL-safe format.
 */
const encodePlantUml = (source: string): string => {
	const data = new TextEncoder().encode(source);
	const compressed = deflateRaw(data);
	let result = '';
	for (let i = 0; i < compressed.length; i += 3) {
		const b1 = compressed[i] ?? 0;
		const b2 = compressed[i + 1] ?? 0;
		const b3 = compressed[i + 2] ?? 0;
		result += encode3bytes(b1, b2, b3);
	}
	return result;
};

/**
 * Simple deflate implementation for PlantUML encoding.
 * Uses a minimal compression that PlantUML server accepts.
 */
const deflateRaw = (data: Uint8Array): Uint8Array => {
	// PlantUML uses a custom deflate format
	// For simplicity, use non-compressed deflate blocks
	const result: number[] = [];

	// Add data in 65535-byte chunks (max for non-compressed block)
	const chunkSize = 65535;
	for (let i = 0; i < data.length; i += chunkSize) {
		const chunk = data.slice(i, Math.min(i + chunkSize, data.length));
		const isLast = i + chunkSize >= data.length;

		// Block header: BFINAL=1/0, BTYPE=00 (non-compressed)
		result.push(isLast ? 0x01 : 0x00);

		// LEN (2 bytes, little-endian)
		result.push(chunk.length & 0xff);
		result.push((chunk.length >> 8) & 0xff);

		// NLEN (one's complement of LEN)
		const nlen = ~chunk.length & 0xffff;
		result.push(nlen & 0xff);
		result.push((nlen >> 8) & 0xff);

		// Data
		for (const byte of chunk) {
			result.push(byte);
		}
	}

	return new Uint8Array(result);
};

/**
 * Generate PlantUML preview URL using public server.
 */
export const getPlantUmlUrl = (source: string): string => {
	const encoded = encodePlantUml(source);
	return `https://www.plantuml.com/plantuml/svg/${encoded}`;
};

// Lazy-loaded modules
let katexModule: typeof import('katex') | null = null;
let mermaidModule: typeof import('mermaid') | null = null;
let vizModule: typeof import('@viz-js/viz') | null = null;

/**
 * Load KaTeX module lazily.
 */
const loadKatex = async (): Promise<typeof import('katex')> => {
	if (!katexModule) {
		katexModule = await import('katex');
	}
	return katexModule;
};

/**
 * Load Mermaid module lazily.
 */
const loadMermaid = async (): Promise<typeof import('mermaid')> => {
	if (!mermaidModule) {
		mermaidModule = await import('mermaid');
		mermaidModule.default.initialize({
			startOnLoad: false,
			theme: 'default',
			securityLevel: 'strict',
			fontFamily: 'inherit',
		});
	}
	return mermaidModule;
};

/**
 * Load Viz.js module lazily.
 */
const loadViz = async (): Promise<typeof import('@viz-js/viz')> => {
	if (!vizModule) {
		vizModule = await import('@viz-js/viz');
	}
	return vizModule;
};

// Mermaid diagram counter for unique IDs
let mermaidDiagramCounter = 0;

/**
 * Render TeX/LaTeX expression to HTML.
 */
export const renderTex = async (
	expression: string,
	displayMode: boolean = false
): Promise<TexRenderResult> => {
	try {
		const katex = await loadKatex();
		const html = katex.default.renderToString(expression, {
			displayMode,
			throwOnError: false,
			output: 'html',
			trust: false,
			strict: 'warn',
		});
		return { success: true, html };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			html: `<span class="tex-error">${escapeHtml(message)}</span>`,
			error: message,
		};
	}
};

/**
 * Render Mermaid diagram to SVG.
 */
export const renderMermaid = async (source: string): Promise<DiagramRenderResult> => {
	try {
		const mermaid = await loadMermaid();
		const id = `mermaid-diagram-${++mermaidDiagramCounter}`;
		const result: MermaidRenderResult = await mermaid.default.render(id, source);
		return { success: true, html: result.svg };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			html: `<div class="diagram-error">${escapeHtml(message)}</div>`,
			error: message,
		};
	}
};

/**
 * Render GraphViz DOT diagram to SVG.
 */
export const renderGraphviz = async (source: string): Promise<DiagramRenderResult> => {
	try {
		const vizJs = await loadViz();
		const viz = await vizJs.instance();
		const svg = viz.renderSVGElement(source);
		return { success: true, html: svg.outerHTML };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			html: `<div class="diagram-error">${escapeHtml(message)}</div>`,
			error: message,
		};
	}
};

/**
 * Render PlantUML diagram (returns img element with URL to public server).
 */
export const renderPlantUml = (source: string): DiagramRenderResult => {
	try {
		const url = getPlantUmlUrl(source);
		const html = `<img src="${escapeHtml(url)}" alt="PlantUML diagram" class="plantuml-diagram" loading="lazy" />`;
		return { success: true, html };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			html: `<div class="diagram-error">${escapeHtml(message)}</div>`,
			error: message,
		};
	}
};

/**
 * Render a diagram based on its type.
 */
export const renderDiagram = async (
	type: DiagramType,
	source: string
): Promise<DiagramRenderResult> => {
	switch (type) {
		case 'mermaid':
			return await renderMermaid(source);
		case 'plantuml':
			return await renderPlantUml(source);
		case 'graphviz':
			return await renderGraphviz(source);
		default:
			return {
				success: false,
				html: `<div class="diagram-error">Unknown diagram type: ${type}</div>`,
				error: `Unknown diagram type: ${type}`,
			};
	}
};

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
 * Detect diagram type from code block language.
 */
export const detectDiagramType = (language: string): DiagramType | null => {
	const normalized = language.toLowerCase().trim();
	switch (normalized) {
		case 'mermaid':
			return 'mermaid';
		case 'plantuml':
		case 'puml':
			return 'plantuml';
		case 'graphviz':
		case 'dot':
			return 'graphviz';
		default:
			return null;
	}
};

/**
 * Check if a language identifier represents a diagram type.
 */
export const isDiagramLanguage = (language: string): boolean =>
	detectDiagramType(language) !== null;
