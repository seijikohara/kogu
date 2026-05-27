import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Key, Lock, Terminal, Unlock, User } from 'lucide-react';
import { toast } from 'sonner';

import { ActionButton, CopyButton } from '@/lib/components/action';
import { getErrorMessage } from '@/lib/utils';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormError,
	FormInfo,
	FormInput,
	FormSection,
	FormSelect,
} from '@/lib/components/form';
import { SectionHeader } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import {
	EmptyState,
	ErrorDisplay,
	LiveStatusRegion,
	LoadingOverlay,
	StatItem,
} from '@/lib/components/status';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { CodeBlock } from '@/lib/components/ui/code-block';
import { useDocumentTitle } from '@/lib/hooks';
import {
	buildGpgUserId,
	cancelWorkerOperation,
	checkCliAvailability,
	type CliAvailability,
	type GenerationMethod,
	GPG_ALGORITHMS,
	type GpgKeyAlgorithm,
	type GpgKeyResult,
	generateGpgKeyPair,
	isValidEmail,
} from '@/lib/services/generators';

const formatElapsedTime = (ms: number): string =>
	ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;

export const Route = createFileRoute('/gpg-key-generator')({
	component: GpgKeyGeneratorPage,
});

function GpgKeyGeneratorPage() {
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [comment, setComment] = useState('');
	const [algorithm, setAlgorithm] = useState<GpgKeyAlgorithm>('rsa4096');
	const [passphrase, setPassphrase] = useState('');
	const [method, setMethod] = useState<GenerationMethod>('library');

	const [keyResult, setKeyResult] = useState<GpgKeyResult | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [flashCounter, setFlashCounter] = useState(0);
	const isCancelledRef = useRef(false);

	const [cliAvailability, setCliAvailability] = useState<CliAvailability | null>(null);

	const [showOptions, setShowOptions] = useState(true);
	const [showKeyInfo, setShowKeyInfo] = useState(true);
	const [showGpgCommands, setShowGpgCommands] = useState(true);

	const [elapsedMs, setElapsedMs] = useState(0);
	const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useDocumentTitle('GPG Key Generator');

	useEffect(() => {
		checkCliAvailability()
			.then(setCliAvailability)
			.catch(() => setCliAvailability({ ssh_keygen: false, gpg: false }));
	}, []);

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

	const userIdPreview = buildGpgUserId(name, email, comment);
	const canGenerate = name.trim().length > 0 && isValidEmail(email);
	const gpgAvailable = cliAvailability?.gpg ?? false;
	const elapsedTimeDisplay = formatElapsedTime(elapsedMs);

	const handleGenerate = async () => {
		if (!canGenerate) return;
		setIsGenerating(true);
		isCancelledRef.current = false;
		setError(null);
		setKeyResult(null);
		startTimer();

		try {
			const result = await generateGpgKeyPair({
				name: name.trim(),
				email: email.trim(),
				comment: comment.trim() || undefined,
				algorithm,
				passphrase: passphrase || undefined,
				method,
			});
			if (!isCancelledRef.current) {
				setKeyResult(result);
				setFlashCounter((c) => c + 1);
				toast.success('GPG key pair generated successfully');
			}
		} catch (e) {
			if (!isCancelledRef.current) {
				const message = getErrorMessage(e);
				setError(message);
				toast.error('Failed to generate GPG key', { description: message });
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

	return (
		<ToolShell
			valid={keyResult ? true : null}
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			primaryAction={{ run: handleGenerate, canRun: canGenerate && !isGenerating }}
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
					<FormSection title="Identity">
						<div className="space-y-2">
							<FormInput
								label="Name *"
								value={name}
								onValueChange={setName}
								placeholder="John Doe"
								hint="Your real name or identity"
								size="compact"
							/>
							<FormInput
								label="Email *"
								type="email"
								value={email}
								onValueChange={setEmail}
								placeholder="john@example.com"
								size="compact"
							/>
							{email && !isValidEmail(email) ? (
								<FormError message="Please enter a valid email address" />
							) : null}
							<FormInput
								label="Comment (optional)"
								value={comment}
								onValueChange={setComment}
								placeholder="Work key"
								size="compact"
							/>
						</div>
					</FormSection>

					{name || email ? (
						<FormSection title="User ID Preview">
							<Card density="compact" className="bg-muted/30">
								<CardContent className="p-3">
									<div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
										<User className="h-3 w-3" />
										Preview
									</div>
									<code className="text-xs">{userIdPreview}</code>
								</CardContent>
							</Card>
						</FormSection>
					) : null}

					<FormSection title="Algorithm">
						<FormSelect
							label="Type"
							value={algorithm}
							onValueChange={(v) => setAlgorithm(v as GpgKeyAlgorithm)}
							options={GPG_ALGORITHMS.map((a) => ({
								value: a.value,
								label: a.recommended ? `${a.label} (Recommended)` : a.label,
								description: a.description,
							}))}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Security">
						<FormInput
							label="Passphrase (optional)"
							type="password"
							showToggle
							value={passphrase}
							onValueChange={setPassphrase}
							placeholder="Enter passphrase..."
							hint="Recommended for key protection"
							size="compact"
						/>
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
									description: 'Bundled openpgp.js — no system install needed',
								},
								{
									value: 'cli',
									label: 'CLI',
									description: gpgAvailable ? 'Uses local gpg binary' : 'gpg not detected on PATH',
									disabled: !gpgAvailable,
								},
							]}
							size="compact"
						/>
						{cliAvailability?.gpg_version ? (
							<p className="mt-1 text-xs text-muted-foreground">{cliAvailability.gpg_version}</p>
						) : null}
					</FormSection>

					<FormSection title="Actions">
						<div className="space-y-2">
							<ActionButton
								label="Generate Key Pair"
								icon={Key}
								loading={isGenerating}
								loadingLabel="Generating..."
								disabled={!canGenerate}
								shortcutHint
								onClick={handleGenerate}
							/>
							{keyResult ? (
								<ActionButton label="Clear" variant="outline" onClick={handleClear} />
							) : null}
						</div>
					</FormSection>

					<FormSection title="Display">
						<div className="space-y-1">
							<FormCheckboxGroup>
								<FormCheckbox
									label="Show key information"
									checked={showKeyInfo}
									onCheckedChange={setShowKeyInfo}
									size="compact"
								/>
								<FormCheckbox
									label="Show GPG commands"
									checked={showGpgCommands}
									onCheckedChange={setShowGpgCommands}
									size="compact"
								/>
							</FormCheckboxGroup>
						</div>
					</FormSection>

					<FormSection title="About GPG Keys">
						<FormInfo>
							<ul className="list-inside list-disc space-y-0.5">
								<li>GPG keys enable encryption and digital signatures</li>
								<li>RSA: Wide compatibility, proven security</li>
								<li>ECDSA: Smaller keys, faster operations</li>
								<li>Passphrase protects private key at rest</li>
							</ul>
						</FormInfo>
					</FormSection>

					<FormSection title="Algorithm Comparison">
						<FormInfo showIcon={false}>
							<div className="space-y-0.5">
								<div className="flex justify-between">
									<span>RSA-2048:</span>
									<span>Minimum, legacy compatible</span>
								</div>
								<div className="flex justify-between">
									<span>RSA-3072:</span>
									<span>128-bit security</span>
								</div>
								<div className="flex justify-between">
									<span>RSA-4096:</span>
									<span>Maximum RSA security</span>
								</div>
								<div className="flex justify-between">
									<span>ECDSA P-256:</span>
									<span>128-bit, compact</span>
								</div>
								<div className="flex justify-between">
									<span>ECDSA P-384:</span>
									<span>192-bit, high security</span>
								</div>
							</div>
						</FormInfo>
					</FormSection>

					<FormSection title="User ID Format">
						<FormInfo showIcon={false}>
							<code className="block rounded bg-muted p-1.5 font-mono text-xs">
								{'Name (Comment) <email@example.com>'}
							</code>
							<p className="mt-1.5">The User ID identifies the key owner. Comment is optional.</p>
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="relative flex h-full flex-col overflow-hidden">
				<LoadingOverlay
					show={isGenerating}
					title="Generating GPG Key..."
					message="Key generation in progress"
					elapsedTime={elapsedTimeDisplay}
					onCancel={handleCancel}
				/>
				<SectionHeader title="Generated Keys" />

				<LiveStatusRegion className="flex-1 overflow-auto p-4">
					{keyResult ? (
						<div key={flashCounter} className="animate-flash-success space-y-4 rounded-md">
							{showKeyInfo ? (
								<Card density="compact">
									<CardHeader className="pb-3">
										<div className="flex items-center gap-2">
											<User className="h-4 w-4 text-muted-foreground" />
											<CardTitle className="text-sm font-medium">Key Information</CardTitle>
										</div>
									</CardHeader>
									<CardContent>
										<div className="space-y-2">
											<div className="flex items-start justify-between">
												<span className="text-xs text-muted-foreground">User ID</span>
												<code className="text-xs">{keyResult.user_id}</code>
											</div>
											<div className="flex items-start justify-between">
												<span className="text-xs text-muted-foreground">Fingerprint</span>
												<div className="flex items-center gap-2">
													<code className="text-xs">{keyResult.fingerprint}</code>
													<CopyButton
														text={keyResult.fingerprint}
														toastLabel="Fingerprint"
														size="icon"
														className="h-6 w-6"
													/>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							) : null}

							<Card density="compact">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
									<div className="flex items-center gap-2">
										<Unlock className="h-4 w-4 text-success" />
										<CardTitle className="text-sm font-medium">Public Key (PGP Armor)</CardTitle>
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
									<CodeBlock as="pre" maxHeight="md" wrap>
										{keyResult.public_key}
									</CodeBlock>
									<p className="mt-2 text-xs text-muted-foreground">
										Share this key with others so they can encrypt messages to you
									</p>
								</CardContent>
							</Card>

							<Card density="compact" variant="warning">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
									<div className="flex items-center gap-2">
										<Lock className="h-4 w-4 text-warning" />
										<CardTitle className="text-sm font-medium">Private Key (PGP Armor)</CardTitle>
										<span className="text-xs text-warning">(Keep Secret!)</span>
									</div>
									<CopyButton
										text={keyResult.private_key}
										toastLabel="Private key"
										size="sm"
										showLabel
										className="h-7"
									/>
								</CardHeader>
								<CardContent>
									<CodeBlock as="pre" maxHeight="md" wrap>
										{keyResult.private_key}
									</CodeBlock>
									<p className="mt-2 text-xs text-warning">
										Never share this key. Import with: <code>gpg --import private-key.asc</code>
									</p>
								</CardContent>
							</Card>

							{showGpgCommands ? (
								<Card density="compact">
									<CardHeader className="pb-3">
										<div className="flex items-center gap-2">
											<Terminal className="h-4 w-4 text-muted-foreground" />
											<CardTitle className="text-sm font-medium">Equivalent GPG Commands</CardTitle>
										</div>
									</CardHeader>
									<CardContent>
										<div className="space-y-3">
											<div>
												<div className="mb-1 flex items-center justify-between">
													<span className="text-xs text-muted-foreground">Interactive</span>
													<CopyButton
														text={keyResult.gpg_command_interactive}
														toastLabel="Command"
														size="icon"
														className="h-6 w-6"
													/>
												</div>
												<CodeBlock>{keyResult.gpg_command_interactive}</CodeBlock>
											</div>

											<div>
												<div className="mb-1 flex items-center justify-between">
													<span className="text-xs text-muted-foreground">Batch Mode</span>
													<CopyButton
														text={keyResult.gpg_command_batch}
														toastLabel="Command"
														size="icon"
														className="h-6 w-6"
													/>
												</div>
												<CodeBlock as="pre" maxHeight="sm" wrap>
													{keyResult.gpg_command_batch}
												</CodeBlock>
											</div>
										</div>
									</CardContent>
								</Card>
							) : null}
						</div>
					) : error ? (
						<ErrorDisplay variant="centered" message={error} />
					) : (
						<EmptyState
							icon={Key}
							title="Enter your details and generate a GPG key pair"
							description="Name and email are required"
						/>
					)}
				</LiveStatusRegion>
			</div>
		</ToolShell>
	);
}
