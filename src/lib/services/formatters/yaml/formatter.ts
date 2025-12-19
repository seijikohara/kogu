/**
 * YAML Formatter - Format, Minify, and Validate Functions
 */

import * as yaml from 'yaml';

import { defaultYamlFormatOptions } from '../constants.js';
import type { YamlFormatOptions, YamlStats } from '../types.js';
import { calculateStats, formatBytes, sortKeysDeep } from '../utils.js';

/** Format YAML with options */
export const formatYaml = (input: string, options: Partial<YamlFormatOptions> = {}): string => {
	const opts = { ...defaultYamlFormatOptions, ...options };
	const parsed = yaml.parse(input);
	const data = opts.sortKeys ? sortKeysDeep(parsed) : parsed;

	return yaml.stringify(data, {
		indent: opts.indentSize,
		lineWidth: opts.lineWidth,
		singleQuote: opts.singleQuote,
	});
};

/** Minify YAML */
export const minifyYaml = (input: string): string =>
	yaml.stringify(yaml.parse(input), { indent: 0 });

/** Calculate YAML statistics */
export const calculateYamlStats = (input: string): YamlStats => {
	const stats = calculateStats(yaml.parse(input));
	return {
		keys: stats.keys,
		values: stats.values,
		depth: stats.maxDepth,
		size: formatBytes(new Blob([input]).size),
	};
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if input is JSON format (not pure YAML).
 * JSON is a valid subset of YAML, but we want to reject it in YAML formatter.
 */
const isJsonFormat = (input: string): boolean => {
	const trimmed = input.trim();

	// Check if it looks like JSON (starts with { or [)
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		try {
			JSON.parse(trimmed);
			return true;
		} catch {
			// Not valid JSON, might be YAML flow style
			return false;
		}
	}

	return false;
};

/** Validate YAML input */
export const validateYaml = (input: string): { valid: boolean; error?: string } => {
	// Reject JSON input - YAML formatter should only accept pure YAML
	if (isJsonFormat(input)) {
		return {
			valid: false,
			error: 'JSON format detected. Please use JSON Formatter for JSON input.',
		};
	}

	try {
		yaml.parse(input);
		return { valid: true };
	} catch (e) {
		return {
			valid: false,
			error: e instanceof Error ? e.message : 'Invalid YAML',
		};
	}
};
