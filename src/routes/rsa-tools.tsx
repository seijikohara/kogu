import { createFileRoute, useRouter } from '@tanstack/react-router';
import {
	CheckCircle2,
	FlaskConical,
	KeyRound,
	KeySquare,
	Lock,
	Pencil,
	ShieldCheck,
	Sparkles,
	Trash2,
	XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { toast } from 'sonner';

import { CopyButton } from '@/lib/components/action';
import {
	FormInfo,
	FormSection,
	FormSelect,
	FormTextarea,
	type SelectOption,
} from '@/lib/components/form';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { useDocumentTitle } from '@/lib/hooks';
import {
	decrypt,
	encrypt,
	formatOutput,
	generateSampleKeypair,
	importPrivateKey,
	importPublicKey,
	importSignKey,
	importVerifyKey,
	type OutputFormat,
	type ParsedKeyInfo,
	parseInputBytes,
	type RsaPadding,
	type RsaSignAlg,
	sign,
	verify,
} from '@/lib/services/rsa';
import { createToolOptionsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

type RsaTab = 'encrypt' | 'decrypt' | 'sign' | 'verify';

interface RsaPrefs {
	readonly activeTab: RsaTab;
	readonly padding: RsaPadding;
	readonly signAlg: RsaSignAlg;
	readonly outputFormat: OutputFormat;
	readonly publicPem: string;
	readonly privatePem: string;
}

const DEFAULT_PREFS: RsaPrefs = {
	activeTab: 'encrypt',
	padding: 'oaep-sha256',
	signAlg: 'pss-sha256',
	outputFormat: 'base64',
	publicPem: '',
	privatePem: '',
};

const useRsaPrefs = createToolOptionsStore<RsaPrefs>('rsa-tools', DEFAULT_PREFS);

const TABS = [
	{ id: 'encrypt' as const, label: 'Encrypt', icon: Lock },
	{ id: 'decrypt' as const, label: 'Decrypt', icon: KeyRound },
	{ id: 'sign' as const, label: 'Sign', icon: Pencil },
	{ id: 'verify' as const, label: 'Verify', icon: ShieldCheck },
] as const;

const PADDING_OPTIONS: readonly SelectOption[] = [
	{ value: 'oaep-sha1', label: 'OAEP / SHA-1' },
	{ value: 'oaep-sha256', label: 'OAEP / SHA-256' },
	{ value: 'oaep-sha384', label: 'OAEP / SHA-384' },
	{ value: 'oaep-sha512', label: 'OAEP / SHA-512' },
];

const SIGN_OPTIONS: readonly SelectOption[] = [
	{ value: 'pss-sha256', label: 'RSASSA-PSS / SHA-256' },
	{ value: 'pss-sha384', label: 'RSASSA-PSS / SHA-384' },
	{ value: 'pss-sha512', label: 'RSASSA-PSS / SHA-512' },
	{ value: 'pkcs1-sha256', label: 'RSASSA-PKCS1-v1_5 / SHA-256' },
	{ value: 'pkcs1-sha384', label: 'RSASSA-PKCS1-v1_5 / SHA-384' },
	{ value: 'pkcs1-sha512', label: 'RSASSA-PKCS1-v1_5 / SHA-512' },
];

const OUTPUT_OPTIONS: readonly SelectOption[] = [
	{ value: 'base64', label: 'Base64' },
	{ value: 'hex', label: 'Hex' },
	{ value: 'data-uri', label: 'data: URI' },
];

const isRsaTab = (value: string): value is RsaTab =>
	value === 'encrypt' || value === 'decrypt' || value === 'sign' || value === 'verify';

const isRsaPadding = (value: string): value is RsaPadding =>
	value === 'oaep-sha1' ||
	value === 'oaep-sha256' ||
	value === 'oaep-sha384' ||
	value === 'oaep-sha512';

const isRsaSignAlg = (value: string): value is RsaSignAlg =>
	value === 'pss-sha256' ||
	value === 'pss-sha384' ||
	value === 'pss-sha512' ||
	value === 'pkcs1-sha256' ||
	value === 'pkcs1-sha384' ||
	value === 'pkcs1-sha512';

const isOutputFormat = (value: string): value is OutputFormat =>
	value === 'base64' || value === 'hex' || value === 'data-uri';

const getErrorMessage = (e: unknown, fallback = 'Unknown error'): string => {
	if (e instanceof Error) return e.message;
	if (typeof e === 'string') return e;
	return fallback;
};

const readTextFile = (file: File): Promise<string> =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
		reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
		reader.readAsText(file);
	});

// Pick the relevant PEM and importer for the active tab, then parse it. Lives
// outside the component to keep the auto-parse effect's complexity manageable.
const resolveKeyInfo = async (tab: RsaTab, prefs: RsaPrefs): Promise<ParsedKeyInfo | null> => {
	const isPublic = tab === 'encrypt' || tab === 'verify';
	const pem = isPublic ? prefs.publicPem : prefs.privatePem;
	if (!pem.trim()) return null;
	const importer = (() => {
		if (tab === 'encrypt') return importPublicKey(pem, prefs.padding);
		if (tab === 'verify') return importVerifyKey(pem, prefs.signAlg);
		if (tab === 'decrypt') return importPrivateKey(pem, prefs.padding);
		return importSignKey(pem, prefs.signAlg);
	})();
	const result = await importer;
	return result.ok ? result.info : null;
};

export const Route = createFileRoute('/rsa-tools')({
	component: RsaToolsPage,
});

function RsaToolsPage() {
	useDocumentTitle('RSA Toolkit');
	const router = useRouter();

	const { value: prefs, patch } = useRsaPrefs();

	const [plaintext, setPlaintext] = useState('');
	const [ciphertext, setCiphertext] = useState('');
	const [message, setMessage] = useState('');
	const [signature, setSignature] = useState('');
	const [output, setOutput] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
	const [keyInfo, setKeyInfo] = useState<ParsedKeyInfo | null>(null);
	const [busy, setBusy] = useState(false);

	const activeTab = prefs.activeTab;

	// Auto-parse the relevant key for the active tab so the key-info panel
	// reflects whichever PEM the user is actively working with.
	useEffect(() => {
		let cancelled = false;
		resolveKeyInfo(activeTab, prefs).then((info) => {
			if (!cancelled) setKeyInfo(info);
		});
		return () => {
			cancelled = true;
		};
	}, [activeTab, prefs]);

	// Reset transient outputs when switching tabs so users see a clean slate.
	useEffect(() => {
		setOutput('');
		setError(null);
		setVerifyResult(null);
	}, [activeTab]);

	const handleTabChange = (tab: string) => {
		if (isRsaTab(tab)) patch({ activeTab: tab });
	};

	const handleGenerateKeypair = async () => {
		try {
			const { publicPem, privatePem } = await generateSampleKeypair();
			patch({ publicPem, privatePem });
			toast.success('Generated fresh 2048-bit RSA keypair.');
		} catch (e) {
			toast.error('Failed to generate keypair', { description: getErrorMessage(e) });
		}
	};

	const handleClearKeys = () => {
		patch({ publicPem: '', privatePem: '' });
	};

	const handleOpenSshGenerator = () => {
		router.navigate({ to: '/ssh-key-generator' });
	};

	const handleOpenGpgGenerator = () => {
		router.navigate({ to: '/gpg-key-generator' });
	};

	const handleEncrypt = async () => {
		setBusy(true);
		setError(null);
		try {
			const imported = await importPublicKey(prefs.publicPem, prefs.padding);
			if (!imported.ok) throw new Error(imported.error);
			const bytes = await encrypt(imported.key, plaintext);
			setOutput(formatOutput(bytes, prefs.outputFormat));
		} catch (e) {
			setError(getErrorMessage(e));
			setOutput('');
		} finally {
			setBusy(false);
		}
	};

	const handleDecrypt = async () => {
		setBusy(true);
		setError(null);
		try {
			const imported = await importPrivateKey(prefs.privatePem, prefs.padding);
			if (!imported.ok) throw new Error(imported.error);
			const bytes = parseInputBytes(ciphertext, 'auto');
			const plain = await decrypt(imported.key, bytes);
			setOutput(plain);
		} catch (e) {
			setError(getErrorMessage(e));
			setOutput('');
		} finally {
			setBusy(false);
		}
	};

	const handleSign = async () => {
		setBusy(true);
		setError(null);
		try {
			const imported = await importSignKey(prefs.privatePem, prefs.signAlg);
			if (!imported.ok) throw new Error(imported.error);
			const bytes = await sign(imported.key, message, prefs.signAlg);
			setOutput(formatOutput(bytes, prefs.outputFormat));
		} catch (e) {
			setError(getErrorMessage(e));
			setOutput('');
		} finally {
			setBusy(false);
		}
	};

	const handleVerify = async () => {
		setBusy(true);
		setError(null);
		setVerifyResult(null);
		try {
			const imported = await importVerifyKey(prefs.publicPem, prefs.signAlg);
			if (!imported.ok) throw new Error(imported.error);
			const sigBytes = parseInputBytes(signature, 'auto');
			const ok = await verify(imported.key, message, sigBytes, prefs.signAlg);
			setVerifyResult(ok);
		} catch (e) {
			setError(getErrorMessage(e));
			setVerifyResult(false);
		} finally {
			setBusy(false);
		}
	};

	const ALGO_LABEL = useMemo(() => {
		if (activeTab === 'encrypt' || activeTab === 'decrypt') {
			return PADDING_OPTIONS.find((o) => o.value === prefs.padding)?.label ?? prefs.padding;
		}
		return SIGN_OPTIONS.find((o) => o.value === prefs.signAlg)?.label ?? prefs.signAlg;
	}, [activeTab, prefs.padding, prefs.signAlg]);

	const statusContent = (
		<>
			<StatItem label="Algorithm" value={ALGO_LABEL} />
			<StatItem label="Key" value={keyInfo ? `${keyInfo.bitLength} bit` : '—'} />
			{activeTab === 'verify' && verifyResult !== null ? (
				<StatItem
					label="Result"
					value={verifyResult ? 'Valid' : 'Invalid'}
					variant={verifyResult ? 'success' : 'error'}
				/>
			) : null}
		</>
	);

	const rail = (
		<>
			<FormSection title="Key info">
				<KeyInfoPanel info={keyInfo} />
			</FormSection>

			<FormSection title="Algorithm">
				{activeTab === 'encrypt' || activeTab === 'decrypt' ? (
					<FormSelect
						label="Padding"
						value={prefs.padding}
						options={PADDING_OPTIONS}
						onValueChange={(v) => {
							if (isRsaPadding(v)) patch({ padding: v });
						}}
					/>
				) : (
					<FormSelect
						label="Signature"
						value={prefs.signAlg}
						options={SIGN_OPTIONS}
						onValueChange={(v) => {
							if (isRsaSignAlg(v)) patch({ signAlg: v });
						}}
					/>
				)}
			</FormSection>

			{activeTab === 'encrypt' || activeTab === 'sign' ? (
				<FormSection title="Output">
					<FormSelect
						label="Format"
						value={prefs.outputFormat}
						options={OUTPUT_OPTIONS}
						onValueChange={(v) => {
							if (isOutputFormat(v)) patch({ outputFormat: v });
						}}
					/>
				</FormSection>
			) : null}

			<FormSection title="Samples">
				<div className="flex flex-col gap-2">
					<Button variant="outline" size="sm" onClick={handleGenerateKeypair}>
						<FlaskConical className="h-3.5 w-3.5" />
						Generate sample keypair
					</Button>
					<Button variant="outline" size="sm" onClick={handleClearKeys}>
						<Trash2 className="h-3.5 w-3.5" />
						Clear keys
					</Button>
					<Button variant="outline" size="sm" onClick={handleOpenSshGenerator}>
						<KeyRound className="h-3.5 w-3.5" />
						Open SSH Key Generator
					</Button>
					<Button variant="outline" size="sm" onClick={handleOpenGpgGenerator}>
						<KeySquare className="h-3.5 w-3.5" />
						Open GPG Key Generator
					</Button>
				</div>
			</FormSection>

			<FormSection title="About">
				<FormInfo>
					All processing happens in your browser. Keys never leave the device. PKCS#1 v1.5
					encryption is not exposed by Web Crypto — use OAEP. Legacy{' '}
					<code className="font-mono">RSA PRIVATE KEY</code> (PKCS#1) PEMs are wrapped into PKCS#8
					automatically.
				</FormInfo>
			</FormSection>
		</>
	);

	const renderTabContent = (tab: string): ReactNode => {
		if (tab === 'encrypt') {
			return (
				<EncryptTab
					publicPem={prefs.publicPem}
					onPublicPemChange={(v) => patch({ publicPem: v })}
					plaintext={plaintext}
					onPlaintextChange={setPlaintext}
					output={output}
					error={error}
					busy={busy}
					onRun={handleEncrypt}
				/>
			);
		}
		if (tab === 'decrypt') {
			return (
				<DecryptTab
					privatePem={prefs.privatePem}
					onPrivatePemChange={(v) => patch({ privatePem: v })}
					ciphertext={ciphertext}
					onCiphertextChange={setCiphertext}
					output={output}
					error={error}
					busy={busy}
					onRun={handleDecrypt}
				/>
			);
		}
		if (tab === 'sign') {
			return (
				<SignTab
					privatePem={prefs.privatePem}
					onPrivatePemChange={(v) => patch({ privatePem: v })}
					message={message}
					onMessageChange={setMessage}
					output={output}
					error={error}
					busy={busy}
					onRun={handleSign}
				/>
			);
		}
		return (
			<VerifyTab
				publicPem={prefs.publicPem}
				onPublicPemChange={(v) => patch({ publicPem: v })}
				message={message}
				onMessageChange={setMessage}
				signature={signature}
				onSignatureChange={setSignature}
				result={verifyResult}
				error={error}
				busy={busy}
				onRun={handleVerify}
			/>
		);
	};

	return (
		<ToolShell
			layout="tabbed"
			tabs={TABS}
			activeTab={activeTab}
			onTabChange={handleTabChange}
			rail={rail}
			statusContent={statusContent}
			renderTabContent={renderTabContent}
			valid={activeTab === 'verify' ? verifyResult : error ? false : null}
			error={error ?? undefined}
		/>
	);
}

interface KeyInfoPanelProps {
	readonly info: ParsedKeyInfo | null;
}

function KeyInfoPanel({ info }: KeyInfoPanelProps) {
	if (!info) {
		return (
			<p className="text-xs text-muted-foreground">Paste a key on the right to see its details.</p>
		);
	}
	const fingerprintShort = info.fingerprint.replace(/:/g, '').slice(0, 16);
	return (
		<dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 text-xs">
			<dt className="font-mono text-muted-foreground">Algorithm</dt>
			<dd className="font-mono">{info.algorithm}</dd>
			<dt className="font-mono text-muted-foreground">Type</dt>
			<dd className="font-mono">{info.type}</dd>
			<dt className="font-mono text-muted-foreground">Bit length</dt>
			<dd className="font-mono tabular-nums">{info.bitLength}</dd>
			<dt className="font-mono text-muted-foreground">Format</dt>
			<dd className="font-mono uppercase">{info.format}</dd>
			<dt className="font-mono text-muted-foreground">SHA-256</dt>
			<dd className="break-all font-mono">{fingerprintShort}…</dd>
		</dl>
	);
}

interface DropTextareaProps {
	readonly label: string;
	readonly value: string;
	readonly placeholder: string;
	readonly rows?: number;
	readonly onValueChange: (value: string) => void;
}

function DropTextarea({ label, value, placeholder, rows = 8, onValueChange }: DropTextareaProps) {
	const [isDragOver, setIsDragOver] = useState(false);

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
		const file = e.dataTransfer.files[0];
		if (!file) return;
		readTextFile(file)
			.then(onValueChange)
			.catch((err) => toast.error('Failed to read file', { description: getErrorMessage(err) }));
	};

	const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(true);
	};

	const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
	};

	return (
		<section
			aria-label={`${label} drop zone`}
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			className={cn(
				'rounded-md border-2 border-dashed border-border/60 p-2 transition-colors',
				isDragOver && 'border-primary bg-primary/5'
			)}
		>
			<FormTextarea
				label={label}
				value={value}
				onValueChange={onValueChange}
				placeholder={placeholder}
				rows={rows}
				className="font-mono text-xs"
			/>
		</section>
	);
}

interface EncryptTabProps {
	readonly publicPem: string;
	readonly onPublicPemChange: (value: string) => void;
	readonly plaintext: string;
	readonly onPlaintextChange: (value: string) => void;
	readonly output: string;
	readonly error: string | null;
	readonly busy: boolean;
	readonly onRun: () => void;
}

function EncryptTab({
	publicPem,
	onPublicPemChange,
	plaintext,
	onPlaintextChange,
	output,
	error,
	busy,
	onRun,
}: EncryptTabProps) {
	return (
		<TwoPaneLayout
			leftTitle="Public key (PEM)"
			leftIcon={KeyRound}
			rightTitle="Plaintext"
			rightIcon={Sparkles}
			leftBody={
				<DropTextarea
					label="Public key PEM"
					value={publicPem}
					onValueChange={onPublicPemChange}
					placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
				/>
			}
			rightBody={
				<>
					<FormTextarea
						label="Plaintext"
						value={plaintext}
						onValueChange={onPlaintextChange}
						placeholder="Text to encrypt"
						rows={5}
					/>
					<Button onClick={onRun} disabled={busy || !publicPem || !plaintext} className="w-full">
						<Lock className="h-3.5 w-3.5" />
						Encrypt
					</Button>
					<OutputBlock label="Ciphertext" value={output} error={error} icon={Lock} />
				</>
			}
		/>
	);
}

interface DecryptTabProps {
	readonly privatePem: string;
	readonly onPrivatePemChange: (value: string) => void;
	readonly ciphertext: string;
	readonly onCiphertextChange: (value: string) => void;
	readonly output: string;
	readonly error: string | null;
	readonly busy: boolean;
	readonly onRun: () => void;
}

function DecryptTab({
	privatePem,
	onPrivatePemChange,
	ciphertext,
	onCiphertextChange,
	output,
	error,
	busy,
	onRun,
}: DecryptTabProps) {
	return (
		<TwoPaneLayout
			leftTitle="Private key (PEM)"
			leftIcon={KeyRound}
			rightTitle="Ciphertext"
			rightIcon={Lock}
			leftBody={
				<DropTextarea
					label="Private key PEM"
					value={privatePem}
					onValueChange={onPrivatePemChange}
					placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
				/>
			}
			rightBody={
				<>
					<FormTextarea
						label="Ciphertext (base64, hex, or data: URI)"
						value={ciphertext}
						onValueChange={onCiphertextChange}
						placeholder="Paste ciphertext"
						rows={5}
						className="font-mono text-xs"
					/>
					<Button onClick={onRun} disabled={busy || !privatePem || !ciphertext} className="w-full">
						<KeyRound className="h-3.5 w-3.5" />
						Decrypt
					</Button>
					<OutputBlock label="Plaintext" value={output} error={error} icon={Sparkles} />
				</>
			}
		/>
	);
}

interface SignTabProps {
	readonly privatePem: string;
	readonly onPrivatePemChange: (value: string) => void;
	readonly message: string;
	readonly onMessageChange: (value: string) => void;
	readonly output: string;
	readonly error: string | null;
	readonly busy: boolean;
	readonly onRun: () => void;
}

function SignTab({
	privatePem,
	onPrivatePemChange,
	message,
	onMessageChange,
	output,
	error,
	busy,
	onRun,
}: SignTabProps) {
	return (
		<TwoPaneLayout
			leftTitle="Private key (PEM)"
			leftIcon={KeyRound}
			rightTitle="Message"
			rightIcon={Pencil}
			leftBody={
				<DropTextarea
					label="Private key PEM"
					value={privatePem}
					onValueChange={onPrivatePemChange}
					placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
				/>
			}
			rightBody={
				<>
					<FormTextarea
						label="Message"
						value={message}
						onValueChange={onMessageChange}
						placeholder="Text to sign"
						rows={5}
					/>
					<Button onClick={onRun} disabled={busy || !privatePem || !message} className="w-full">
						<Pencil className="h-3.5 w-3.5" />
						Sign
					</Button>
					<OutputBlock label="Signature" value={output} error={error} icon={ShieldCheck} />
				</>
			}
		/>
	);
}

interface VerifyTabProps {
	readonly publicPem: string;
	readonly onPublicPemChange: (value: string) => void;
	readonly message: string;
	readonly onMessageChange: (value: string) => void;
	readonly signature: string;
	readonly onSignatureChange: (value: string) => void;
	readonly result: boolean | null;
	readonly error: string | null;
	readonly busy: boolean;
	readonly onRun: () => void;
}

function VerifyTab({
	publicPem,
	onPublicPemChange,
	message,
	onMessageChange,
	signature,
	onSignatureChange,
	result,
	error,
	busy,
	onRun,
}: VerifyTabProps) {
	return (
		<TwoPaneLayout
			leftTitle="Public key (PEM)"
			leftIcon={KeyRound}
			rightTitle="Verify"
			rightIcon={ShieldCheck}
			leftBody={
				<DropTextarea
					label="Public key PEM"
					value={publicPem}
					onValueChange={onPublicPemChange}
					placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
				/>
			}
			rightBody={
				<>
					<FormTextarea
						label="Message"
						value={message}
						onValueChange={onMessageChange}
						placeholder="Original message"
						rows={4}
					/>
					<FormTextarea
						label="Signature (base64, hex, or data: URI)"
						value={signature}
						onValueChange={onSignatureChange}
						placeholder="Paste signature"
						rows={4}
						className="font-mono text-xs"
					/>
					<Button
						onClick={onRun}
						disabled={busy || !publicPem || !message || !signature}
						className="w-full"
					>
						<ShieldCheck className="h-3.5 w-3.5" />
						Verify
					</Button>
					<VerifyResultBadge result={result} error={error} />
				</>
			}
		/>
	);
}

interface VerifyResultBadgeProps {
	readonly result: boolean | null;
	readonly error: string | null;
}

function VerifyResultBadge({ result, error }: VerifyResultBadgeProps) {
	if (error) {
		return (
			<div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
				<div className="flex items-center gap-2 text-destructive">
					<XCircle className="h-5 w-5" />
					<span className="text-sm font-medium">Error</span>
				</div>
				<p className="mt-1.5 break-words text-xs text-muted-foreground">{error}</p>
			</div>
		);
	}
	if (result === null) {
		return (
			<EmbeddedEmptyState
				icon={ShieldCheck}
				title="No verification yet"
				description="Provide a key, message and signature, then press Verify."
			/>
		);
	}
	if (result) {
		return (
			<div className="rounded-md border border-success/30 bg-success/5 p-4">
				<div className="flex items-center gap-2 text-success">
					<CheckCircle2 className="h-5 w-5" />
					<span className="text-sm font-medium">Valid signature</span>
				</div>
				<p className="mt-1.5 text-xs text-muted-foreground">
					The signature is authentic for the given message and key.
				</p>
			</div>
		);
	}
	return (
		<div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
			<div className="flex items-center gap-2 text-destructive">
				<XCircle className="h-5 w-5" />
				<span className="text-sm font-medium">Invalid signature</span>
			</div>
			<p className="mt-1.5 text-xs text-muted-foreground">
				The signature does not match the message under this key.
			</p>
		</div>
	);
}

interface OutputBlockProps {
	readonly label: string;
	readonly value: string;
	readonly error: string | null;
	readonly icon: typeof Lock;
}

function OutputBlock({ label, value, error, icon: Icon }: OutputBlockProps) {
	if (error) {
		return (
			<div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
				<div className="flex items-center gap-2 text-destructive">
					<XCircle className="h-4 w-4" />
					<span className="text-xs font-medium">Error</span>
				</div>
				<p className="mt-1 break-words text-xs text-muted-foreground">{error}</p>
			</div>
		);
	}
	if (!value) {
		return (
			<EmbeddedEmptyState
				icon={Icon}
				title={`No ${label.toLowerCase()} yet`}
				description="Fill the inputs and press the action button."
			/>
		);
	}
	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{label}
				</span>
				<div className="flex items-center gap-1.5">
					<Badge variant="outline" className="font-mono text-2xs">
						{value.length} ch
					</Badge>
					<CopyButton text={value} toastLabel={label} size="sm" />
				</div>
			</div>
			<code className="block max-h-64 overflow-auto break-all rounded-md border bg-muted p-3 font-mono text-2xs">
				{value}
			</code>
		</div>
	);
}

interface TwoPaneLayoutProps {
	readonly leftTitle: string;
	readonly leftIcon: typeof Lock;
	readonly rightTitle: string;
	readonly rightIcon: typeof Lock;
	readonly leftBody: ReactNode;
	readonly rightBody: ReactNode;
}

function TwoPaneLayout({
	leftTitle,
	leftIcon: LeftIcon,
	rightTitle,
	rightIcon: RightIcon,
	leftBody,
	rightBody,
}: TwoPaneLayoutProps) {
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex-1 overflow-auto p-4">
				<div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
					<Card density="compact">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-sm font-medium">
								<LeftIcon className="h-4 w-4 text-muted-foreground" />
								{leftTitle}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">{leftBody}</CardContent>
					</Card>
					<Card density="compact">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-sm font-medium">
								<RightIcon className="h-4 w-4 text-muted-foreground" />
								{rightTitle}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">{rightBody}</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
