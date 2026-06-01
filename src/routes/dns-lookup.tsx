import { createFileRoute } from '@tanstack/react-router';
import { AlertCircle, Globe, Search, ShieldCheck, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ActionButton, CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormInput,
	FormSection,
	FormSelect,
	FormSlider,
} from '@/lib/components/form';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { ToneBadge } from '@/lib/components/ui/tone-badge';
import { useDocumentTitle } from '@/lib/hooks';
import {
	type DnsLookupRequest,
	type DnsLookupResult,
	type DnsTypeResult,
	exportAsDig,
	isIpLiteral,
	RECORD_TYPES,
	type RecordType,
	resolverIpFor,
	RESOLVER_PRESETS,
	type ResolverPreset,
	runDnsLookup,
	SAMPLE_DOMAIN,
	SAMPLE_REVERSE_IP,
	toReverseDnsName,
} from '@/lib/services/dns';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';

interface DnsLookupOptions {
	readonly recordTypes: readonly RecordType[];
	readonly resolver: ResolverPreset;
	readonly customResolver: string;
	readonly timeoutMs: number;
}

const DEFAULT_TYPES: readonly RecordType[] = ['A', 'AAAA'];
const PTR_ONLY: readonly RecordType[] = ['PTR'];

const DEFAULTS: DnsLookupOptions = {
	recordTypes: DEFAULT_TYPES,
	resolver: 'system',
	customResolver: '',
	timeoutMs: 3000,
};

const useDnsLookupOptions = createToolOptionsStore<DnsLookupOptions>('dns-lookup', DEFAULTS);

const RESOLVER_SELECT_OPTIONS = RESOLVER_PRESETS.map((preset) => ({
	value: preset.id,
	label: preset.label,
	description: preset.description,
}));

export const Route = createFileRoute('/dns-lookup')({
	component: DnsLookupPage,
});

function DnsLookupPage() {
	useDocumentTitle('DNS Lookup');

	const { value: options, patch, reset } = useDnsLookupOptions();
	const { recordTypes, resolver, customResolver, timeoutMs } = options;

	const [name, setName] = useState<string>(SAMPLE_DOMAIN);
	const [result, setResult] = useState<DnsLookupResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const [showRail, setShowRail] = usePersistedRail('dns-lookup');

	const trimmedName = name.trim();
	const reverseLookup = trimmedName.length > 0 && isIpLiteral(trimmedName);

	// Effective request derives the resolver spec (preset id or literal IP)
	// and forces PTR when the input is an IP literal so the user gets a
	// reverse lookup without having to manually toggle chips.
	const effectiveRequest = useMemo<DnsLookupRequest>(() => {
		const resolverSpec = resolver === 'custom' ? customResolver.trim() : resolver;
		const effectiveTypes = reverseLookup ? PTR_ONLY : recordTypes;
		const effectiveName = reverseLookup ? toReverseDnsName(trimmedName) : trimmedName;
		return {
			name: effectiveName,
			recordTypes: effectiveTypes,
			resolver: resolverSpec,
			timeoutMs,
		};
	}, [resolver, customResolver, recordTypes, reverseLookup, trimmedName, timeoutMs]);

	const totalRecords = useMemo(
		() => result?.results.reduce((sum, type) => sum + type.records.length, 0) ?? 0,
		[result]
	);

	const errorCount = useMemo(
		() => result?.results.filter((type) => type.error !== null).length ?? 0,
		[result]
	);

	const handleLookup = async () => {
		if (trimmedName.length === 0) {
			setError('Enter a domain or IP to look up.');
			return;
		}
		if (effectiveRequest.recordTypes.length === 0) {
			setError('Select at least one record type.');
			return;
		}
		if (resolver === 'custom' && customResolver.trim().length === 0) {
			setError('Enter a custom resolver IP, or pick a preset.');
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const next = await runDnsLookup(effectiveRequest);
			setResult(next);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
			setResult(null);
		} finally {
			setLoading(false);
		}
	};

	const handleToggleType = (type: RecordType, checked: boolean) => {
		const next = checked
			? [...recordTypes, type].filter((t, idx, arr) => arr.indexOf(t) === idx)
			: recordTypes.filter((t) => t !== type);
		// Preserve canonical order to keep result cards stable across toggles.
		const ordered = RECORD_TYPES.filter((t) => next.includes(t));
		patch({ recordTypes: ordered });
	};

	const handleCopyDig = async () => {
		try {
			await navigator.clipboard.writeText(exportAsDig(effectiveRequest));
			toast.success('dig command copied to clipboard');
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	const handleLoadSampleDomain = () => {
		setName(SAMPLE_DOMAIN);
		setResult(null);
		setError(null);
	};

	const handleLoadReverseSample = () => {
		setName(SAMPLE_REVERSE_IP);
		setResult(null);
		setError(null);
	};

	const validity: boolean | null =
		trimmedName.length === 0 ? null : result === null ? null : errorCount === 0;

	return (
		<ToolShell
			valid={validity}
			error={error ?? undefined}
			showRail={showRail}
			onShowRailChange={setShowRail}
			statusContent={
				<DnsLookupStatus result={result} totalRecords={totalRecords} errorCount={errorCount} />
			}
			rail={
				<DnsLookupRail
					recordTypes={recordTypes}
					resolver={resolver}
					customResolver={customResolver}
					timeoutMs={timeoutMs}
					reverseLookup={reverseLookup}
					onToggleType={handleToggleType}
					onResolverChange={(v) => patch({ resolver: v })}
					onCustomResolverChange={(v) => patch({ customResolver: v })}
					onTimeoutChange={(v) => patch({ timeoutMs: v })}
					onLoadSampleDomain={handleLoadSampleDomain}
					onLoadReverseSample={handleLoadReverseSample}
					onCopyDig={handleCopyDig}
					onResetOptions={reset}
				/>
			}
		>
			<DnsLookupMain
				name={name}
				onNameChange={setName}
				reverseLookup={reverseLookup}
				effectiveRequest={effectiveRequest}
				loading={loading}
				error={error}
				result={result}
				onLookup={handleLookup}
			/>
		</ToolShell>
	);
}

/* -------------------------------------------------------------------------- */

interface StatusProps {
	readonly result: DnsLookupResult | null;
	readonly totalRecords: number;
	readonly errorCount: number;
}

function DnsLookupStatus({ result, totalRecords, errorCount }: StatusProps) {
	if (result === null) return null;
	return (
		<>
			<StatItem label="Records" value={totalRecords} />
			<StatItem label="Errors" value={errorCount} />
			<StatItem label="Elapsed" value={`${result.elapsedMs} ms`} />
		</>
	);
}

/* -------------------------------------------------------------------------- */

interface RailProps {
	readonly recordTypes: readonly RecordType[];
	readonly resolver: ResolverPreset;
	readonly customResolver: string;
	readonly timeoutMs: number;
	readonly reverseLookup: boolean;
	readonly onToggleType: (type: RecordType, checked: boolean) => void;
	readonly onResolverChange: (value: ResolverPreset) => void;
	readonly onCustomResolverChange: (value: string) => void;
	readonly onTimeoutChange: (value: number) => void;
	readonly onLoadSampleDomain: () => void;
	readonly onLoadReverseSample: () => void;
	readonly onCopyDig: () => void;
	readonly onResetOptions: () => void;
}

function DnsLookupRail({
	recordTypes,
	resolver,
	customResolver,
	timeoutMs,
	reverseLookup,
	onToggleType,
	onResolverChange,
	onCustomResolverChange,
	onTimeoutChange,
	onLoadSampleDomain,
	onLoadReverseSample,
	onCopyDig,
	onResetOptions,
}: RailProps) {
	return (
		<>
			<FormSection title="Resolver">
				<FormSelect
					label="Upstream"
					value={resolver}
					options={RESOLVER_SELECT_OPTIONS}
					onValueChange={(v) => onResolverChange(v as ResolverPreset)}
				/>
				{resolver === 'custom' ? (
					<FormInput
						label="Custom resolver IP"
						value={customResolver}
						onValueChange={onCustomResolverChange}
						placeholder="e.g. 1.0.0.1 or 2606:4700:4700::1111"
						size="compact"
					/>
				) : null}
			</FormSection>

			<FormSection title="Record types">
				{reverseLookup ? (
					<FormInfo>
						Reverse lookup detected — querying <code className="font-mono">PTR</code> only. Other
						record-type toggles are ignored until the input is no longer an IP literal.
					</FormInfo>
				) : null}
				<FormCheckboxGroup>
					{RECORD_TYPES.map((type) => (
						<FormCheckbox
							key={type}
							label={type}
							size="compact"
							checked={recordTypes.includes(type)}
							disabled={reverseLookup}
							onCheckedChange={(checked) => onToggleType(type, checked)}
						/>
					))}
				</FormCheckboxGroup>
			</FormSection>

			<FormSection title="Options">
				<FormSlider
					label="Timeout"
					min={500}
					max={15000}
					step={500}
					value={timeoutMs}
					valueLabel={`${timeoutMs} ms`}
					onValueChange={onTimeoutChange}
				/>
				<ActionButton label="Reset options" variant="outline" onClick={onResetOptions} />
			</FormSection>

			<FormSection title="Samples">
				<div className="grid grid-cols-1 gap-1">
					<Button variant="outline" size="sm" onClick={onLoadSampleDomain}>
						Load sample ({SAMPLE_DOMAIN})
					</Button>
					<Button variant="outline" size="sm" onClick={onLoadReverseSample}>
						Load reverse sample ({SAMPLE_REVERSE_IP})
					</Button>
				</div>
			</FormSection>

			<FormSection title="Export">
				<Button variant="outline" size="sm" className="w-full" onClick={onCopyDig}>
					<Terminal className="mr-1.5 h-3.5 w-3.5" />
					Copy as dig
				</Button>
			</FormSection>

			<ToolFooter
				relatedItems={[
					{ id: 'tls-inspector', reason: 'Inspect TLS of a resolved host' },
					{ id: 'rest-client', reason: 'Send HTTP request to a resolved host' },
					{ id: 'cidr-calculator', reason: 'Analyse a resolved IP address' },
				]}
				aboutText={
					<>
						Standard DNS over UDP / TCP. DNS-over-HTTPS, multi-resolver compare, and DNSSEC
						validation are deferred to a follow-up. The AD badge mirrors the upstream{' '}
						<code className="font-mono">ad</code> header bit — meaningful only when the upstream
						itself validates.
					</>
				}
			/>
		</>
	);
}

/* -------------------------------------------------------------------------- */

interface MainProps {
	readonly name: string;
	readonly onNameChange: (value: string) => void;
	readonly reverseLookup: boolean;
	readonly effectiveRequest: DnsLookupRequest;
	readonly loading: boolean;
	readonly error: string | null;
	readonly result: DnsLookupResult | null;
	readonly onLookup: () => void;
}

function DnsLookupMain({
	name,
	onNameChange,
	reverseLookup,
	effectiveRequest,
	loading,
	error,
	result,
	onLookup,
}: MainProps) {
	return (
		<div className="flex h-full flex-col overflow-auto p-3">
			<div className="space-y-3">
				<Card density="compact">
					<CardHeader className="pb-2">
						<CardTitle>Query</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						<div className="flex items-end gap-2">
							<div className="flex-1">
								<FormInput
									label="Domain or IP"
									value={name}
									onValueChange={onNameChange}
									placeholder="example.com or 8.8.8.8"
								/>
							</div>
							<Button onClick={onLookup} disabled={loading || name.trim().length === 0}>
								<Search className="mr-1.5 h-3.5 w-3.5" />
								{loading ? 'Looking up...' : 'Lookup'}
							</Button>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
							<span>
								Resolver:{' '}
								<code className="font-mono">{resolverIpFor(effectiveRequest.resolver)}</code>
							</span>
							<span>·</span>
							<span>
								Types: <code className="font-mono">{effectiveRequest.recordTypes.join(', ')}</code>
							</span>
							{reverseLookup ? (
								<>
									<span>·</span>
									<ToneBadge tone="info">Reverse (PTR)</ToneBadge>
								</>
							) : null}
						</div>
						{error ? (
							<div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
								<AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
								<span>{error}</span>
							</div>
						) : null}
					</CardContent>
				</Card>

				{result === null ? (
					<Card density="compact">
						<CardContent>
							<EmbeddedEmptyState
								icon={Globe}
								title="No lookup yet"
								description="Enter a domain or IP, pick the resolver and record types from the rail, then run the query."
							/>
						</CardContent>
					</Card>
				) : (
					result.results.map((typeResult) => (
						<TypeResultCard key={typeResult.recordType} typeResult={typeResult} />
					))
				)}
			</div>
		</div>
	);
}

/* -------------------------------------------------------------------------- */

interface TypeResultCardProps {
	readonly typeResult: DnsTypeResult;
}

function TypeResultCard({ typeResult }: TypeResultCardProps) {
	const { recordType, records, error, authenticData } = typeResult;
	const hasError = error !== null;
	const showAd = authenticData === true;

	return (
		<Card density="compact">
			<CardHeader className="pb-2">
				<div className="flex flex-wrap items-center gap-2">
					<CardTitle className="font-mono">{recordType}</CardTitle>
					<ToneBadge tone={records.length > 0 ? 'success' : 'info'}>
						{records.length} {records.length === 1 ? 'record' : 'records'}
					</ToneBadge>
					{hasError ? <ToneBadge tone="destructive">Error</ToneBadge> : null}
					{showAd ? (
						<ToneBadge tone="success">
							<ShieldCheck className="mr-1 h-3 w-3" />
							AD
						</ToneBadge>
					) : null}
				</div>
			</CardHeader>
			<CardContent className="space-y-2">
				{hasError ? (
					<div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
						<AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
						<span className="break-all">{error}</span>
					</div>
				) : records.length === 0 ? (
					<p className="text-xs text-muted-foreground">
						No records returned for this type (NOERROR / NXDOMAIN).
					</p>
				) : (
					<div className="grid grid-cols-1 gap-1.5">
						{records.map((record) => (
							<div
								// Two records of the same type with identical rdata would
								// be a server misconfiguration; the value is enough to key on.
								key={`${record.recordType}-${record.value}`}
								className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5"
							>
								<div className="min-w-0 flex-1 font-mono text-sm break-all">{record.value}</div>
								<div className="flex shrink-0 items-center gap-2">
									<ToneBadge tone="info">TTL {record.ttl}s</ToneBadge>
									<CopyButton
										text={record.value}
										toastLabel={`${record.recordType} record`}
										size="sm"
										variant="ghost"
										showLabel={false}
									/>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
