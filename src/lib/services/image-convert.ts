/**
 * In-browser image conversion service.
 *
 * Converts a source image (as a `Blob`/`File`) to one or more target
 * formats via Canvas. All processing is done in the user's browser; no
 * uploads are performed.
 *
 * AVIF encoding is currently not implemented and `convertImage` throws
 * when called with `format: 'avif'`. AVIF support requires WASM (e.g.
 * `@jsquash/avif`) and is intentionally deferred to a follow-up PR to
 * keep the bundle small.
 */

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'avif';
export type RotationDeg = 0 | 90 | 180 | 270;

export interface FlipOptions {
	readonly h: boolean;
	readonly v: boolean;
}

export interface ConvertOptions {
	readonly format: ImageFormat;
	readonly quality: number; // 1-100, ignored for png
	readonly width: number;
	readonly height: number;
	readonly rotation: RotationDeg;
	readonly flip: FlipOptions;
	readonly backgroundFill: string; // hex, used when format is jpeg (no alpha)
}

export interface SourceImage {
	readonly blob: Blob;
	readonly bitmap: ImageBitmap;
	readonly mime: string;
	readonly width: number;
	readonly height: number;
	readonly bytes: number;
	readonly filename: string;
}

export interface ConvertedImage {
	readonly format: ImageFormat;
	readonly blob: Blob;
	readonly url: string; // ObjectURL — caller revokes when no longer needed
	readonly bytes: number;
	readonly width: number;
	readonly height: number;
}

export const FORMAT_MIME: Readonly<Record<ImageFormat, string>> = {
	png: 'image/png',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	avif: 'image/avif',
};

export const FORMAT_LABEL: Readonly<Record<ImageFormat, string>> = {
	png: 'PNG',
	jpeg: 'JPEG',
	webp: 'WebP',
	avif: 'AVIF',
};

export const FORMAT_SUPPORTS_QUALITY: Readonly<Record<ImageFormat, boolean>> = {
	png: false,
	jpeg: true,
	webp: true,
	avif: true,
};

export const FORMAT_HAS_ALPHA: Readonly<Record<ImageFormat, boolean>> = {
	png: true,
	jpeg: false,
	webp: true,
	avif: true,
};

export const FORMAT_EXTENSION: Readonly<Record<ImageFormat, string>> = {
	png: 'png',
	jpeg: 'jpg',
	webp: 'webp',
	avif: 'avif',
};

export const RESIZE_PRESETS = [256, 512, 1024, 2048] as const;

export const ALL_FORMATS: readonly ImageFormat[] = ['png', 'jpeg', 'webp', 'avif'];

/** Decode a file into an in-memory bitmap with original metadata. */
export const loadSource = async (file: File): Promise<SourceImage> => {
	const bitmap = await createImageBitmap(file);
	return {
		blob: file,
		bitmap,
		mime: file.type || 'image/*',
		width: bitmap.width,
		height: bitmap.height,
		bytes: file.size,
		filename: file.name || 'image',
	};
};

/** Render the source bitmap onto an offscreen canvas applying transforms,
 * then encode it as the requested format. AVIF is not supported yet. */
export const convertImage = async (
	source: SourceImage,
	opts: ConvertOptions
): Promise<ConvertedImage> => {
	if (opts.format === 'avif') {
		// TODO: integrate @jsquash/avif WASM encoder in a follow-up PR.
		throw new Error('AVIF encoding is not implemented in this build');
	}

	const swapAxes = opts.rotation === 90 || opts.rotation === 270;
	const outW = Math.max(1, Math.round(swapAxes ? opts.height : opts.width));
	const outH = Math.max(1, Math.round(swapAxes ? opts.width : opts.height));

	const canvas = new OffscreenCanvas(outW, outH);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D context unavailable');

	// Fill background for formats without an alpha channel so transparent
	// pixels become the chosen color instead of black.
	if (!FORMAT_HAS_ALPHA[opts.format]) {
		ctx.fillStyle = opts.backgroundFill;
		ctx.fillRect(0, 0, outW, outH);
	}

	ctx.save();
	ctx.translate(outW / 2, outH / 2);
	ctx.rotate((opts.rotation * Math.PI) / 180);
	ctx.scale(opts.flip.h ? -1 : 1, opts.flip.v ? -1 : 1);
	ctx.drawImage(source.bitmap, -opts.width / 2, -opts.height / 2, opts.width, opts.height);
	ctx.restore();

	const blob = await canvas.convertToBlob({
		type: FORMAT_MIME[opts.format],
		quality: Math.max(0, Math.min(1, opts.quality / 100)),
	});
	const url = URL.createObjectURL(blob);
	return { format: opts.format, blob, url, bytes: blob.size, width: outW, height: outH };
};

export interface MultiConvertResult {
	readonly format: ImageFormat;
	readonly ok: true;
	readonly converted: ConvertedImage;
}

export interface MultiConvertError {
	readonly format: ImageFormat;
	readonly ok: false;
	readonly error: string;
}

export type MultiConvertOutcome = MultiConvertResult | MultiConvertError;

/** Convert one source image to multiple target formats in parallel. */
export const convertMany = (
	source: SourceImage,
	formats: readonly ImageFormat[],
	optsFor: (format: ImageFormat) => ConvertOptions
): Promise<readonly MultiConvertOutcome[]> =>
	Promise.all(
		formats.map(async (f): Promise<MultiConvertOutcome> => {
			try {
				const converted = await convertImage(source, optsFor(f));
				return { format: f, ok: true, converted };
			} catch (e) {
				return {
					format: f,
					ok: false,
					error: e instanceof Error ? e.message : String(e),
				};
			}
		})
	);

/** Build a deterministic demo image at runtime so the route does not
 * need to ship a hard-coded blob. Renders a gradient with a label. */
export const generateDemoImage = async (): Promise<File> => {
	const c = new OffscreenCanvas(512, 384);
	const g = c.getContext('2d');
	if (!g) throw new Error('Canvas 2D context unavailable');
	const gradient = g.createLinearGradient(0, 0, 512, 384);
	gradient.addColorStop(0, '#3b82f6');
	gradient.addColorStop(0.5, '#a855f7');
	gradient.addColorStop(1, '#ec4899');
	g.fillStyle = gradient;
	g.fillRect(0, 0, 512, 384);
	g.fillStyle = 'rgba(255,255,255,0.9)';
	g.font = 'bold 48px sans-serif';
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.fillText('Kogu Sample', 256, 192);
	const blob = await c.convertToBlob({ type: 'image/png' });
	return new File([blob], 'sample.png', { type: 'image/png' });
};

/** Trigger the browser download for a blob with the given filename. */
export const triggerDownload = (blob: Blob, filename: string): void => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Format a byte count as a short human-readable string. */
export const humanBytes = (n: number): string => {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

/** Build a target filename from the source filename and target format. */
export const buildOutputFilename = (sourceFilename: string, format: ImageFormat): string => {
	const dot = sourceFilename.lastIndexOf('.');
	const base = dot > 0 ? sourceFilename.slice(0, dot) : sourceFilename;
	return `${base || 'image'}.${FORMAT_EXTENSION[format]}`;
};
