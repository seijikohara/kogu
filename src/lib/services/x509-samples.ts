/**
 * Sample certificate generator for the X.509 Certificate Decoder tool.
 *
 * Generates fresh, self-signed certificates at runtime via Web Crypto and
 * `@peculiar/x509`. Avoids shipping any hard-coded PEM / DER blobs in the
 * source tree (which would otherwise grow stale and bloat the bundle).
 */

import {
	BasicConstraintsExtension,
	cryptoProvider,
	ExtendedKeyUsageExtension,
	KeyUsageFlags,
	KeyUsagesExtension,
	SubjectAlternativeNameExtension,
	SubjectKeyIdentifierExtension,
	X509CertificateGenerator,
} from '@peculiar/x509';

cryptoProvider.set(crypto);

const RSA_ALG: RsaHashedKeyGenParams = {
	name: 'RSASSA-PKCS1-v1_5',
	modulusLength: 2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash: 'SHA-256',
};

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const newSerial = (): string => {
	const bytes = new Uint8Array(8);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Generate a fresh self-signed leaf certificate (TLS server + client usage,
 * valid for one year from now).
 */
export const generateSampleLeafCertificate = async (): Promise<string> => {
	const keys = await crypto.subtle.generateKey(RSA_ALG, true, ['sign', 'verify']);
	const now = new Date();
	const ski = await SubjectKeyIdentifierExtension.create(keys.publicKey);
	const san = new SubjectAlternativeNameExtension([
		{ type: 'dns', value: 'sample.kogu.local' },
		{ type: 'dns', value: '*.sample.kogu.local' },
		{ type: 'ip', value: '127.0.0.1' },
		{ type: 'email', value: 'sample@kogu.local' },
	]);
	const cert = await X509CertificateGenerator.createSelfSigned({
		serialNumber: newSerial(),
		name: 'CN=sample.kogu.local, O=Kogu Sample, OU=Engineering, C=US, ST=California, L=San Francisco',
		notBefore: now,
		notAfter: new Date(now.getTime() + YEAR_MS),
		signingAlgorithm: RSA_ALG,
		keys,
		extensions: [
			new BasicConstraintsExtension(false, undefined, true),
			new KeyUsagesExtension(KeyUsageFlags.digitalSignature | KeyUsageFlags.keyEncipherment, true),
			new ExtendedKeyUsageExtension(['1.3.6.1.5.5.7.3.1', '1.3.6.1.5.5.7.3.2'], false),
			san,
			ski,
		],
	});
	return cert.toString('pem');
};

/**
 * Generate a fresh two-cert chain: a CA root and a leaf signed by the CA.
 * The returned string concatenates both PEMs (CA first, then leaf) and is
 * the canonical "chain bundle" format consumed by parseCertificates().
 */
export const generateSampleChain = async (): Promise<string> => {
	const caKeys = await crypto.subtle.generateKey(RSA_ALG, true, ['sign', 'verify']);
	const leafKeys = await crypto.subtle.generateKey(RSA_ALG, true, ['sign', 'verify']);
	const now = new Date();
	const caNotAfter = new Date(now.getTime() + YEAR_MS * 5);
	const leafNotAfter = new Date(now.getTime() + YEAR_MS);

	const caSki = await SubjectKeyIdentifierExtension.create(caKeys.publicKey);
	const ca = await X509CertificateGenerator.createSelfSigned({
		serialNumber: newSerial(),
		name: 'CN=Kogu Sample Root CA, O=Kogu Sample, C=US',
		notBefore: now,
		notAfter: caNotAfter,
		signingAlgorithm: RSA_ALG,
		keys: caKeys,
		extensions: [
			new BasicConstraintsExtension(true, 1, true),
			new KeyUsagesExtension(KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign, true),
			caSki,
		],
	});

	const leafSki = await SubjectKeyIdentifierExtension.create(leafKeys.publicKey);
	const leaf = await X509CertificateGenerator.create({
		serialNumber: newSerial(),
		subject: 'CN=sample.kogu.local, O=Kogu Sample, C=US',
		issuer: ca.subject,
		notBefore: now,
		notAfter: leafNotAfter,
		signingAlgorithm: RSA_ALG,
		publicKey: leafKeys.publicKey,
		signingKey: caKeys.privateKey,
		extensions: [
			new BasicConstraintsExtension(false, undefined, true),
			new KeyUsagesExtension(KeyUsageFlags.digitalSignature | KeyUsageFlags.keyEncipherment, true),
			new ExtendedKeyUsageExtension(['1.3.6.1.5.5.7.3.1'], false),
			new SubjectAlternativeNameExtension([
				{ type: 'dns', value: 'sample.kogu.local' },
				{ type: 'dns', value: 'api.sample.kogu.local' },
			]),
			leafSki,
		],
	});

	return `${ca.toString('pem')}\n${leaf.toString('pem')}`;
};
