/**
 * QR code generation service.
 * Wraps the `qr-code-styling` package to provide rich styling
 * (dot/corner shapes, gradients, logo overlay) plus content-type
 * encoders for common payloads (Wi-Fi, vCard, calendar, etc.).
 */

import QRCodeStyling, {
	type CornerDotType,
	type CornerSquareType,
	type DotType,
	type ErrorCorrectionLevel as RawErrorCorrectionLevel,
	type Options,
} from 'qr-code-styling';

export type ErrorCorrectionLevel = RawErrorCorrectionLevel;

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
	{ level: 'H', label: 'H (High)', recovery: '~30%', description: 'Survives damage / logos' },
];

export const DOT_TYPES: readonly { readonly value: DotType; readonly label: string }[] = [
	{ value: 'square', label: 'Square' },
	{ value: 'rounded', label: 'Rounded' },
	{ value: 'dots', label: 'Dots' },
	{ value: 'classy', label: 'Classy' },
	{ value: 'classy-rounded', label: 'Classy rounded' },
	{ value: 'extra-rounded', label: 'Extra rounded' },
];

export const CORNER_SQUARE_TYPES: readonly {
	readonly value: CornerSquareType;
	readonly label: string;
}[] = [
	{ value: 'square', label: 'Square' },
	{ value: 'extra-rounded', label: 'Extra rounded' },
	{ value: 'dot', label: 'Dot' },
];

export const CORNER_DOT_TYPES: readonly {
	readonly value: CornerDotType;
	readonly label: string;
}[] = [
	{ value: 'square', label: 'Square' },
	{ value: 'dot', label: 'Dot' },
];

export type WifiSecurity = 'WPA' | 'WEP' | 'nopass';

export type QrContent =
	| { readonly kind: 'text'; readonly text: string }
	| {
			readonly kind: 'wifi';
			readonly ssid: string;
			readonly password: string;
			readonly security: WifiSecurity;
			readonly hidden: boolean;
	  }
	| {
			readonly kind: 'vcard';
			readonly firstName: string;
			readonly lastName: string;
			readonly phone: string;
			readonly email: string;
			readonly org: string;
			readonly url: string;
	  }
	| { readonly kind: 'email'; readonly to: string; readonly subject: string; readonly body: string }
	| { readonly kind: 'sms'; readonly to: string; readonly body: string }
	| { readonly kind: 'phone'; readonly number: string }
	| { readonly kind: 'geo'; readonly latitude: string; readonly longitude: string }
	| {
			readonly kind: 'calendar';
			readonly title: string;
			readonly start: string;
			readonly end: string;
			readonly location: string;
			readonly description: string;
	  }
	| {
			readonly kind: 'bitcoin';
			readonly address: string;
			readonly amount: string;
			readonly label: string;
	  };

export type QrContentKind = QrContent['kind'];

export interface ContentKindInfo {
	readonly kind: QrContentKind;
	readonly label: string;
	readonly description: string;
}

export const CONTENT_KINDS: readonly ContentKindInfo[] = [
	{ kind: 'text', label: 'Text / URL', description: 'Plain text or any URL' },
	{ kind: 'wifi', label: 'Wi-Fi', description: 'SSID + password for instant connect' },
	{ kind: 'vcard', label: 'vCard (contact)', description: 'Save to address book' },
	{ kind: 'email', label: 'Email', description: 'mailto: with optional subject / body' },
	{ kind: 'sms', label: 'SMS', description: 'Send a text message' },
	{ kind: 'phone', label: 'Phone', description: 'Dial a number' },
	{ kind: 'geo', label: 'Geo', description: 'Open coordinates in a map app' },
	{ kind: 'calendar', label: 'Calendar event', description: 'iCalendar VEVENT payload' },
	{ kind: 'bitcoin', label: 'Bitcoin', description: 'BIP-21 payment URI' },
];

const escapeWifi = (value: string): string => value.replace(/([\\;,:"])/g, '\\$1');
const escapeVcard = (value: string): string => value.replace(/([\\;,])/g, '\\$1');

const formatICalDate = (input: string): string => {
	const date = new Date(input);
	if (Number.isNaN(date.getTime())) return '';
	const pad = (n: number) => n.toString().padStart(2, '0');
	const yyyy = date.getUTCFullYear();
	const mm = pad(date.getUTCMonth() + 1);
	const dd = pad(date.getUTCDate());
	const hh = pad(date.getUTCHours());
	const mi = pad(date.getUTCMinutes());
	const ss = pad(date.getUTCSeconds());
	return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
};

export const encodeQrContent = (content: QrContent): string => {
	if (content.kind === 'text') return content.text;
	if (content.kind === 'wifi') {
		const hiddenSegment = content.hidden ? 'H:true;' : '';
		return `WIFI:T:${content.security};S:${escapeWifi(content.ssid)};P:${escapeWifi(content.password)};${hiddenSegment};`;
	}
	if (content.kind === 'vcard') {
		const lines = [
			'BEGIN:VCARD',
			'VERSION:3.0',
			`N:${escapeVcard(content.lastName)};${escapeVcard(content.firstName)}`,
			`FN:${escapeVcard(`${content.firstName} ${content.lastName}`.trim())}`,
			content.org ? `ORG:${escapeVcard(content.org)}` : '',
			content.phone ? `TEL:${content.phone}` : '',
			content.email ? `EMAIL:${content.email}` : '',
			content.url ? `URL:${content.url}` : '',
			'END:VCARD',
		].filter((line) => line.length > 0);
		return lines.join('\n');
	}
	if (content.kind === 'email') {
		const params = new URLSearchParams();
		if (content.subject) params.set('subject', content.subject);
		if (content.body) params.set('body', content.body);
		const qs = params.toString();
		return `mailto:${content.to}${qs ? `?${qs}` : ''}`;
	}
	if (content.kind === 'sms') {
		const qs = content.body ? `?body=${encodeURIComponent(content.body)}` : '';
		return `sms:${content.to}${qs}`;
	}
	if (content.kind === 'phone') {
		return `tel:${content.number}`;
	}
	if (content.kind === 'geo') {
		return `geo:${content.latitude},${content.longitude}`;
	}
	if (content.kind === 'calendar') {
		const lines = [
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'BEGIN:VEVENT',
			content.title ? `SUMMARY:${content.title}` : '',
			content.start ? `DTSTART:${formatICalDate(content.start)}` : '',
			content.end ? `DTEND:${formatICalDate(content.end)}` : '',
			content.location ? `LOCATION:${content.location}` : '',
			content.description ? `DESCRIPTION:${content.description}` : '',
			'END:VEVENT',
			'END:VCALENDAR',
		].filter((line) => line.length > 0);
		return lines.join('\n');
	}
	const params = new URLSearchParams();
	if (content.amount) params.set('amount', content.amount);
	if (content.label) params.set('label', content.label);
	const qs = params.toString();
	return `bitcoin:${content.address}${qs ? `?${qs}` : ''}`;
};

export const isContentValid = (content: QrContent): boolean => {
	if (content.kind === 'text') return content.text.length > 0;
	if (content.kind === 'wifi') return content.ssid.length > 0;
	if (content.kind === 'vcard') return content.firstName.length > 0 || content.lastName.length > 0;
	if (content.kind === 'email') return content.to.length > 0;
	if (content.kind === 'sms') return content.to.length > 0;
	if (content.kind === 'phone') return content.number.length > 0;
	if (content.kind === 'geo') return content.latitude.length > 0 && content.longitude.length > 0;
	if (content.kind === 'calendar') return content.title.length > 0;
	return content.address.length > 0;
};

export const DEFAULT_CONTENT_BY_KIND: Readonly<Record<QrContentKind, QrContent>> = {
	text: { kind: 'text', text: 'https://github.com/seijikohara/kogu' },
	wifi: { kind: 'wifi', ssid: '', password: '', security: 'WPA', hidden: false },
	vcard: { kind: 'vcard', firstName: '', lastName: '', phone: '', email: '', org: '', url: '' },
	email: { kind: 'email', to: '', subject: '', body: '' },
	sms: { kind: 'sms', to: '', body: '' },
	phone: { kind: 'phone', number: '' },
	geo: { kind: 'geo', latitude: '', longitude: '' },
	calendar: { kind: 'calendar', title: '', start: '', end: '', location: '', description: '' },
	bitcoin: { kind: 'bitcoin', address: '', amount: '', label: '' },
};

export interface StyleOptions {
	readonly width: number;
	readonly margin: number;
	readonly errorCorrectionLevel: ErrorCorrectionLevel;
	readonly dotType: DotType;
	readonly cornerSquareType: CornerSquareType;
	readonly cornerDotType: CornerDotType;
	readonly foregroundColor: string;
	readonly backgroundColor: string;
	readonly useGradient: boolean;
	readonly gradientColor: string;
	readonly logoDataUrl: string;
	readonly logoSize: number;
	readonly hideBackgroundDots: boolean;
}

export const DEFAULT_STYLE_OPTIONS: StyleOptions = {
	width: 320,
	margin: 8,
	errorCorrectionLevel: 'M',
	dotType: 'rounded',
	cornerSquareType: 'extra-rounded',
	cornerDotType: 'dot',
	foregroundColor: '#0f172a',
	backgroundColor: '#ffffff',
	useGradient: false,
	gradientColor: '#3b82f6',
	logoDataUrl: '',
	logoSize: 0.3,
	hideBackgroundDots: true,
};

export const MIN_WIDTH = 128;
export const MAX_WIDTH = 1024;
export const MIN_MARGIN = 0;
export const MAX_MARGIN = 32;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const isValidHexColor = (value: string): boolean => HEX_COLOR_PATTERN.test(value);

export const buildQrOptions = (data: string, style: StyleOptions): Options => {
	const dotsOptions: Options['dotsOptions'] = style.useGradient
		? {
				type: style.dotType,
				gradient: {
					type: 'linear',
					rotation: Math.PI / 4,
					colorStops: [
						{ offset: 0, color: style.foregroundColor },
						{ offset: 1, color: style.gradientColor },
					],
				},
			}
		: { type: style.dotType, color: style.foregroundColor };
	return {
		width: style.width,
		height: style.width,
		type: 'svg',
		data: data || ' ',
		margin: style.margin,
		qrOptions: { errorCorrectionLevel: style.errorCorrectionLevel },
		image: style.logoDataUrl || undefined,
		imageOptions: {
			margin: 4,
			imageSize: style.logoSize,
			hideBackgroundDots: style.hideBackgroundDots,
			crossOrigin: 'anonymous',
		},
		dotsOptions,
		cornersSquareOptions: {
			type: style.cornerSquareType,
			color: style.foregroundColor,
		},
		cornersDotOptions: {
			type: style.cornerDotType,
			color: style.foregroundColor,
		},
		backgroundOptions: { color: style.backgroundColor },
	};
};

export const createQr = (data: string, style: StyleOptions): QRCodeStyling =>
	new QRCodeStyling(buildQrOptions(data, style));
