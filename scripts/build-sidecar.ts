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
import { chmodSync, copyFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Constants
const SIDECARS = ['bcrypt-worker'] as const;
const BINARIES_DIR = join('src-tauri', 'binaries');

// Types
type Sidecar = (typeof SIDECARS)[number];

interface BuildConfig {
	readonly release: boolean;
	readonly profile: 'release' | 'debug';
	readonly targetTriple: string;
}

interface SidecarPaths {
	readonly sidecar: Sidecar;
	readonly sourcePath: string;
	readonly destPath: string;
	readonly destName: string;
}

// Pure functions
const parseArgs = (argv: readonly string[]): boolean =>
	argv.slice(2).some((arg) => arg === '--release' || arg === '-r');

const getProfile = (release: boolean): 'release' | 'debug' => (release ? 'release' : 'debug');

const buildDestName = (sidecar: Sidecar, targetTriple: string): string =>
	`${sidecar}-${targetTriple}`;

const buildSidecarPaths = (sidecar: Sidecar, config: BuildConfig): SidecarPaths => {
	const destName = buildDestName(sidecar, config.targetTriple);
	return {
		sidecar,
		sourcePath: join('src-tauri', 'target', config.profile, sidecar),
		destPath: join(BINARIES_DIR, destName),
		destName,
	};
};

const buildAllSidecarPaths = (config: BuildConfig): readonly SidecarPaths[] =>
	SIDECARS.map((sidecar) => buildSidecarPaths(sidecar, config));

const filterNonExistentPaths = (paths: readonly SidecarPaths[]): readonly SidecarPaths[] =>
	paths.filter((p) => !existsSync(p.destPath));

// Shell execution
const getTargetTriple = async (): Promise<string> => {
	const result = await $`rustc -Vv`.text();
	const match = result.match(/host:\s+(\S+)/);
	if (!match) {
		throw new Error('Failed to determine target triple');
	}
	return match[1];
};

const runCargoBuild = async (sidecar: Sidecar, release: boolean): Promise<void> => {
	const args = release ? ['build', '--bin', sidecar, '--release'] : ['build', '--bin', sidecar];
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

const cleanupPlaceholders = (paths: readonly SidecarPaths[]): void => {
	paths.forEach((p) => {
		if (existsSync(p.destPath)) {
			try {
				unlinkSync(p.destPath);
			} catch {
				// Ignore cleanup errors
			}
		}
	});
};

// Main workflow
const buildSidecars = async (release: boolean): Promise<void> => {
	const profile = getProfile(release);
	console.log(`Building sidecars in ${profile} mode...`);

	const targetTriple = await getTargetTriple();
	console.log(`Target triple: ${targetTriple}`);

	const config: BuildConfig = { release, profile, targetTriple };
	const allPaths = buildAllSidecarPaths(config);
	const placeholderPaths = filterNonExistentPaths(allPaths);

	ensureDirectory(BINARIES_DIR);

	// Create placeholders for Tauri's build.rs validation
	placeholderPaths.forEach((p) => {
		console.log(`  Creating placeholder for ${p.destName}...`);
		createPlaceholder(p.destPath);
	});

	try {
		// Build all sidecar binaries
		await Promise.all(
			SIDECARS.map(async (sidecar) => {
				console.log(`  Building ${sidecar}...`);
				await runCargoBuild(sidecar, release);
			})
		);

		// Copy binaries with target triple suffix
		allPaths.forEach((p) => {
			console.log(`  Copying ${p.sidecar} -> ${p.destName}`);
			copyBinary(p.sourcePath, p.destPath);
		});

		console.log('Sidecar build complete!');
	} catch (error) {
		cleanupPlaceholders(placeholderPaths);
		throw error;
	}
};

// Entry point
const release = parseArgs(process.argv);

buildSidecars(release).catch((error) => {
	console.error('Error building sidecars:', error);
	process.exit(1);
});
