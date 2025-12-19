/**
 * SQL Formatter - Format, Minify, and Validate Functions
 */

import { format as sqlFormat } from 'sql-formatter';

import { defaultSqlFormatOptions } from '../constants.js';
import type { SqlFormatOptions, SqlStats } from '../types.js';
import { formatBytes } from '../utils.js';

/** Format SQL with options */
export const formatSql = (input: string, options: Partial<SqlFormatOptions> = {}): string => {
	const opts = { ...defaultSqlFormatOptions, ...options };
	return sqlFormat(input, {
		language: opts.language,
		tabWidth: opts.tabWidth,
		useTabs: opts.useTabs,
		keywordCase: opts.keywordCase,
		indentStyle: opts.indentStyle,
		logicalOperatorNewline: opts.logicalOperatorNewline,
		expressionWidth: opts.expressionWidth,
		linesBetweenQueries: opts.linesBetweenQueries,
		denseOperators: opts.denseOperators,
		newlineBeforeSemicolon: opts.newlineBeforeSemicolon,
	});
};

/** Minify SQL */
export const minifySql = (input: string): string => input.replace(/\s+/g, ' ').trim();

/** Calculate SQL statistics */
export const calculateSqlStats = (input: string): SqlStats => {
	// Count statements by semicolons (excluding those in strings/comments)
	const statements = input.split(';').filter((s) => s.trim().length > 0).length;

	return {
		statements,
		size: formatBytes(new Blob([input]).size),
	};
};

/** Validate SQL input */
export const validateSql = (input: string): { valid: boolean; error?: string } => {
	if (!input.trim()) {
		return { valid: false, error: 'Empty input' };
	}

	try {
		// Try to format as a basic validation
		sqlFormat(input, { language: 'sql' });
		return { valid: true };
	} catch (e) {
		return {
			valid: false,
			error: e instanceof Error ? e.message : 'Invalid SQL',
		};
	}
};
