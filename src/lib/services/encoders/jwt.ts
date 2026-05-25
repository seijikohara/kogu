/**
 * JWT decoder service.
 */

export interface JwtHeader {
	alg?: string;
	typ?: string;
	[key: string]: unknown;
}

export interface JwtPayload {
	iss?: string;
	sub?: string;
	aud?: string | string[];
	exp?: number;
	nbf?: number;
	iat?: number;
	jti?: string;
	[key: string]: unknown;
}

export interface JwtDecoded {
	header: JwtHeader;
	payload: JwtPayload;
	signature: string;
	isExpired: boolean;
	expiresAt?: Date;
	issuedAt?: Date;
	notBefore?: Date;
}

/**
 * Decode Base64URL to string.
 */
export const base64UrlDecode = (str: string): string => {
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	const padding = base64.length % 4;
	const paddedBase64 = padding ? `${base64}${'='.repeat(4 - padding)}` : base64;

	return decodeURIComponent(
		globalThis
			.atob(paddedBase64)
			.split('')
			.map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
			.join('')
	);
};

/**
 * Decode JWT token.
 */
export const decodeJwt = (token: string): JwtDecoded | null => {
	const parts = token.trim().split('.');
	if (parts.length !== 3) {
		return null;
	}

	const headerPart = parts[0];
	const payloadPart = parts[1];
	const signaturePart = parts[2];

	if (!headerPart || !payloadPart || !signaturePart) {
		return null;
	}

	try {
		const header = JSON.parse(base64UrlDecode(headerPart)) as JwtHeader;
		const payload = JSON.parse(base64UrlDecode(payloadPart)) as JwtPayload;

		const now = Date.now() / 1000;
		const isExpired = payload.exp ? payload.exp < now : false;

		return {
			header,
			payload,
			signature: signaturePart,
			isExpired,
			expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
			issuedAt: payload.iat ? new Date(payload.iat * 1000) : undefined,
			notBefore: payload.nbf ? new Date(payload.nbf * 1000) : undefined,
		};
	} catch {
		return null;
	}
};

/**
 * Validate JWT format.
 */
export const validateJwt = (input: string): { valid: boolean; error?: string } => {
	if (!input.trim()) {
		return { valid: false, error: 'Empty input' };
	}

	const parts = input.trim().split('.');
	if (parts.length !== 3) {
		return { valid: false, error: 'JWT must have 3 parts separated by dots' };
	}

	const decoded = decodeJwt(input);
	if (!decoded) {
		return { valid: false, error: 'Invalid JWT encoding' };
	}

	return { valid: true };
};

/**
 * JWT standard claims descriptions.
 */
export const JWT_STANDARD_CLAIMS: { claim: string; name: string; description: string }[] = [
	{ claim: 'iss', name: 'Issuer', description: 'Principal that issued the JWT' },
	{ claim: 'sub', name: 'Subject', description: 'Subject of the JWT' },
	{ claim: 'aud', name: 'Audience', description: 'Recipients the JWT is intended for' },
	{ claim: 'exp', name: 'Expiration Time', description: 'Time after which the JWT expires' },
	{ claim: 'nbf', name: 'Not Before', description: 'Time before which the JWT is not valid' },
	{ claim: 'iat', name: 'Issued At', description: 'Time at which the JWT was issued' },
	{ claim: 'jti', name: 'JWT ID', description: 'Unique identifier for the JWT' },
];

export const SAMPLE_JWT =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE5MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';
