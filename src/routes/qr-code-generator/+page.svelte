<script lang="ts">
	import {
		Bitcoin,
		Calendar,
		Contact,
		Download,
		Globe,
		Image as ImageIcon,
		Mail,
		MapPin,
		MessageSquare,
		Phone,
		QrCode,
		Trash2,
		Wifi,
	} from '@lucide/svelte';
	import type { CornerDotType, CornerSquareType, DotType } from 'qr-code-styling';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { ActionButton, CopyButton } from '$lib/components/action';
	import {
		FormCheckbox,
		FormInfo,
		FormInput,
		FormSection,
		FormSelect,
		FormSlider,
		FormTextarea,
	} from '$lib/components/form';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { SectionHeader } from '$lib/components/layout';
	import { ToolShell } from '$lib/components/shell';
	import { StatItem } from '$lib/components/status';
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
	} from '$lib/services/qr-code.js';

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

	const isDotType = (value: string): value is DotType =>
		DOT_TYPES.some((opt) => opt.value === value);

	const isCornerSquareType = (value: string): value is CornerSquareType =>
		CORNER_SQUARE_TYPES.some((opt) => opt.value === value);

	const isCornerDotType = (value: string): value is CornerDotType =>
		CORNER_DOT_TYPES.some((opt) => opt.value === value);

	// State
	let activeKind = $state<QrContentKind>('text');
	let contents = $state<Record<QrContentKind, QrContent>>({
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
	let style = $state<StyleOptions>({ ...DEFAULT_STYLE_OPTIONS });
	let showOptions = $state(true);

	// Derived
	const currentContent = $derived(contents[activeKind]);
	const encodedData = $derived(encodeQrContent(currentContent));
	const valid = $derived(isContentValid(currentContent));
	const colorsValid = $derived(
		isValidHexColor(style.foregroundColor) &&
			isValidHexColor(style.backgroundColor) &&
			(!style.useGradient || isValidHexColor(style.gradientColor))
	);

	const kindOptions = CONTENT_KINDS.map((info) => ({
		value: info.kind,
		label: info.label,
	}));

	const ActiveKindIcon = $derived(KIND_ICONS[activeKind]);

	const errorCorrectionOptions = ERROR_CORRECTION_LEVELS.map((info) => ({
		value: info.level,
		label: `${info.label} (${info.recovery})`,
	}));

	const dotOptions = DOT_TYPES.map((opt) => ({ value: opt.value, label: opt.label }));
	const cornerSquareOptions = CORNER_SQUARE_TYPES.map((opt) => ({
		value: opt.value,
		label: opt.label,
	}));
	const cornerDotOptions = CORNER_DOT_TYPES.map((opt) => ({ value: opt.value, label: opt.label }));

	const wifiSecurityOptions = [
		{ value: 'WPA', label: 'WPA / WPA2 / WPA3' },
		{ value: 'WEP', label: 'WEP (legacy)' },
		{ value: 'nopass', label: 'No password' },
	];

	// Update helpers — return new content objects so we never mutate state in place.
	const setContent = <K extends QrContentKind>(
		kind: K,
		partial: Partial<Extract<QrContent, { kind: K }>>
	) => {
		contents = {
			...contents,
			[kind]: { ...contents[kind], ...partial } as QrContent,
		};
	};

	const handleKindChange = (value: string) => {
		if (isQrContentKind(value)) activeKind = value;
	};
	const handleSecurityChange = (value: string) => {
		if (isWifiSecurity(value)) setContent('wifi', { security: value });
	};
	const handleDotTypeChange = (value: string) => {
		if (isDotType(value)) style = { ...style, dotType: value };
	};
	const handleCornerSquareChange = (value: string) => {
		if (isCornerSquareType(value)) style = { ...style, cornerSquareType: value };
	};
	const handleCornerDotChange = (value: string) => {
		if (isCornerDotType(value)) style = { ...style, cornerDotType: value };
	};
	const handleErrorCorrectionChange = (value: string) => {
		if (value === 'L' || value === 'M' || value === 'Q' || value === 'H') {
			style = { ...style, errorCorrectionLevel: value };
		}
	};

	// Logo upload
	const handleLogoUpload = (event: Event) => {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result;
			if (typeof result === 'string') style = { ...style, logoDataUrl: result };
		};
		reader.readAsDataURL(file);
	};
	const handleLogoClear = () => {
		style = { ...style, logoDataUrl: '' };
	};

	// QR rendering — runs in browser only.
	let previewEl: HTMLDivElement | null = $state(null);
	let qrInstance: ReturnType<typeof createQr> | null = null;

	onMount(() => {
		if (!previewEl) return;
		qrInstance = createQr(encodedData, style);
		qrInstance.append(previewEl);
	});

	$effect(() => {
		// React to data + style changes; update existing instance.
		if (!qrInstance) return;
		if (!valid || !colorsValid) return;
		qrInstance.update({
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
	});

	const handleDownload = async (extension: 'svg' | 'png') => {
		if (!qrInstance) return;
		try {
			await qrInstance.download({ name: 'qrcode', extension });
			toast.success(`${extension.toUpperCase()} downloaded`);
		} catch (e) {
			toast.error('Download failed', { description: e instanceof Error ? e.message : String(e) });
		}
	};

	const handleCopyData = async () => {
		try {
			await navigator.clipboard.writeText(encodedData);
			toast.success('Encoded data copied');
		} catch {
			toast.error('Failed to copy');
		}
	};
</script>

<svelte:head>
	<title>QR Code Generator - Kogu</title>
</svelte:head>

<ToolShell valid={valid && colorsValid ? true : null} bind:showRail={showOptions}>
	{#snippet statusContent()}
		{#if valid}
			<StatItem label="Type" value={activeKind} />
			<StatItem label="Size" value={`${style.width}×${style.width}`} />
			<StatItem label="Level" value={style.errorCorrectionLevel} />
			<StatItem label="Length" value={encodedData.length} />
		{/if}
	{/snippet}

	{#snippet rail()}
		<FormSection title="Content type">
			<FormSelect
				label="Type"
				value={activeKind}
				options={kindOptions}
				onchange={handleKindChange}
			/>
		</FormSection>

		<FormSection title="Content">
			{#if activeKind === 'text'}
				{@const c = contents.text as TextContent}
				<FormTextarea
					label="Text or URL"
					value={c.text}
					onchange={(v) => setContent('text', { text: v })}
					placeholder="https://example.com"
					rows={3}
				/>
			{:else if activeKind === 'wifi'}
				{@const c = contents.wifi as WifiContent}
				<FormInput
					label="Network name (SSID)"
					value={c.ssid}
					onchange={(v) => setContent('wifi', { ssid: v })}
					placeholder="my-wifi"
				/>
				<FormSelect
					label="Security"
					value={c.security}
					options={wifiSecurityOptions}
					onchange={handleSecurityChange}
				/>
				{#if c.security !== 'nopass'}
					<FormInput
						label="Password"
						type="password"
						showToggle
						value={c.password}
						onchange={(v) => setContent('wifi', { password: v })}
					/>
				{/if}
				<FormCheckbox
					label="Hidden network"
					checked={c.hidden}
					onchange={(v) => setContent('wifi', { hidden: v })}
				/>
			{:else if activeKind === 'vcard'}
				{@const c = contents.vcard as VcardContent}
				<FormInput
					label="First name"
					value={c.firstName}
					onchange={(v) => setContent('vcard', { firstName: v })}
				/>
				<FormInput
					label="Last name"
					value={c.lastName}
					onchange={(v) => setContent('vcard', { lastName: v })}
				/>
				<FormInput
					label="Phone"
					value={c.phone}
					onchange={(v) => setContent('vcard', { phone: v })}
					placeholder="+1 555 0100"
				/>
				<FormInput
					label="Email"
					type="email"
					value={c.email}
					onchange={(v) => setContent('vcard', { email: v })}
				/>
				<FormInput
					label="Organization"
					value={c.org}
					onchange={(v) => setContent('vcard', { org: v })}
				/>
				<FormInput label="URL" value={c.url} onchange={(v) => setContent('vcard', { url: v })} />
			{:else if activeKind === 'email'}
				{@const c = contents.email as EmailContent}
				<FormInput
					label="To"
					type="email"
					value={c.to}
					onchange={(v) => setContent('email', { to: v })}
					placeholder="hello@example.com"
				/>
				<FormInput
					label="Subject"
					value={c.subject}
					onchange={(v) => setContent('email', { subject: v })}
				/>
				<FormTextarea
					label="Body"
					value={c.body}
					onchange={(v) => setContent('email', { body: v })}
					rows={3}
				/>
			{:else if activeKind === 'sms'}
				{@const c = contents.sms as SmsContent}
				<FormInput
					label="To"
					value={c.to}
					onchange={(v) => setContent('sms', { to: v })}
					placeholder="+1 555 0100"
				/>
				<FormTextarea
					label="Message"
					value={c.body}
					onchange={(v) => setContent('sms', { body: v })}
					rows={3}
				/>
			{:else if activeKind === 'phone'}
				{@const c = contents.phone as PhoneContent}
				<FormInput
					label="Number"
					value={c.number}
					onchange={(v) => setContent('phone', { number: v })}
					placeholder="+1 555 0100"
				/>
			{:else if activeKind === 'geo'}
				{@const c = contents.geo as GeoContent}
				<FormInput
					label="Latitude"
					value={c.latitude}
					onchange={(v) => setContent('geo', { latitude: v })}
					placeholder="35.6762"
					class="font-mono"
				/>
				<FormInput
					label="Longitude"
					value={c.longitude}
					onchange={(v) => setContent('geo', { longitude: v })}
					placeholder="139.6503"
					class="font-mono"
				/>
			{:else if activeKind === 'calendar'}
				{@const c = contents.calendar as CalendarContent}
				<FormInput
					label="Title"
					value={c.title}
					onchange={(v) => setContent('calendar', { title: v })}
				/>
				<FormInput
					label="Start (ISO)"
					value={c.start}
					onchange={(v) => setContent('calendar', { start: v })}
					placeholder="2026-06-01T09:00"
					class="font-mono"
				/>
				<FormInput
					label="End (ISO)"
					value={c.end}
					onchange={(v) => setContent('calendar', { end: v })}
					placeholder="2026-06-01T10:00"
					class="font-mono"
				/>
				<FormInput
					label="Location"
					value={c.location}
					onchange={(v) => setContent('calendar', { location: v })}
				/>
				<FormTextarea
					label="Description"
					value={c.description}
					onchange={(v) => setContent('calendar', { description: v })}
					rows={2}
				/>
			{:else if activeKind === 'bitcoin'}
				{@const c = contents.bitcoin as BitcoinContent}
				<FormInput
					label="Address"
					value={c.address}
					onchange={(v) => setContent('bitcoin', { address: v })}
					placeholder="bc1q..."
					class="font-mono"
				/>
				<FormInput
					label="Amount (BTC)"
					value={c.amount}
					onchange={(v) => setContent('bitcoin', { amount: v })}
					placeholder="0.001"
					class="font-mono"
				/>
				<FormInput
					label="Label"
					value={c.label}
					onchange={(v) => setContent('bitcoin', { label: v })}
				/>
			{/if}
		</FormSection>

		<FormSection title="Style">
			<FormSelect
				label="Dot style"
				value={style.dotType}
				options={dotOptions}
				onchange={handleDotTypeChange}
			/>
			<FormSelect
				label="Corner square"
				value={style.cornerSquareType}
				options={cornerSquareOptions}
				onchange={handleCornerSquareChange}
			/>
			<FormSelect
				label="Corner dot"
				value={style.cornerDotType}
				options={cornerDotOptions}
				onchange={handleCornerDotChange}
			/>
		</FormSection>

		<FormSection title="Colors">
			<FormInput
				label="Foreground"
				value={style.foregroundColor}
				onchange={(v) => (style = { ...style, foregroundColor: v })}
				placeholder="#0f172a"
				size="compact"
				class="font-mono"
			/>
			<FormInput
				label="Background"
				value={style.backgroundColor}
				onchange={(v) => (style = { ...style, backgroundColor: v })}
				placeholder="#ffffff"
				size="compact"
				class="font-mono"
			/>
			<FormCheckbox
				label="Use gradient"
				checked={style.useGradient}
				onchange={(v) => (style = { ...style, useGradient: v })}
			/>
			{#if style.useGradient}
				<FormInput
					label="Gradient end"
					value={style.gradientColor}
					onchange={(v) => (style = { ...style, gradientColor: v })}
					placeholder="#3b82f6"
					size="compact"
					class="font-mono"
				/>
			{/if}
		</FormSection>

		<FormSection title="Logo">
			<input
				type="file"
				accept="image/*"
				onchange={handleLogoUpload}
				class="block w-full cursor-pointer rounded-md border bg-background px-3 py-1.5 text-xs file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium hover:bg-accent"
			/>
			{#if style.logoDataUrl}
				<div class="flex items-center gap-2 rounded-md border bg-surface-3 p-2">
					<img
						src={style.logoDataUrl}
						alt="logo preview"
						class="h-10 w-10 rounded object-contain"
					/>
					<span class="flex-1 text-xs text-muted-foreground">Logo loaded</span>
					<Button variant="ghost" size="sm" class="h-7 px-2" onclick={handleLogoClear}>
						<Trash2 class="h-3.5 w-3.5" />
					</Button>
				</div>
				<FormSlider
					label="Logo size"
					value={Math.round(style.logoSize * 100)}
					onchange={(v) => (style = { ...style, logoSize: v / 100 })}
					min={10}
					max={50}
					step={1}
					valueLabel={`${Math.round(style.logoSize * 100)}%`}
				/>
				<FormCheckbox
					label="Hide background dots under logo"
					checked={style.hideBackgroundDots}
					onchange={(v) => (style = { ...style, hideBackgroundDots: v })}
				/>
				<FormInfo>
					Use error correction level <strong>H</strong> for best logo readability.
				</FormInfo>
			{/if}
		</FormSection>

		<FormSection title="Size & error correction">
			<FormSlider
				label="Width"
				bind:value={style.width}
				min={MIN_WIDTH}
				max={MAX_WIDTH}
				step={32}
				valueLabel={`${style.width}px`}
			/>
			<FormSlider
				label="Margin"
				bind:value={style.margin}
				min={MIN_MARGIN}
				max={MAX_MARGIN}
				step={1}
				valueLabel={`${style.margin}`}
			/>
			<FormSelect
				label="Error correction"
				value={style.errorCorrectionLevel}
				options={errorCorrectionOptions}
				onchange={handleErrorCorrectionChange}
			/>
		</FormSection>
	{/snippet}

	<!-- Result panel -->
	<div class="flex h-full flex-col overflow-hidden">
		<SectionHeader title="Preview">
			{#snippet trailing()}
				<div class="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						class="h-7 gap-1 px-2 text-xs"
						disabled={!valid || !colorsValid}
						onclick={() => handleDownload('svg')}
					>
						<Download class="h-3 w-3" />
						SVG
					</Button>
					<Button
						variant="ghost"
						size="sm"
						class="h-7 gap-1 px-2 text-xs"
						disabled={!valid || !colorsValid}
						onclick={() => handleDownload('png')}
					>
						<Download class="h-3 w-3" />
						PNG
					</Button>
				</div>
			{/snippet}
		</SectionHeader>

		<div class="flex-1 overflow-auto p-6">
			<div class="mx-auto flex max-w-3xl flex-col gap-6">
				<Card.Root class="overflow-hidden">
					<Card.Content class="flex items-center justify-center p-8">
						<div bind:this={previewEl} class="flex items-center justify-center"></div>
					</Card.Content>
				</Card.Root>

				{#if !valid}
					<Card.Root class="border-warning/40 bg-warning/5">
						<Card.Content class="flex items-start gap-3 py-4">
							<ImageIcon class="mt-0.5 h-4 w-4 text-warning" />
							<div class="text-sm text-muted-foreground">
								Fill in the required fields above to render the QR code.
							</div>
						</Card.Content>
					</Card.Root>
				{/if}

				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between space-y-0 py-4">
						<div class="flex items-center gap-2">
							<ActiveKindIcon class="h-4 w-4 text-muted-foreground" />
							<Card.Title class="text-sm font-medium">Encoded payload</Card.Title>
						</div>
						<CopyButton text={encodedData} toastLabel="Encoded data" size="sm" class="h-7" />
					</Card.Header>
					<Card.Content class="pt-0">
						<pre
							class="overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">{encodedData}</pre>
					</Card.Content>
				</Card.Root>
			</div>
		</div>
	</div>
</ToolShell>
