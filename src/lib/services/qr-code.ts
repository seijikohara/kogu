/**
 * QR code generation service.
 * Wraps the `qrcode` npm package to produce SVG and PNG (data URL)
 * output simultaneously, with project-specific defaults.
 */

import QRCode from 'qrcode';

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface ErrorCorrectionInfo {
	readonly level: ErrorCorrectionLevel;
	readonly label: string;
	readonly recovery: string;
	readonly description: string;
}

export const ERROR_CORRECTION_LEVELS: readonly ErrorCorrectionInfo[] = [
	{ level: 'L', label: 'L (Low)', recovery: '~7%', description: 'Smallest, least resilient' },
	{ level: 'M', label: 'M (Medium)', recovery: '~15%', description: 'Default for most uses' },
	{ level: 'Q', label: 'Q (Quartile)', recovery: '~25%', description: 'Tolerates moderate damage' },
	{ level: 'H', label: 'H (High)', recovery: '~30%', description: 'Survives heavy damage / logos' },
];

export interface QrOptions {
	readonly text: string;
	readonly errorCorrectionLevel: ErrorCorrectionLevel;
	readonly width: number;
	readonly margin: number;
	readonly foregroundColor: string;
	readonly backgroundColor: string;
}

export const DEFAULT_QR_OPTIONS: QrOptions = {
	text: '',
	errorCorrectionLevel: 'M',
	width: 256,
	margin: 4,
	foregroundColor: '#000000',
	backgroundColor: '#ffffff',
};

export const MIN_WIDTH = 64;
export const MAX_WIDTH = 1024;
export const MIN_MARGIN = 0;
export const MAX_MARGIN = 16;

export interface QrResult {
	readonly svg: string;
	readonly dataUrl: string;
}

export const isErrorCorrectionLevel = (value: string): value is ErrorCorrectionLevel =>
	value === 'L' || value === 'M' || value === 'Q' || value === 'H';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const isValidHexColor = (value: string): boolean => HEX_COLOR_PATTERN.test(value);

export const generateQrCode = async (options: QrOptions): Promise<QrResult> => {
	if (options.text.length === 0) {
		throw new Error('Text is required');
	}
	if (!isValidHexColor(options.foregroundColor) || !isValidHexColor(options.backgroundColor)) {
		throw new Error('Colors must be 6-digit hex values (e.g., #000000)');
	}
	const baseOptions = {
		errorCorrectionLevel: options.errorCorrectionLevel,
		width: options.width,
		margin: options.margin,
		color: {
			dark: options.foregroundColor,
			light: options.backgroundColor,
		},
	};
	const [svg, dataUrl] = await Promise.all([
		QRCode.toString(options.text, { ...baseOptions, type: 'svg' }),
		QRCode.toDataURL(options.text, baseOptions),
	]);
	return { svg, dataUrl };
};
