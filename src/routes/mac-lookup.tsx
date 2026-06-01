import { createFileRoute } from '@tanstack/react-router';
import { Cable, Database, Dice5, Network } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ActionButton, CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormError,
	FormInfo,
	FormInput,
	FormMode,
	FormSection,
} from '@/lib/components/form';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { ToneBadge } from '@/lib/components/ui/tone-badge';
import { useDocumentTitle } from '@/lib/hooks';
import {
	formatMac,
	formatPrefix,
	generateRandomMac,
	getOuiDatabaseInfo,
	lookupVendor,
	type MacFlags,
	type MacFormat,
	macFlags,
	type OuiDatabaseInfo,
	type ParsedMac,
	parseMac,
	SAMPLE_BROADCAST,
	SAMPLE_LOCAL_MAC,
	SAMPLE_MAC,
	toEui64,
	toIpv6LinkLocal,
	type VendorResult,
} from '@/lib/services/mac';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';

interface MacLookupOptions {
	readonly displayFormat: MacFormat;
	readonly upperCase: boolean;
	readonly randomLocalOnly: boolean;
	readonly randomVendorOui: string;
}

const DEFAULTS: MacLookupOptions = {
	displayFormat: 'colon',
	upperCase: false,
	randomLocalOnly: true,
	randomVendorOui: '',
};

const useMacLookupOptions = createToolOptionsStore<MacLookupOptions>('mac-lookup', DEFAULTS);

const FORMAT_OPTIONS: readonly { readonly value: MacFormat; readonly label: string }[] = [
	{ value: 'colon', label: 'Colon' },
	{ value: 'dash', label: 'Dash' },
	{ value: 'dot', label: 'Dot' },
	{ value: 'bare', label: 'Bare' },
];

export const Route = createFileRoute('/mac-lookup')({
	component: MacLookupPage,
});

function MacLookupPage() {
	useDocumentTitle('MAC Address Lookup');

	const { value: options, patch } = useMacLookupOptions();
	const { displayFormat, upperCase, randomLocalOnly, randomVendorOui } = options;

	const [input, setInput] = useState<string>(SAMPLE_MAC);
	const [vendor, setVendor] = useState<VendorResult | null>(null);
	const [vendorLoading, setVendorLoading] = useState<boolean>(false);
	const [dbInfo, setDbInfo] = useState<OuiDatabaseInfo | null>(null);
	const [showRail, setShowRail] = usePersistedRail('mac-lookup');

	const parseResult = useMemo(() => parseMac(input), [input]);
	const trimmed = input.trim();

	// Resolve vendor whenever the parsed MAC changes. Render-effect because
	// the lookup is an out-of-band IPC roundtrip that cannot be derived
	// synchronously.
	useEffect(() => {
		if (!parseResult.ok) {
			setVendor(null);
			setVendorLoading(false);
			return;
		}
		let cancelled = false;
		setVendorLoading(true);
		lookupVendor(parseResult.mac).then((result) => {
			if (cancelled) return;
			setVendor(result);
			setVendorLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [parseResult]);

	// One-shot fetch of bundled database metadata for the freshness badge.
	useEffect(() => {
		let cancelled = false;
		getOuiDatabaseInfo().then((info) => {
			if (!cancelled) setDbInfo(info);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const flags: MacFlags | null = parseResult.ok ? macFlags(parseResult.mac) : null;

	const validity: boolean | null = trimmed.length === 0 ? null : parseResult.ok;
	const error = !parseResult.ok && trimmed.length > 0 ? parseResult.error : undefined;

	const handleGenerateRandom = () => {
		const mac = generateRandomMac({
			locallyAdministered: randomLocalOnly,
			vendorPrefix: randomVendorOui.trim().length > 0 ? randomVendorOui : undefined,
		});
		setInput(formatMac(mac, displayFormat, upperCase));
	};

	return (
		<ToolShell
			valid={validity}
			error={error}
			showRail={showRail}
			onShowRailChange={setShowRail}
			statusContent={
				<MacLookupStatus parseResult={parseResult} vendor={vendor} flags={flags} dbInfo={dbInfo} />
			}
			rail={
				<MacLookupRail
					displayFormat={displayFormat}
					upperCase={upperCase}
					randomLocalOnly={randomLocalOnly}
					randomVendorOui={randomVendorOui}
					dbInfo={dbInfo}
					onLoadSample={setInput}
					onClear={() => setInput('')}
					onPatch={patch}
					onGenerateRandom={handleGenerateRandom}
				/>
			}
		>
			<MacLookupMain
				input={input}
				onInputChange={setInput}
				parseResult={parseResult}
				vendor={vendor}
				vendorLoading={vendorLoading}
				flags={flags}
				displayFormat={displayFormat}
				upperCase={upperCase}
				dbInfo={dbInfo}
			/>
		</ToolShell>
	);
}

/* -------------------------------------------------------------------------- */

interface StatusProps {
	readonly parseResult: ReturnType<typeof parseMac>;
	readonly vendor: VendorResult | null;
	readonly flags: MacFlags | null;
	readonly dbInfo: OuiDatabaseInfo | null;
}

function MacLookupStatus({ parseResult, vendor, flags, dbInfo }: StatusProps) {
	if (!parseResult.ok || !flags) {
		return dbInfo ? <StatItem label="OUI entries" value={dbInfo.entries.toLocaleString()} /> : null;
	}
	const typeLabel = flags.broadcast ? 'Broadcast' : flags.multicast ? 'Multicast' : 'Unicast';
	const adminLabel = flags.local ? 'Local' : 'Universal';
	return (
		<>
			<StatItem label="Vendor" value={vendor?.vendor ?? 'Unknown'} />
			<StatItem label="Type" value={typeLabel} />
			<StatItem label="Admin" value={adminLabel} />
		</>
	);
}

/* -------------------------------------------------------------------------- */

interface RailProps {
	readonly displayFormat: MacFormat;
	readonly upperCase: boolean;
	readonly randomLocalOnly: boolean;
	readonly randomVendorOui: string;
	readonly dbInfo: OuiDatabaseInfo | null;
	readonly onLoadSample: (value: string) => void;
	readonly onClear: () => void;
	readonly onPatch: (delta: Partial<MacLookupOptions>) => void;
	readonly onGenerateRandom: () => void;
}

function MacLookupRail({
	displayFormat,
	upperCase,
	randomLocalOnly,
	randomVendorOui,
	dbInfo,
	onLoadSample,
	onClear,
	onPatch,
	onGenerateRandom,
}: RailProps) {
	return (
		<>
			<FormSection title="Input">
				<FormInfo>
					Paste any MAC address in colon (<code className="font-mono">aa:bb:cc:dd:ee:ff</code>),
					dash, dot/Cisco (<code className="font-mono">aabb.ccdd.eeff</code>), or bare-hex form.
				</FormInfo>
				<div className="grid grid-cols-2 gap-1">
					<Button variant="outline" size="sm" onClick={() => onLoadSample(SAMPLE_MAC)}>
						Vendor sample
					</Button>
					<Button variant="outline" size="sm" onClick={() => onLoadSample(SAMPLE_LOCAL_MAC)}>
						Local sample
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="col-span-2"
						onClick={() => onLoadSample(SAMPLE_BROADCAST)}
					>
						Broadcast sample
					</Button>
				</div>
				<ActionButton label="Clear" variant="outline" onClick={onClear} />
			</FormSection>

			<FormSection title="Format preference">
				<FormMode<MacFormat>
					label="Notation"
					value={displayFormat}
					options={FORMAT_OPTIONS}
					layout="stacked"
					onValueChange={(v) => onPatch({ displayFormat: v })}
				/>
				<FormCheckbox
					label="Uppercase hex"
					checked={upperCase}
					onCheckedChange={(checked) => onPatch({ upperCase: checked })}
				/>
			</FormSection>

			<FormSection title="Random generator">
				<FormInfo>
					Produces a locally-administered MAC for testing. Provide a 6-hex-char OUI to inherit a
					vendor prefix instead.
				</FormInfo>
				<FormCheckbox
					label="Locally-administered (sets U/L bit)"
					checked={randomLocalOnly}
					onCheckedChange={(checked) => onPatch({ randomLocalOnly: checked })}
				/>
				<FormInput
					label="Vendor OUI (optional)"
					value={randomVendorOui}
					placeholder="e.g. 001B63"
					size="compact"
					onValueChange={(v) => onPatch({ randomVendorOui: v })}
				/>
				<Button variant="default" size="sm" className="w-full" onClick={onGenerateRandom}>
					<Dice5 className="mr-1.5 h-3.5 w-3.5" />
					Generate random
				</Button>
			</FormSection>

			{dbInfo ? (
				<FormSection title="Database">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Database className="h-3.5 w-3.5" />
						<span>
							{dbInfo.entries.toLocaleString()} entries — updated {dbInfo.updated}
						</span>
					</div>
				</FormSection>
			) : null}

			<ToolFooter
				relatedItems={[
					{ id: 'network-interfaces', reason: 'View local interface MAC addresses' },
					{ id: 'ip-converter', reason: 'Convert IPv4 ↔ IPv6 addresses' },
					{ id: 'cidr-calculator', reason: 'Calculate subnets from CIDR notation' },
				]}
				aboutText="Vendor lookup uses the bundled IEEE OUI database via a Tauri command. All processing happens locally; no network calls."
			/>
		</>
	);
}

/* -------------------------------------------------------------------------- */

interface MainProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly parseResult: ReturnType<typeof parseMac>;
	readonly vendor: VendorResult | null;
	readonly vendorLoading: boolean;
	readonly flags: MacFlags | null;
	readonly displayFormat: MacFormat;
	readonly upperCase: boolean;
	readonly dbInfo: OuiDatabaseInfo | null;
}

function MacLookupMain({
	input,
	onInputChange,
	parseResult,
	vendor,
	vendorLoading,
	flags,
	displayFormat,
	upperCase,
	dbInfo,
}: MainProps) {
	const trimmed = input.trim();
	const isEmpty = trimmed.length === 0;
	const showResults = parseResult.ok;

	return (
		<div className="flex h-full flex-col overflow-auto p-3">
			<div className="space-y-3">
				<InputCard
					input={input}
					onInputChange={onInputChange}
					hasError={!parseResult.ok && !isEmpty}
					error={!parseResult.ok && !isEmpty ? parseResult.error : null}
					displayFormat={displayFormat}
					upperCase={upperCase}
				/>
				{isEmpty ? (
					<EmptyCard />
				) : showResults && parseResult.ok && flags ? (
					<>
						<VendorCard vendor={vendor} loading={vendorLoading} dbInfo={dbInfo} />
						<FlagsCard flags={flags} />
						<NormalizedFormsCard
							mac={parseResult.mac}
							displayFormat={displayFormat}
							upperCase={upperCase}
						/>
					</>
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
					icon={Network}
					title="Enter a MAC address"
					description="Paste a MAC in any notation to identify its vendor (OUI), inspect its address-type bits, and see every canonical rendering."
				/>
			</CardContent>
		</Card>
	);
}

/* -------------------------------------------------------------------------- */

interface InputCardProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly hasError: boolean;
	readonly error: string | null;
	readonly displayFormat: MacFormat;
	readonly upperCase: boolean;
}

function InputCard({ input, onInputChange, hasError, error }: InputCardProps) {
	return (
		<Card density="compact">
			<CardHeader className="pb-2">
				<CardTitle>MAC Address</CardTitle>
			</CardHeader>
			<CardContent>
				<FormInput
					label="MAC address"
					value={input}
					onValueChange={onInputChange}
					placeholder="aa:bb:cc:dd:ee:ff"
				/>
				{hasError && error ? <FormError message={error} className="mt-2" /> : null}
			</CardContent>
		</Card>
	);
}

/* -------------------------------------------------------------------------- */

interface VendorCardProps {
	readonly vendor: VendorResult | null;
	readonly loading: boolean;
	readonly dbInfo: OuiDatabaseInfo | null;
}

function VendorCard({ vendor, loading, dbInfo }: VendorCardProps) {
	const knownVendor = vendor?.vendor ?? null;
	const matchedPrefix = vendor?.matchedPrefix ?? null;

	return (
		<Card density="compact">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="flex items-center gap-2">
						<Cable className="h-4 w-4 text-muted-foreground" />
						Vendor
					</CardTitle>
					{dbInfo ? (
						<span className="text-2xs text-muted-foreground">DB updated {dbInfo.updated}</span>
					) : null}
				</div>
			</CardHeader>
			<CardContent className="space-y-2">
				{loading ? (
					<p className="text-sm text-muted-foreground">Looking up vendor…</p>
				) : knownVendor ? (
					<>
						<div className="text-lg font-semibold">{knownVendor}</div>
						{matchedPrefix ? (
							<div className="flex items-center gap-2">
								<span className="text-xs text-muted-foreground">Matched OUI prefix:</span>
								<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
									{matchedPrefix}
								</code>
								<CopyButton
									text={matchedPrefix}
									toastLabel="OUI prefix"
									size="sm"
									variant="ghost"
									showLabel={false}
								/>
							</div>
						) : null}
					</>
				) : (
					<>
						<div className="text-sm font-medium text-muted-foreground">Unknown vendor</div>
						<p className="text-xs text-muted-foreground">
							The OUI prefix is not in the bundled database. The address may be locally
							administered, randomized, or assigned outside the curated subset.
						</p>
					</>
				)}
			</CardContent>
		</Card>
	);
}

/* -------------------------------------------------------------------------- */

interface FlagsCardProps {
	readonly flags: MacFlags;
}

function FlagsCard({ flags }: FlagsCardProps) {
	return (
		<Card density="compact">
			<CardHeader className="pb-2">
				<CardTitle>Address Flags</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-wrap gap-1.5">
					<ToneBadge tone={flags.local ? 'warning' : 'success'}>
						{flags.local ? 'Locally administered' : 'Universally administered'}
					</ToneBadge>
					<ToneBadge tone={flags.multicast ? 'info' : 'success'}>
						{flags.multicast ? 'Multicast' : 'Unicast'}
					</ToneBadge>
					{flags.broadcast ? <ToneBadge tone="destructive">Broadcast</ToneBadge> : null}
					{flags.nullAddress ? <ToneBadge tone="destructive">Null address</ToneBadge> : null}
				</div>
				<p className="mt-2 text-2xs text-muted-foreground">
					Address-type bits live in the least-significant two bits of byte 0: bit 0 (I/G) selects
					unicast vs multicast; bit 1 (U/L) selects universal vs local administration.
				</p>
			</CardContent>
		</Card>
	);
}

/* -------------------------------------------------------------------------- */

interface NormalizedFormsCardProps {
	readonly mac: ParsedMac;
	readonly displayFormat: MacFormat;
	readonly upperCase: boolean;
}

interface NormalizedRow {
	readonly key: string;
	readonly label: string;
	readonly value: string;
	readonly hint?: string;
}

function NormalizedFormsCard({ mac, displayFormat, upperCase }: NormalizedFormsCardProps) {
	const rows: readonly NormalizedRow[] = useMemo(() => {
		const colon = formatMac(mac, 'colon', upperCase);
		const dash = formatMac(mac, 'dash', upperCase);
		const dot = formatMac(mac, 'dot', upperCase);
		const bare = formatMac(mac, 'bare', upperCase);
		const eui64 = toEui64(mac, upperCase);
		const ipv6 = toIpv6LinkLocal(mac);
		return [
			{ key: 'colon', label: 'Colon', value: colon },
			{ key: 'dash', label: 'Dash', value: dash },
			{ key: 'dot', label: 'Dot (Cisco)', value: dot },
			{ key: 'bare', label: 'Bare hex', value: bare },
			{
				key: 'eui64',
				label: 'Modified EUI-64',
				value: eui64,
				hint: 'Inserts FF:FE and flips the U/L bit (RFC 4291 §2.5.1).',
			},
			{
				key: 'ipv6',
				label: 'IPv6 link-local',
				value: ipv6,
				hint: 'fe80::/10 prefix + EUI-64 interface identifier.',
			},
		];
	}, [mac, upperCase]);

	return (
		<Card density="compact">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between gap-2">
					<CardTitle>Normalized Forms</CardTitle>
					<span className="text-2xs text-muted-foreground">
						Preferred: {FORMAT_OPTIONS.find((o) => o.value === displayFormat)?.label}
						{upperCase ? ' · UPPER' : ''}
					</span>
				</div>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 gap-2">
					{rows.map((row) => (
						<div
							key={row.key}
							className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5"
						>
							<div className="min-w-0">
								<div className="text-2xs uppercase tracking-wide text-muted-foreground">
									{row.label}
								</div>
								<div className="font-mono text-sm break-all tabular-nums">{row.value}</div>
								{row.hint ? (
									<p className="mt-0.5 text-2xs text-muted-foreground">{row.hint}</p>
								) : null}
							</div>
							<CopyButton
								text={row.value}
								toastLabel={row.label}
								size="sm"
								variant="ghost"
								showLabel={false}
							/>
						</div>
					))}
				</div>
				<p className="mt-3 text-2xs text-muted-foreground">
					Matched prefix used for vendor lookup: {formatPrefix(mac.bytes)}
				</p>
			</CardContent>
		</Card>
	);
}
