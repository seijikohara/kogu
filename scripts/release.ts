#!/usr/bin/env bun

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const exec = (cmd: string, options?: { stdio?: 'inherit' | 'pipe' }): string => {
	try {
		const result = execSync(cmd, {
			encoding: 'utf-8',
			stdio: options?.stdio ?? 'pipe',
		});
		return typeof result === 'string' ? result.trim() : '';
	} catch (error) {
		if (error instanceof Error && 'status' in error) {
			process.exit(error.status as number);
		}
		throw error;
	}
};

const getCurrentVersion = (): string => {
	const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
	return packageJson.version;
};

const main = async () => {
	// Check if on main branch
	const currentBranch = exec('git branch --show-current');
	if (currentBranch !== 'main') {
		console.error('Error: Must be on main branch to create a release');
		console.error(`Current branch: ${currentBranch}`);
		process.exit(1);
	}

	// Check for uncommitted changes
	const status = exec('git status --porcelain');
	if (status) {
		console.error('Error: Working directory is not clean');
		console.error(status);
		process.exit(1);
	}

	// Pull latest changes
	console.log('Pulling latest changes...');
	exec('git pull origin main', { stdio: 'inherit' });

	const currentVersion = getCurrentVersion();
	console.log(`\nCurrent version: ${currentVersion}`);

	// Run bumpp to select new version
	console.log('\nSelect new version:');
	exec('bunx bumpp --no-push --no-tag --no-commit', { stdio: 'inherit' });

	const newVersion = getCurrentVersion();
	if (newVersion === currentVersion) {
		console.log('Version unchanged. Aborting.');
		process.exit(0);
	}

	const branchName = `release/v${newVersion}`;
	console.log(`\nCreating branch: ${branchName}`);

	// Create release branch
	exec(`git checkout -b ${branchName}`);

	// Commit changes
	exec('git add .');
	exec(`git commit -m "chore: release v${newVersion}"`);

	// Push branch
	console.log('Pushing branch...');
	exec(`git push -u origin ${branchName}`, { stdio: 'inherit' });

	// Create PR
	console.log('\nCreating pull request...');
	const prUrl = exec(
		`gh pr create --title "chore: release v${newVersion}" --body "## Release v${newVersion}

This PR was automatically created by the release script.

### Changes
- Bump version to ${newVersion}

### After Merge
A tag \\\`v${newVersion}\\\` will be automatically created, triggering the release workflow."`
	);

	console.log(`\n✅ Release PR created: ${prUrl}`);
	console.log('\nNext steps:');
	console.log('1. Review and merge the PR');
	console.log('2. Tag will be created automatically');
	console.log('3. Release workflow will build and publish artifacts');

	// Return to main branch
	exec('git checkout main');
};

main().catch(console.error);
