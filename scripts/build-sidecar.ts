#!/usr/bin/env bun

/**
 * Build and copy sidecar binary for Tauri
 *
 * This script builds the worker binary and copies it to the
 * src-tauri/binaries directory with the correct target triple suffix.
 *
 * The build process creates a placeholder file first to satisfy Tauri's
 * build script validation, then replaces it with the actual binary.
 */

import { chmodSync, copyFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { $ } from 'bun';

// Constants
const SIDECAR_NAME = 'worker';
const BINARIES_DIR = join('src-tauri', 'binaries');

// Pure functions
const parseArgs = (argv: readonly string[]): boolean =>
	argv.slice(2).some((arg) => arg === '--release' || arg === '-r');

const getProfile = (release: boolean): 'release' | 'debug' => (release ? 'release' : 'debug');

// Shell execution
const getTargetTriple = async (): Promise<string> => {
	const result = await $`rustc -Vv`.text();
	const match = result.match(/host:\s+(\S+)/);
	if (!match) {
		throw new Error('Failed to determine target triple');
	}
	return match[1];
};

const runCargoBuild = async (release: boolean): Promise<void> => {
	const args = release
		? ['build', '--bin', SIDECAR_NAME, '--release']
		: ['build', '--bin', SIDECAR_NAME];
	await $`cargo ${args}`.cwd('src-tauri');
};

// File operations
const ensureDirectory = (dir: string): void => {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
};

const createPlaceholder = (path: string): void => {
	writeFileSync(path, '');
	chmodSync(path, 0o755);
};

const copyBinary = (sourcePath: string, destPath: string): void => {
	if (!existsSync(sourcePath)) {
		throw new Error(`Binary not found: ${sourcePath}`);
	}
	copyFileSync(sourcePath, destPath);
	chmodSync(destPath, 0o755);
};

const cleanupPlaceholder = (path: string): void => {
	if (existsSync(path)) {
		try {
			unlinkSync(path);
		} catch {
			// Ignore cleanup errors
		}
	}
};

// Main workflow
const buildSidecar = async (release: boolean): Promise<void> => {
	const profile = getProfile(release);
	console.log(`Building sidecar in ${profile} mode...`);

	const targetTriple = await getTargetTriple();
	console.log(`Target triple: ${targetTriple}`);

	const destName = `${SIDECAR_NAME}-${targetTriple}`;
	const sourcePath = join('src-tauri', 'target', profile, SIDECAR_NAME);
	const destPath = join(BINARIES_DIR, destName);

	ensureDirectory(BINARIES_DIR);

	// Create placeholder if destination doesn't exist
	const needsPlaceholder = !existsSync(destPath);
	if (needsPlaceholder) {
		console.log(`  Creating placeholder for ${destName}...`);
		createPlaceholder(destPath);
	}

	try {
		// Build sidecar binary
		console.log(`  Building ${SIDECAR_NAME}...`);
		await runCargoBuild(release);

		// Copy binary with target triple suffix
		console.log(`  Copying ${SIDECAR_NAME} -> ${destName}`);
		copyBinary(sourcePath, destPath);

		console.log('Sidecar build complete!');
	} catch (error) {
		if (needsPlaceholder) {
			cleanupPlaceholder(destPath);
		}
		throw error;
	}
};

// Entry point
const release = parseArgs(process.argv);

buildSidecar(release).catch((error) => {
	console.error('Error building sidecar:', error);
	process.exit(1);
});
