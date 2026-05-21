import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
	Bitcoin,
	Calendar,
	Contact,
	Download,
	Globe,
	Mail,
	MapPin,
	MessageSquare,
	Phone,
	QrCode,
	Trash2,
	Wifi,
} from 'lucide-react';
import type { CornerDotType, CornerSquareType, DotType } from 'qr-code-styling';
import { toast } from 'sonner';

import { CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormInfo,
	FormInput,
	FormSection,
	FormSelect,
	FormSlider,
	FormTextarea,
} from '@/lib/components/form';
import { SectionHeader } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, LiveStatusRegion, StatItem } from '@/lib/components/status';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/lib/components/ui/tooltip';
import {
	CONTENT_KINDS,
	CORNER_DOT_TYPES,
	CORNER_SQUARE_TYPES,
	createQr,
	DEFAULT_CONTENT_BY_KIND,
	DEFAULT_STYLE_OPTIONS,
	DOT_TYPES,
	encodeQrContent,
	ERROR_CORRECTION_LEVELS,
	isContentValid,
	isValidHexColor,
	MAX_MARGIN,
	MAX_WIDTH,
	MIN_MARGIN,
	MIN_WIDTH,
	type QrContent,
	type QrContentKind,
	type StyleOptions,
	type WifiSecurity,
} from '@/lib/services/qr-code';

type WifiContent = Extract<QrContent, { kind: 'wifi' }>;
type VcardContent = Extract<QrContent, { kind: 'vcard' }>;
type EmailContent = Extract<QrContent, { kind: 'email' }>;
type SmsContent = Extract<QrContent, { kind: 'sms' }>;
type PhoneContent = Extract<QrContent, { kind: 'phone' }>;
type GeoContent = Extract<QrContent, { kind: 'geo' }>;
type CalendarContent = Extract<QrContent, { kind: 'calendar' }>;
type BitcoinContent = Extract<QrContent, { kind: 'bitcoin' }>;
type TextContent = Extract<QrContent, { kind: 'text' }>;

const KIND_ICONS: Record<QrContentKind, typeof QrCode> = {
	text: Globe,
	wifi: Wifi,
	vcard: Contact,
	email: Mail,
	sms: MessageSquare,
	phone: Phone,
	geo: MapPin,
	calendar: Calendar,
	bitcoin: Bitcoin,
};

const isQrContentKind = (value: string): value is QrContentKind =>
	CONTENT_KINDS.some((info) => info.kind === value);

const isWifiSecurity = (value: string): value is WifiSecurity =>
	value === 'WPA' || value === 'WEP' || value === 'nopass';

const isDotType = (value: string): value is DotType => DOT_TYPES.some((opt) => opt.value === value);

const isCornerSquareType = (value: string): value is CornerSquareType =>
	CORNER_SQUARE_TYPES.some((opt) => opt.value === value);

const isCornerDotType = (value: string): value is CornerDotType =>
	CORNER_DOT_TYPES.some((opt) => opt.value === value);

export const Route = createFileRoute('/qr-code-generator')({
	component: QrCodeGeneratorPage,
});

function QrCodeGeneratorPage() {
	const [activeKind, setActiveKind] = useState<QrContentKind>('text');
	const [contents, setContents] = useState<Record<QrContentKind, QrContent>>({
		text: { ...DEFAULT_CONTENT_BY_KIND.text } as TextContent,
		wifi: { ...DEFAULT_CONTENT_BY_KIND.wifi } as WifiContent,
		vcard: { ...DEFAULT_CONTENT_BY_KIND.vcard } as VcardContent,
		email: { ...DEFAULT_CONTENT_BY_KIND.email } as EmailContent,
		sms: { ...DEFAULT_CONTENT_BY_KIND.sms } as SmsContent,
		phone: { ...DEFAULT_CONTENT_BY_KIND.phone } as PhoneContent,
		geo: { ...DEFAULT_CONTENT_BY_KIND.geo } as GeoContent,
		calendar: { ...DEFAULT_CONTENT_BY_KIND.calendar } as CalendarContent,
		bitcoin: { ...DEFAULT_CONTENT_BY_KIND.bitcoin } as BitcoinContent,
	});
	const [style, setStyle] = useState<StyleOptions>({ ...DEFAULT_STYLE_OPTIONS });
	const [showOptions, setShowOptions] = useState(true);

	const previewRef = useRef<HTMLDivElement | null>(null);
	const qrInstanceRef = useRef<ReturnType<typeof createQr> | null>(null);

	useEffect(() => {
		document.title = 'QR Code Generator — Kogu';
	}, []);

	const currentContent = contents[activeKind];
	const encodedData = encodeQrContent(currentContent);
	const valid = isContentValid(currentContent);
	const colorsValid =
		isValidHexColor(style.foregroundColor) &&
		isValidHexColor(style.backgroundColor) &&
		(!style.useGradient || isValidHexColor(style.gradientColor));

	useEffect(() => {
		const host = previewRef.current;
		if (!host) return;
		const instance = createQr(encodedData, style);
		qrInstanceRef.current = instance;
		instance.append(host);
		return () => {
			qrInstanceRef.current = null;
			host.replaceChildren();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally mount once
	}, []);

	useEffect(() => {
		if (!qrInstanceRef.current) return;
		if (!valid || !colorsValid) return;
		qrInstanceRef.current.update({
			data: encodedData,
			width: style.width,
			height: style.width,
			margin: style.margin,
			qrOptions: { errorCorrectionLevel: style.errorCorrectionLevel },
			image: style.logoDataUrl || undefined,
			imageOptions: {
				margin: 4,
				imageSize: style.logoSize,
				hideBackgroundDots: style.hideBackgroundDots,
			},
			dotsOptions: style.useGradient
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
				: { type: style.dotType, color: style.foregroundColor },
			cornersSquareOptions: { type: style.cornerSquareType, color: style.foregroundColor },
			cornersDotOptions: { type: style.cornerDotType, color: style.foregroundColor },
			backgroundOptions: { color: style.backgroundColor },
		});
	}, [encodedData, style, valid, colorsValid]);

	const setContent = <K extends QrContentKind>(
		kind: K,
		partial: Partial<Extract<QrContent, { kind: K }>>
	) =>
		setContents((prev) => ({
			...prev,
			[kind]: { ...prev[kind], ...partial } as QrContent,
		}));

	const kindOptions = CONTENT_KINDS.map((info) => ({
		value: info.kind,
		label: info.label,
		description: info.description,
		icon: KIND_ICONS[info.kind],
	}));
	const errorCorrectionOptions = ERROR_CORRECTION_LEVELS.map((info) => ({
		value: info.level,
		label: `${info.label} ${info.recovery}`,
		description: info.description,
	}));
	const dotOptions = DOT_TYPES.map((opt) => ({ value: opt.value, label: opt.label }));
	const cornerSquareOptions = CORNER_SQUARE_TYPES.map((opt) => ({
		value: opt.value,
		label: opt.label,
	}));
	const cornerDotOptions = CORNER_DOT_TYPES.map((opt) => ({
		value: opt.value,
		label: opt.label,
	}));
	const wifiSecurityOptions = [
		{ value: 'WPA', label: 'WPA / WPA2 / WPA3' },
		{ value: 'WEP', label: 'WEP (legacy)' },
		{ value: 'nopass', label: 'No password' },
	];

	const ActiveKindIcon = KIND_ICONS[activeKind];

	const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result;
			if (typeof result === 'string') setStyle((prev) => ({ ...prev, logoDataUrl: result }));
		};
		reader.readAsDataURL(file);
	};
	const handleLogoClear = () => setStyle((prev) => ({ ...prev, logoDataUrl: '' }));

	const handleDownload = async (extension: 'svg' | 'png') => {
		if (!qrInstanceRef.current) return;
		try {
			await qrInstanceRef.current.download({ name: 'qrcode', extension });
			toast.success(`${extension.toUpperCase()} downloaded`);
		} catch (e) {
			toast.error('Download failed', {
				description: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const renderContentInputs = () => {
		if (activeKind === 'text') {
			const c = contents.text as TextContent;
			return (
				<FormTextarea
					label="Text or URL"
					value={c.text}
					onValueChange={(v) => setContent('text', { text: v })}
					placeholder="https://example.com"
					rows={3}
					size="compact"
				/>
			);
		}
		if (activeKind === 'wifi') {
			const c = contents.wifi as WifiContent;
			return (
				<>
					<FormInput
						label="Network name (SSID)"
						value={c.ssid}
						onValueChange={(v) => setContent('wifi', { ssid: v })}
						placeholder="my-wifi"
						size="compact"
					/>
					<FormSelect
						label="Security"
						value={c.security}
						options={wifiSecurityOptions}
						onValueChange={(v) => {
							if (isWifiSecurity(v)) setContent('wifi', { security: v });
						}}
						size="compact"
					/>
					{c.security !== 'nopass' ? (
						<FormInput
							label="Password"
							type="password"
							showToggle
							value={c.password}
							onValueChange={(v) => setContent('wifi', { password: v })}
							size="compact"
						/>
					) : null}
					<FormCheckbox
						label="Hidden network"
						checked={c.hidden}
						onCheckedChange={(v) => setContent('wifi', { hidden: v })}
						size="compact"
					/>
				</>
			);
		}
		if (activeKind === 'vcard') {
			const c = contents.vcard as VcardContent;
			return (
				<>
					<FormInput
						label="First name"
						value={c.firstName}
						onValueChange={(v) => setContent('vcard', { firstName: v })}
						size="compact"
					/>
					<FormInput
						label="Last name"
						value={c.lastName}
						onValueChange={(v) => setContent('vcard', { lastName: v })}
						size="compact"
					/>
					<FormInput
						label="Phone"
						value={c.phone}
						onValueChange={(v) => setContent('vcard', { phone: v })}
						placeholder="+1 555 0100"
						size="compact"
					/>
					<FormInput
						label="Email"
						type="email"
						value={c.email}
						onValueChange={(v) => setContent('vcard', { email: v })}
						size="compact"
					/>
					<FormInput
						label="Organization"
						value={c.org}
						onValueChange={(v) => setContent('vcard', { org: v })}
						size="compact"
					/>
					<FormInput
						label="URL"
						value={c.url}
						onValueChange={(v) => setContent('vcard', { url: v })}
						size="compact"
					/>
				</>
			);
		}
		if (activeKind === 'email') {
			const c = contents.email as EmailContent;
			return (
				<>
					<FormInput
						label="To"
						type="email"
						value={c.to}
						onValueChange={(v) => setContent('email', { to: v })}
						placeholder="hello@example.com"
						size="compact"
					/>
					<FormInput
						label="Subject"
						value={c.subject}
						onValueChange={(v) => setContent('email', { subject: v })}
						size="compact"
					/>
					<FormTextarea
						label="Body"
						value={c.body}
						onValueChange={(v) => setContent('email', { body: v })}
						rows={3}
						size="compact"
					/>
				</>
			);
		}
		if (activeKind === 'sms') {
			const c = contents.sms as SmsContent;
			return (
				<>
					<FormInput
						label="To"
						value={c.to}
						onValueChange={(v) => setContent('sms', { to: v })}
						placeholder="+1 555 0100"
						size="compact"
					/>
					<FormTextarea
						label="Message"
						value={c.body}
						onValueChange={(v) => setContent('sms', { body: v })}
						rows={3}
						size="compact"
					/>
				</>
			);
		}
		if (activeKind === 'phone') {
			const c = contents.phone as PhoneContent;
			return (
				<FormInput
					label="Number"
					value={c.number}
					onValueChange={(v) => setContent('phone', { number: v })}
					placeholder="+1 555 0100"
					size="compact"
				/>
			);
		}
		if (activeKind === 'geo') {
			const c = contents.geo as GeoContent;
			return (
				<>
					<FormInput
						label="Latitude"
						value={c.latitude}
						onValueChange={(v) => setContent('geo', { latitude: v })}
						placeholder="35.6762"
						className="font-mono"
						size="compact"
					/>
					<FormInput
						label="Longitude"
						value={c.longitude}
						onValueChange={(v) => setContent('geo', { longitude: v })}
						placeholder="139.6503"
						className="font-mono"
						size="compact"
					/>
				</>
			);
		}
		if (activeKind === 'calendar') {
			const c = contents.calendar as CalendarContent;
			return (
				<>
					<FormInput
						label="Title"
						value={c.title}
						onValueChange={(v) => setContent('calendar', { title: v })}
						size="compact"
					/>
					<FormInput
						label="Start (ISO)"
						value={c.start}
						onValueChange={(v) => setContent('calendar', { start: v })}
						placeholder="2026-06-01T09:00"
						className="font-mono"
						size="compact"
					/>
					<FormInput
						label="End (ISO)"
						value={c.end}
						onValueChange={(v) => setContent('calendar', { end: v })}
						placeholder="2026-06-01T10:00"
						className="font-mono"
						size="compact"
					/>
					<FormInput
						label="Location"
						value={c.location}
						onValueChange={(v) => setContent('calendar', { location: v })}
						size="compact"
					/>
					<FormTextarea
						label="Description"
						value={c.description}
						onValueChange={(v) => setContent('calendar', { description: v })}
						rows={2}
						size="compact"
					/>
				</>
			);
		}
		if (activeKind === 'bitcoin') {
			const c = contents.bitcoin as BitcoinContent;
			return (
				<>
					<FormInput
						label="Address"
						value={c.address}
						onValueChange={(v) => setContent('bitcoin', { address: v })}
						placeholder="bc1q..."
						className="font-mono"
						size="compact"
					/>
					<FormInput
						label="Amount (BTC)"
						value={c.amount}
						onValueChange={(v) => setContent('bitcoin', { amount: v })}
						placeholder="0.001"
						className="font-mono"
						size="compact"
					/>
					<FormInput
						label="Label"
						value={c.label}
						onValueChange={(v) => setContent('bitcoin', { label: v })}
						size="compact"
					/>
				</>
			);
		}
		return null;
	};

	return (
		<ToolShell
			valid={valid && colorsValid ? true : null}
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			statusContent={
				valid ? (
					<>
						<StatItem label="Type" value={activeKind} />
						<StatItem label="Size" value={`${style.width}×${style.width}`} />
						<StatItem label="Level" value={style.errorCorrectionLevel} />
						<StatItem label="Length" value={encodedData.length} />
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Content type">
						<FormSelect
							label="Type"
							value={activeKind}
							options={kindOptions}
							onValueChange={(v) => {
								if (isQrContentKind(v)) setActiveKind(v);
							}}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Content">{renderContentInputs()}</FormSection>

					<FormSection title="Style">
						<FormSelect
							label="Dot style"
							value={style.dotType}
							options={dotOptions}
							onValueChange={(v) => {
								if (isDotType(v)) setStyle((prev) => ({ ...prev, dotType: v }));
							}}
							size="compact"
						/>
						<FormSelect
							label="Corner square"
							value={style.cornerSquareType}
							options={cornerSquareOptions}
							onValueChange={(v) => {
								if (isCornerSquareType(v)) setStyle((prev) => ({ ...prev, cornerSquareType: v }));
							}}
							size="compact"
						/>
						<FormSelect
							label="Corner dot"
							value={style.cornerDotType}
							options={cornerDotOptions}
							onValueChange={(v) => {
								if (isCornerDotType(v)) setStyle((prev) => ({ ...prev, cornerDotType: v }));
							}}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Colors">
						<FormInput
							label="Foreground"
							value={style.foregroundColor}
							onValueChange={(v) => setStyle((prev) => ({ ...prev, foregroundColor: v }))}
							placeholder="#0f172a"
							size="compact"
							className="font-mono"
						/>
						<FormInput
							label="Background"
							value={style.backgroundColor}
							onValueChange={(v) => setStyle((prev) => ({ ...prev, backgroundColor: v }))}
							placeholder="#ffffff"
							size="compact"
							className="font-mono"
						/>
						<FormCheckbox
							label="Use gradient"
							checked={style.useGradient}
							onCheckedChange={(v) => setStyle((prev) => ({ ...prev, useGradient: v }))}
							size="compact"
						/>
						{style.useGradient ? (
							<FormInput
								label="Gradient end"
								value={style.gradientColor}
								onValueChange={(v) => setStyle((prev) => ({ ...prev, gradientColor: v }))}
								placeholder="#3b82f6"
								size="compact"
								className="font-mono"
							/>
						) : null}
					</FormSection>

					<FormSection title="Logo">
						<input
							type="file"
							accept="image/*"
							onChange={handleLogoUpload}
							className="block w-full cursor-pointer rounded-md border bg-background px-3 py-1.5 text-xs file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium hover:bg-accent"
						/>
						{style.logoDataUrl ? (
							<>
								<div className="flex items-center gap-2 rounded-md border bg-card p-2">
									<img
										src={style.logoDataUrl}
										alt="logo preview"
										className="h-10 w-10 rounded object-contain"
									/>
									<span className="flex-1 text-xs text-muted-foreground">Logo loaded</span>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 px-2"
												onClick={handleLogoClear}
											>
												<Trash2 className="h-3.5 w-3.5" />
												<span className="sr-only">Remove logo</span>
											</Button>
										</TooltipTrigger>
										<TooltipContent>Remove logo</TooltipContent>
									</Tooltip>
								</div>
								<FormSlider
									label="Logo size"
									value={Math.round(style.logoSize * 100)}
									onValueChange={(v) => setStyle((prev) => ({ ...prev, logoSize: v / 100 }))}
									min={10}
									max={50}
									step={1}
									valueLabel={`${Math.round(style.logoSize * 100)}%`}
									size="compact"
								/>
								<FormCheckbox
									label="Hide background dots under logo"
									checked={style.hideBackgroundDots}
									onCheckedChange={(v) => setStyle((prev) => ({ ...prev, hideBackgroundDots: v }))}
									size="compact"
								/>
								<FormInfo>
									Use error correction level <strong>H</strong> for best logo readability.
								</FormInfo>
							</>
						) : null}
					</FormSection>

					<FormSection title="Size & error correction">
						<FormSlider
							label="Width"
							value={style.width}
							onValueChange={(v) => setStyle((prev) => ({ ...prev, width: v }))}
							min={MIN_WIDTH}
							max={MAX_WIDTH}
							step={32}
							valueLabel={`${style.width}px`}
							size="compact"
						/>
						<FormSlider
							label="Margin"
							value={style.margin}
							onValueChange={(v) => setStyle((prev) => ({ ...prev, margin: v }))}
							min={MIN_MARGIN}
							max={MAX_MARGIN}
							step={1}
							valueLabel={`${style.margin}`}
							size="compact"
						/>
						<FormSelect
							label="Error correction"
							value={style.errorCorrectionLevel}
							options={errorCorrectionOptions}
							onValueChange={(v) => {
								if (v === 'L' || v === 'M' || v === 'Q' || v === 'H')
									setStyle((prev) => ({ ...prev, errorCorrectionLevel: v }));
							}}
							size="compact"
						/>
					</FormSection>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<SectionHeader
					title="Preview"
					trailing={
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								// SectionHeader is bg-surface-2; restore visible hover affordance.
								className="h-7 gap-1 px-2 text-xs hover:bg-interactive-hover"
								disabled={!valid || !colorsValid}
								onClick={() => handleDownload('svg')}
							>
								<Download className="h-3 w-3" />
								SVG
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 gap-1 px-2 text-xs hover:bg-interactive-hover"
								disabled={!valid || !colorsValid}
								onClick={() => handleDownload('png')}
							>
								<Download className="h-3 w-3" />
								PNG
							</Button>
						</div>
					}
				/>

				<LiveStatusRegion className="flex-1 overflow-auto p-6">
					<div className="mx-auto flex max-w-3xl flex-col gap-6">
						<Card density="compact" className="overflow-hidden">
							<CardContent className="flex items-center justify-center p-8">
								<div ref={previewRef} className="flex items-center justify-center" />
							</CardContent>
						</Card>

						{!valid ? (
							<Card density="compact" variant="warning">
								<CardContent className="py-6">
									<EmbeddedEmptyState
										icon={QrCode}
										title="Fill in content to render"
										description="Complete the required fields on the left to generate the QR code."
									/>
								</CardContent>
							</Card>
						) : null}

						<Card density="compact">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
								<div className="flex items-center gap-2">
									<ActiveKindIcon className="h-4 w-4 text-muted-foreground" />
									<CardTitle className="text-sm font-medium">Encoded payload</CardTitle>
								</div>
								<CopyButton
									text={encodedData}
									toastLabel="Encoded data"
									size="sm"
									className="h-7"
								/>
							</CardHeader>
							<CardContent className="pt-0">
								<pre className="overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
									{encodedData}
								</pre>
							</CardContent>
						</Card>
					</div>
				</LiveStatusRegion>
			</div>
		</ToolShell>
	);
}
