/**
 * Base64 encoder/decoder service.
 */

// `formatBytes` previously had its own copy here; the canonical implementation
// now lives in `@/lib/utils/format`. Re-export so existing consumers keep
// their import path until they migrate.
export { formatBytes } from '@/lib/utils';

/** Base64 encoding variant */
export type Base64Variant = 'standard' | 'url-safe';

/** Line break options for Base64 output */
export type Base64LineBreak = 'none' | '64' | '76';

/** Base64 encoding options */
export interface Base64EncodeOptions {
	/** Encoding variant: standard (+/) or url-safe (-_) */
	variant: Base64Variant;
	/** Add padding (=) characters */
	padding: boolean;
	/** Line break interval */
	lineBreak: Base64LineBreak;
	/** Output as Data URL with MIME type */
	dataUrl: boolean;
	/** MIME type for Data URL */
	mimeType: string;
}

/** Base64 decoding options */
export interface Base64DecodeOptions {
	/** Ignore whitespace characters */
	ignoreWhitespace: boolean;
	/** Ignore invalid characters instead of throwing error */
	ignoreInvalidChars: boolean;
	/** Auto-detect URL-safe variant */
	autoDetectVariant: boolean;
}

/** Default Base64 encoding options */
export const defaultBase64EncodeOptions: Base64EncodeOptions = {
	variant: 'standard',
	padding: true,
	lineBreak: 'none',
	dataUrl: false,
	mimeType: 'text/plain',
};

/** Default Base64 decoding options */
export const defaultBase64DecodeOptions: Base64DecodeOptions = {
	ignoreWhitespace: true,
	ignoreInvalidChars: false,
	autoDetectVariant: true,
};

/** Common MIME types for Data URL */
export const BASE64_MIME_TYPES = [
	{ value: 'text/plain', label: 'Text (text/plain)' },
	{ value: 'text/html', label: 'HTML (text/html)' },
	{ value: 'text/css', label: 'CSS (text/css)' },
	{ value: 'text/javascript', label: 'JavaScript (text/javascript)' },
	{ value: 'application/json', label: 'JSON (application/json)' },
	{ value: 'application/xml', label: 'XML (application/xml)' },
	{ value: 'image/png', label: 'PNG Image (image/png)' },
	{ value: 'image/jpeg', label: 'JPEG Image (image/jpeg)' },
	{ value: 'image/gif', label: 'GIF Image (image/gif)' },
	{ value: 'image/svg+xml', label: 'SVG Image (image/svg+xml)' },
	{ value: 'application/pdf', label: 'PDF (application/pdf)' },
	{ value: 'application/octet-stream', label: 'Binary (application/octet-stream)' },
] as const;

/**
 * Encode text to Base64 with options.
 */
export const encodeToBase64 = (
	text: string,
	options: Partial<Base64EncodeOptions> = {}
): string => {
	const opts = { ...defaultBase64EncodeOptions, ...options };

	// Encode to bytes
	const bytes = new TextEncoder().encode(text);
	const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

	// Standard Base64 encoding -> apply optional transforms as a const
	// pipeline so each step is a referentially-transparent string -> string.
	type Transform = (input: string) => string;
	const transforms: readonly Transform[] = [
		// Convert to URL-safe variant if needed
		opts.variant === 'url-safe'
			? (input) => input.replace(/\+/g, '-').replace(/\//g, '_')
			: (input) => input,
		// Remove padding if not wanted
		opts.padding ? (input) => input : (input) => input.replace(/=+$/, ''),
		// Add line breaks if specified
		opts.lineBreak === 'none'
			? (input) => input
			: (input) => {
					const lineLength = opts.lineBreak === '64' ? 64 : 76;
					return input.match(new RegExp(`.{1,${lineLength}}`, 'g'))?.join('\n') ?? input;
				},
		// Wrap as Data URL if requested
		opts.dataUrl
			? (input) => `data:${opts.mimeType};base64,${input.replace(/\n/g, '')}`
			: (input) => input,
	];

	return transforms.reduce((acc, transform) => transform(acc), globalThis.btoa(binary));
};

/**
 * Decode Base64 to text with options.
 */
export const decodeFromBase64 = (
	base64: string,
	options: Partial<Base64DecodeOptions> = {}
): string => {
	const opts = { ...defaultBase64DecodeOptions, ...options };

	// Strip Data URL prefix if present.
	const stripDataUrl = (value: string): string => {
		if (!value.startsWith('data:')) return value;
		const commaIndex = value.indexOf(',');
		return commaIndex === -1 ? value : value.slice(commaIndex + 1);
	};

	const cleaned = ((): string => {
		type Transform = (value: string) => string;
		const steps: readonly Transform[] = [
			stripDataUrl,
			opts.ignoreWhitespace ? (value) => value.replace(/\s/g, '') : (value) => value,
			opts.autoDetectVariant
				? (value) =>
						value.includes('-') || value.includes('_')
							? value.replace(/-/g, '+').replace(/_/g, '/')
							: value
				: (value) => value,
			opts.ignoreInvalidChars ? (value) => value.replace(/[^A-Za-z0-9+/=]/g, '') : (value) => value,
		];
		return steps.reduce((acc, step) => step(acc), base64);
	})();

	// Add padding if missing
	const padding = cleaned.length % 4;
	const padded = padding ? cleaned + '='.repeat(4 - padding) : cleaned;

	const binary = globalThis.atob(padded);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new TextDecoder().decode(bytes);
};

/**
 * Validate Base64 string with options.
 */
export const validateBase64 = (
	input: string,
	options: Partial<Base64DecodeOptions> = {}
): { valid: boolean; error?: string } => {
	if (!input.trim()) {
		return { valid: false, error: 'Empty input' };
	}

	const opts = { ...defaultBase64DecodeOptions, ...options };

	// Strip the Data URL prefix (if any), then optionally drop whitespace.
	const withoutDataUrl = ((): string => {
		if (!input.startsWith('data:')) return input;
		const commaIndex = input.indexOf(',');
		return commaIndex === -1 ? input : input.slice(commaIndex + 1);
	})();
	const cleanInput = opts.ignoreWhitespace ? withoutDataUrl.replace(/\s/g, '') : withoutDataUrl;

	// Check for valid Base64 characters (including URL-safe)
	const base64Regex = opts.autoDetectVariant
		? /^[A-Za-z0-9+/\-_]*={0,2}$/
		: /^[A-Za-z0-9+/]*={0,2}$/;

	if (!base64Regex.test(cleanInput)) {
		return { valid: false, error: 'Invalid Base64 characters' };
	}

	try {
		decodeFromBase64(input, options);
		return { valid: true };
	} catch {
		return { valid: false, error: 'Invalid Base64 encoding' };
	}
};

/**
 * Detect Base64 variant from input.
 */
export const detectBase64Variant = (input: string): Base64Variant => {
	const cleanInput = input.replace(/\s/g, '');
	if (cleanInput.includes('-') || cleanInput.includes('_')) {
		return 'url-safe';
	}
	return 'standard';
};

/**
 * Check if input is a Data URL.
 */
export const isDataUrl = (input: string): boolean => {
	return input.trim().startsWith('data:');
};

/**
 * Extract MIME type from Data URL.
 */
export const extractMimeType = (dataUrl: string): string | null => {
	const match = dataUrl.match(/^data:([^;,]+)/);
	return match?.[1] ?? null;
};

export interface Base64Stats {
	inputChars: number;
	inputBytes: number;
	outputChars: number;
	outputBytes: number;
	ratio: string;
}

/**
 * Calculate Base64 encoding statistics.
 */
export const calculateBase64Stats = (input: string, output: string): Base64Stats => {
	const inputBytes = new TextEncoder().encode(input).length;
	const outputBytes = new TextEncoder().encode(output).length;
	const ratio = inputBytes > 0 ? ((outputBytes / inputBytes) * 100).toFixed(1) : '0';

	return {
		inputChars: input.length,
		inputBytes,
		outputChars: output.length,
		outputBytes,
		ratio: `${ratio}%`,
	};
};

/**
 * Convert file to Base64 data URL.
 */
export const fileToBase64 = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error('Failed to read file'));
		reader.readAsDataURL(file);
	});
};

/**
 * Convert Base64 data URL to Blob for download.
 */
export const base64ToBlob = (dataUrl: string): Blob => {
	const parts = dataUrl.split(',');
	const header = parts[0] ?? '';
	const data = parts[1] ?? '';
	const mimeMatch = header.match(/data:([^;]+)/);
	const mime = mimeMatch?.[1] ?? 'application/octet-stream';
	const binary = globalThis.atob(data);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new Blob([bytes], { type: mime });
};

export const SAMPLE_TEXT_FOR_BASE64 = `Hello, World!
This is a sample text for Base64 encoding.
日本語のテキストもサポートしています。
Special characters: !@#$%^&*()_+-=[]{}|;':",.<>?`;
