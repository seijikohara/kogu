/**
 * MIME Type catalog and lookup helpers.
 *
 * A curated set of common MIME types covering the entries developers
 * actually look up. Each entry includes file extensions, optional aliases
 * (with deprecation notes), magic bytes for binary type sniffing, charset
 * info for text types, and reference URLs.
 *
 * The catalog is deliberately kept small (~100 entries) over an exhaustive
 * dump of the IANA registry. Use `filterEntries` for bidirectional search
 * across types, extensions, and free text.
 */

export type MimeCategory =
	| 'image'
	| 'audio'
	| 'video'
	| 'font'
	| 'text'
	| 'application'
	| 'multipart'
	| 'message';

export interface MimeReference {
	readonly label: string;
	readonly url: string;
}

export interface MagicBytes {
	/** Space-separated uppercase hex (e.g. "89 50 4E 47 0D 0A 1A 0A"). */
	readonly hex: string;
	/** Byte offset from start of file. Defaults to 0. */
	readonly offset?: number;
	readonly description?: string;
}

export interface MimeEntry {
	readonly type: string;
	readonly category: MimeCategory;
	/** Extensions include the leading dot (e.g. `.png`). */
	readonly extensions: readonly string[];
	readonly summary: string;
	readonly aliases?: readonly string[];
	readonly aliasNote?: string;
	readonly magic?: readonly MagicBytes[];
	readonly charset?: readonly string[];
	readonly defaultCharset?: string;
	readonly references?: readonly MimeReference[];
}

export const CATEGORY_LABELS: Readonly<Record<MimeCategory, string>> = {
	image: 'Image',
	audio: 'Audio',
	video: 'Video',
	font: 'Font',
	text: 'Text',
	application: 'Application',
	multipart: 'Multipart',
	message: 'Message',
};

/**
 * Tailwind utility classes for category badges. Uses tonal pairings
 * consistent with existing semantic tokens in `app.css`.
 */
export const CATEGORY_TONES: Readonly<Record<MimeCategory, string>> = {
	image: 'bg-info/10 text-info',
	audio: 'bg-success/10 text-success',
	video: 'bg-destructive/10 text-destructive',
	font: 'bg-warning/10 text-warning',
	text: 'bg-muted text-muted-foreground',
	application: 'bg-primary/10 text-primary',
	multipart: 'bg-accent text-accent-foreground',
	message: 'bg-secondary text-secondary-foreground',
};

const IANA_REGISTRY = 'https://www.iana.org/assignments/media-types/media-types.xhtml';

const ref = (label: string, url: string): MimeReference => ({ label, url });

/* -------------------------------------------------------------------------- */
/* Catalog                                                                    */
/* -------------------------------------------------------------------------- */

export const MIME_ENTRIES: readonly MimeEntry[] = [
	/* ---------- image ---------- */
	{
		type: 'image/png',
		category: 'image',
		extensions: ['.png'],
		summary: 'Portable Network Graphics; lossless raster format with alpha channel.',
		magic: [{ hex: '89 50 4E 47 0D 0A 1A 0A', description: 'PNG signature' }],
		references: [ref('RFC 2083', 'https://www.rfc-editor.org/rfc/rfc2083')],
	},
	{
		type: 'image/jpeg',
		category: 'image',
		extensions: ['.jpg', '.jpeg', '.jpe', '.jfif'],
		summary: 'JPEG (Joint Photographic Experts Group); lossy compressed photograph format.',
		aliases: ['image/jpg', 'image/pjpeg'],
		aliasNote: '`image/jpg` is a common non-standard alias; always emit `image/jpeg`.',
		magic: [
			{ hex: 'FF D8 FF DB', description: 'JPEG raw' },
			{ hex: 'FF D8 FF E0', description: 'JPEG with JFIF marker' },
			{ hex: 'FF D8 FF E1', description: 'JPEG with EXIF marker' },
			{ hex: 'FF D8 FF EE', description: 'JPEG with Adobe APP14 marker' },
		],
		references: [ref('RFC 1341', 'https://www.rfc-editor.org/rfc/rfc1341')],
	},
	{
		type: 'image/gif',
		category: 'image',
		extensions: ['.gif'],
		summary: 'Graphics Interchange Format; palette-indexed raster with animation support.',
		magic: [
			{ hex: '47 49 46 38 37 61', description: 'GIF87a' },
			{ hex: '47 49 46 38 39 61', description: 'GIF89a' },
		],
		references: [ref('W3C GIF89a', 'https://www.w3.org/Graphics/GIF/spec-gif89a.txt')],
	},
	{
		type: 'image/webp',
		category: 'image',
		extensions: ['.webp'],
		summary: 'WebP; modern lossy / lossless image format with smaller files than JPEG / PNG.',
		magic: [
			{ hex: '52 49 46 46', description: '"RIFF" header' },
			{ hex: '57 45 42 50', offset: 8, description: '"WEBP" at offset 8' },
		],
		references: [ref('RFC 9649', 'https://www.rfc-editor.org/rfc/rfc9649')],
	},
	{
		type: 'image/svg+xml',
		category: 'image',
		extensions: ['.svg', '.svgz'],
		summary: 'Scalable Vector Graphics; XML-based vector image format.',
		charset: ['utf-8', 'utf-16', 'us-ascii'],
		defaultCharset: 'utf-8',
		references: [ref('W3C SVG', 'https://www.w3.org/TR/SVG2/')],
	},
	{
		type: 'image/avif',
		category: 'image',
		extensions: ['.avif'],
		summary: 'AV1 Image File Format; HEIF container with AV1-encoded payload.',
		magic: [{ hex: '66 74 79 70 61 76 69 66', offset: 4, description: '"ftypavif" at offset 4' }],
		references: [ref('MIANA', `${IANA_REGISTRY}#image`)],
	},
	{
		type: 'image/bmp',
		category: 'image',
		extensions: ['.bmp', '.dib'],
		summary: 'Windows Bitmap; uncompressed raster image format.',
		aliases: ['image/x-bmp', 'image/x-ms-bmp'],
		magic: [{ hex: '42 4D', description: '"BM" header' }],
	},
	{
		type: 'image/x-icon',
		category: 'image',
		extensions: ['.ico'],
		summary: 'Windows icon container; multiple bitmap sizes used as favicons.',
		aliases: ['image/vnd.microsoft.icon'],
		magic: [{ hex: '00 00 01 00', description: 'ICO header' }],
	},
	{
		type: 'image/tiff',
		category: 'image',
		extensions: ['.tif', '.tiff'],
		summary: 'Tagged Image File Format; flexible raster format used in publishing.',
		magic: [
			{ hex: '49 49 2A 00', description: 'Little-endian TIFF' },
			{ hex: '4D 4D 00 2A', description: 'Big-endian TIFF' },
		],
		references: [ref('RFC 3302', 'https://www.rfc-editor.org/rfc/rfc3302')],
	},
	{
		type: 'image/heic',
		category: 'image',
		extensions: ['.heic'],
		summary: 'High Efficiency Image Container; HEVC-encoded images used by iOS.',
		magic: [{ hex: '66 74 79 70 68 65 69 63', offset: 4, description: '"ftypheic" at offset 4' }],
	},
	{
		type: 'image/heif',
		category: 'image',
		extensions: ['.heif'],
		summary: 'High Efficiency Image File Format; generic HEIF container.',
		aliases: ['image/heic'],
		magic: [{ hex: '66 74 79 70 6D 69 66 31', offset: 4, description: '"ftypmif1" at offset 4' }],
	},

	/* ---------- audio ---------- */
	{
		type: 'audio/mpeg',
		category: 'audio',
		extensions: ['.mp3', '.mp2', '.mpga'],
		summary: 'MPEG-1 / MPEG-2 Audio Layer III (MP3); common lossy audio compression.',
		aliases: ['audio/mp3'],
		aliasNote: '`audio/mp3` is non-standard; always emit `audio/mpeg`.',
		magic: [
			{ hex: '49 44 33', description: 'ID3v2 tag' },
			{ hex: 'FF FB', description: 'MPEG-1 Layer III frame sync' },
			{ hex: 'FF F3', description: 'MPEG-2 Layer III frame sync' },
		],
		references: [ref('RFC 3003', 'https://www.rfc-editor.org/rfc/rfc3003')],
	},
	{
		type: 'audio/wav',
		category: 'audio',
		extensions: ['.wav', '.wave'],
		summary: 'Waveform Audio File Format; RIFF container with PCM samples.',
		aliases: ['audio/x-wav', 'audio/vnd.wave'],
		magic: [
			{ hex: '52 49 46 46', description: '"RIFF" header' },
			{ hex: '57 41 56 45', offset: 8, description: '"WAVE" at offset 8' },
		],
	},
	{
		type: 'audio/ogg',
		category: 'audio',
		extensions: ['.ogg', '.oga', '.opus'],
		summary: 'Ogg container, typically with Vorbis or Opus payload.',
		magic: [{ hex: '4F 67 67 53', description: '"OggS" page header' }],
		references: [ref('RFC 5334', 'https://www.rfc-editor.org/rfc/rfc5334')],
	},
	{
		type: 'audio/webm',
		category: 'audio',
		extensions: ['.weba'],
		summary: 'WebM audio (Matroska-based) with Vorbis or Opus payload.',
		magic: [{ hex: '1A 45 DF A3', description: 'EBML header' }],
	},
	{
		type: 'audio/flac',
		category: 'audio',
		extensions: ['.flac'],
		summary: 'Free Lossless Audio Codec; bit-perfect lossless audio compression.',
		magic: [{ hex: '66 4C 61 43', description: '"fLaC" stream marker' }],
	},
	{
		type: 'audio/aac',
		category: 'audio',
		extensions: ['.aac'],
		summary: 'Advanced Audio Coding; lossy audio compression used in iTunes / YouTube.',
		magic: [{ hex: 'FF F1', description: 'ADTS header (MPEG-4)' }],
	},
	{
		type: 'audio/mp4',
		category: 'audio',
		extensions: ['.m4a', '.mp4a'],
		summary: 'AAC audio in an MP4 container; the lossy format used by iTunes (M4A).',
		aliases: ['audio/x-m4a'],
		magic: [{ hex: '66 74 79 70 4D 34 41 20', offset: 4, description: '"ftypM4A " at offset 4' }],
	},
	{
		type: 'audio/midi',
		category: 'audio',
		extensions: ['.mid', '.midi'],
		summary: 'Musical Instrument Digital Interface; symbolic music notation.',
		aliases: ['audio/x-midi'],
		magic: [{ hex: '4D 54 68 64', description: '"MThd" header' }],
	},
	{
		type: 'audio/x-aiff',
		category: 'audio',
		extensions: ['.aif', '.aiff', '.aifc'],
		summary: 'Audio Interchange File Format; uncompressed audio container from Apple.',
		aliases: ['audio/aiff'],
		magic: [
			{ hex: '46 4F 52 4D', description: '"FORM" header' },
			{ hex: '41 49 46 46', offset: 8, description: '"AIFF" at offset 8' },
		],
	},
	{
		type: 'audio/opus',
		category: 'audio',
		extensions: ['.opus'],
		summary: 'Opus lossy audio; modern codec used by WebRTC and streaming.',
		references: [ref('RFC 7587', 'https://www.rfc-editor.org/rfc/rfc7587')],
	},

	/* ---------- video ---------- */
	{
		type: 'video/mp4',
		category: 'video',
		extensions: ['.mp4', '.m4v', '.m4p'],
		summary: 'MPEG-4 Part 14 container; the dominant H.264 / H.265 video format.',
		magic: [
			{ hex: '66 74 79 70 69 73 6F 6D', offset: 4, description: '"ftypisom" at offset 4' },
			{ hex: '66 74 79 70 4D 53 4E 56', offset: 4, description: '"ftypMSNV" at offset 4' },
		],
		references: [ref('RFC 4337', 'https://www.rfc-editor.org/rfc/rfc4337')],
	},
	{
		type: 'video/mpeg',
		category: 'video',
		extensions: ['.mpg', '.mpeg', '.mpe', '.m1v', '.m2v'],
		summary: 'MPEG-1 / MPEG-2 program / video stream.',
		magic: [{ hex: '00 00 01 BA', description: 'MPEG-PS pack header' }],
		references: [ref('RFC 2046', 'https://www.rfc-editor.org/rfc/rfc2046')],
	},
	{
		type: 'video/ogg',
		category: 'video',
		extensions: ['.ogv', '.ogg'],
		summary: 'Ogg container with Theora / VP8 video payload.',
		magic: [{ hex: '4F 67 67 53', description: '"OggS" page header' }],
	},
	{
		type: 'video/webm',
		category: 'video',
		extensions: ['.webm'],
		summary: 'WebM video (Matroska-based) with VP8 / VP9 / AV1 payload.',
		magic: [{ hex: '1A 45 DF A3', description: 'EBML header' }],
	},
	{
		type: 'video/x-msvideo',
		category: 'video',
		extensions: ['.avi'],
		summary: 'Audio Video Interleave; legacy RIFF-based Microsoft video container.',
		aliases: ['video/avi', 'video/msvideo'],
		magic: [
			{ hex: '52 49 46 46', description: '"RIFF" header' },
			{ hex: '41 56 49 20', offset: 8, description: '"AVI " at offset 8' },
		],
	},
	{
		type: 'video/quicktime',
		category: 'video',
		extensions: ['.mov', '.qt'],
		summary: 'Apple QuickTime container; predecessor of MP4 ISO Base Media Format.',
		magic: [{ hex: '66 74 79 70 71 74 20 20', offset: 4, description: '"ftypqt  " at offset 4' }],
	},
	{
		type: 'video/x-matroska',
		category: 'video',
		extensions: ['.mkv', '.mka', '.mks'],
		summary: 'Matroska container; open-source flexible multimedia container.',
		magic: [{ hex: '1A 45 DF A3', description: 'EBML header' }],
	},
	{
		type: 'video/3gpp',
		category: 'video',
		extensions: ['.3gp', '.3gpp'],
		summary: '3GPP multimedia container; mobile-focused MP4 variant.',
		magic: [{ hex: '66 74 79 70 33 67', offset: 4, description: '"ftyp3g" at offset 4' }],
	},

	/* ---------- font ---------- */
	{
		type: 'font/woff',
		category: 'font',
		extensions: ['.woff'],
		summary: 'Web Open Font Format 1.0; SFNT with zlib compression for web fonts.',
		aliases: ['application/font-woff'],
		magic: [{ hex: '77 4F 46 46', description: '"wOFF" signature' }],
		references: [ref('RFC 8081', 'https://www.rfc-editor.org/rfc/rfc8081')],
	},
	{
		type: 'font/woff2',
		category: 'font',
		extensions: ['.woff2'],
		summary: 'Web Open Font Format 2.0; SFNT with Brotli compression for web fonts.',
		magic: [{ hex: '77 4F 46 32', description: '"wOF2" signature' }],
		references: [ref('RFC 8081', 'https://www.rfc-editor.org/rfc/rfc8081')],
	},
	{
		type: 'font/ttf',
		category: 'font',
		extensions: ['.ttf'],
		summary: 'TrueType Font; original Apple / Microsoft vector font format.',
		aliases: ['application/x-font-ttf', 'application/x-font-truetype'],
		magic: [{ hex: '00 01 00 00', description: 'TTF signature' }],
	},
	{
		type: 'font/otf',
		category: 'font',
		extensions: ['.otf'],
		summary: 'OpenType Font; TrueType superset adding PostScript outlines.',
		aliases: ['application/x-font-otf', 'application/x-font-opentype'],
		magic: [{ hex: '4F 54 54 4F', description: '"OTTO" signature' }],
	},
	{
		type: 'application/vnd.ms-fontobject',
		category: 'font',
		extensions: ['.eot'],
		summary: 'Embedded OpenType; legacy font format used by Internet Explorer.',
	},
	{
		type: 'font/collection',
		category: 'font',
		extensions: ['.ttc', '.otc'],
		summary: 'OpenType / TrueType Collection; multiple fonts in one file.',
		magic: [{ hex: '74 74 63 66', description: '"ttcf" signature' }],
	},

	/* ---------- text ---------- */
	{
		type: 'text/html',
		category: 'text',
		extensions: ['.html', '.htm', '.shtml'],
		summary: 'HyperText Markup Language; the document format for the World Wide Web.',
		charset: ['utf-8', 'utf-16', 'iso-8859-1', 'windows-1252'],
		defaultCharset: 'utf-8',
		references: [
			ref('RFC 2854', 'https://www.rfc-editor.org/rfc/rfc2854'),
			ref('HTML Living Standard', 'https://html.spec.whatwg.org/'),
		],
	},
	{
		type: 'text/plain',
		category: 'text',
		extensions: ['.txt', '.text', '.log', '.conf'],
		summary: 'Plain text without markup; the default for unknown text content.',
		charset: ['utf-8', 'utf-16', 'us-ascii', 'iso-8859-1'],
		defaultCharset: 'utf-8',
		references: [ref('RFC 2046', 'https://www.rfc-editor.org/rfc/rfc2046#section-4.1')],
	},
	{
		type: 'text/css',
		category: 'text',
		extensions: ['.css'],
		summary: 'Cascading Style Sheets; styling language for HTML and XML documents.',
		charset: ['utf-8', 'iso-8859-1'],
		defaultCharset: 'utf-8',
		references: [ref('RFC 2318', 'https://www.rfc-editor.org/rfc/rfc2318')],
	},
	{
		type: 'text/csv',
		category: 'text',
		extensions: ['.csv'],
		summary: 'Comma-separated values; tabular data interchange format.',
		charset: ['utf-8', 'us-ascii', 'windows-1252'],
		defaultCharset: 'utf-8',
		references: [ref('RFC 4180', 'https://www.rfc-editor.org/rfc/rfc4180')],
	},
	{
		type: 'text/javascript',
		category: 'text',
		extensions: ['.js', '.mjs', '.cjs'],
		summary: 'JavaScript / ECMAScript source code; the standard type per HTML spec.',
		aliases: ['application/javascript', 'application/x-javascript'],
		aliasNote:
			'RFC 9239 designates `text/javascript` as the official type; older deployments use `application/javascript`.',
		charset: ['utf-8', 'us-ascii'],
		defaultCharset: 'utf-8',
		references: [ref('RFC 9239', 'https://www.rfc-editor.org/rfc/rfc9239')],
	},
	{
		type: 'text/markdown',
		category: 'text',
		extensions: ['.md', '.markdown', '.mdown', '.mkdn'],
		summary: 'Markdown; lightweight markup for prose with inline HTML support.',
		charset: ['utf-8'],
		defaultCharset: 'utf-8',
		references: [ref('RFC 7763', 'https://www.rfc-editor.org/rfc/rfc7763')],
	},
	{
		type: 'application/yaml',
		category: 'text',
		extensions: ['.yaml', '.yml'],
		summary: 'YAML Ain’t Markup Language; human-friendly data serialization.',
		aliases: ['text/yaml', 'text/x-yaml', 'application/x-yaml'],
		aliasNote: 'RFC 9512 registered `application/yaml` in 2023; older systems use `text/yaml`.',
		charset: ['utf-8', 'utf-16', 'utf-32'],
		defaultCharset: 'utf-8',
		references: [ref('RFC 9512', 'https://www.rfc-editor.org/rfc/rfc9512')],
	},
	{
		type: 'text/xml',
		category: 'text',
		extensions: ['.xml'],
		summary: 'Extensible Markup Language as text; prefer `application/xml` for binary safety.',
		aliases: ['application/xml'],
		aliasNote:
			'`text/xml` and `application/xml` differ in charset default. Prefer `application/xml` per RFC 7303.',
		charset: ['us-ascii', 'utf-8', 'utf-16'],
		defaultCharset: 'us-ascii',
		references: [ref('RFC 7303', 'https://www.rfc-editor.org/rfc/rfc7303')],
	},
	{
		type: 'text/x-sql',
		category: 'text',
		extensions: ['.sql'],
		summary: 'Structured Query Language source; non-standard text type for SQL scripts.',
		charset: ['utf-8'],
		defaultCharset: 'utf-8',
	},

	/* ---------- application ---------- */
	{
		type: 'application/json',
		category: 'application',
		extensions: ['.json'],
		summary: 'JavaScript Object Notation; the dominant text-based data interchange format.',
		charset: ['utf-8'],
		defaultCharset: 'utf-8',
		references: [
			ref('RFC 8259', 'https://www.rfc-editor.org/rfc/rfc8259'),
			ref('IANA', `${IANA_REGISTRY}#application`),
		],
	},
	{
		type: 'application/xml',
		category: 'application',
		extensions: ['.xml', '.xsd', '.xsl', '.xslt'],
		summary: 'XML payloads; preferred over `text/xml` because the charset default is UTF-8.',
		charset: ['utf-8', 'utf-16'],
		defaultCharset: 'utf-8',
		references: [ref('RFC 7303', 'https://www.rfc-editor.org/rfc/rfc7303')],
	},
	{
		type: 'application/pdf',
		category: 'application',
		extensions: ['.pdf'],
		summary: 'Portable Document Format; fixed-layout document container by Adobe.',
		magic: [{ hex: '25 50 44 46 2D', description: '"%PDF-" header' }],
		references: [ref('RFC 8118', 'https://www.rfc-editor.org/rfc/rfc8118')],
	},
	{
		type: 'application/zip',
		category: 'application',
		extensions: ['.zip'],
		summary: 'ZIP archive; the foundational format for many container types (DOCX, JAR, EPUB).',
		aliases: ['application/x-zip-compressed'],
		magic: [
			{ hex: '50 4B 03 04', description: 'ZIP local file header' },
			{ hex: '50 4B 05 06', description: 'Empty ZIP archive' },
			{ hex: '50 4B 07 08', description: 'ZIP spanned archive' },
		],
	},
	{
		type: 'application/gzip',
		category: 'application',
		extensions: ['.gz', '.gzip'],
		summary: 'GZIP-compressed payload; single-file DEFLATE container.',
		aliases: ['application/x-gzip'],
		magic: [{ hex: '1F 8B', description: 'GZIP magic' }],
		references: [ref('RFC 6713', 'https://www.rfc-editor.org/rfc/rfc6713')],
	},
	{
		type: 'application/x-tar',
		category: 'application',
		extensions: ['.tar'],
		summary: 'Tape archive; uncompressed concatenation of files with headers.',
		magic: [
			{ hex: '75 73 74 61 72 00 30 30', offset: 257, description: '"ustar\\000" POSIX' },
			{ hex: '75 73 74 61 72 20 20 00', offset: 257, description: '"ustar  \\0" GNU' },
		],
	},
	{
		type: 'application/x-7z-compressed',
		category: 'application',
		extensions: ['.7z'],
		summary: '7-Zip archive; high-compression container using LZMA / LZMA2.',
		magic: [{ hex: '37 7A BC AF 27 1C', description: '7z signature' }],
	},
	{
		type: 'application/x-rar-compressed',
		category: 'application',
		extensions: ['.rar'],
		summary: 'RAR archive; proprietary high-compression container.',
		aliases: ['application/vnd.rar'],
		magic: [
			{ hex: '52 61 72 21 1A 07 00', description: 'RAR 1.5+' },
			{ hex: '52 61 72 21 1A 07 01 00', description: 'RAR 5.0+' },
		],
	},
	{
		type: 'application/x-bzip2',
		category: 'application',
		extensions: ['.bz2'],
		summary: 'bzip2-compressed payload; Burrows–Wheeler-based DEFLATE alternative.',
		magic: [{ hex: '42 5A 68', description: '"BZh" header' }],
	},
	{
		type: 'application/octet-stream',
		category: 'application',
		extensions: ['.bin', '.dat'],
		summary: 'Arbitrary binary data; the safe fallback when no specific type fits.',
		references: [ref('RFC 2046', 'https://www.rfc-editor.org/rfc/rfc2046#section-4.5.1')],
	},
	{
		type: 'application/x-www-form-urlencoded',
		category: 'application',
		extensions: [],
		summary:
			'Form encoding used by HTML form submissions with the `application/x-www-form-urlencoded` enctype.',
		references: [
			ref('URL Living Standard', 'https://url.spec.whatwg.org/#application/x-www-form-urlencoded'),
		],
	},
	{
		type: 'application/sql',
		category: 'application',
		extensions: ['.sql'],
		summary: 'SQL script payload; the standard application type for query bodies.',
		charset: ['utf-8'],
		defaultCharset: 'utf-8',
		references: [ref('RFC 6922', 'https://www.rfc-editor.org/rfc/rfc6922')],
	},
	{
		type: 'application/x-sh',
		category: 'application',
		extensions: ['.sh', '.bash'],
		summary: 'Shell script; typically Bourne / Bash compatible.',
		magic: [{ hex: '23 21 2F', description: '"#!/" shebang' }],
		charset: ['utf-8', 'us-ascii'],
		defaultCharset: 'utf-8',
	},
	{
		type: 'application/javascript',
		category: 'application',
		extensions: ['.js', '.mjs'],
		summary: 'JavaScript source code; deprecated in favor of `text/javascript` per RFC 9239.',
		aliases: ['text/javascript', 'application/x-javascript'],
		aliasNote:
			'Obsoleted by RFC 9239 in favor of `text/javascript`. Retained for legacy server config.',
		charset: ['utf-8'],
		defaultCharset: 'utf-8',
		references: [ref('RFC 9239', 'https://www.rfc-editor.org/rfc/rfc9239')],
	},
	{
		type: 'application/ecmascript',
		category: 'application',
		extensions: ['.es'],
		summary: 'ECMAScript source code; deprecated alias for JavaScript.',
		aliasNote: 'Obsoleted by RFC 9239; prefer `text/javascript`.',
	},
	{
		type: 'application/wasm',
		category: 'application',
		extensions: ['.wasm'],
		summary: 'WebAssembly binary module.',
		magic: [{ hex: '00 61 73 6D', description: '"\\0asm" Wasm signature' }],
	},
	{
		type: 'application/ld+json',
		category: 'application',
		extensions: ['.jsonld'],
		summary: 'JSON-LD (Linked Data); JSON with semantic context for Linked Data.',
		charset: ['utf-8'],
		defaultCharset: 'utf-8',
		references: [ref('W3C JSON-LD', 'https://www.w3.org/TR/json-ld11/')],
	},
	{
		type: 'application/jwt',
		category: 'application',
		extensions: ['.jwt'],
		summary: 'JSON Web Token; signed and optionally encrypted claims payload.',
		references: [ref('RFC 7519', 'https://www.rfc-editor.org/rfc/rfc7519')],
	},
	{
		type: 'application/vnd.api+json',
		category: 'application',
		extensions: [],
		summary: 'JSON:API; convention for building APIs in JSON with hypermedia controls.',
		charset: ['utf-8'],
		defaultCharset: 'utf-8',
		references: [ref('JSON:API', 'https://jsonapi.org/')],
	},
	{
		type: 'application/vnd.ms-excel',
		category: 'application',
		extensions: ['.xls', '.xlt'],
		summary: 'Microsoft Excel 97–2003 binary spreadsheet.',
		magic: [{ hex: 'D0 CF 11 E0 A1 B1 1A E1', description: 'OLE Compound File header' }],
	},
	{
		type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		category: 'application',
		extensions: ['.docx'],
		summary: 'Microsoft Word OOXML document (ZIP container with XML parts).',
		magic: [{ hex: '50 4B 03 04', description: 'ZIP container header' }],
	},
	{
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		category: 'application',
		extensions: ['.xlsx'],
		summary: 'Microsoft Excel OOXML spreadsheet (ZIP container with XML parts).',
		magic: [{ hex: '50 4B 03 04', description: 'ZIP container header' }],
	},
	{
		type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		category: 'application',
		extensions: ['.pptx'],
		summary: 'Microsoft PowerPoint OOXML presentation (ZIP container with XML parts).',
		magic: [{ hex: '50 4B 03 04', description: 'ZIP container header' }],
	},
	{
		type: 'application/x-shockwave-flash',
		category: 'application',
		extensions: ['.swf'],
		summary: 'Adobe Flash SWF; deprecated browser plugin content.',
		aliases: ['application/vnd.adobe.flash.movie'],
		magic: [
			{ hex: '46 57 53', description: 'Uncompressed "FWS"' },
			{ hex: '43 57 53', description: 'zlib-compressed "CWS"' },
		],
	},
	{
		type: 'application/x-msdownload',
		category: 'application',
		extensions: ['.exe', '.dll', '.com'],
		summary: 'Windows portable executable (PE) binary.',
		aliases: ['application/vnd.microsoft.portable-executable'],
		magic: [{ hex: '4D 5A', description: '"MZ" DOS header' }],
	},
	{
		type: 'application/x-deb',
		category: 'application',
		extensions: ['.deb'],
		summary: 'Debian package archive; ar archive with control.tar and data.tar members.',
		aliases: ['application/vnd.debian.binary-package'],
		magic: [{ hex: '21 3C 61 72 63 68 3E', description: '"!<arch>" ar signature' }],
	},
	{
		type: 'application/x-rpm',
		category: 'application',
		extensions: ['.rpm'],
		summary: 'RPM Package Manager archive; Red Hat / SUSE software package.',
		magic: [{ hex: 'ED AB EE DB', description: 'RPM lead header' }],
	},

	/* ---------- multipart ---------- */
	{
		type: 'multipart/form-data',
		category: 'multipart',
		extensions: [],
		summary: 'Form encoding for binary uploads; required when `<input type="file">` is present.',
		references: [ref('RFC 7578', 'https://www.rfc-editor.org/rfc/rfc7578')],
	},
	{
		type: 'multipart/mixed',
		category: 'multipart',
		extensions: [],
		summary: 'Sequence of unrelated parts with independent content types.',
		references: [ref('RFC 2046', 'https://www.rfc-editor.org/rfc/rfc2046#section-5.1.3')],
	},
	{
		type: 'multipart/alternative',
		category: 'multipart',
		extensions: [],
		summary: 'Same content in multiple representations (e.g. text/plain + text/html mail body).',
		references: [ref('RFC 2046', 'https://www.rfc-editor.org/rfc/rfc2046#section-5.1.4')],
	},

	/* ---------- message ---------- */
	{
		type: 'message/rfc822',
		category: 'message',
		extensions: ['.eml', '.mht', '.mhtml'],
		summary: 'Internet Message Format; raw email payload including headers and body.',
		references: [ref('RFC 5322', 'https://www.rfc-editor.org/rfc/rfc5322')],
	},
];

/* -------------------------------------------------------------------------- */
/* Filtering                                                                  */
/* -------------------------------------------------------------------------- */

export interface FilterOptions {
	readonly query: string;
	readonly categories: ReadonlySet<MimeCategory>;
	readonly requireMagic: boolean;
}

const normalize = (value: string): string => value.toLowerCase().trim();

const matchesQuery = (entry: MimeEntry, query: string): boolean => {
	if (query.length === 0) return true;
	const q = normalize(query);
	if (entry.type.toLowerCase().includes(q)) return true;
	if (entry.summary.toLowerCase().includes(q)) return true;
	if (entry.extensions.some((ext) => ext.toLowerCase().includes(q))) return true;
	// Accept an extension query without the leading dot.
	if (!q.startsWith('.') && entry.extensions.some((ext) => ext.slice(1).toLowerCase() === q))
		return true;
	if (entry.aliases?.some((alias) => alias.toLowerCase().includes(q))) return true;
	return false;
};

export const filterEntries = (
	all: readonly MimeEntry[],
	opts: FilterOptions
): readonly MimeEntry[] =>
	all.filter((entry) => {
		if (!opts.categories.has(entry.category)) return false;
		if (opts.requireMagic && (!entry.magic || entry.magic.length === 0)) return false;
		return matchesQuery(entry, opts.query);
	});

/* -------------------------------------------------------------------------- */
/* Snippet generators                                                         */
/* -------------------------------------------------------------------------- */

export const asContentTypeHeader = (entry: MimeEntry, charset?: string): string => {
	const cs = charset ?? entry.defaultCharset;
	if (entry.category === 'text' && cs) return `Content-Type: ${entry.type}; charset=${cs}`;
	return `Content-Type: ${entry.type}`;
};

/**
 * Java-style MediaType constant reference; mirrors Spring's `MediaType` /
 * Jakarta EE `MediaType` static-field naming conventions.
 */
export const asJavaMediaType = (entry: MimeEntry): string => {
	const constName = entry.type
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
	return `MediaType.parseMediaType("${entry.type}"); // suggested constant: ${constName}`;
};

/**
 * Python `mimetypes` module tuple shape: `(type, extension)`.
 */
export const asPythonTuple = (entry: MimeEntry): string => {
	const ext = entry.extensions[0] ?? '';
	return `("${entry.type}", "${ext}")`;
};

/**
 * Go-style constant declaration suitable for pasting into a constants file.
 */
export const asGoConstant = (entry: MimeEntry): string => {
	const constName = entry.type
		.split(/[^a-z0-9]+/i)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join('');
	return `const MimeType${constName} = "${entry.type}"`;
};
