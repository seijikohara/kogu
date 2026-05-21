import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Key, Lock, Terminal, Unlock } from 'lucide-react';
import { toast } from 'sonner';

import { ActionButton, CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormInput,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { SectionHeader } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmptyState, ErrorDisplay, LoadingOverlay, StatItem } from '@/lib/components/status';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import {
	cancelWorkerOperation,
	checkCliAvailability,
	type CliAvailability,
	type GenerationMethod,
	generateSshKeyPair,
	SSH_ALGORITHMS,
	type SshKeyAlgorithm,
	type SshKeyResult,
} from '@/lib/services/generators';

const formatElapsedTime = (ms: number): string =>
	ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;

const ALG_DESCRIPTIONS: Record<SshKeyAlgorithm, string> = {
	ed25519: 'Modern, fast, and secure. Best choice for most use cases.',
	ecdsa_p256: 'Good security with NIST P-256 curve. Widely supported.',
	ecdsa_p384: 'Higher security with NIST P-384 curve.',
	rsa2048: 'Legacy compatibility. Minimum recommended RSA size.',
	rsa3072: 'Better security than RSA-2048. Good for long-term use.',
	rsa4096: 'Maximum RSA security. Slower key generation.',
};

export const Route = createFileRoute('/ssh-key-generator')({
	component: SshKeyGeneratorPage,
});

function SshKeyGeneratorPage() {
	const [algorithm, setAlgorithm] = useState<SshKeyAlgorithm>('ed25519');
	const [comment, setComment] = useState('');
	const [passphrase, setPassphrase] = useState('');
	const [method, setMethod] = useState<GenerationMethod>('library');

	const [keyResult, setKeyResult] = useState<SshKeyResult | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [flashCounter, setFlashCounter] = useState(0);

	const [cliAvailability, setCliAvailability] = useState<CliAvailability | null>(null);
	const [elapsedMs, setElapsedMs] = useState(0);
	const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const isCancelledRef = useRef(false);

	const [showOptions, setShowOptions] = useState(true);
	const [showFingerprint, setShowFingerprint] = useState(true);
	const [showEquivalentCommand, setShowEquivalentCommand] = useState(true);

	useEffect(() => {
		document.title = 'SSH Key Generator — Kogu';
	}, []);

	useEffect(() => {
		checkCliAvailability()
			.then(setCliAvailability)
			.catch(() => setCliAvailability({ ssh_keygen: false, gpg: false }));
	}, []);

	const sshKeygenAvailable = cliAvailability?.ssh_keygen ?? false;
	const algorithmDescription = ALG_DESCRIPTIONS[algorithm] ?? '';
	const elapsedTimeDisplay = formatElapsedTime(elapsedMs);

	const startTimer = () => {
		setElapsedMs(0);
		timerIntervalRef.current = setInterval(() => {
			setElapsedMs((prev) => prev + 100);
		}, 100);
	};

	const stopTimer = () => {
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
			timerIntervalRef.current = null;
		}
	};

	const handleGenerate = async () => {
		setIsGenerating(true);
		isCancelledRef.current = false;
		setError(null);
		setKeyResult(null);
		startTimer();

		try {
			const result = await generateSshKeyPair({
				algorithm,
				comment: comment.trim() || undefined,
				passphrase: passphrase || undefined,
				method,
			});
			if (!isCancelledRef.current) {
				setKeyResult(result);
				setFlashCounter((c) => c + 1);
				toast.success('SSH key pair generated successfully');
			}
		} catch (e) {
			if (!isCancelledRef.current) {
				const message = e instanceof Error ? e.message : String(e);
				setError(message);
				toast.error('Failed to generate SSH key', { description: message });
			}
		} finally {
			stopTimer();
			setIsGenerating(false);
		}
	};

	const handleCancel = async () => {
		isCancelledRef.current = true;
		await cancelWorkerOperation();
		stopTimer();
		setIsGenerating(false);
		toast.info('Key generation cancelled');
	};

	const handleClear = () => {
		setKeyResult(null);
		setError(null);
	};

	const privateKeyFile =
		algorithm === 'ed25519' ? 'id_ed25519' : algorithm.startsWith('ecdsa') ? 'id_ecdsa' : 'id_rsa';

	return (
		<ToolShell
			valid={keyResult ? true : null}
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			statusContent={
				keyResult ? (
					<>
						<StatItem label="Algorithm" value={keyResult.algorithm} />
						<StatItem label="Method" value={keyResult.method_used} />
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Algorithm">
						<FormSelect
							label="Type"
							value={algorithm}
							onValueChange={(v) => setAlgorithm(v as SshKeyAlgorithm)}
							options={SSH_ALGORITHMS.map((a) => ({
								value: a.value,
								label: a.recommended ? `${a.label} (Recommended)` : a.label,
								description: a.description,
							}))}
							size="compact"
						/>
						{algorithmDescription ? (
							<p className="mt-1 text-xs text-muted-foreground">{algorithmDescription}</p>
						) : null}
					</FormSection>

					<FormSection title="Key Details">
						<div className="space-y-2">
							<FormInput
								label="Comment (optional)"
								value={comment}
								onValueChange={setComment}
								placeholder="user@hostname or email"
								hint="Typically your email address or user@host"
								size="compact"
							/>
							<FormInput
								label="Passphrase (optional)"
								type="password"
								showToggle
								value={passphrase}
								onValueChange={setPassphrase}
								placeholder="Enter passphrase..."
								hint="Leave empty for no passphrase protection"
								size="compact"
							/>
						</div>
					</FormSection>

					<FormSection title="Generation Method">
						<FormSelect
							label="Method"
							value={method}
							onValueChange={(v) => setMethod(v as GenerationMethod)}
							options={[
								{
									value: 'library',
									label: 'Library',
									description: 'Bundled sshpk — no system install needed',
								},
								{
									value: 'cli',
									label: 'CLI',
									description: sshKeygenAvailable
										? 'Uses local ssh-keygen binary'
										: 'ssh-keygen not detected on PATH',
									disabled: !sshKeygenAvailable,
								},
							]}
							size="compact"
						/>
						{cliAvailability?.ssh_keygen_version ? (
							<p className="mt-1 text-xs text-muted-foreground">
								{cliAvailability.ssh_keygen_version}
							</p>
						) : null}
					</FormSection>

					<FormSection title="Actions">
						<div className="space-y-2">
							<ActionButton
								label="Generate Key Pair"
								icon={Key}
								loading={isGenerating}
								loadingLabel="Generating..."
								shortcut
								onClick={handleGenerate}
							/>
							{keyResult ? (
								<ActionButton label="Clear Result" variant="outline" onClick={handleClear} />
							) : null}
						</div>
					</FormSection>

					<FormSection title="Display">
						<div className="space-y-1">
							<FormCheckboxGroup>
								<FormCheckbox
									label="Show fingerprint"
									checked={showFingerprint}
									onCheckedChange={setShowFingerprint}
									size="compact"
								/>
								<FormCheckbox
									label="Show ssh-keygen command"
									checked={showEquivalentCommand}
									onCheckedChange={setShowEquivalentCommand}
									size="compact"
								/>
							</FormCheckboxGroup>
						</div>
					</FormSection>

					<FormSection title="About SSH Keys">
						<FormInfo>
							<ul className="list-inside list-disc space-y-0.5">
								<li>Ed25519: Modern, fast, compact (recommended)</li>
								<li>ECDSA: Good balance of security and compatibility</li>
								<li>RSA: Wide compatibility, larger key sizes</li>
								<li>Passphrase encrypts private key at rest</li>
							</ul>
						</FormInfo>
					</FormSection>

					<FormSection title="Algorithm Comparison">
						<FormInfo showIcon={false}>
							<div className="space-y-0.5">
								<div className="flex justify-between">
									<span>Ed25519:</span>
									<span>256-bit, fastest</span>
								</div>
								<div className="flex justify-between">
									<span>ECDSA P-256:</span>
									<span>256-bit, fast</span>
								</div>
								<div className="flex justify-between">
									<span>ECDSA P-384:</span>
									<span>384-bit, moderate</span>
								</div>
								<div className="flex justify-between">
									<span>RSA-2048:</span>
									<span>2048-bit, slower</span>
								</div>
								<div className="flex justify-between">
									<span>RSA-4096:</span>
									<span>4096-bit, slowest</span>
								</div>
							</div>
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="relative flex h-full flex-col overflow-hidden">
				<LoadingOverlay
					show={isGenerating}
					title="Generating SSH Key..."
					message="Key generation in progress"
					elapsedTime={elapsedTimeDisplay}
					onCancel={handleCancel}
				/>
				<SectionHeader title="Generated Keys" />

				<div className="flex-1 overflow-auto p-4">
					{keyResult ? (
						<div key={flashCounter} className="animate-flash-success space-y-4 rounded-md">
							{showFingerprint ? (
								<Card density="compact">
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
										<CardTitle className="text-sm font-medium">Fingerprint (SHA-256)</CardTitle>
										<CopyButton
											text={keyResult.fingerprint}
											toastLabel="Fingerprint"
											size="sm"
											showLabel
											className="h-7"
										/>
									</CardHeader>
									<CardContent>
										<code className="block rounded bg-muted p-2 font-mono text-sm">
											{keyResult.fingerprint}
										</code>
									</CardContent>
								</Card>
							) : null}

							<Card density="compact">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
									<div className="flex items-center gap-2">
										<Unlock className="h-4 w-4 text-success" />
										<CardTitle className="text-sm font-medium">Public Key</CardTitle>
									</div>
									<CopyButton
										text={keyResult.public_key}
										toastLabel="Public key"
										size="sm"
										showLabel
										className="h-7"
									/>
								</CardHeader>
								<CardContent>
									<pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-xs">
										{keyResult.public_key}
									</pre>
									<p className="mt-2 text-xs text-muted-foreground">
										Add this to <code>~/.ssh/authorized_keys</code> on remote servers
									</p>
								</CardContent>
							</Card>

							<div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
								<div className="mb-2 flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Lock className="h-4 w-4 text-warning" />
										<span className="text-sm font-medium">Private Key</span>
										<span className="text-xs text-warning">(Keep Secret!)</span>
									</div>
									<CopyButton
										text={keyResult.private_key}
										toastLabel="Private key"
										size="sm"
										showLabel
										className="h-7"
									/>
								</div>
								<pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-xs">
									{keyResult.private_key}
								</pre>
								<p className="mt-2 text-xs text-warning">
									Save this to <code>~/.ssh/{privateKeyFile}</code> with permissions 600
								</p>
							</div>

							{showEquivalentCommand ? (
								<Card density="compact">
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
										<div className="flex items-center gap-2">
											<Terminal className="h-4 w-4 text-muted-foreground" />
											<CardTitle className="text-sm font-medium">
												Equivalent ssh-keygen Command
											</CardTitle>
										</div>
										<CopyButton
											text={keyResult.ssh_keygen_command}
											toastLabel="Command"
											size="sm"
											showLabel
											className="h-7"
										/>
									</CardHeader>
									<CardContent>
										<code className="block rounded bg-muted p-2 font-mono text-xs">
											{keyResult.ssh_keygen_command}
										</code>
									</CardContent>
								</Card>
							) : null}
						</div>
					) : error ? (
						<ErrorDisplay variant="centered" message={error} />
					) : (
						<EmptyState icon={Key} title="Configure options and generate an SSH key pair" />
					)}
				</div>
			</div>
		</ToolShell>
	);
}
