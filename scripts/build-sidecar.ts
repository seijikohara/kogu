#!/usr/bin/env bun

/**
 * Build and copy sidecar binaries for Tauri
 *
 * This script builds the worker and net-scanner binaries and copies them to the
 * src-tauri/binaries directory with the correct target triple suffix.
 *
 * The build process creates a placeholder file first to satisfy Tauri's
 * build script validation, then replaces it with the actual binary.
 */

import { chmodSync, copyFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { $ } from 'bun';

// Constants
const SIDECAR_NAMES = ['worker', 'net-scanner'] as const;
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

const runCargoBuild = async (name: string, release: boolean): Promise<void> => {
	const args = release ? ['build', '--bin', name, '--release'] : ['build', '--bin', name];
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
const buildSidecars = async (release: boolean): Promise<void> => {
	const profile = getProfile(release);
	console.log(`Building sidecars in ${profile} mode...`);

	const targetTriple = await getTargetTriple();
	console.log(`Target triple: ${targetTriple}`);

	ensureDirectory(BINARIES_DIR);

	// Create all placeholders first so Tauri's build script validation passes
	// for every externalBin before any cargo build is invoked.
	const placeholdersCreated: string[] = [];
	for (const name of SIDECAR_NAMES) {
		const destPath = join(BINARIES_DIR, `${name}-${targetTriple}`);
		if (!existsSync(destPath)) {
			console.log(`  Creating placeholder for ${name}-${targetTriple}...`);
			createPlaceholder(destPath);
			placeholdersCreated.push(destPath);
		}
	}

	try {
		for (const name of SIDECAR_NAMES) {
			const destName = `${name}-${targetTriple}`;
			const sourcePath = join('src-tauri', 'target', profile, name);
			const destPath = join(BINARIES_DIR, destName);

			console.log(`  Building ${name}...`);
			await runCargoBuild(name, release);

			console.log(`  Copying ${name} -> ${destName}`);
			copyBinary(sourcePath, destPath);
		}
	} catch (error) {
		for (const p of placeholdersCreated) {
			cleanupPlaceholder(p);
		}
		throw error;
	}

	console.log('Sidecar build complete!');
};

// Entry point
const release = parseArgs(process.argv);

buildSidecars(release).catch((error) => {
	console.error('Error building sidecar:', error);
	process.exit(1);
});
