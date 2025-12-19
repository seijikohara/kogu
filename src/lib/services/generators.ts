/**
 * Generator services for SSH, GPG, and BCrypt key/hash generation.
 * These are TypeScript wrappers around Tauri backend commands.
 */

import { invoke } from '@tauri-apps/api/core';

// =============================================================================
// BCrypt Types
// =============================================================================

export interface BcryptHashResult {
	readonly hash: string;
	readonly cost: number;
	readonly algorithm: string;
}

export interface BcryptVerifyResult {
	readonly valid: boolean;
	readonly message: string;
}

export interface BcryptCostInfo {
	readonly cost: number;
	readonly estimated_time_ms: number;
	readonly security_level: string;
}

// =============================================================================
// SSH Key Types
// =============================================================================

export type SshKeyAlgorithm =
	| 'ed25519'
	| 'ecdsa_p256'
	| 'ecdsa_p384'
	| 'rsa2048'
	| 'rsa3072'
	| 'rsa4096';
export type GenerationMethod = 'library' | 'cli';

export interface SshKeyOptions {
	readonly algorithm: SshKeyAlgorithm;
	readonly comment?: string;
	readonly passphrase?: string;
	readonly method: GenerationMethod;
}

export interface SshKeyResult {
	readonly public_key: string;
	readonly private_key: string;
	readonly fingerprint: string;
	readonly algorithm: string;
	readonly method_used: string;
	readonly ssh_keygen_command: string;
}

export const SSH_ALGORITHMS = [
	{ value: 'ed25519' as const, label: 'Ed25519', recommended: true },
	{ value: 'ecdsa_p256' as const, label: 'ECDSA P-256', recommended: false },
	{ value: 'ecdsa_p384' as const, label: 'ECDSA P-384', recommended: false },
	{ value: 'rsa2048' as const, label: 'RSA 2048', recommended: false },
	{ value: 'rsa3072' as const, label: 'RSA 3072', recommended: false },
	{ value: 'rsa4096' as const, label: 'RSA 4096', recommended: false },
] as const;

// =============================================================================
// GPG Key Types
// =============================================================================

export type GpgKeyAlgorithm = 'rsa2048' | 'rsa3072' | 'rsa4096' | 'ecdsa_p256' | 'ecdsa_p384';

export interface GpgKeyOptions {
	readonly algorithm: GpgKeyAlgorithm;
	readonly name: string;
	readonly email: string;
	readonly comment?: string;
	readonly passphrase?: string;
	readonly method: GenerationMethod;
}

export interface GpgKeyResult {
	readonly algorithm: string;
	readonly user_id: string;
	readonly fingerprint: string;
	readonly public_key: string;
	readonly private_key: string;
	readonly gpg_command_interactive: string;
	readonly gpg_command_batch: string;
	readonly method_used: string;
}

export const GPG_ALGORITHMS = [
	{ value: 'ecdsa_p256' as const, label: 'ECDSA P-256', recommended: true },
	{ value: 'ecdsa_p384' as const, label: 'ECDSA P-384', recommended: false },
	{ value: 'rsa4096' as const, label: 'RSA 4096', recommended: false },
	{ value: 'rsa3072' as const, label: 'RSA 3072', recommended: false },
	{ value: 'rsa2048' as const, label: 'RSA 2048', recommended: false },
] as const;

// =============================================================================
// GPG Helper Functions
// =============================================================================

/**
 * Build GPG User ID string from name, email, and optional comment.
 */
export const buildGpgUserId = (name: string, email: string, comment?: string): string => {
	if (comment?.trim()) {
		return `${name} (${comment}) <${email}>`;
	}
	return `${name} <${email}>`;
};

/**
 * Validate email address format.
 */
export const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

// =============================================================================
// CLI Availability
// =============================================================================

export interface CliAvailability {
	readonly ssh_keygen: boolean;
	readonly gpg: boolean;
	readonly ssh_keygen_version?: string;
	readonly gpg_version?: string;
}

// =============================================================================
// BCrypt Functions
// =============================================================================

export const MIN_BCRYPT_COST = 4;
export const MAX_BCRYPT_COST = 20;
export const DEFAULT_BCRYPT_COST = 10;

/**
 * Generate a BCrypt hash from a password.
 */
export const generateBcryptHash = async (
	password: string,
	cost: number
): Promise<BcryptHashResult> =>
	invoke<BcryptHashResult>('generate_bcrypt_hash', { password, cost });

/**
 * Verify a password against a BCrypt hash.
 */
export const verifyBcryptHash = async (
	password: string,
	hash: string
): Promise<BcryptVerifyResult> =>
	invoke<BcryptVerifyResult>('verify_bcrypt_hash', { password, hash });

/**
 * Get information about a BCrypt cost factor.
 */
export const getBcryptCostInfo = async (cost: number): Promise<BcryptCostInfo> =>
	invoke<BcryptCostInfo>('get_bcrypt_cost_info', { cost });

/**
 * Cancel any ongoing BCrypt operation.
 * This will cause the operation to return an error immediately,
 * though the background computation may continue until completion.
 */
export const cancelBcryptOperation = async (): Promise<void> =>
	invoke<void>('cancel_bcrypt_operation');

// =============================================================================
// SSH Key Functions
// =============================================================================

/**
 * Generate an SSH key pair.
 */
export const generateSshKeyPair = async (options: SshKeyOptions): Promise<SshKeyResult> =>
	invoke<SshKeyResult>('generate_ssh_keypair', { options });

// =============================================================================
// GPG Key Functions
// =============================================================================

/**
 * Generate a GPG key pair.
 */
export const generateGpgKeyPair = async (options: GpgKeyOptions): Promise<GpgKeyResult> =>
	invoke<GpgKeyResult>('generate_gpg_keypair', { options });

// =============================================================================
// CLI Availability Functions
// =============================================================================

/**
 * Check if CLI tools (ssh-keygen, gpg) are available.
 */
export const checkCliAvailability = async (): Promise<CliAvailability> =>
	invoke<CliAvailability>('check_cli_availability');
