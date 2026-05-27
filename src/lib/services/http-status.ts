/**
 * HTTP Status Code reference data and filter logic.
 *
 * Catalog includes all IANA-registered codes (100-599) defined primarily in
 * RFC 9110 (Semantics, June 2022), plus widely-used non-standard codes
 * (Cloudflare 520-527, nginx 444/494/499, etc.). Each entry carries a
 * one-sentence summary, an RFC reference where applicable, optional
 * "when to use" guidance, optional misuse warnings on commonly-confused
 * codes, and a list of semantically-adjacent codes.
 *
 * All data and filters are framework-agnostic and pure.
 */

export type StatusCategory = '1xx' | '2xx' | '3xx' | '4xx' | '5xx';

export type StatusKind =
	| 'informational'
	| 'success'
	| 'redirection'
	| 'client-error'
	| 'server-error';

export interface StatusCode {
	readonly code: number;
	readonly phrase: string;
	readonly category: StatusCategory;
	readonly kind: StatusKind;
	readonly summary: string;
	readonly rfc?: string;
	readonly rfcUrl?: string;
	readonly whenToUse?: string;
	readonly misuse?: string;
	readonly related?: readonly number[];
	readonly standard: boolean;
}

/** Canonical IANA registry URL. */
const IANA_URL = 'https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml';

/** RFC 9110 (HTTP Semantics) anchor for a section number, e.g. "15.5.5". */
const rfc9110 = (section: string): string =>
	`https://www.rfc-editor.org/rfc/rfc9110#section-${section}`;

const rfcUrl = (rfc: string, section: string): string =>
	`https://www.rfc-editor.org/rfc/${rfc.toLowerCase()}#section-${section}`;

export const STATUS_CODES: readonly StatusCode[] = [
	// ---------------------------------------------------------------- 1xx ----
	{
		code: 100,
		phrase: 'Continue',
		category: '1xx',
		kind: 'informational',
		summary:
			'Initial part of the request received and the client should continue sending the request body.',
		rfc: 'RFC 9110 §15.2.1',
		rfcUrl: rfc9110('15.2.1'),
		whenToUse:
			'Respond when the client sent "Expect: 100-continue" and the request looks acceptable.',
		standard: true,
	},
	{
		code: 101,
		phrase: 'Switching Protocols',
		category: '1xx',
		kind: 'informational',
		summary: 'Server is switching protocols as requested by the client in the Upgrade header.',
		rfc: 'RFC 9110 §15.2.2',
		rfcUrl: rfc9110('15.2.2'),
		whenToUse:
			'Use when upgrading from HTTP/1.1 to WebSocket or HTTP/2 over the same TCP connection.',
		standard: true,
	},
	{
		code: 102,
		phrase: 'Processing',
		category: '1xx',
		kind: 'informational',
		summary:
			'WebDAV interim response indicating the server has accepted the complete request but is still processing it.',
		rfc: 'RFC 2518 §10.1',
		rfcUrl: rfcUrl('rfc2518', '10.1'),
		whenToUse:
			'Send periodically during a long WebDAV operation to keep the client from timing out.',
		standard: true,
	},
	{
		code: 103,
		phrase: 'Early Hints',
		category: '1xx',
		kind: 'informational',
		summary:
			'Allows the user agent to start preloading resources while the server prepares the final response.',
		rfc: 'RFC 8297',
		rfcUrl: 'https://www.rfc-editor.org/rfc/rfc8297',
		whenToUse:
			'Send Link headers early so the browser can begin fetching critical CSS / JS in parallel.',
		standard: true,
	},

	// ---------------------------------------------------------------- 2xx ----
	{
		code: 200,
		phrase: 'OK',
		category: '2xx',
		kind: 'success',
		summary: 'Request succeeded; the meaning of the success depends on the HTTP method.',
		rfc: 'RFC 9110 §15.3.1',
		rfcUrl: rfc9110('15.3.1'),
		whenToUse:
			'Default success response for GET, HEAD, PUT, POST, DELETE when no more specific code applies.',
		misuse: 'Do not return 200 with an error body — pick the right 4xx/5xx code instead.',
		related: [201, 202, 204],
		standard: true,
	},
	{
		code: 201,
		phrase: 'Created',
		category: '2xx',
		kind: 'success',
		summary: 'Request succeeded and a new resource has been created as a result.',
		rfc: 'RFC 9110 §15.3.2',
		rfcUrl: rfc9110('15.3.2'),
		whenToUse:
			'Respond to POST / PUT that creates a resource; include a Location header pointing to it.',
		related: [200, 202, 204],
		standard: true,
	},
	{
		code: 202,
		phrase: 'Accepted',
		category: '2xx',
		kind: 'success',
		summary: 'Request accepted for processing but processing has not been completed.',
		rfc: 'RFC 9110 §15.3.3',
		rfcUrl: rfc9110('15.3.3'),
		whenToUse:
			'Acknowledge work that is dispatched asynchronously; return a status URL clients can poll.',
		related: [200, 201, 204],
		standard: true,
	},
	{
		code: 203,
		phrase: 'Non-Authoritative Information',
		category: '2xx',
		kind: 'success',
		summary:
			'Returned metadata is not exactly the same as available from the origin but is from a local or third-party copy.',
		rfc: 'RFC 9110 §15.3.4',
		rfcUrl: rfc9110('15.3.4'),
		whenToUse: 'Use on a proxy that transformed the upstream response.',
		standard: true,
	},
	{
		code: 204,
		phrase: 'No Content',
		category: '2xx',
		kind: 'success',
		summary: 'Request succeeded and there is no additional content to send in the response body.',
		rfc: 'RFC 9110 §15.3.5',
		rfcUrl: rfc9110('15.3.5'),
		whenToUse:
			'Respond to DELETE or to a PUT/PATCH that does not return the resource representation.',
		related: [200, 205, 304],
		standard: true,
	},
	{
		code: 205,
		phrase: 'Reset Content',
		category: '2xx',
		kind: 'success',
		summary:
			'Instructs the user agent to reset the document that sent the request (e.g. clear the submitted form).',
		rfc: 'RFC 9110 §15.3.6',
		rfcUrl: rfc9110('15.3.6'),
		whenToUse:
			'After a data-entry submission, when you want the client to clear and reset the form.',
		related: [204],
		standard: true,
	},
	{
		code: 206,
		phrase: 'Partial Content',
		category: '2xx',
		kind: 'success',
		summary: 'Server is delivering only part of the resource due to a Range header in the request.',
		rfc: 'RFC 9110 §15.3.7',
		rfcUrl: rfc9110('15.3.7'),
		whenToUse: 'Reply to range requests for downloads, video streaming, or resumable uploads.',
		related: [200, 416],
		standard: true,
	},
	{
		code: 207,
		phrase: 'Multi-Status',
		category: '2xx',
		kind: 'success',
		summary: 'WebDAV: response body conveys the status of multiple independent operations.',
		rfc: 'RFC 4918 §11.1',
		rfcUrl: rfcUrl('rfc4918', '11.1'),
		whenToUse:
			'Reply to a WebDAV PROPFIND / batch operation where individual items may differ in status.',
		standard: true,
	},
	{
		code: 208,
		phrase: 'Already Reported',
		category: '2xx',
		kind: 'success',
		summary:
			'WebDAV: members of a DAV binding have already been enumerated in a previous part of the multistatus.',
		rfc: 'RFC 5842 §7.1',
		rfcUrl: rfcUrl('rfc5842', '7.1'),
		whenToUse: 'Avoid repeating internal members in WebDAV PROPFIND responses with bindings.',
		standard: true,
	},
	{
		code: 226,
		phrase: 'IM Used',
		category: '2xx',
		kind: 'success',
		summary:
			'Server fulfilled a GET request and the response is a representation of the result of one or more instance manipulations.',
		rfc: 'RFC 3229 §10.4.1',
		rfcUrl: rfcUrl('rfc3229', '10.4.1'),
		whenToUse: 'Use with delta encoding when responding to clients that advertise A-IM support.',
		standard: true,
	},

	// ---------------------------------------------------------------- 3xx ----
	{
		code: 300,
		phrase: 'Multiple Choices',
		category: '3xx',
		kind: 'redirection',
		summary:
			'Request has more than one possible response; the user agent or user should choose one of them.',
		rfc: 'RFC 9110 §15.4.1',
		rfcUrl: rfc9110('15.4.1'),
		whenToUse:
			'Offer alternative representations (e.g. language variants) and let the client pick.',
		standard: true,
	},
	{
		code: 301,
		phrase: 'Moved Permanently',
		category: '3xx',
		kind: 'redirection',
		summary: 'Resource has been permanently moved to the URL in the Location header.',
		rfc: 'RFC 9110 §15.4.2',
		rfcUrl: rfc9110('15.4.2'),
		whenToUse: 'Use for permanent URL changes that should be cached and update bookmarks.',
		misuse:
			'301 is aggressively cached. Prefer 302 for temporary moves; once cached, 301 is hard to undo.',
		related: [302, 303, 307, 308],
		standard: true,
	},
	{
		code: 302,
		phrase: 'Found',
		category: '3xx',
		kind: 'redirection',
		summary:
			'Resource resides temporarily under a different URL; future requests should still use the original URL.',
		rfc: 'RFC 9110 §15.4.3',
		rfcUrl: rfc9110('15.4.3'),
		whenToUse:
			'Default temporary redirect when method-preservation does not matter (browsers often rewrite to GET).',
		misuse:
			'Many clients rewrite the method to GET; if you need the original method preserved, use 307 instead.',
		related: [301, 303, 307, 308],
		standard: true,
	},
	{
		code: 303,
		phrase: 'See Other',
		category: '3xx',
		kind: 'redirection',
		summary:
			'Response can be found at another URL using a GET method; commonly used after POST to redirect to a result page.',
		rfc: 'RFC 9110 §15.4.4',
		rfcUrl: rfc9110('15.4.4'),
		whenToUse:
			'Implement the Post/Redirect/Get pattern after form submission to avoid duplicate POSTs on refresh.',
		related: [301, 302, 307],
		standard: true,
	},
	{
		code: 304,
		phrase: 'Not Modified',
		category: '3xx',
		kind: 'redirection',
		summary: 'Cached copy is still fresh; client should use its stored representation.',
		rfc: 'RFC 9110 §15.4.5',
		rfcUrl: rfc9110('15.4.5'),
		whenToUse:
			'Respond to conditional GET (If-None-Match / If-Modified-Since) when the resource is unchanged.',
		related: [200, 412],
		standard: true,
	},
	{
		code: 305,
		phrase: 'Use Proxy',
		category: '3xx',
		kind: 'redirection',
		summary:
			'Deprecated: requested resource must be accessed through the proxy given in the Location field.',
		rfc: 'RFC 9110 §15.4.6',
		rfcUrl: rfc9110('15.4.6'),
		whenToUse: 'Do not use — deprecated due to security concerns.',
		standard: true,
	},
	{
		code: 307,
		phrase: 'Temporary Redirect',
		category: '3xx',
		kind: 'redirection',
		summary:
			'Resource resides temporarily under a different URL; the request method and body must not change when redirecting.',
		rfc: 'RFC 9110 §15.4.8',
		rfcUrl: rfc9110('15.4.8'),
		whenToUse: 'Temporary redirect that preserves the HTTP method (POST stays POST).',
		misuse:
			'307/308 preserve the request method. Use 307 (not 302) when redirecting a POST and you want it re-POSTed.',
		related: [302, 308],
		standard: true,
	},
	{
		code: 308,
		phrase: 'Permanent Redirect',
		category: '3xx',
		kind: 'redirection',
		summary:
			'Resource has been permanently moved; the request method and body must not change when following the redirect.',
		rfc: 'RFC 9110 §15.4.9',
		rfcUrl: rfc9110('15.4.9'),
		whenToUse:
			'Permanent redirect for APIs where the original method (POST / PUT) must be preserved.',
		misuse:
			'307/308 preserve the request method. Use 308 (not 301) for permanent API URL changes that must keep POST.',
		related: [301, 307],
		standard: true,
	},

	// ---------------------------------------------------------------- 4xx ----
	{
		code: 400,
		phrase: 'Bad Request',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Server cannot or will not process the request due to a client error (malformed syntax, invalid framing, etc.).',
		rfc: 'RFC 9110 §15.5.1',
		rfcUrl: rfc9110('15.5.1'),
		whenToUse:
			'Reject malformed JSON, invalid headers, or otherwise unparseable input at the protocol layer.',
		misuse:
			'Reserve 400 for malformed input. Use 422 when the body is well-formed but semantically invalid.',
		related: [422],
		standard: true,
	},
	{
		code: 401,
		phrase: 'Unauthorized',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Request lacks valid authentication credentials for the target resource; "Unauthenticated" would be more accurate.',
		rfc: 'RFC 9110 §15.5.2',
		rfcUrl: rfc9110('15.5.2'),
		whenToUse:
			'Use when no credentials were sent or the credentials are invalid; include a WWW-Authenticate header.',
		misuse:
			'401 = not authenticated (missing/invalid credentials). 403 = authenticated but not authorized for this resource.',
		related: [403, 407],
		standard: true,
	},
	{
		code: 402,
		phrase: 'Payment Required',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Reserved for future use; sometimes returned by APIs to indicate a billing issue or quota exhaustion.',
		rfc: 'RFC 9110 §15.5.3',
		rfcUrl: rfc9110('15.5.3'),
		whenToUse:
			'Optionally used by paid APIs to flag subscription/billing failures; behavior is non-standard.',
		standard: true,
	},
	{
		code: 403,
		phrase: 'Forbidden',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Server understood the request but refuses to authorize it; re-authenticating will not help.',
		rfc: 'RFC 9110 §15.5.4',
		rfcUrl: rfc9110('15.5.4'),
		whenToUse:
			'Use when the authenticated principal lacks permission for the action regardless of credentials.',
		misuse:
			'403 means "not allowed even with valid credentials". Use 401 when credentials are missing or invalid.',
		related: [401, 404, 405],
		standard: true,
	},
	{
		code: 404,
		phrase: 'Not Found',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Server cannot find the requested resource; the URL may be wrong or the resource may not exist.',
		rfc: 'RFC 9110 §15.5.5',
		rfcUrl: rfc9110('15.5.5'),
		whenToUse:
			'Use when the resource identified by the URL does not exist (or to hide its existence from unauthorized callers).',
		misuse:
			'404 for a missing item is correct; 404 for an existing collection endpoint with zero results is wrong — return 200 with [].',
		related: [403, 410],
		standard: true,
	},
	{
		code: 405,
		phrase: 'Method Not Allowed',
		category: '4xx',
		kind: 'client-error',
		summary: 'Request method is known by the server but not supported by the target resource.',
		rfc: 'RFC 9110 §15.5.6',
		rfcUrl: rfc9110('15.5.6'),
		whenToUse:
			'Reject methods the endpoint does not support; include an Allow header listing valid methods.',
		related: [403, 501],
		standard: true,
	},
	{
		code: 406,
		phrase: 'Not Acceptable',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Server cannot produce a response matching the list of acceptable values defined in the request Accept headers.',
		rfc: 'RFC 9110 §15.5.7',
		rfcUrl: rfc9110('15.5.7'),
		whenToUse: 'Use when content negotiation fails for Accept / Accept-Language / Accept-Encoding.',
		standard: true,
	},
	{
		code: 407,
		phrase: 'Proxy Authentication Required',
		category: '4xx',
		kind: 'client-error',
		summary: 'Similar to 401, but authentication must be done by a proxy.',
		rfc: 'RFC 9110 §15.5.8',
		rfcUrl: rfc9110('15.5.8'),
		whenToUse: 'Returned by a proxy that requires authentication before forwarding the request.',
		related: [401],
		standard: true,
	},
	{
		code: 408,
		phrase: 'Request Timeout',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Server timed out waiting for the request; the client may repeat the request without modifications.',
		rfc: 'RFC 9110 §15.5.9',
		rfcUrl: rfc9110('15.5.9'),
		whenToUse:
			'Close idle connections that did not finish sending the request within the server timeout.',
		standard: true,
	},
	{
		code: 409,
		phrase: 'Conflict',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Request conflicts with the current state of the target resource (e.g. concurrent edit).',
		rfc: 'RFC 9110 §15.5.10',
		rfcUrl: rfc9110('15.5.10'),
		whenToUse:
			'Reject optimistic-concurrency conflicts, duplicate-key inserts, or competing edits.',
		standard: true,
	},
	{
		code: 410,
		phrase: 'Gone',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Resource is no longer available and will not be available again; the condition is expected to be permanent.',
		rfc: 'RFC 9110 §15.5.11',
		rfcUrl: rfc9110('15.5.11'),
		whenToUse:
			'Signal that a resource has been intentionally retired so search engines and caches can purge it.',
		related: [404],
		standard: true,
	},
	{
		code: 411,
		phrase: 'Length Required',
		category: '4xx',
		kind: 'client-error',
		summary: 'Server refuses to accept the request without a defined Content-Length header.',
		rfc: 'RFC 9110 §15.5.12',
		rfcUrl: rfc9110('15.5.12'),
		whenToUse: 'Demand Content-Length for endpoints that cannot stream the request body.',
		standard: true,
	},
	{
		code: 412,
		phrase: 'Precondition Failed',
		category: '4xx',
		kind: 'client-error',
		summary: 'One or more conditions given in the request header fields evaluated to false.',
		rfc: 'RFC 9110 §15.5.13',
		rfcUrl: rfc9110('15.5.13'),
		whenToUse:
			'Reject conditional PUT / PATCH when If-Match / If-Unmodified-Since does not hold (optimistic concurrency).',
		related: [304, 428],
		standard: true,
	},
	{
		code: 413,
		phrase: 'Content Too Large',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Request body is larger than the server is willing or able to process. Previously "Payload Too Large".',
		rfc: 'RFC 9110 §15.5.14',
		rfcUrl: rfc9110('15.5.14'),
		whenToUse: 'Reject uploads beyond the configured maximum size.',
		standard: true,
	},
	{
		code: 414,
		phrase: 'URI Too Long',
		category: '4xx',
		kind: 'client-error',
		summary: 'Request-target is longer than the server is willing to interpret.',
		rfc: 'RFC 9110 §15.5.15',
		rfcUrl: rfc9110('15.5.15'),
		whenToUse: 'Reject pathologically long URLs (often a sign of misuse or attack).',
		standard: true,
	},
	{
		code: 415,
		phrase: 'Unsupported Media Type',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Server refuses to accept the request because the payload format is in an unsupported media type.',
		rfc: 'RFC 9110 §15.5.16',
		rfcUrl: rfc9110('15.5.16'),
		whenToUse: 'Reject Content-Type values that the endpoint does not support.',
		standard: true,
	},
	{
		code: 416,
		phrase: 'Range Not Satisfiable',
		category: '4xx',
		kind: 'client-error',
		summary:
			'None of the ranges in the request Range header overlap the current extent of the selected resource.',
		rfc: 'RFC 9110 §15.5.17',
		rfcUrl: rfc9110('15.5.17'),
		whenToUse: 'Respond when a Range request asks for bytes beyond the size of the resource.',
		related: [206],
		standard: true,
	},
	{
		code: 417,
		phrase: 'Expectation Failed',
		category: '4xx',
		kind: 'client-error',
		summary: 'Expectation given in the request Expect header could not be met by the server.',
		rfc: 'RFC 9110 §15.5.18',
		rfcUrl: rfc9110('15.5.18'),
		whenToUse: 'Reject "Expect: 100-continue" when the request would not be acceptable.',
		standard: true,
	},
	{
		code: 418,
		phrase: "I'm a teapot",
		category: '4xx',
		kind: 'client-error',
		summary:
			'Joke status from RFC 2324 (Hyper Text Coffee Pot Control Protocol); occasionally used as a sentinel value.',
		rfc: 'RFC 2324 §2.3.2',
		rfcUrl: rfcUrl('rfc2324', '2.3.2'),
		whenToUse: 'Avoid in production APIs; some services return it to flag bot / abuse traffic.',
		standard: false,
	},
	{
		code: 421,
		phrase: 'Misdirected Request',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Request was directed at a server that is not able to produce a response (e.g. wrong SNI / authority).',
		rfc: 'RFC 9110 §15.5.20',
		rfcUrl: rfc9110('15.5.20'),
		whenToUse:
			'Reject HTTP/2 connection coalescing when the authority does not match the certificate.',
		standard: true,
	},
	{
		code: 422,
		phrase: 'Unprocessable Content',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Server understands the content type and syntax of the request but was unable to process the contained instructions.',
		rfc: 'RFC 9110 §15.5.21',
		rfcUrl: rfc9110('15.5.21'),
		whenToUse:
			'Reject well-formed input that fails business / semantic validation (e.g. invalid email, value out of range).',
		misuse:
			'422 = well-formed body with semantic errors. 400 = malformed body (bad JSON, missing required header).',
		related: [400],
		standard: true,
	},
	{
		code: 423,
		phrase: 'Locked',
		category: '4xx',
		kind: 'client-error',
		summary: 'WebDAV: source or destination resource of a method is locked.',
		rfc: 'RFC 4918 §11.3',
		rfcUrl: rfcUrl('rfc4918', '11.3'),
		whenToUse: 'Reject WebDAV operations that conflict with an active lock.',
		standard: true,
	},
	{
		code: 424,
		phrase: 'Failed Dependency',
		category: '4xx',
		kind: 'client-error',
		summary:
			'WebDAV: method could not be performed because the requested action depended on another action that failed.',
		rfc: 'RFC 4918 §11.4',
		rfcUrl: rfcUrl('rfc4918', '11.4'),
		whenToUse: 'Use within a WebDAV multistatus when one operation cascades a failure.',
		standard: true,
	},
	{
		code: 425,
		phrase: 'Too Early',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Server is unwilling to risk processing a request that might be replayed (TLS 1.3 0-RTT).',
		rfc: 'RFC 8470',
		rfcUrl: 'https://www.rfc-editor.org/rfc/rfc8470',
		whenToUse: 'Reject early-data requests for endpoints whose effects are not safe to replay.',
		standard: true,
	},
	{
		code: 426,
		phrase: 'Upgrade Required',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Server refuses to perform the request using the current protocol but might after the client upgrades.',
		rfc: 'RFC 9110 §15.5.22',
		rfcUrl: rfc9110('15.5.22'),
		whenToUse: 'Demand TLS / HTTP/2 by including an Upgrade header in the response.',
		standard: true,
	},
	{
		code: 428,
		phrase: 'Precondition Required',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Origin server requires the request to be conditional (prevents lost-update / "lost edit" problems).',
		rfc: 'RFC 6585 §3',
		rfcUrl: rfcUrl('rfc6585', '3'),
		whenToUse:
			'Require If-Match on PUT / PATCH so concurrent edits cannot silently overwrite each other.',
		related: [412],
		standard: true,
	},
	{
		code: 429,
		phrase: 'Too Many Requests',
		category: '4xx',
		kind: 'client-error',
		summary: 'User has sent too many requests in a given amount of time ("rate limiting").',
		rfc: 'RFC 6585 §4',
		rfcUrl: rfcUrl('rfc6585', '4'),
		whenToUse: 'Throttle abusive clients; include a Retry-After header indicating when to retry.',
		related: [503],
		standard: true,
	},
	{
		code: 431,
		phrase: 'Request Header Fields Too Large',
		category: '4xx',
		kind: 'client-error',
		summary: 'Server is unwilling to process the request because its header fields are too large.',
		rfc: 'RFC 6585 §5',
		rfcUrl: rfcUrl('rfc6585', '5'),
		whenToUse: 'Reject requests with oversized cookies or header blocks.',
		standard: true,
	},
	{
		code: 451,
		phrase: 'Unavailable For Legal Reasons',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Resource is unavailable due to legal demands (e.g. court order, government censorship).',
		rfc: 'RFC 7725',
		rfcUrl: 'https://www.rfc-editor.org/rfc/rfc7725',
		whenToUse:
			'Indicate that content was removed for legal reasons rather than because it does not exist.',
		standard: true,
	},
	{
		code: 499,
		phrase: 'Client Closed Request',
		category: '4xx',
		kind: 'client-error',
		summary:
			'Non-standard nginx code logged when the client closed the connection before the server could respond.',
		whenToUse:
			'Recognise in nginx access logs as a client-side abort; not a code you should emit yourself.',
		standard: false,
	},

	// ---------------------------------------------------------------- 5xx ----
	{
		code: 500,
		phrase: 'Internal Server Error',
		category: '5xx',
		kind: 'server-error',
		summary:
			'Server encountered an unexpected condition that prevented it from fulfilling the request.',
		rfc: 'RFC 9110 §15.6.1',
		rfcUrl: rfc9110('15.6.1'),
		whenToUse:
			'Generic catch-all when no more specific 5xx applies; log details server-side but do not leak them.',
		standard: true,
	},
	{
		code: 501,
		phrase: 'Not Implemented',
		category: '5xx',
		kind: 'server-error',
		summary: 'Server does not support the functionality required to fulfill the request.',
		rfc: 'RFC 9110 §15.6.2',
		rfcUrl: rfc9110('15.6.2'),
		whenToUse: 'Respond when the method is unknown (e.g. unknown verb) or feature is not built.',
		related: [405],
		standard: true,
	},
	{
		code: 502,
		phrase: 'Bad Gateway',
		category: '5xx',
		kind: 'server-error',
		summary:
			'Server, while acting as a gateway or proxy, received an invalid response from the upstream server.',
		rfc: 'RFC 9110 §15.6.3',
		rfcUrl: rfc9110('15.6.3'),
		whenToUse:
			'Returned by load balancers / reverse proxies when upstream returns garbage or closes prematurely.',
		standard: true,
	},
	{
		code: 503,
		phrase: 'Service Unavailable',
		category: '5xx',
		kind: 'server-error',
		summary:
			'Server is currently unable to handle the request due to temporary overload or scheduled maintenance.',
		rfc: 'RFC 9110 §15.6.4',
		rfcUrl: rfc9110('15.6.4'),
		whenToUse:
			'Reject during maintenance windows or when capacity is exhausted; include Retry-After.',
		related: [429, 504],
		standard: true,
	},
	{
		code: 504,
		phrase: 'Gateway Timeout',
		category: '5xx',
		kind: 'server-error',
		summary:
			'Server, while acting as a gateway or proxy, did not receive a timely response from an upstream server it needed to access.',
		rfc: 'RFC 9110 §15.6.5',
		rfcUrl: rfc9110('15.6.5'),
		whenToUse:
			'Returned by load balancers when the upstream is slow / unresponsive beyond the configured timeout.',
		related: [502, 503],
		standard: true,
	},
	{
		code: 505,
		phrase: 'HTTP Version Not Supported',
		category: '5xx',
		kind: 'server-error',
		summary: 'Server does not support the major HTTP version used in the request.',
		rfc: 'RFC 9110 §15.6.6',
		rfcUrl: rfc9110('15.6.6'),
		whenToUse: 'Reject HTTP/0.9 or otherwise unsupported protocol versions.',
		standard: true,
	},
	{
		code: 506,
		phrase: 'Variant Also Negotiates',
		category: '5xx',
		kind: 'server-error',
		summary: 'Transparent content negotiation for the request results in a circular reference.',
		rfc: 'RFC 2295 §8.1',
		rfcUrl: rfcUrl('rfc2295', '8.1'),
		whenToUse: 'Signal a configuration error in transparent content negotiation.',
		standard: true,
	},
	{
		code: 507,
		phrase: 'Insufficient Storage',
		category: '5xx',
		kind: 'server-error',
		summary: 'WebDAV: server is unable to store the representation needed to complete the request.',
		rfc: 'RFC 4918 §11.5',
		rfcUrl: rfcUrl('rfc4918', '11.5'),
		whenToUse: 'Reject WebDAV writes when the backing store has no room.',
		standard: true,
	},
	{
		code: 508,
		phrase: 'Loop Detected',
		category: '5xx',
		kind: 'server-error',
		summary: 'WebDAV: server detected an infinite loop while processing the request.',
		rfc: 'RFC 5842 §7.2',
		rfcUrl: rfcUrl('rfc5842', '7.2'),
		whenToUse: 'Terminate WebDAV recursion that would otherwise never converge.',
		standard: true,
	},
	{
		code: 510,
		phrase: 'Not Extended',
		category: '5xx',
		kind: 'server-error',
		summary: 'Further extensions to the request are required for the server to fulfill it.',
		rfc: 'RFC 2774 §7',
		rfcUrl: rfcUrl('rfc2774', '7'),
		whenToUse:
			'Rarely used; signals that the request must include additional HTTP extension framing.',
		standard: true,
	},
	{
		code: 511,
		phrase: 'Network Authentication Required',
		category: '5xx',
		kind: 'server-error',
		summary: 'Client needs to authenticate to gain network access (captive portal).',
		rfc: 'RFC 6585 §6',
		rfcUrl: rfcUrl('rfc6585', '6'),
		whenToUse: 'Returned by captive portals to interrupt traffic until the user signs in.',
		standard: true,
	},
	{
		code: 520,
		phrase: 'Web Server Returned an Unknown Error',
		category: '5xx',
		kind: 'server-error',
		summary:
			'Non-standard CDN code: origin returned an empty, unknown, or otherwise unexpected response.',
		whenToUse: 'CDN diagnostic only; investigate the origin server response if you encounter this.',
		standard: false,
	},
	{
		code: 521,
		phrase: 'Web Server Is Down',
		category: '5xx',
		kind: 'server-error',
		summary: 'Non-standard CDN code: origin server refused the connection from the CDN.',
		whenToUse: 'CDN diagnostic only; verify the origin is up and the CDN is allowlisted.',
		standard: false,
	},
	{
		code: 522,
		phrase: 'Connection Timed Out',
		category: '5xx',
		kind: 'server-error',
		summary: 'Non-standard CDN code: CDN could not negotiate a TCP handshake with the origin.',
		whenToUse: 'CDN diagnostic only; check network ACLs and origin health.',
		standard: false,
	},
	{
		code: 523,
		phrase: 'Origin Is Unreachable',
		category: '5xx',
		kind: 'server-error',
		summary: 'Non-standard CDN code: CDN cannot reach the origin (DNS / routing failure).',
		whenToUse: 'CDN diagnostic only; check DNS, BGP routing, and origin reachability.',
		standard: false,
	},
	{
		code: 524,
		phrase: 'A Timeout Occurred',
		category: '5xx',
		kind: 'server-error',
		summary:
			'Non-standard CDN code: TCP connection to the origin established, but no HTTP response within the timeout.',
		whenToUse: 'CDN diagnostic only; tune origin response times or extend CDN timeout.',
		standard: false,
	},
	{
		code: 525,
		phrase: 'SSL Handshake Failed',
		category: '5xx',
		kind: 'server-error',
		summary: 'Non-standard CDN code: TLS handshake with the origin failed.',
		whenToUse: 'CDN diagnostic only; verify origin certificate, cipher suite, and SNI.',
		standard: false,
	},
	{
		code: 526,
		phrase: 'Invalid SSL Certificate',
		category: '5xx',
		kind: 'server-error',
		summary: 'Non-standard CDN code: origin presented an invalid TLS certificate.',
		whenToUse: 'CDN diagnostic only; renew or reconfigure the origin certificate chain.',
		standard: false,
	},
	{
		code: 527,
		phrase: 'Railgun Error',
		category: '5xx',
		kind: 'server-error',
		summary: 'Non-standard CDN code: error in the tunneled connection between CDN edge and origin.',
		whenToUse: 'CDN diagnostic only; involves the CDN-specific origin tunnel.',
		standard: false,
	},
	{
		code: 530,
		phrase: 'Site Frozen / Origin Error',
		category: '5xx',
		kind: 'server-error',
		summary:
			'Non-standard CDN code: site is suspended or origin returned an error that triggered a CDN 1xxx error page.',
		whenToUse:
			'CDN diagnostic only; consult the CDN-specific error-code page for the underlying cause.',
		standard: false,
	},
	{
		code: 598,
		phrase: 'Network Read Timeout Error',
		category: '5xx',
		kind: 'server-error',
		summary:
			'Non-standard proxy code: used by some HTTP proxies when a read on the upstream connection times out.',
		whenToUse: 'Proxy diagnostic only; not part of any RFC.',
		standard: false,
	},
	{
		code: 599,
		phrase: 'Network Connect Timeout Error',
		category: '5xx',
		kind: 'server-error',
		summary:
			'Non-standard proxy code: used by some HTTP proxies when establishing the upstream connection times out.',
		whenToUse: 'Proxy diagnostic only; not part of any RFC.',
		standard: false,
	},
] as const;

export const CATEGORY_LABELS: Readonly<Record<StatusCategory, string>> = {
	'1xx': '1xx Informational',
	'2xx': '2xx Success',
	'3xx': '3xx Redirection',
	'4xx': '4xx Client Error',
	'5xx': '5xx Server Error',
};

/**
 * Tailwind class fragment for the category's accent. Maps to the project's
 * tone tokens (`success` / `info` / `warning` / `destructive`) used by
 * `ToneBadge`.
 */
export const CATEGORY_TONES: Readonly<
	Record<StatusCategory, 'info' | 'success' | 'warning' | 'destructive'>
> = {
	'1xx': 'info',
	'2xx': 'success',
	'3xx': 'info',
	'4xx': 'warning',
	'5xx': 'destructive',
};

export const ALL_CATEGORIES: readonly StatusCategory[] = ['1xx', '2xx', '3xx', '4xx', '5xx'];

/** Resolve a numeric code to its category, or `null` when outside 100-599. */
export const categoryOf = (code: number): StatusCategory | null => {
	if (code < 100 || code > 599) return null;
	const bucket = Math.floor(code / 100);
	if (bucket === 1) return '1xx';
	if (bucket === 2) return '2xx';
	if (bucket === 3) return '3xx';
	if (bucket === 4) return '4xx';
	if (bucket === 5) return '5xx';
	return null;
};

/** Look up a status code by its numeric value. */
export const getStatusCode = (code: number): StatusCode | undefined =>
	STATUS_CODES.find((entry) => entry.code === code);

export interface FilterOptions {
	readonly query: string;
	readonly categories: ReadonlySet<StatusCategory>;
	readonly includeNonStandard: boolean;
	readonly misuseOnly?: boolean;
}

/**
 * Match a code against the search query. A numeric query (e.g. "4", "40",
 * "404") matches by prefix of the code; an alphabetic query matches the
 * phrase, summary, or "when to use" text as a substring.
 */
const matchesQuery = (entry: StatusCode, query: string): boolean => {
	const trimmed = query.trim();
	if (trimmed.length === 0) return true;

	if (/^\d+$/.test(trimmed)) {
		return entry.code.toString().startsWith(trimmed);
	}

	const needle = trimmed.toLowerCase();
	const haystack = [entry.phrase, entry.summary, entry.whenToUse ?? '', entry.misuse ?? '']
		.join(' ')
		.toLowerCase();
	return haystack.includes(needle);
};

export const filterStatusCodes = (
	all: readonly StatusCode[],
	opts: FilterOptions
): readonly StatusCode[] =>
	all
		.filter((entry) => opts.includeNonStandard || entry.standard)
		.filter((entry) => opts.categories.has(entry.category))
		.filter((entry) => (opts.misuseOnly ? Boolean(entry.misuse) : true))
		.filter((entry) => matchesQuery(entry, opts.query));

/** Total catalog size — exported for status-bar display. */
export const TOTAL_CODES = STATUS_CODES.length;

/** IANA registry homepage. */
export const IANA_REGISTRY_URL = IANA_URL;
