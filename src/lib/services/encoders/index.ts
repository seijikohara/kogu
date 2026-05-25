/**
 * Encoder/Decoder services for Base64, URL, JWT, and Hash operations.
 */

export {
	BASE64_MIME_TYPES,
	base64ToBlob,
	calculateBase64Stats,
	decodeFromBase64,
	defaultBase64DecodeOptions,
	defaultBase64EncodeOptions,
	detectBase64Variant,
	encodeToBase64,
	extractMimeType,
	fileToBase64,
	formatBytes,
	isDataUrl,
	SAMPLE_TEXT_FOR_BASE64,
	validateBase64,
} from './base64';
export type {
	Base64DecodeOptions,
	Base64EncodeOptions,
	Base64LineBreak,
	Base64Stats,
	Base64Variant,
} from './base64';

export {
	buildUrl,
	decodeUrl,
	decodeUrlComponent,
	decodeUrlWithOptions,
	defaultUrlDecodeOptions,
	defaultUrlEncodeOptions,
	encodeUrl,
	encodeUrlComponent,
	encodeUrlWithOptions,
	getEncodingDepth,
	isDoubleEncoded,
	parseUrl,
	RFC3986_UNRESERVED,
	SAMPLE_URL,
	URL_ENCODING_EXAMPLES,
	URL_MODE_PRESERVED_CHARS,
} from './url';
export type {
	QueryParameter,
	UrlComponents,
	UrlDecodeOptions,
	UrlEncodeMode,
	UrlEncodeOptions,
	UrlHexCase,
	UrlInvalidHandling,
	UrlNewlineHandling,
	UrlSpaceEncoding,
} from './url';

export { base64UrlDecode, decodeJwt, JWT_STANDARD_CLAIMS, SAMPLE_JWT, validateJwt } from './jwt';
export type { JwtDecoded, JwtHeader, JwtPayload } from './jwt';

export {
	compareHashes,
	generateAllFileHashes,
	generateAllHashes,
	generateFileHash,
	generateHash,
	HASH_ALGORITHMS,
	SAMPLE_TEXT_FOR_HASH,
} from './hash';
export type { HashAlgorithm, HashResult } from './hash';
