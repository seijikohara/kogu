import { createFileRoute } from '@tanstack/react-router';
import { Combine, Globe2, Network } from 'lucide-react';
import { type CSSProperties, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ActionButton, CopyButton } from '@/lib/components/action';
import { FormInfo, FormInput, FormMode, FormSection } from '@/lib/components/form';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/lib/components/ui/accordion';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { ToneBadge } from '@/lib/components/ui/tone-badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/lib/components/ui/tooltip';
import { useDocumentTitle } from '@/lib/hooks';
import {
	bitMap,
	type CidrDetails,
	type ExportFormat,
	exportDetails,
	type IpFamily,
	type ParsedCidr,
	parseCidr,
	type ReservedRange,
	SAMPLE_V4,
	SAMPLE_V6,
	splitIntoSubnets,
	tryAggregate,
} from '@/lib/services/cidr';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import { cn } from '@/lib/utils';

type FamilyOption = 'auto' | IpFamily;

interface CidrOptions {
	readonly familyOverride: FamilyOption;
	readonly exportFormat: ExportFormat;
}

const DEFAULTS: CidrOptions = {
	familyOverride: 'auto',
	exportFormat: 'json',
};

const useCidrOptions = createToolOptionsStore<CidrOptions>('cidr-calculator', DEFAULTS);

const FAMILY_OPTIONS: readonly { readonly value: FamilyOption; readonly label: string }[] = [
	{ value: 'auto', label: 'Auto' },
	{ value: 'ipv4', label: 'IPv4' },
	{ value: 'ipv6', label: 'IPv6' },
];

const EXPORT_OPTIONS: readonly { readonly value: ExportFormat; readonly label: string }[] = [
	{ value: 'json', label: 'JSON' },
	{ value: 'csv', label: 'CSV' },
	{ value: 'shell', label: 'Shell' },
];

const RESERVED_TONE: Record<ReservedRange, 'success' | 'warning' | 'info' | 'destructive'> = {
	'rfc1918-private': 'info',
	'rfc6598-cgnat': 'info',
	loopback: 'success',
	'link-local': 'warning',
	multicast: 'warning',
	broadcast: 'warning',
	documentation: 'info',
	unspecified: 'destructive',
	reserved: 'destructive',
	ula: 'info',
	'ipv4-mapped': 'info',
};

const RESERVED_SHORT_LABEL: Record<ReservedRange, string> = {
	'rfc1918-private': 'RFC 1918 Private',
	'rfc6598-cgnat': 'RFC 6598 CGNAT',
	loopback: 'Loopback',
	'link-local': 'Link-local',
	multicast: 'Multicast',
	broadcast: 'Broadcast',
	documentation: 'Documentation',
	unspecified: 'Unspecified',
	reserved: 'Reserved',
	ula: 'Unique Local',
	'ipv4-mapped': 'IPv4-mapped',
};

export const Route = createFileRoute('/cidr-calculator')({
	component: CidrCalculatorPage,
});

function CidrCalculatorPage() {
	useDocumentTitle('CIDR Calculator');

	const { value: options, patch } = useCidrOptions();
	const { familyOverride, exportFormat } = options;

	const [input, setInput] = useState<string>(SAMPLE_V4);
	const [childPrefixText, setChildPrefixText] = useState<string>('27');
	const [aggregateInput, setAggregateInput] = useState<string>('');
	const [showRail, setShowRail] = usePersistedRail('cidr-calculator');

	const result = useMemo(
		() => parseCidr(input, familyOverride === 'auto' ? undefined : familyOverride),
		[input, familyOverride]
	);

	const aggregateResult = useMemo(() => {
		if (!result.ok) return null;
		if (aggregateInput.trim().length === 0) return null;
		const other = parseCidr(aggregateInput, familyOverride === 'auto' ? undefined : familyOverride);
		if (!other.ok) return { error: other.error };
		const agg = tryAggregate(result.parsed, other.parsed);
		if (!agg)
			return {
				error:
					'The two CIDRs cannot be aggregated. They must share family, prefix length, and be adjacent.',
			};
		return { cidr: agg.cidr };
	}, [result, aggregateInput, familyOverride]);

	const childPrefix = useMemo(() => {
		const trimmed = childPrefixText.trim();
		if (!/^\d+$/.test(trimmed)) return null;
		return Number(trimmed);
	}, [childPrefixText]);

	const subnetSplit = useMemo(() => {
		if (!result.ok) return null;
		if (childPrefix === null) return null;
		return splitIntoSubnets(result.parsed, childPrefix);
	}, [result, childPrefix]);

	const handleCopyExport = async () => {
		if (!result.ok) return;
		const text = exportDetails(result.details, exportFormat);
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${exportFormat.toUpperCase()} details copied to clipboard`);
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	const handleLoadSampleV4 = () => setInput(SAMPLE_V4);
	const handleLoadSampleV6 = () => setInput(SAMPLE_V6);
	const handleClear = () => setInput('');

	const validity: boolean | null = input.trim().length === 0 ? null : result.ok;

	return (
		<ToolShell
			valid={validity}
			error={!result.ok && input.trim().length > 0 ? result.error : undefined}
			showRail={showRail}
			onShowRailChange={setShowRail}
			statusContent={
				result.ok ? (
					<>
						<StatItem label="Family" value={result.details.family === 'ipv4' ? 'IPv4' : 'IPv6'} />
						<StatItem label="Prefix" value={`/${result.details.prefix}`} />
						<StatItem label="Total" value={result.details.totalAddresses.toString()} />
						<StatItem label="Reserved" value={result.reserved.length} />
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Input">
						<FormInfo>
							Accepts IPv4 (e.g. <code className="font-mono">192.168.1.0/24</code>) and IPv6 (e.g.{' '}
							<code className="font-mono">2001:db8::/48</code>). Family is auto-detected.
						</FormInfo>
						<div className="grid grid-cols-2 gap-1">
							<Button variant="outline" size="sm" onClick={handleLoadSampleV4}>
								Load IPv4 sample
							</Button>
							<Button variant="outline" size="sm" onClick={handleLoadSampleV6}>
								Load IPv6 sample
							</Button>
						</div>
						<ActionButton label="Clear" variant="outline" onClick={handleClear} />
					</FormSection>

					<FormSection title="Family">
						<FormMode<FamilyOption>
							label="Override"
							value={familyOverride}
							options={FAMILY_OPTIONS}
							onValueChange={(v) => patch({ familyOverride: v })}
						/>
					</FormSection>

					<FormSection title="Export">
						<FormMode<ExportFormat>
							label="Format"
							value={exportFormat}
							options={EXPORT_OPTIONS}
							onValueChange={(v) => patch({ exportFormat: v })}
						/>
					</FormSection>

					<ToolFooter
						relatedItems={[
							{ id: 'ip-converter', reason: 'Convert IPv4 ↔ IPv6' },
							{ id: 'dns-lookup', reason: 'Resolve a name to an IP' },
						]}
						aboutText={
							<ul className="list-inside list-disc space-y-0.5">
								<li>All calculations happen in-browser.</li>
								<li>Supports IPv4 (/0–/32) and IPv6 (/0–/128).</li>
								<li>Math runs on bigint; no precision loss.</li>
								<li>Detects RFC 1918 / 6598, loopback, ULA, and more.</li>
							</ul>
						}
					/>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-auto p-3">
				<div className="space-y-3">
					<Card density="compact">
						<CardHeader className="pb-2">
							<CardTitle>CIDR Notation</CardTitle>
						</CardHeader>
						<CardContent>
							<FormInput
								label="Address / prefix"
								value={input}
								onValueChange={setInput}
								placeholder="e.g. 192.168.1.0/24 or 2001:db8::/48"
								size="default"
							/>
							{!result.ok && input.trim().length > 0 ? (
								<p className="mt-2 text-xs text-destructive">{result.error}</p>
							) : null}
							{result.ok && result.reserved.length > 0 ? (
								<div className="mt-3 flex flex-wrap gap-1.5">
									{result.reserved.map((r) => (
										<Tooltip key={`${r.label}-${r.description}`}>
											<TooltipTrigger asChild>
												<span>
													<ToneBadge tone={RESERVED_TONE[r.label]}>
														{RESERVED_SHORT_LABEL[r.label]}
													</ToneBadge>
												</span>
											</TooltipTrigger>
											<TooltipContent>{r.description}</TooltipContent>
										</Tooltip>
									))}
								</div>
							) : null}
						</CardContent>
					</Card>

					{!result.ok || input.trim().length === 0 ? (
						<Card density="compact">
							<CardContent>
								<EmbeddedEmptyState
									icon={Network}
									title="Enter a CIDR notation"
									description="Type an IPv4 or IPv6 address with prefix length to see derived values, bit-level visualization, and reserved-range detection."
								/>
							</CardContent>
						</Card>
					) : (
						<>
							<DetailsGrid details={result.details} />
							<BitGridCard parsed={result.parsed} />
							<ExportCard
								details={result.details}
								format={exportFormat}
								onCopy={handleCopyExport}
							/>
							<SubnettingPanel
								parsed={result.parsed}
								childPrefixText={childPrefixText}
								onChildPrefixChange={setChildPrefixText}
								splitResult={subnetSplit}
								aggregateInput={aggregateInput}
								onAggregateInputChange={setAggregateInput}
								aggregateResult={aggregateResult}
							/>
						</>
					)}
				</div>
			</div>
		</ToolShell>
	);
}

/* -------------------------------------------------------------------------- */

interface DetailsGridProps {
	readonly details: CidrDetails;
}

interface DetailItem {
	readonly key: string;
	readonly label: string;
	readonly value: string;
}

function DetailsGrid({ details }: DetailsGridProps) {
	const items: readonly DetailItem[] = useMemo(() => {
		const base: DetailItem[] = [
			{ key: 'cidr', label: 'CIDR', value: details.cidrText },
			{ key: 'network', label: 'Network', value: details.networkText },
		];
		if (details.broadcastText) {
			base.push({ key: 'broadcast', label: 'Broadcast', value: details.broadcastText });
		}
		base.push(
			{ key: 'first', label: 'First Host', value: details.firstHostText },
			{ key: 'last', label: 'Last Host', value: details.lastHostText },
			{ key: 'total', label: 'Total Addresses', value: details.totalAddresses.toString() },
			{ key: 'usable', label: 'Usable Hosts', value: details.usableHosts.toString() },
			{ key: 'prefix', label: 'Prefix Length', value: `/${details.prefix}` },
			{ key: 'mask', label: 'Mask', value: details.maskText },
			{ key: 'wildcard', label: 'Wildcard', value: details.wildcardText },
			{ key: 'hex', label: 'Hex Mask', value: details.maskHex }
		);
		return base;
	}, [details]);

	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
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
					</CardContent>
				</Card>
			))}
		</div>
	);
}

/* -------------------------------------------------------------------------- */

interface BitGridCardProps {
	readonly parsed: ParsedCidr;
}

function BitGridCard({ parsed }: BitGridCardProps) {
	const bits = useMemo(() => bitMap(parsed), [parsed]);
	const groupSize = parsed.family === 'ipv4' ? 8 : 16;
	const groupCount = parsed.maxPrefix / groupSize;
	const groupLabel = parsed.family === 'ipv4' ? 'octet' : 'hextet';

	return (
		<Card density="compact">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between gap-2">
					<CardTitle>Bit Layout</CardTitle>
					<div className="flex items-center gap-2 text-2xs text-muted-foreground">
						<span className="inline-flex items-center gap-1">
							<span className="inline-block size-2.5 rounded-sm bg-info/60" />
							network ({parsed.prefix})
						</span>
						<span className="inline-flex items-center gap-1">
							<span className="inline-block size-2.5 rounded-sm bg-muted-foreground/20" />
							host ({parsed.maxPrefix - parsed.prefix})
						</span>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="overflow-x-auto">
					<div
						className="grid gap-y-1"
						style={
							{
								gridTemplateColumns: `repeat(${parsed.maxPrefix}, minmax(0.5rem, 1fr))`,
							} as CSSProperties
						}
					>
						{bits.map((isNetwork, idx) => {
							const isGroupStart = idx % groupSize === 0 && idx > 0;
							const bitKey = `${parsed.family}-bit-${idx}`;
							return (
								<Tooltip key={bitKey}>
									<TooltipTrigger asChild>
										<span
											className={cn(
												'flex h-5 items-center justify-center rounded-sm border font-mono text-2xs leading-none transition-colors',
												isNetwork
													? 'border-info/40 bg-info/30 text-info-foreground'
													: 'border-border bg-muted text-muted-foreground/60',
												isGroupStart && 'ml-1'
											)}
										>
											{isNetwork ? '1' : '0'}
										</span>
									</TooltipTrigger>
									<TooltipContent>
										<span className="font-mono text-2xs">
											bit {idx + 1} of {parsed.maxPrefix} · {isNetwork ? 'network' : 'host'}
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

/* -------------------------------------------------------------------------- */

interface ExportCardProps {
	readonly details: CidrDetails;
	readonly format: ExportFormat;
	readonly onCopy: () => void;
}

function ExportCard({ details, format, onCopy }: ExportCardProps) {
	const text = useMemo(() => exportDetails(details, format), [details, format]);

	return (
		<Card density="compact">
			<CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
				<CardTitle>Export ({format.toUpperCase()})</CardTitle>
				<Button variant="outline" size="sm" onClick={onCopy}>
					Copy as {format.toUpperCase()}
				</Button>
			</CardHeader>
			<CardContent>
				<pre className="overflow-x-auto rounded-md border bg-muted/30 p-2 font-mono text-2xs leading-relaxed">
					{text}
				</pre>
			</CardContent>
		</Card>
	);
}

/* -------------------------------------------------------------------------- */

interface SubnettingPanelProps {
	readonly parsed: ParsedCidr;
	readonly childPrefixText: string;
	readonly onChildPrefixChange: (value: string) => void;
	readonly splitResult: ReturnType<typeof splitIntoSubnets> | null;
	readonly aggregateInput: string;
	readonly onAggregateInputChange: (value: string) => void;
	readonly aggregateResult: { readonly cidr?: string; readonly error?: string } | null;
}

const SUBNET_TABLE_LIMIT = 64;

function SubnettingPanel({
	parsed,
	childPrefixText,
	onChildPrefixChange,
	splitResult,
	aggregateInput,
	onAggregateInputChange,
	aggregateResult,
}: SubnettingPanelProps) {
	const splitError =
		splitResult && !Array.isArray(splitResult) ? (splitResult as { error: string }).error : null;
	const splitRows = splitResult && Array.isArray(splitResult) ? splitResult : null;
	const truncated = splitRows ? splitRows.length > SUBNET_TABLE_LIMIT : false;
	const visibleRows = splitRows ? splitRows.slice(0, SUBNET_TABLE_LIMIT) : null;

	return (
		<Card density="compact">
			<Accordion type="multiple" defaultValue={['split']}>
				<AccordionItem value="split">
					<CardHeader className="pb-0">
						<AccordionTrigger className="py-0">
							<CardTitle className="flex items-center gap-2">
								<Globe2 className="h-4 w-4 text-muted-foreground" />
								Split into smaller subnets
							</CardTitle>
						</AccordionTrigger>
					</CardHeader>
					<AccordionContent>
						<CardContent className="space-y-2">
							<div className="flex items-end gap-2">
								<div className="flex-1">
									<FormInput
										label={`Child prefix (greater than /${parsed.prefix}, max /${parsed.maxPrefix})`}
										value={childPrefixText}
										onValueChange={onChildPrefixChange}
										placeholder={`e.g. /${Math.min(parsed.prefix + 4, parsed.maxPrefix)}`}
										size="compact"
									/>
								</div>
							</div>
							{splitError ? (
								<p className="text-xs text-destructive">{splitError}</p>
							) : visibleRows && visibleRows.length > 0 ? (
								<div className="overflow-x-auto">
									<table className="w-full min-w-max border-collapse text-xs">
										<thead>
											<tr className="border-b border-border/60 text-left text-2xs uppercase tracking-wide text-muted-foreground">
												<th className="py-1.5 pr-3 font-semibold">CIDR</th>
												<th className="py-1.5 pr-3 font-semibold">First</th>
												<th className="py-1.5 pr-3 font-semibold">Last</th>
												<th className="py-1.5 pr-3 font-semibold text-right">Addresses</th>
												<th className="py-1.5 pr-1" />
											</tr>
										</thead>
										<tbody>
											{visibleRows.map((row) => (
												<tr key={row.cidr} className="border-b border-border/30 last:border-b-0">
													<td className="py-1.5 pr-3 font-mono">{row.cidr}</td>
													<td className="py-1.5 pr-3 font-mono text-muted-foreground">
														{row.first}
													</td>
													<td className="py-1.5 pr-3 font-mono text-muted-foreground">
														{row.last}
													</td>
													<td className="py-1.5 pr-3 text-right font-mono tabular-nums">
														{row.count.toString()}
													</td>
													<td className="py-1.5 pr-1 text-right">
														<CopyButton
															text={row.cidr}
															toastLabel="CIDR"
															size="sm"
															variant="ghost"
															showLabel={false}
														/>
													</td>
												</tr>
											))}
										</tbody>
									</table>
									{truncated ? (
										<p className="mt-2 text-2xs text-muted-foreground">
											Showing the first {SUBNET_TABLE_LIMIT} of {splitRows?.length} subnets.
										</p>
									) : null}
								</div>
							) : (
								<p className="text-2xs text-muted-foreground">
									Enter a child prefix greater than /{parsed.prefix} to compute child subnets.
								</p>
							)}
						</CardContent>
					</AccordionContent>
				</AccordionItem>

				<AccordionItem value="aggregate">
					<CardHeader className="pb-0">
						<AccordionTrigger className="py-0">
							<CardTitle className="flex items-center gap-2">
								<Combine className="h-4 w-4 text-muted-foreground" />
								Aggregate with adjacent CIDR
							</CardTitle>
						</AccordionTrigger>
					</CardHeader>
					<AccordionContent>
						<CardContent className="space-y-2">
							<FormInput
								label="Second CIDR (same family and prefix, adjacent)"
								value={aggregateInput}
								onValueChange={onAggregateInputChange}
								placeholder={
									parsed.family === 'ipv4' ? 'e.g. 10.0.0.128/25' : 'e.g. 2001:db8:1::/48'
								}
								size="compact"
							/>
							{aggregateResult?.error ? (
								<p className="text-xs text-destructive">{aggregateResult.error}</p>
							) : aggregateResult?.cidr ? (
								<div className="flex items-center justify-between gap-2 rounded-md border bg-success/5 px-2.5 py-1.5">
									<div className="font-mono text-sm">{aggregateResult.cidr}</div>
									<CopyButton
										text={aggregateResult.cidr}
										toastLabel="Supernet"
										size="sm"
										variant="ghost"
										showLabel={false}
									/>
								</div>
							) : (
								<p className="text-2xs text-muted-foreground">
									Provide a second CIDR with the same prefix length to compute the enclosing
									supernet.
								</p>
							)}
						</CardContent>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</Card>
	);
}
