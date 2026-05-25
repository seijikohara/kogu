import { createFileRoute } from '@tanstack/react-router';
import { Globe } from 'lucide-react';
import { type CSSProperties, type ReactNode, useMemo, useState } from 'react';

import { ActionButton, CopyButton } from '@/lib/components/action';
import { FormCheckbox, FormError, FormInfo, FormInput, FormSection } from '@/lib/components/form';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { ToneBadge } from '@/lib/components/ui/tone-badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/lib/components/ui/tooltip';
import { useDocumentTitle } from '@/lib/hooks';
import {
	BIT_FIELD_COLORS,
	bitsFor,
	type ConvertedFromIpv4,
	type ConvertedFromIpv6,
	convertFromIpv4,
	convertFromIpv6,
	type EmbeddingInfo,
	type EmbeddingKind,
	type IpFamily,
	type ParsedAddress,
	parseIp,
	SAMPLE_6TO4,
	SAMPLE_MAPPED,
	SAMPLE_TEREDO,
	SAMPLE_V4,
	SAMPLE_V6,
} from '@/lib/services/ip-convert';
import { createToolOptionsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

interface IpConverterOptions {
	readonly showBitmap: boolean;
	readonly favorMixedForMapped: boolean;
}

const DEFAULTS: IpConverterOptions = {
	showBitmap: true,
	favorMixedForMapped: true,
};

const useIpConverterOptions = createToolOptionsStore<IpConverterOptions>('ip-converter', DEFAULTS);

const EMBEDDING_TONE: Record<EmbeddingKind, 'success' | 'warning' | 'info' | 'destructive'> = {
	'ipv4-mapped': 'info',
	'ipv4-compatible': 'warning',
	'6to4': 'info',
	teredo: 'info',
	isatap: 'info',
	none: 'success',
};

const EMBEDDING_LABEL: Record<EmbeddingKind, string> = {
	'ipv4-mapped': 'IPv4-mapped',
	'ipv4-compatible': 'IPv4-compatible',
	'6to4': '6to4',
	teredo: 'Teredo',
	isatap: 'ISATAP',
	none: 'Plain IPv6',
};

export const Route = createFileRoute('/ip-converter')({
	component: IpConverterPage,
});

function IpConverterPage() {
	useDocumentTitle('IP Address Converter');

	const { value: options, patch } = useIpConverterOptions();
	const { showBitmap, favorMixedForMapped } = options;

	const [input, setInput] = useState<string>(SAMPLE_V4);
	const [showRail, setShowRail] = useState(true);

	const result = useMemo(() => parseIp(input), [input]);
	const fromIpv4 = useMemo(
		() =>
			result.ok && result.parsed.family === 'ipv4' ? convertFromIpv4(result.parsed.value) : null,
		[result]
	);
	const fromIpv6 = useMemo(
		() =>
			result.ok && result.parsed.family === 'ipv6' ? convertFromIpv6(result.parsed.value) : null,
		[result]
	);

	const trimmed = input.trim();
	const validity: boolean | null = trimmed.length === 0 ? null : result.ok;
	const embedding: EmbeddingInfo | null = fromIpv6?.embedding ?? null;
	const family: IpFamily | null = result.ok ? result.parsed.family : null;

	return (
		<ToolShell
			valid={validity}
			error={!result.ok && trimmed.length > 0 ? result.error : undefined}
			showRail={showRail}
			onShowRailChange={setShowRail}
			statusContent={
				<IpConverterStatus family={family} embedding={embedding} parsedOk={result.ok} />
			}
			rail={
				<IpConverterRail
					showBitmap={showBitmap}
					favorMixedForMapped={favorMixedForMapped}
					onLoadSample={setInput}
					onClear={() => setInput('')}
					onPatch={patch}
				/>
			}
		>
			<IpConverterMain
				input={input}
				trimmed={trimmed}
				parsed={result.ok ? result.parsed : null}
				error={!result.ok && trimmed.length > 0 ? result.error : null}
				embedding={embedding}
				fromIpv4={fromIpv4}
				fromIpv6={fromIpv6}
				favorMixedForMapped={favorMixedForMapped}
				showBitmap={showBitmap}
				onInputChange={setInput}
			/>
		</ToolShell>
	);
}

/* -------------------------------------------------------------------------- */

interface IpConverterStatusProps {
	readonly family: IpFamily | null;
	readonly embedding: EmbeddingInfo | null;
	readonly parsedOk: boolean;
}

function IpConverterStatus({ family, embedding, parsedOk }: IpConverterStatusProps) {
	if (!parsedOk || family === null) return null;
	return (
		<>
			<StatItem label="Family" value={family === 'ipv4' ? 'IPv4' : 'IPv6'} />
			{embedding ? <StatItem label="Embedding" value={EMBEDDING_LABEL[embedding.kind]} /> : null}
			<StatItem label="Integer bytes" value={family === 'ipv4' ? 4 : 16} />
		</>
	);
}

/* -------------------------------------------------------------------------- */

interface IpConverterRailProps {
	readonly showBitmap: boolean;
	readonly favorMixedForMapped: boolean;
	readonly onLoadSample: (value: string) => void;
	readonly onClear: () => void;
	readonly onPatch: (delta: Partial<IpConverterOptions>) => void;
}

function IpConverterRail({
	showBitmap,
	favorMixedForMapped,
	onLoadSample,
	onClear,
	onPatch,
}: IpConverterRailProps) {
	return (
		<>
			<FormSection title="Input">
				<FormInfo>
					Paste any IPv4 (e.g. <code className="font-mono">192.0.2.1</code>) or IPv6 (e.g.{' '}
					<code className="font-mono">2001:db8::1</code>). The family is auto-detected.
				</FormInfo>
				<div className="grid grid-cols-2 gap-1">
					<Button variant="outline" size="sm" onClick={() => onLoadSample(SAMPLE_V4)}>
						Load sample IPv4
					</Button>
					<Button variant="outline" size="sm" onClick={() => onLoadSample(SAMPLE_V6)}>
						Load sample IPv6
					</Button>
					<Button variant="outline" size="sm" onClick={() => onLoadSample(SAMPLE_MAPPED)}>
						Load IPv4-mapped sample
					</Button>
					<Button variant="outline" size="sm" onClick={() => onLoadSample(SAMPLE_6TO4)}>
						Load 6to4 sample
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="col-span-2"
						onClick={() => onLoadSample(SAMPLE_TEREDO)}
					>
						Load Teredo sample
					</Button>
				</div>
				<ActionButton label="Clear" variant="outline" onClick={onClear} />
			</FormSection>

			<FormSection title="Visualization">
				<FormCheckbox
					label="Show bit visualization"
					checked={showBitmap}
					onCheckedChange={(checked) => onPatch({ showBitmap: checked })}
				/>
			</FormSection>

			<FormSection title="Display">
				<FormCheckbox
					label="Use mixed form for IPv4-mapped (::ffff:a.b.c.d)"
					checked={favorMixedForMapped}
					onCheckedChange={(checked) => onPatch({ favorMixedForMapped: checked })}
				/>
			</FormSection>

			<FormSection title="About">
				<FormInfo>
					<ul className="list-inside list-disc space-y-0.5">
						<li>All conversions happen in-browser; no network calls.</li>
						<li>IPv6 compressed form follows RFC 5952.</li>
						<li>Embeddings: IPv4-mapped (RFC 4291), 6to4 (RFC 3056), Teredo (RFC 4380).</li>
						<li>Math runs on bigint; no precision loss for u128.</li>
					</ul>
				</FormInfo>
			</FormSection>
		</>
	);
}

/* -------------------------------------------------------------------------- */

interface IpConverterMainProps {
	readonly input: string;
	readonly trimmed: string;
	readonly parsed: ParsedAddress | null;
	readonly error: string | null;
	readonly embedding: EmbeddingInfo | null;
	readonly fromIpv4: ConvertedFromIpv4 | null;
	readonly fromIpv6: ConvertedFromIpv6 | null;
	readonly favorMixedForMapped: boolean;
	readonly showBitmap: boolean;
	readonly onInputChange: (value: string) => void;
}

function IpConverterMain({
	input,
	trimmed,
	parsed,
	error,
	embedding,
	fromIpv4,
	fromIpv6,
	favorMixedForMapped,
	showBitmap,
	onInputChange,
}: IpConverterMainProps) {
	const isEmpty = trimmed.length === 0 || parsed === null;
	return (
		<div className="flex h-full flex-col overflow-auto p-3">
			<div className="space-y-3">
				<InputCard
					input={input}
					onInputChange={onInputChange}
					parsed={parsed}
					error={error}
					embedding={embedding}
				/>
				{isEmpty ? (
					<EmptyCard />
				) : fromIpv4 ? (
					<FromIpv4Section converted={fromIpv4} favorMixedForMapped={favorMixedForMapped} />
				) : fromIpv6 ? (
					<FromIpv6Section converted={fromIpv6} />
				) : null}
				{showBitmap && parsed ? (
					<BitGridCard parsed={parsed} embedding={embedding ?? undefined} />
				) : null}
			</div>
		</div>
	);
}

function EmptyCard() {
	return (
		<Card density="compact">
			<CardContent>
				<EmbeddedEmptyState
					icon={Globe}
					title="Enter an IP address"
					description="Type an IPv4 or IPv6 address to see the cross-family encodings, notation normalization, embedding detection, and bit-level breakdown."
				/>
			</CardContent>
		</Card>
	);
}

/* -------------------------------------------------------------------------- */

interface InputCardProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly parsed: ParsedAddress | null;
	readonly error: string | null;
	readonly embedding: EmbeddingInfo | null;
}

function InputCard({ input, onInputChange, parsed, error, embedding }: InputCardProps) {
	return (
		<Card density="compact">
			<CardHeader className="pb-2">
				<CardTitle>Address</CardTitle>
			</CardHeader>
			<CardContent>
				<FormInput
					label="IPv4 or IPv6 address"
					value={input}
					onValueChange={onInputChange}
					placeholder="e.g. 192.0.2.1, 2001:db8::1, or ::ffff:192.0.2.1"
					size="default"
				/>
				{error ? <FormError message={error} className="mt-2" /> : null}
				{parsed ? (
					<div className="mt-3 flex flex-wrap gap-1.5">
						<ToneBadge tone={parsed.family === 'ipv4' ? 'info' : 'success'}>
							{parsed.family === 'ipv4' ? 'IPv4' : 'IPv6'}
						</ToneBadge>
						{embedding && embedding.kind !== 'none' ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<span>
										<ToneBadge tone={EMBEDDING_TONE[embedding.kind]}>
											{EMBEDDING_LABEL[embedding.kind]}
										</ToneBadge>
									</span>
								</TooltipTrigger>
								<TooltipContent>{embedding.description}</TooltipContent>
							</Tooltip>
						) : null}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

/* -------------------------------------------------------------------------- */

interface FromIpv4SectionProps {
	readonly converted: ConvertedFromIpv4;
	readonly favorMixedForMapped: boolean;
}

interface DetailItem {
	readonly key: string;
	readonly label: string;
	readonly value: string;
	readonly hint?: string;
}

function FromIpv4Section({ converted, favorMixedForMapped }: FromIpv4SectionProps) {
	// When the user opts out of mixed (dotted-quad) form, render the IPv4-mapped
	// address using pure hextets so the entire IPv6 surface stays in colon-hex.
	const mappedDisplay = useMemo(() => {
		if (favorMixedForMapped) return converted.mapped;
		const v = converted.decimalInteger;
		const hi = (v >> 16n) & 0xffffn;
		const lo = v & 0xffffn;
		return `::ffff:${hi.toString(16)}:${lo.toString(16)}`;
	}, [favorMixedForMapped, converted.mapped, converted.decimalInteger]);

	const items: readonly DetailItem[] = [
		{ key: 'decimal', label: 'Decimal integer (u32)', value: converted.decimalInteger.toString() },
		{ key: 'hex', label: 'Hex', value: converted.hexInteger },
		{ key: 'binary', label: 'Binary', value: converted.binary },
		{
			key: 'mapped',
			label: 'IPv4-mapped (::ffff:…)',
			value: mappedDisplay,
			hint: 'Used by dual-stack sockets (RFC 4291).',
		},
		{
			key: 'compatible',
			label: 'IPv4-compatible (::…)',
			value: converted.compatible,
			hint: 'Deprecated by RFC 4291; shown for completeness.',
		},
		{
			key: 'sixToFour',
			label: '6to4 prefix (2002:…::/48)',
			value: converted.sixToFour,
			hint: 'Each IPv4 maps to its own /48 site prefix (RFC 3056).',
		},
		{
			key: 'sixToFourHost',
			label: '6to4 host (typical /64)',
			value: converted.sixToFourFull,
		},
	];

	return <DetailsGrid items={items} />;
}

/* -------------------------------------------------------------------------- */

interface FromIpv6SectionProps {
	readonly converted: ConvertedFromIpv6;
}

function FromIpv6Section({ converted }: FromIpv6SectionProps) {
	const items: readonly DetailItem[] = [
		{ key: 'compressed', label: 'Compressed (RFC 5952)', value: converted.ipv6.compressed },
		{ key: 'expanded', label: 'Expanded (full 8 groups)', value: converted.ipv6.expanded },
		{ key: 'mixed', label: 'Mixed (dotted-quad tail)', value: converted.ipv6.mixed },
		{ key: 'decimal', label: 'Decimal integer (u128)', value: converted.decimalInteger.toString() },
		{ key: 'hex', label: 'Hex', value: converted.hexInteger },
	];

	return (
		<>
			<DetailsGrid items={items} />
			<EmbeddingCard embedding={converted.embedding} />
		</>
	);
}

/* -------------------------------------------------------------------------- */

interface DetailsGridProps {
	readonly items: readonly DetailItem[];
}

function DetailsGrid({ items }: DetailsGridProps) {
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{items.map((item) => (
				<Card key={item.key} density="compact">
					<CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
						<CardTitle className="truncate text-xs uppercase tracking-wide text-muted-foreground">
							{item.label}
						</CardTitle>
						<CopyButton
							text={item.value}
							toastLabel={item.label}
							size="sm"
							variant="ghost"
							showLabel={false}
						/>
					</CardHeader>
					<CardContent>
						<div className="font-mono text-sm break-all tabular-nums">{item.value}</div>
						{item.hint ? (
							<p className="mt-1.5 text-2xs text-muted-foreground">{item.hint}</p>
						) : null}
					</CardContent>
				</Card>
			))}
		</div>
	);
}

/* -------------------------------------------------------------------------- */

interface EmbeddingCardProps {
	readonly embedding: EmbeddingInfo;
}

function EmbeddingCard({ embedding }: EmbeddingCardProps) {
	return (
		<Card density="compact">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="flex items-center gap-2">
						Embedding
						<ToneBadge tone={EMBEDDING_TONE[embedding.kind]}>
							{EMBEDDING_LABEL[embedding.kind]}
						</ToneBadge>
					</CardTitle>
				</div>
			</CardHeader>
			<CardContent className="space-y-2">
				<p className="text-xs text-muted-foreground">{embedding.description}</p>
				{embedding.embeddedIpv4 ? (
					<EmbeddingRow label="Embedded IPv4" value={embedding.embeddedIpv4} />
				) : null}
				{embedding.teredoServer ? (
					<EmbeddingRow label="Teredo server" value={embedding.teredoServer} />
				) : null}
				{embedding.teredoMappedAddress ? (
					<EmbeddingRow label="Mapped client" value={embedding.teredoMappedAddress} />
				) : null}
				{embedding.teredoMappedPort !== undefined ? (
					<EmbeddingRow label="Mapped port" value={String(embedding.teredoMappedPort)} copyable />
				) : null}
				{embedding.teredoFlags ? (
					<EmbeddingRow
						label="Flags"
						value={`cone=${embedding.teredoFlags.cone ? 'yes' : 'no'} · individual=${embedding.teredoFlags.individual ? 'yes' : 'no'} · reserved=0x${embedding.teredoFlags.reserved.toString(16).padStart(4, '0')}`}
						copyable={false}
					/>
				) : null}
			</CardContent>
		</Card>
	);
}

interface EmbeddingRowProps {
	readonly label: string;
	readonly value: string;
	readonly copyable?: boolean;
}

function EmbeddingRow({ label, value, copyable = true }: EmbeddingRowProps) {
	return (
		<div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5">
			<div className="min-w-0">
				<div className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</div>
				<div className="font-mono text-sm break-all tabular-nums">{value}</div>
			</div>
			{copyable ? (
				<CopyButton text={value} toastLabel={label} size="sm" variant="ghost" showLabel={false} />
			) : null}
		</div>
	);
}

/* -------------------------------------------------------------------------- */

interface BitGridCardProps {
	readonly parsed: ParsedAddress;
	readonly embedding?: EmbeddingInfo;
}

function BitGridCard({ parsed, embedding }: BitGridCardProps) {
	const bits = useMemo(
		() => bitsFor(parsed.value, parsed.family, embedding),
		[parsed.value, parsed.family, embedding]
	);
	const groupSize = parsed.family === 'ipv4' ? 8 : 16;
	const totalBits = parsed.family === 'ipv4' ? 32 : 128;
	const groupCount = totalBits / groupSize;
	const groupLabel = parsed.family === 'ipv4' ? 'octet' : 'hextet';

	const legend: readonly ReactNode[] = useMemo(() => {
		const seen = new Set<string>();
		return bits.flatMap((cell) => {
			if (!cell.field || seen.has(cell.field)) return [];
			seen.add(cell.field);
			return [
				<span key={cell.field} className="inline-flex items-center gap-1">
					<span className={cn('inline-block size-2.5 rounded-sm', cell.fieldColor)} />
					{cell.field}
				</span>,
			];
		});
	}, [bits]);

	return (
		<Card density="compact">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between gap-2">
					<CardTitle>Bit Layout</CardTitle>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
						{legend}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="overflow-x-auto">
					<div
						className="grid gap-y-1"
						style={
							{
								gridTemplateColumns: `repeat(${totalBits}, minmax(0.5rem, 1fr))`,
							} as CSSProperties
						}
					>
						{bits.map((cell, idx) => {
							const isGroupStart = idx % groupSize === 0 && idx > 0;
							const bitKey = `${parsed.family}-bit-${idx}`;
							return (
								<Tooltip key={bitKey}>
									<TooltipTrigger asChild>
										<span
											className={cn(
												'flex h-5 items-center justify-center rounded-sm border font-mono text-2xs leading-none transition-colors',
												cell.value === 1
													? cn(
															cell.fieldColor ?? BIT_FIELD_COLORS.host,
															'border-transparent text-foreground'
														)
													: 'border-border bg-muted text-muted-foreground/60',
												isGroupStart && 'ml-1'
											)}
										>
											{cell.value}
										</span>
									</TooltipTrigger>
									<TooltipContent>
										<span className="font-mono text-2xs">
											bit {idx + 1} of {totalBits}
											{cell.field ? ` · ${cell.field}` : ''}
										</span>
									</TooltipContent>
								</Tooltip>
							);
						})}
					</div>
					<div
						className="mt-1 grid gap-y-1"
						style={
							{ gridTemplateColumns: `repeat(${groupCount}, minmax(0, 1fr))` } as CSSProperties
						}
					>
						{Array.from({ length: groupCount }, (_, i) => {
							const labelKey = `${parsed.family}-${groupLabel}-${i}`;
							return (
								<span
									key={labelKey}
									className="text-center font-mono text-2xs text-muted-foreground"
								>
									{groupLabel} {i + 1}
								</span>
							);
						})}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
