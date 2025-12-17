#!/usr/bin/env bun

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as readline from 'node:readline';

// Constants
const VERSION_FILES = [
	'package.json',
	'src-tauri/tauri.conf.json',
	'src-tauri/Cargo.toml',
] as const;

const RELEASE_TYPES = ['patch', 'minor', 'major'] as const;

// Types
type ReleaseType = (typeof RELEASE_TYPES)[number];

interface Version {
	readonly major: number;
	readonly minor: number;
	readonly patch: number;
}

interface ExecOptions {
	readonly stdio?: 'inherit' | 'pipe';
}

// Version bump strategies using object literal
const VERSION_BUMP_STRATEGIES = {
	major: ({ major }: Version): string => `${major + 1}.0.0`,
	minor: ({ major, minor }: Version): string => `${major}.${minor + 1}.0`,
	patch: ({ major, minor, patch }: Version): string => `${major}.${minor}.${patch + 1}`,
} as const satisfies Record<ReleaseType, (version: Version) => string>;

// Pure functions
const parseVersion = (version: string): Version => {
	const [major, minor, patch] = version.split('.').map(Number);
	return { major, minor, patch };
};

const bumpVersion = (current: string, type: ReleaseType): string =>
	VERSION_BUMP_STRATEGIES[type](parseVersion(current));

const formatCommitLine = (line: string): string => `  ${line}`;

const formatChangelogLine = (line: string): string => `- ${line}`;

const formatVersionUpdate = (file: string, oldVersion: string, newVersion: string): string =>
	`- \`${file}\`: ${oldVersion} → ${newVersion}`;

// File operations
const readJsonVersion = (filePath: string): string => {
	const content = readFileSync(resolve(process.cwd(), filePath), 'utf-8');
	return JSON.parse(content).version;
};

const updateJsonFile = (filePath: string, newVersion: string): string => {
	const fullPath = resolve(process.cwd(), filePath);
	const content = readFileSync(fullPath, 'utf-8');
	const json = JSON.parse(content);
	json.version = newVersion;
	const updatedContent = `${JSON.stringify(json, null, '\t')}
`;
	writeFileSync(fullPath, updatedContent);
	return filePath;
};

const updateCargoToml = (filePath: string, newVersion: string): string => {
	const fullPath = resolve(process.cwd(), filePath);
	const content = readFileSync(fullPath, 'utf-8');
	const updatedContent = content.replace(/^version = "[^"]*"/m, `version = "${newVersion}"`);
	writeFileSync(fullPath, updatedContent);
	return filePath;
};

const updateVersionInFile = (filePath: string, newVersion: string): string => {
	if (filePath.endsWith('.json')) return updateJsonFile(filePath, newVersion);
	if (filePath.endsWith('Cargo.toml')) return updateCargoToml(filePath, newVersion);
	throw new Error(`Unknown file type: ${filePath}`);
};

// Shell execution
const exec = (cmd: string, options: ExecOptions = {}): string => {
	try {
		const result = execSync(cmd, {
			encoding: 'utf-8',
			stdio: options.stdio ?? 'pipe',
		});
		return typeof result === 'string' ? result.trim() : '';
	} catch (error) {
		if (error instanceof Error && 'status' in error) {
			process.exit(error.status as number);
		}
		throw error;
	}
};

// Git operations
const getCurrentBranch = (): string => exec('git branch --show-current');

const getGitStatus = (): string => exec('git status --porcelain');

const getRecentCommits = (since: string): string => {
	try {
		return exec(
			`git log v${since}..HEAD --oneline --no-decorate 2>/dev/null || git log --oneline -10`
		);
	} catch {
		return exec('git log --oneline -10');
	}
};

const pullLatest = (): void => {
	exec('git pull origin main', { stdio: 'inherit' });
};

const createBranch = (name: string): void => {
	exec(`git checkout -b ${name}`);
};

const commitChanges = (message: string): void => {
	exec('git add .');
	exec(`git commit --no-gpg-sign -m "${message}"`);
};

const pushBranch = (name: string): void => {
	exec(`git push -u origin ${name}`, { stdio: 'inherit' });
};

const checkoutMain = (): void => {
	exec('git checkout main');
};

// User interaction
const prompt = async (question: string): Promise<string> => {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(question, (answer: string) => {
			rl.close();
			resolve(answer.trim());
		});
	});
};

const selectReleaseType = async (currentVersion: string): Promise<ReleaseType> => {
	console.log('\nSelect release type:');

	RELEASE_TYPES.forEach((type, index) => {
		const newVersion = bumpVersion(currentVersion, type);
		console.log(`  ${index + 1}) ${type.padEnd(6)} → ${newVersion}`);
	});

	const answer = await prompt('\nEnter choice (1-3): ');
	const choice = parseInt(answer, 10);

	if (choice < 1 || choice > 3) {
		console.error('Invalid choice. Aborting.');
		process.exit(1);
	}

	return RELEASE_TYPES[choice - 1];
};

// PR body builder
const buildPrBody = (
	newVersion: string,
	currentVersion: string,
	commits: string,
	files: readonly string[]
): string => {
	const changelogLines = commits.split('\n').map(formatChangelogLine).join('\n');
	const versionUpdates = files
		.map((file) => formatVersionUpdate(file, currentVersion, newVersion))
		.join('\n');

	return `## Release v${newVersion}

This PR was automatically created by the release script.

### Changes since v${currentVersion}
${changelogLines}

### Version Updates
${versionUpdates}

### After Merge
A tag \`v${newVersion}\` will be automatically created, triggering the release workflow.`;
};

// GitHub operations
const createPullRequest = (version: string, body: string): string => {
	const escapedBody = body.replace(/"/g, '\\"').replace(/\n/g, '\\n');
	return exec(`gh pr create --title "chore: release v${version}" --body "${escapedBody}"`);
};

// Validation
const validateMainBranch = (): void => {
	const currentBranch = getCurrentBranch();
	if (currentBranch === 'main') return;

	console.error('Error: Must be on main branch to create a release');
	console.error(`Current branch: ${currentBranch}`);
	process.exit(1);
};

const validateCleanWorkingDirectory = (): void => {
	const status = getGitStatus();
	if (!status) return;

	console.error('Error: Working directory is not clean');
	console.error(status);
	process.exit(1);
};

// Main workflow
const main = async (): Promise<void> => {
	// Validation
	validateMainBranch();
	validateCleanWorkingDirectory();

	// Pull latest
	console.log('Pulling latest changes...');
	pullLatest();

	const currentVersion = readJsonVersion('package.json');
	console.log(`\nCurrent version: ${currentVersion}`);

	// Show recent commits
	console.log('\nRecent commits:');
	const commits = getRecentCommits(currentVersion);
	const formattedCommits = commits.split('\n').map(formatCommitLine).join('\n');
	console.log(formattedCommits);

	// Select release type
	const releaseType = await selectReleaseType(currentVersion);
	const newVersion = bumpVersion(currentVersion, releaseType);

	console.log(`\nBumping version: ${currentVersion} → ${newVersion}`);

	// Update version files
	console.log('\nUpdating version files:');
	const updatedFiles = VERSION_FILES.map((file) => {
		const updated = updateVersionInFile(file, newVersion);
		console.log(`  ✓ Updated ${updated}`);
		return updated;
	});

	// Update lockfile
	console.log('\nUpdating lockfile...');
	exec('bun install', { stdio: 'inherit' });

	// Create release branch
	const branchName = `release/v${newVersion}`;
	console.log(`\nCreating branch: ${branchName}`);
	createBranch(branchName);

	// Commit and push
	commitChanges(`chore: release v${newVersion}`);
	console.log('\nPushing branch...');
	pushBranch(branchName);

	// Create PR
	console.log('\nCreating pull request...');
	const prBody = buildPrBody(newVersion, currentVersion, commits, updatedFiles);
	const prUrl = createPullRequest(newVersion, prBody);

	console.log(`\n✅ Release PR created: ${prUrl}`);
	console.log('\nNext steps:');
	console.log('1. Review and merge the PR');
	console.log('2. Tag will be created automatically');
	console.log('3. Release workflow will build and publish artifacts');

	// Return to main
	checkoutMain();
};

main().catch(console.error);
