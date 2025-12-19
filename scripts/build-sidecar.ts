#!/usr/bin/env bun
/**
 * Build and copy sidecar binaries for Tauri
 *
 * This script builds the bcrypt-worker binary and copies it to the
 * src-tauri/binaries directory with the correct target triple suffix.
 *
 * The build process creates placeholder files first to satisfy Tauri's
 * build script validation, then replaces them with the actual binaries.
 */

import { $ } from 'bun';
import { existsSync, mkdirSync, copyFileSync, chmodSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const SIDECARS = ['bcrypt-worker'] as const;

async function getTargetTriple(): Promise<string> {
	const result = await $`rustc -Vv`.text();
	const match = result.match(/host:\s+(\S+)/);
	if (!match) {
		throw new Error('Failed to determine target triple');
	}
	return match[1];
}

async function buildSidecars(release: boolean): Promise<void> {
	const mode = release ? '--release' : '';
	const profile = release ? 'release' : 'debug';

	console.log(`Building sidecars in ${profile} mode...`);

	// Get target triple first
	const targetTriple = await getTargetTriple();
	console.log(`Target triple: ${targetTriple}`);

	// Ensure binaries directory exists
	const binariesDir = join('src-tauri', 'binaries');
	if (!existsSync(binariesDir)) {
		mkdirSync(binariesDir, { recursive: true });
	}

	// Create placeholder files for all sidecars first
	// This is needed because Tauri's build.rs checks for sidecar existence
	// before our binary is built
	const placeholderPaths: string[] = [];
	for (const sidecar of SIDECARS) {
		const destName = `${sidecar}-${targetTriple}`;
		const destPath = join(binariesDir, destName);

		if (!existsSync(destPath)) {
			console.log(`  Creating placeholder for ${destName}...`);
			writeFileSync(destPath, '');
			chmodSync(destPath, 0o755);
			placeholderPaths.push(destPath);
		}
	}

	try {
		// Build all sidecar binaries
		for (const sidecar of SIDECARS) {
			console.log(`  Building ${sidecar}...`);
			if (mode) {
				await $`cargo build --bin ${sidecar} ${mode}`.cwd('src-tauri');
			} else {
				await $`cargo build --bin ${sidecar}`.cwd('src-tauri');
			}
		}

		// Copy binaries with target triple suffix (replacing placeholders)
		for (const sidecar of SIDECARS) {
			const sourcePath = join('src-tauri', 'target', profile, sidecar);
			const destName = `${sidecar}-${targetTriple}`;
			const destPath = join(binariesDir, destName);

			if (!existsSync(sourcePath)) {
				throw new Error(`Binary not found: ${sourcePath}`);
			}

			console.log(`  Copying ${sidecar} -> ${destName}`);
			copyFileSync(sourcePath, destPath);
			chmodSync(destPath, 0o755);
		}

		console.log('Sidecar build complete!');
	} catch (error) {
		// Clean up placeholder files on error
		for (const placeholderPath of placeholderPaths) {
			if (existsSync(placeholderPath)) {
				try {
					unlinkSync(placeholderPath);
				} catch {
					// Ignore cleanup errors
				}
			}
		}
		throw error;
	}
}

// Parse arguments
const args = process.argv.slice(2);
const release = args.includes('--release') || args.includes('-r');

buildSidecars(release).catch((error) => {
	console.error('Error building sidecars:', error);
	process.exit(1);
});
