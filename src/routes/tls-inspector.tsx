import { createFileRoute } from '@tanstack/react-router';
import {
	FlaskConical,
	KeyRound,
	Layers,
	Loader2,
	Lock,
	ShieldAlert,
	ShieldCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { CopyButton } from '@/lib/components/action';
import { FormError, FormInfo, FormInput, FormSection, FormSlider } from '@/lib/components/form';
import { SectionLabel } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { useDocumentTitle } from '@/lib/hooks';
import {
	buildPemBundle,
	buildPemFromBase64,
	decodeChain,
	EXPIRED_SAMPLE_HOST,
	inspectTls,
	PORT_PRESETS,
	SAMPLE_HOST,
	SAMPLE_PORT,
	SELF_SIGNED_SAMPLE_HOST,
	TIMEOUT_DEFAULT_MS,
	TIMEOUT_MAX_MS,
	TIMEOUT_MIN_MS,
	TIMEOUT_STEP_MS,
	type TlsInspectResult,
} from '@/lib/services/tls';
import {
	daysUntilExpiry,
	getSubjectLabel,
	isExpired,
	isNotYetValid,
	type ParsedCertificate,
	type SanEntry,
	type SanType,
} from '@/lib/services/x509';
import { createToolOptionsStore } from '@/lib/stores';
import { cn, getErrorMessage } from '@/lib/utils';

interface TlsInspectorOptions {
	readonly host: string;
	readonly port: number;
	readonly sni: string;
	readonly timeoutMs: number;
}

const DEFAULT_OPTIONS: TlsInspectorOptions = {
	host: '',
	port: SAMPLE_PORT,
	sni: '',
	timeoutMs: TIMEOUT_DEFAULT_MS,
};

const useTlsInspectorOptions = createToolOptionsStore<TlsInspectorOptions>(
	'tls-inspector',
	DEFAULT_OPTIONS
);

const SAN_TYPE_TONE: Readonly<
	Record<SanType, { readonly label: string; readonly className: string }>
> = {
	dns: { label: 'DNS', className: 'bg-success/10 text-success border-success/30' },
	ip: { label: 'IP', className: 'bg-info/10 text-info border-info/30' },
	uri: { label: 'URI', className: 'bg-warning/10 text-warning border-warning/30' },
	email: { label: 'Email', className: 'bg-primary/10 text-primary border-primary/30' },
	dirName: { label: 'DirName', className: 'bg-muted text-foreground' },
	other: { label: 'Other', className: 'bg-muted text-muted-foreground' },
};

type ExpiryTone = 'success' | 'info' | 'warning' | 'destructive';

const TONE_BADGE_CLASS: Readonly<Record<ExpiryTone, string>> = {
	success: 'bg-success/10 text-success border-success/30',
	info: 'bg-info/10 text-info border-info/30',
	warning: 'bg-warning/10 text-warning border-warning/30',
	destructive: 'bg-destructive/10 text-destructive border-destructive/30',
};

const formatDate = (date: Date): string => date.toLocaleString();

interface ExpiryBadge {
	readonly label: string;
	readonly tone: ExpiryTone;
}

const buildExpiryBadge = (cert: ParsedCertificate, now: Date): ExpiryBadge => {
	if (isNotYetValid(cert, now)) {
		return { label: 'Not yet valid', tone: 'info' };
	}
	if (isExpired(cert, now)) {
		const days = Math.abs(daysUntilExpiry(cert, now));
		return { label: `Expired ${days} days ago`, tone: 'destructive' };
	}
	const days = daysUntilExpiry(cert, now);
	if (days <= 7) return { label: `Expires in ${days} days`, tone: 'destructive' };
	if (days <= 30) return { label: `Expires in ${days} days`, tone: 'warning' };
	return { label: `Valid (${days} days left)`, tone: 'success' };
};

const clampPort = (value: string): number => {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed)) return SAMPLE_PORT;
	return Math.max(1, Math.min(65535, parsed));
};

export const Route = createFileRoute('/tls-inspector')({
	component: TlsInspectorPage,
});

function TlsInspectorPage() {
	useDocumentTitle('TLS Inspector');

	const { value: options, patch } = useTlsInspectorOptions();
	const { host, port, sni, timeoutMs } = options;

	const [result, setResult] = useState<TlsInspectResult | null>(null);
	const [parsedChain, setParsedChain] = useState<readonly ParsedCertificate[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [running, setRunning] = useState(false);
	const [showRail, setShowRail] = useState(true);

	const canRun = host.trim().length > 0 && !running;

	const handleRun = async () => {
		const trimmedHost = host.trim();
		if (trimmedHost.length === 0) return;
		setRunning(true);
		setError(null);
		try {
			const next = await inspectTls({
				host: trimmedHost,
				port,
				sni: sni.trim().length > 0 ? sni.trim() : undefined,
				timeoutMs,
			});
			setResult(next);
			const parsed = await decodeChain(next.peerChainBase64);
			setParsedChain(parsed.certificates);
			if (parsed.errors.length > 0) {
				toast.error(`Failed to parse ${parsed.errors.length} certificate(s) in chain`);
			}
		} catch (e) {
			setError(getErrorMessage(e, 'Inspection failed'));
			setResult(null);
			setParsedChain([]);
		} finally {
			setRunning(false);
		}
	};

	const loadSample = (sampleHost: string) => {
		patch({ host: sampleHost, port: SAMPLE_PORT, sni: '' });
		setResult(null);
		setParsedChain([]);
		setError(null);
	};

	const handleCopyChain = async () => {
		if (!result) return;
		try {
			await navigator.clipboard.writeText(buildPemBundle(result.peerChainBase64));
			toast.success('Full chain PEM copied to clipboard');
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	const now = useMemo(() => new Date(), [result]);

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			statusContent={
				<>
					<StatItem label="Version" value={result?.negotiatedVersion ?? '—'} />
					<StatItem label="Cipher" value={result?.cipherSuite ?? '—'} />
					<StatItem label="Certs" value={result?.peerChainBase64.length ?? 0} />
					<StatItem label="Elapsed" value={result ? `${result.elapsedMs} ms` : '—'} />
				</>
			}
			rail={
				<>
					<FormSection title="Run">
						<Button onClick={handleRun} disabled={!canRun} className="w-full">
							{running ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<ShieldCheck className="h-4 w-4" />
							)}
							{running ? 'Inspecting…' : 'Inspect'}
						</Button>
					</FormSection>

					<FormSection title="SNI override">
						<FormInput
							label="SNI hostname"
							value={sni}
							placeholder="leave empty to use host"
							onValueChange={(value) => patch({ sni: value })}
							hint="Server Name Indication sent in the ClientHello."
						/>
					</FormSection>

					<FormSection title="Options">
						<FormSlider
							label="Timeout (ms)"
							value={timeoutMs}
							min={TIMEOUT_MIN_MS}
							max={TIMEOUT_MAX_MS}
							step={TIMEOUT_STEP_MS}
							onValueChange={(value) => patch({ timeoutMs: value })}
						/>
					</FormSection>

					<FormSection title="Samples">
						<div className="flex flex-col gap-2">
							<Button variant="outline" size="sm" onClick={() => loadSample(SAMPLE_HOST)}>
								<FlaskConical className="h-3.5 w-3.5" />
								{SAMPLE_HOST}:{SAMPLE_PORT}
							</Button>
							<Button variant="outline" size="sm" onClick={() => loadSample(EXPIRED_SAMPLE_HOST)}>
								<FlaskConical className="h-3.5 w-3.5" />
								Expired ({EXPIRED_SAMPLE_HOST})
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => loadSample(SELF_SIGNED_SAMPLE_HOST)}
							>
								<FlaskConical className="h-3.5 w-3.5" />
								Self-signed ({SELF_SIGNED_SAMPLE_HOST})
							</Button>
						</div>
					</FormSection>

					<FormSection title="Export">
						<Button
							variant="outline"
							size="sm"
							onClick={handleCopyChain}
							disabled={!result || result.peerChainBase64.length === 0}
							className="w-full"
						>
							Copy full chain as PEM
						</Button>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							Performs a TLS handshake and dumps the certificate chain. Accepts invalid / expired /
							self-signed certs for inspection — connections are NOT verified.
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="shrink-0 border-b bg-surface-2 p-4">
					<HostPortInputBar
						host={host}
						port={port}
						running={running}
						canRun={canRun}
						onHostChange={(value) => patch({ host: value })}
						onPortChange={(value) => patch({ port: value })}
						onRun={handleRun}
					/>
				</div>

				<div className="flex-1 overflow-auto">
					{error ? (
						<div className="p-4">
							<FormError message={error} />
						</div>
					) : null}

					{!result && !error ? (
						<div className="flex h-full items-center justify-center p-4">
							<EmbeddedEmptyState
								icon={Lock}
								title="Inspect a TLS endpoint"
								description="Enter a host and port, then click Inspect. The peer's certificate chain is rendered below — even when the chain is expired, self-signed, or otherwise invalid."
							/>
						</div>
					) : null}

					{result ? (
						<div className="space-y-4 p-4">
							<HandshakeSummaryCard result={result} />
							<ChainCards chain={parsedChain} base64Chain={result.peerChainBase64} now={now} />
						</div>
					) : null}
				</div>
			</div>
		</ToolShell>
	);
}

interface HostPortInputBarProps {
	readonly host: string;
	readonly port: number;
	readonly running: boolean;
	readonly canRun: boolean;
	readonly onHostChange: (value: string) => void;
	readonly onPortChange: (value: number) => void;
	readonly onRun: () => void;
}

function HostPortInputBar({
	host,
	port,
	running,
	canRun,
	onHostChange,
	onPortChange,
	onRun,
}: HostPortInputBarProps) {
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && canRun) onRun();
	};

	return (
		<div className="space-y-2">
			<div className="grid grid-cols-[1fr_120px_auto] gap-2">
				<div className="space-y-1">
					<Label className="text-sm font-medium">Host</Label>
					<Input
						value={host}
						placeholder="example.com"
						onChange={(e) => onHostChange(e.target.value)}
						onKeyDown={handleKeyDown}
						className="h-9 bg-background text-sm"
					/>
				</div>
				<div className="space-y-1">
					<Label className="text-sm font-medium">Port</Label>
					<Input
						type="number"
						min={1}
						max={65535}
						value={port}
						onChange={(e) => onPortChange(clampPort(e.target.value))}
						onKeyDown={handleKeyDown}
						className="h-9 bg-background text-sm"
					/>
				</div>
				<div className="flex flex-col justify-end">
					<Button onClick={onRun} disabled={!canRun}>
						{running ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<ShieldCheck className="h-4 w-4" />
						)}
						Inspect
					</Button>
				</div>
			</div>
			<div className="flex flex-wrap gap-1.5">
				<span className="text-xs text-muted-foreground">Port presets:</span>
				{PORT_PRESETS.map((preset) => (
					<Button
						key={preset}
						variant={port === preset ? 'default' : 'outline'}
						size="sm"
						className="h-6 px-2 text-xs"
						onClick={() => onPortChange(preset)}
					>
						{preset}
					</Button>
				))}
			</div>
		</div>
	);
}

interface HandshakeSummaryCardProps {
	readonly result: TlsInspectResult;
}

function HandshakeSummaryCard({ result }: HandshakeSummaryCardProps) {
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-sm font-medium">
					<KeyRound className="h-4 w-4 text-muted-foreground" />
					Handshake summary
					<Badge variant="outline" className="font-mono text-2xs">
						{result.host}:{result.port}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-xs">
					<SummaryRow label="Negotiated version" value={result.negotiatedVersion} />
					<SummaryRow label="Cipher suite" value={result.cipherSuite} />
					<SummaryRow label="ALPN" value={result.alpn ?? '(none)'} />
					<SummaryRow label="SNI" value={result.sni} />
					<SummaryRow label="Peer chain" value={`${result.peerChainBase64.length} certs`} />
					<SummaryRow label="Elapsed" value={`${result.elapsedMs} ms`} />
				</dl>
			</CardContent>
		</Card>
	);
}

interface SummaryRowProps {
	readonly label: string;
	readonly value: string;
}

function SummaryRow({ label, value }: SummaryRowProps) {
	return (
		<>
			<dt className="font-mono text-muted-foreground">{label}</dt>
			<dd className="break-all font-mono">{value}</dd>
		</>
	);
}

interface ChainCardsProps {
	readonly chain: readonly ParsedCertificate[];
	readonly base64Chain: readonly string[];
	readonly now: Date;
}

function ChainCards({ chain, base64Chain, now }: ChainCardsProps) {
	if (chain.length === 0) {
		return (
			<Card density="compact">
				<CardContent>
					<p className="text-xs text-muted-foreground">Peer did not present a certificate chain.</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-3">
			<SectionLabel icon={Layers}>Certificate chain ({chain.length}) — leaf first</SectionLabel>
			{chain.map((cert, idx) => (
				<ChainCertificateCard
					key={cert.fingerprints.sha256}
					cert={cert}
					base64Der={base64Chain[idx] ?? ''}
					role={
						idx === 0
							? 'leaf'
							: idx === chain.length - 1 && chain.length > 1
								? 'root'
								: 'intermediate'
					}
					now={now}
				/>
			))}
		</div>
	);
}

interface ChainCertificateCardProps {
	readonly cert: ParsedCertificate;
	readonly base64Der: string;
	readonly role: 'leaf' | 'intermediate' | 'root';
	readonly now: Date;
}

function ChainCertificateCard({ cert, base64Der, role, now }: ChainCertificateCardProps) {
	const badge = buildExpiryBadge(cert, now);
	const subjectLabel = getSubjectLabel(cert);
	const issuerLabel = cert.issuer.components.map((c) => `${c.shortName}=${c.value}`).join(', ');
	const pem = base64Der.length > 0 ? buildPemFromBase64(base64Der) : cert.pem;

	const roleClass: Record<typeof role, string> = {
		leaf: 'border-success/40',
		intermediate: 'border-warning/40',
		root: 'border-info/40',
	};

	return (
		<Card density="compact" className={cn('border-l-4', roleClass[role])}>
			<CardHeader>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2">
						<Badge variant="outline" className="font-mono text-2xs uppercase">
							{role}
						</Badge>
						<CardTitle className="truncate text-sm font-medium">{subjectLabel}</CardTitle>
						{cert.selfSigned ? (
							<Badge variant="outline" className="font-mono text-2xs">
								Self-signed
							</Badge>
						) : null}
					</div>
					<div className="flex items-center gap-2">
						<Badge className={cn('font-medium', TONE_BADGE_CLASS[badge.tone])}>{badge.label}</Badge>
						<CopyButton text={pem} toastLabel="Certificate PEM" size="sm" />
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<dl className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1 text-xs">
					<SummaryRow label="Subject" value={subjectLabel} />
					<SummaryRow label="Issuer" value={issuerLabel} />
					<SummaryRow label="Not Before" value={formatDate(cert.notBefore)} />
					<SummaryRow label="Not After" value={formatDate(cert.notAfter)} />
					<SummaryRow label="Serial" value={cert.serialNumber} />
					<SummaryRow label="Signature" value={cert.signatureAlgorithm} />
				</dl>
				{cert.subjectAlternativeNames.length > 0 ? (
					<SanBadgeList entries={cert.subjectAlternativeNames} />
				) : null}
			</CardContent>
		</Card>
	);
}

interface SanBadgeListProps {
	readonly entries: readonly SanEntry[];
}

function SanBadgeList({ entries }: SanBadgeListProps) {
	return (
		<div>
			<SectionLabel icon={ShieldAlert} iconClass="h-3.5 w-3.5 text-muted-foreground">
				Subject Alternative Names ({entries.length})
			</SectionLabel>
			<div className="flex flex-wrap gap-1.5">
				{entries.map((entry) => {
					const tone = SAN_TYPE_TONE[entry.type];
					return (
						<Badge
							key={`${entry.type}-${entry.value}`}
							variant="outline"
							className={cn('font-mono text-2xs', tone.className)}
						>
							{tone.label}: {entry.value}
						</Badge>
					);
				})}
			</div>
		</div>
	);
}
