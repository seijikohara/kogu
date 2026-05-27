import { createFileRoute } from '@tanstack/react-router';
import {
	BadgeCheck,
	FlaskConical,
	KeyRound,
	Layers,
	ShieldAlert,
	ShieldCheck,
	Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties, type DragEvent } from 'react';

import { CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormError,
	FormInfo,
	FormSection,
	FormSlider,
	FormTextarea,
} from '@/lib/components/form';
import {
	DefinitionList,
	type DefinitionItem,
	RelatedTools,
	SectionLabel,
} from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/lib/components/ui/accordion';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { useDocumentTitle } from '@/lib/hooks';
import { createToolOptionsStore } from '@/lib/stores';
import {
	buildChain,
	daysSinceStart,
	daysUntilExpiry,
	getSubjectLabel,
	isExpired,
	isNotYetValid,
	parseCertificates,
	type ParsedCertificate,
	type ParsedExtension,
	type ParseResult,
	type SanEntry,
	type SanType,
} from '@/lib/services/x509';
import { generateSampleChain, generateSampleLeafCertificate } from '@/lib/services/x509-samples';
import { cn } from '@/lib/utils';

interface X509Prefs {
	readonly warnDays: number;
	readonly severeDays: number;
	readonly showSha256: boolean;
	readonly showSha1: boolean;
	readonly showMd5: boolean;
}

const DEFAULT_PREFS: X509Prefs = {
	warnDays: 30,
	severeDays: 7,
	showSha256: true,
	showSha1: true,
	showMd5: true,
};

const useX509Prefs = createToolOptionsStore<X509Prefs>('x509-decoder', DEFAULT_PREFS);

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

const formatDate = (date: Date): string => date.toLocaleString();

type ExpiryTone = 'success' | 'info' | 'warning' | 'destructive';

interface ExpiryBadge {
	readonly label: string;
	readonly tone: ExpiryTone;
}

const buildExpiryBadge = (
	cert: ParsedCertificate,
	now: Date,
	warnDays: number,
	severeDays: number
): ExpiryBadge => {
	if (isNotYetValid(cert, now)) {
		const days = Math.abs(daysSinceStart(cert, now));
		return { label: `Not yet valid (in ${days} days)`, tone: 'info' };
	}
	if (isExpired(cert, now)) {
		const days = Math.abs(daysUntilExpiry(cert, now));
		return { label: `Expired ${days} days ago`, tone: 'destructive' };
	}
	const days = daysUntilExpiry(cert, now);
	if (days <= severeDays) return { label: `Expires in ${days} days`, tone: 'destructive' };
	if (days <= warnDays) return { label: `Expires in ${days} days`, tone: 'warning' };
	return { label: `Valid (${days} days left)`, tone: 'success' };
};

const TONE_BADGE_CLASS: Readonly<Record<ExpiryTone, string>> = {
	success: 'bg-success/10 text-success border-success/30',
	info: 'bg-info/10 text-info border-info/30',
	warning: 'bg-warning/10 text-warning border-warning/30',
	destructive: 'bg-destructive/10 text-destructive border-destructive/30',
};

const TONE_TIMELINE_CLASS: Readonly<Record<ExpiryTone, string>> = {
	success: 'fill-success/30 stroke-success',
	info: 'fill-info/30 stroke-info',
	warning: 'fill-warning/30 stroke-warning',
	destructive: 'fill-destructive/30 stroke-destructive',
};

export const Route = createFileRoute('/x509-decoder')({
	component: X509DecoderPage,
});

function X509DecoderPage() {
	useDocumentTitle('X.509 Certificate Decoder');

	const { value: prefs, patch } = useX509Prefs();

	const [input, setInput] = useState('');
	const [parseResult, setParseResult] = useState<ParseResult | null>(null);
	const [parsing, setParsing] = useState(false);
	const [now, setNow] = useState<Date>(() => new Date());
	const [showRail, setShowRail] = useState(true);
	const [isDragOver, setIsDragOver] = useState(false);

	// Re-parse whenever the textual input changes. Debounce so a long paste
	// (multi-cert PEM bundles) does not run the parser on each keystroke.
	useEffect(() => {
		if (input.trim().length === 0) {
			setParseResult(null);
			return;
		}
		const id = window.setTimeout(() => {
			setParsing(true);
			parseCertificates(input).then((res) => {
				setParseResult(res);
				setParsing(false);
			});
		}, 200);
		return () => window.clearTimeout(id);
	}, [input]);

	// Live countdown — re-evaluate expiry banners every minute.
	useEffect(() => {
		const id = window.setInterval(() => setNow(new Date()), 60_000);
		return () => window.clearInterval(id);
	}, []);

	const chain = useMemo(() => buildChain(parseResult?.certificates ?? []), [parseResult]);

	const handleGenerateLeaf = async () => {
		const pem = await generateSampleLeafCertificate();
		setInput(pem);
	};

	const handleGenerateChain = async () => {
		const pem = await generateSampleChain();
		setInput(pem);
	};

	const handleClear = () => setInput('');

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
		const file = e.dataTransfer.files[0];
		if (!file) return;
		file.arrayBuffer().then((buf) => {
			const bytes = new Uint8Array(buf);
			// Prefer text decoding when the file looks ASCII (PEM bundles); fall
			// back to raw DER bytes otherwise so binary .cer / .der files parse.
			const text = new TextDecoder('utf-8').decode(bytes);
			if (/-----BEGIN [^-]+-----/.test(text)) {
				setInput(text);
				return;
			}
			setParsing(true);
			parseCertificates(bytes).then((res) => {
				setParseResult(res);
				setParsing(false);
			});
		});
	};

	const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(true);
	};

	const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
	};

	const certificates = parseResult?.certificates ?? [];
	const errors = parseResult?.errors ?? [];

	const soonestExpiry = useMemo(() => {
		if (certificates.length === 0) return null;
		const min = certificates.reduce(
			(acc, c) => (c.notAfter.getTime() < acc.getTime() ? c.notAfter : acc),
			certificates[0]?.notAfter ?? new Date()
		);
		return min;
	}, [certificates]);

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			statusContent={
				<>
					<StatItem label="Certs" value={certificates.length} />
					<StatItem label="Errors" value={errors.length} />
					<StatItem
						label="Soonest expiry"
						value={soonestExpiry ? soonestExpiry.toLocaleDateString() : '—'}
					/>
				</>
			}
			rail={
				<>
					<FormSection title="Input">
						<FormInfo>
							Accepts PEM, raw base64 (no headers), and binary DER. Multi-PEM bundles are split
							automatically into chain order.
						</FormInfo>
						<div className="flex flex-col gap-2">
							<Button variant="outline" size="sm" onClick={handleGenerateLeaf}>
								<FlaskConical className="h-3.5 w-3.5" />
								Generate sample cert
							</Button>
							<Button variant="outline" size="sm" onClick={handleGenerateChain}>
								<Layers className="h-3.5 w-3.5" />
								Generate sample chain
							</Button>
							<Button variant="outline" size="sm" onClick={handleClear}>
								<Trash2 className="h-3.5 w-3.5" />
								Clear
							</Button>
						</div>
					</FormSection>

					<FormSection title="Expiry Thresholds">
						<FormSlider
							label="Warning at (days)"
							value={prefs.warnDays}
							min={1}
							max={365}
							step={1}
							onValueChange={(v) =>
								patch({ warnDays: v, severeDays: Math.min(prefs.severeDays, v) })
							}
						/>
						<FormSlider
							label="Severe at (days)"
							value={prefs.severeDays}
							min={1}
							max={prefs.warnDays}
							step={1}
							onValueChange={(v) => patch({ severeDays: v })}
						/>
					</FormSection>

					<FormSection title="Fingerprints">
						<FormCheckboxGroup>
							<FormCheckbox
								label="SHA-256"
								checked={prefs.showSha256}
								onCheckedChange={(c) => patch({ showSha256: c })}
								size="compact"
							/>
							<FormCheckbox
								label="SHA-1"
								checked={prefs.showSha1}
								onCheckedChange={(c) => patch({ showSha1: c })}
								size="compact"
							/>
							<FormCheckbox
								label="MD5"
								checked={prefs.showMd5}
								onCheckedChange={(c) => patch({ showMd5: c })}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="Related">
						<RelatedTools
							items={[
								{ id: 'tls-inspector', reason: 'Fetch a live cert chain from a host' },
								{ id: 'rsa-tools', reason: 'Verify a signature with the public key' },
							]}
						/>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							All parsing happens in your browser. Nothing is uploaded. Sample certificates are
							generated locally with fresh keys each time.
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="shrink-0 border-b bg-surface-2 p-4">
					{/* Dropzone wrapper around the textarea. Marked as a region so
					    screen readers can navigate it and the drag handlers attach to
					    a recognised interactive surface. */}
					<section
						aria-label="Certificate input drop zone"
						onDrop={handleDrop}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						className={cn(
							'rounded-md border-2 border-dashed border-border/60 p-2 transition-colors',
							isDragOver && 'border-primary bg-primary/5'
						)}
					>
						<FormTextarea
							label="Certificate input"
							value={input}
							onValueChange={setInput}
							placeholder="Paste PEM, base64, or hex-encoded DER. Drop a .crt / .cer / .pem / .der file here."
							rows={6}
							className="font-mono text-xs"
						/>
					</section>
				</div>

				<div className="flex-1 overflow-auto">
					{certificates.length === 0 && errors.length === 0 ? (
						<div className="flex h-full items-center justify-center p-4">
							<EmbeddedEmptyState
								icon={BadgeCheck}
								title="Paste a certificate"
								description="PEM, base64, or DER. Drag a .crt / .cer / .pem / .der file into the input area, or use Generate sample on the left."
							/>
						</div>
					) : (
						<div className="space-y-4 p-4">
							{parsing ? <p className="text-xs text-muted-foreground">Parsing…</p> : null}

							{errors.length > 0 ? (
								<Card density="compact">
									<CardHeader>
										<CardTitle className="flex items-center gap-2 text-sm">
											<ShieldAlert className="h-4 w-4 text-destructive" />
											Parse errors
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-1">
										{errors.map((err) => (
											<FormError
												key={`${err.index}-${err.message}`}
												message={`Certificate #${err.index + 1}: ${err.message}`}
											/>
										))}
									</CardContent>
								</Card>
							) : null}

							{chain.chain.length >= 2 ? <ChainVisualization chain={chain.chain} /> : null}

							{certificates.map((cert) => (
								<CertificateCard
									key={`${cert.fingerprints.sha256}-${cert.serialNumber}`}
									cert={cert}
									now={now}
									prefs={prefs}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</ToolShell>
	);
}

interface CertificateCardProps {
	readonly cert: ParsedCertificate;
	readonly now: Date;
	readonly prefs: X509Prefs;
}

function CertificateCard({ cert, now, prefs }: CertificateCardProps) {
	const badge = buildExpiryBadge(cert, now, prefs.warnDays, prefs.severeDays);
	const subjectLabel = getSubjectLabel(cert);
	const serialPreview = `${cert.serialNumber.replace(/:/g, '').slice(0, 8)}…`;

	return (
		<Card density="compact">
			<CardHeader>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2">
						<CardTitle className="truncate text-sm font-medium">{subjectLabel}</CardTitle>
						{cert.selfSigned ? (
							<Badge variant="outline" className="font-mono text-2xs">
								Self-signed
							</Badge>
						) : null}
						<Badge variant="outline" className="font-mono text-2xs">
							SN {serialPreview}
						</Badge>
					</div>
					<Badge className={cn('font-medium', TONE_BADGE_CLASS[badge.tone])}>{badge.label}</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<ValidityTimeline cert={cert} now={now} tone={badge.tone} />
				<DnGrid cert={cert} />
				<PublicKeySummary cert={cert} />
				{cert.subjectAlternativeNames.length > 0 ? (
					<SubjectAlternativeNames entries={cert.subjectAlternativeNames} />
				) : null}
				<FingerprintList cert={cert} prefs={prefs} />
				<ExtensionsAccordion cert={cert} />
				<RawAccordion cert={cert} />
			</CardContent>
		</Card>
	);
}

interface ValidityTimelineProps {
	readonly cert: ParsedCertificate;
	readonly now: Date;
	readonly tone: ExpiryTone;
}

function ValidityTimeline({ cert, now, tone }: ValidityTimelineProps) {
	const start = cert.notBefore.getTime();
	const end = cert.notAfter.getTime();
	const total = Math.max(1, end - start);
	const nowMs = now.getTime();
	const positionRatio = Math.min(1, Math.max(0, (nowMs - start) / total));
	const nowX = positionRatio * 100;

	return (
		<div>
			<SectionLabel>Validity</SectionLabel>
			<svg
				viewBox="0 0 100 12"
				preserveAspectRatio="none"
				role="img"
				aria-label={`Validity timeline from ${formatDate(cert.notBefore)} to ${formatDate(
					cert.notAfter
				)}, now at ${Math.round(positionRatio * 100)}%`}
				className={cn('h-10 w-full overflow-visible', TONE_TIMELINE_CLASS[tone])}
			>
				<rect x="0" y="4" width="100" height="4" rx="1.5" className="opacity-40" />
				<line
					x1={nowX}
					y1="0"
					x2={nowX}
					y2="12"
					strokeWidth="0.6"
					strokeLinecap="round"
					className="stroke-foreground"
					vectorEffect="non-scaling-stroke"
				/>
				<circle cx="0" cy="6" r="1" className="fill-foreground" />
				<circle cx="100" cy="6" r="1" className="fill-foreground" />
			</svg>
			<div className="mt-1 flex justify-between text-2xs text-muted-foreground">
				<span>{formatDate(cert.notBefore)}</span>
				<span className="text-foreground">now</span>
				<span>{formatDate(cert.notAfter)}</span>
			</div>
		</div>
	);
}

interface DnGridProps {
	readonly cert: ParsedCertificate;
}

function DnGrid({ cert }: DnGridProps) {
	return (
		<div className="grid gap-3 md:grid-cols-2">
			<DnPanel title="Subject" components={cert.subject.components} />
			<DnPanel title="Issuer" components={cert.issuer.components} />
		</div>
	);
}

interface DnPanelProps {
	readonly title: string;
	readonly components: readonly { readonly shortName: string; readonly value: string }[];
}

function DnPanel({ title, components }: DnPanelProps) {
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent>
				{components.length === 0 ? (
					<p className="text-xs text-muted-foreground">(empty)</p>
				) : (
					<DefinitionList
						keyColumn="80px"
						items={components.map((c) => ({ key: c.shortName, value: c.value, break: true }))}
					/>
				)}
			</CardContent>
		</Card>
	);
}

interface PublicKeySummaryProps {
	readonly cert: ParsedCertificate;
}

function PublicKeySummary({ cert }: PublicKeySummaryProps) {
	const pk = cert.publicKey;
	const items: DefinitionItem[] = [{ key: 'Algorithm', value: pk.algorithm, break: true }];
	if (pk.bitLength) items.push({ key: 'Bit length', value: `${pk.bitLength} bit` });
	if (pk.curve) items.push({ key: 'Curve', value: pk.curve, break: true });
	if (pk.modulusPreview) items.push({ key: 'Modulus', value: pk.modulusPreview, break: true });
	if (pk.exponent) items.push({ key: 'Exponent', value: pk.exponent, break: true });
	items.push({ key: 'Signature', value: cert.signatureAlgorithm, break: true });
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
					<KeyRound className="h-3.5 w-3.5" />
					Public Key
				</CardTitle>
			</CardHeader>
			<CardContent>
				<DefinitionList keyColumn="120px" items={items} />
			</CardContent>
		</Card>
	);
}

interface SubjectAlternativeNamesProps {
	readonly entries: readonly SanEntry[];
}

function SubjectAlternativeNames({ entries }: SubjectAlternativeNamesProps) {
	return (
		<div>
			<SectionLabel>Subject Alternative Names ({entries.length})</SectionLabel>
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

interface FingerprintListProps {
	readonly cert: ParsedCertificate;
	readonly prefs: X509Prefs;
}

function FingerprintList({ cert, prefs }: FingerprintListProps) {
	const rows: readonly {
		readonly label: string;
		readonly value: string;
		readonly show: boolean;
	}[] = [
		{ label: 'SHA-256', value: cert.fingerprints.sha256, show: prefs.showSha256 },
		{ label: 'SHA-1', value: cert.fingerprints.sha1, show: prefs.showSha1 },
		{ label: 'MD5', value: cert.fingerprints.md5, show: prefs.showMd5 },
	];
	const visible = rows.filter((r) => r.show);
	if (visible.length === 0) return null;
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Fingerprints
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-1.5">
				{visible.map((row) => (
					<div key={row.label} className="flex items-start gap-2 text-xs">
						<span className="w-16 shrink-0 font-mono text-muted-foreground">{row.label}</span>
						<code className="flex-1 break-all font-mono">{row.value}</code>
						<CopyButton text={row.value} toastLabel={`${row.label} fingerprint`} size="sm" />
					</div>
				))}
			</CardContent>
		</Card>
	);
}

interface ExtensionsAccordionProps {
	readonly cert: ParsedCertificate;
}

function ExtensionsAccordion({ cert }: ExtensionsAccordionProps) {
	if (cert.extensions.length === 0) return null;
	return (
		<Accordion type="multiple" className="w-full">
			<AccordionItem value="extensions">
				<AccordionTrigger>
					<span className="flex items-center gap-2 text-sm font-medium">
						<ShieldCheck className="h-4 w-4 text-muted-foreground" />
						Extensions
						<Badge variant="outline" className="font-mono text-2xs">
							{cert.extensions.length}
						</Badge>
					</span>
				</AccordionTrigger>
				<AccordionContent>
					<div className="space-y-2">
						{cert.extensions.map((ext) => (
							<ExtensionRow key={ext.oid} extension={ext} />
						))}
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

interface ExtensionRowProps {
	readonly extension: ParsedExtension;
}

function ExtensionRow({ extension }: ExtensionRowProps) {
	return (
		<Card density="compact">
			<CardContent className="space-y-1.5">
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-xs font-medium">{extension.name}</span>
					<span className="font-mono text-2xs text-muted-foreground">{extension.oid}</span>
					{extension.critical ? (
						<Badge className={cn('font-mono text-2xs', TONE_BADGE_CLASS.destructive)}>
							Critical
						</Badge>
					) : null}
				</div>
				<ExtensionBody extension={extension} />
			</CardContent>
		</Card>
	);
}

interface ExtensionBodyProps {
	readonly extension: ParsedExtension;
}

function KeyUsageBody({ usages }: { readonly usages: readonly string[] }) {
	if (usages.length === 0)
		return <p className="text-2xs text-muted-foreground">(no usages declared)</p>;
	return (
		<div className="flex flex-wrap gap-1">
			{usages.map((u) => (
				<Badge key={u} variant="outline" className="font-mono text-2xs">
					{u}
				</Badge>
			))}
		</div>
	);
}

function ExtendedKeyUsageBody({
	purposes,
}: {
	readonly purposes: readonly { readonly oid: string; readonly name: string }[];
}) {
	return (
		<div className="flex flex-wrap gap-1">
			{purposes.map((p) => (
				<Badge key={p.oid} variant="outline" className="font-mono text-2xs" title={p.oid}>
					{p.name}
				</Badge>
			))}
		</div>
	);
}

function BasicConstraintsBody({
	ca,
	pathLenConstraint,
}: {
	readonly ca: boolean;
	readonly pathLenConstraint?: number;
}) {
	const items: DefinitionItem[] = [{ key: 'CA', value: ca ? 'true' : 'false' }];
	if (typeof pathLenConstraint === 'number') {
		items.push({ key: 'Path length', value: String(pathLenConstraint) });
	}
	return <DefinitionList keyColumn="100px" size="2xs" items={items} />;
}

function AuthorityKeyIdBody({
	keyId,
	issuerSerial,
}: {
	readonly keyId?: string;
	readonly issuerSerial?: string;
}) {
	const items: DefinitionItem[] = [];
	if (keyId) items.push({ key: 'Key ID', value: keyId, break: true });
	if (issuerSerial) items.push({ key: 'Serial', value: issuerSerial, break: true });
	return <DefinitionList keyColumn="100px" size="2xs" items={items} />;
}

function CrlUrlsBody({ urls }: { readonly urls: readonly string[] }) {
	if (urls.length === 0) {
		return <p className="text-2xs text-muted-foreground">(no URLs)</p>;
	}
	return (
		<ul className="space-y-1 text-2xs">
			{urls.map((url) => (
				<li key={url} className="break-all font-mono text-muted-foreground">
					{url}
				</li>
			))}
		</ul>
	);
}

function AuthorityInfoBody({
	ocspUrls,
	caIssuerUrls,
}: {
	readonly ocspUrls: readonly string[];
	readonly caIssuerUrls: readonly string[];
}) {
	const items: DefinitionItem[] = [];
	if (ocspUrls.length > 0) items.push({ key: 'OCSP', value: ocspUrls.join(', '), break: true });
	if (caIssuerUrls.length > 0)
		items.push({ key: 'CA Issuer', value: caIssuerUrls.join(', '), break: true });
	return <DefinitionList keyColumn="80px" size="2xs" items={items} />;
}

function ExtensionBody({ extension }: ExtensionBodyProps) {
	const data = extension.parsed;
	switch (data.kind) {
		case 'keyUsage':
			return <KeyUsageBody usages={data.usages} />;
		case 'extendedKeyUsage':
			return <ExtendedKeyUsageBody purposes={data.purposes} />;
		case 'basicConstraints':
			return <BasicConstraintsBody ca={data.ca} pathLenConstraint={data.pathLenConstraint} />;
		case 'subjectAltName':
			return <SubjectAlternativeNames entries={data.entries} />;
		case 'subjectKeyId':
			return (
				<code className="block break-all font-mono text-2xs text-muted-foreground">
					{data.keyId}
				</code>
			);
		case 'authorityKeyId':
			return <AuthorityKeyIdBody keyId={data.keyId} issuerSerial={data.issuerSerial} />;
		case 'crlDistributionPoints':
			return <CrlUrlsBody urls={data.urls} />;
		case 'authorityInfoAccess':
			return <AuthorityInfoBody ocspUrls={data.ocspUrls} caIssuerUrls={data.caIssuerUrls} />;
		default:
			return (
				<code className="block break-all font-mono text-2xs text-muted-foreground">
					{data.value}
				</code>
			);
	}
}

interface RawAccordionProps {
	readonly cert: ParsedCertificate;
}

function RawAccordion({ cert }: RawAccordionProps) {
	return (
		<Accordion type="single" collapsible className="w-full">
			<AccordionItem value="raw">
				<AccordionTrigger>
					<span className="text-sm font-medium">Raw</span>
				</AccordionTrigger>
				<AccordionContent>
					<div className="space-y-3">
						<div>
							<div className="mb-1.5 flex items-center justify-between">
								<span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
									PEM
								</span>
								<CopyButton text={cert.pem} toastLabel="PEM" size="sm" />
							</div>
							<pre className="max-h-64 overflow-auto rounded-md border bg-muted p-3 font-mono text-2xs">
								{cert.pem}
							</pre>
						</div>
						<div>
							<div className="mb-1.5 flex items-center justify-between">
								<span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
									DER (base64)
								</span>
								<CopyButton text={cert.derBase64} toastLabel="DER base64" size="sm" />
							</div>
							<code className="block max-h-32 overflow-auto break-all rounded-md border bg-muted p-3 font-mono text-2xs">
								{cert.derBase64}
							</code>
						</div>
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

interface ChainVisualizationProps {
	readonly chain: readonly ParsedCertificate[];
}

function ChainVisualization({ chain }: ChainVisualizationProps) {
	const ordered = chain;
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-sm font-medium">
					<Layers className="h-4 w-4 text-muted-foreground" />
					Trust chain
					<Badge variant="outline" className="font-mono text-2xs">
						{ordered.length} certs
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div
					className="flex flex-wrap items-center gap-2"
					style={{ '--chain-arrow': '"→"' } as CSSProperties}
				>
					{ordered.map((cert, idx) => (
						<ChainNode
							key={cert.fingerprints.sha256}
							cert={cert}
							role={idx === 0 ? 'root' : idx === ordered.length - 1 ? 'leaf' : 'intermediate'}
							showArrow={idx < ordered.length - 1}
						/>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

interface ChainNodeProps {
	readonly cert: ParsedCertificate;
	readonly role: 'root' | 'intermediate' | 'leaf';
	readonly showArrow: boolean;
}

function ChainNode({ cert, role, showArrow }: ChainNodeProps) {
	const label = getSubjectLabel(cert);
	const roleClass: Record<typeof role, string> = {
		root: 'border-info/40 bg-info/5',
		intermediate: 'border-warning/40 bg-warning/5',
		leaf: 'border-success/40 bg-success/5',
	};
	return (
		<div className="flex items-center gap-2">
			<div
				className={cn('min-w-32 max-w-56 rounded-md border px-3 py-1.5 text-xs', roleClass[role])}
			>
				<div className="text-2xs uppercase tracking-wide text-muted-foreground">{role}</div>
				<div className="truncate font-medium">{label}</div>
			</div>
			{showArrow ? <span className="font-mono text-muted-foreground">→</span> : null}
		</div>
	);
}
