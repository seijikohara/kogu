import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Check, Hash, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';

import { ActionButton, CopyButton } from '@/lib/components/action';
import { getErrorMessage } from '@/lib/utils';
import { FormInfo, FormInput, FormMode, FormSection, FormSlider } from '@/lib/components/form';
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
	type BcryptCostInfo,
	type BcryptHashResult,
	type BcryptVerifyResult,
	cancelWorkerOperation,
	DEFAULT_BCRYPT_COST,
	generateBcryptHash,
	getBcryptCostInfo,
	MAX_BCRYPT_COST,
	MIN_BCRYPT_COST,
	verifyBcryptHash,
} from '@/lib/services/generators';

type ActiveTab = 'generate' | 'verify';

const formatElapsedTime = (ms: number): string =>
	ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;

export const Route = createFileRoute('/bcrypt-generator')({
	component: BcryptGeneratorPage,
});

function BcryptGeneratorPage() {
	const [password, setPassword] = useState('');
	const [cost, setCost] = useState(DEFAULT_BCRYPT_COST);
	const [hashResult, setHashResult] = useState<BcryptHashResult | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [generateError, setGenerateError] = useState<string | null>(null);
	const generateCancelledRef = useRef(false);

	const [verifyPassword, setVerifyPassword] = useState('');
	const [verifyHash, setVerifyHash] = useState('');
	const [verifyResult, setVerifyResult] = useState<BcryptVerifyResult | null>(null);
	const [isVerifying, setIsVerifying] = useState(false);
	const [verifyError, setVerifyError] = useState<string | null>(null);
	const verifyCancelledRef = useRef(false);

	const [showOptions, setShowOptions] = useState(true);
	const [costInfo, setCostInfo] = useState<BcryptCostInfo | null>(null);
	const [activeTab, setActiveTab] = useState<ActiveTab>('generate');
	const [flashCounter, setFlashCounter] = useState(0);

	const [elapsedMs, setElapsedMs] = useState(0);
	const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useDocumentTitle('BCrypt Generator');

	useEffect(() => {
		getBcryptCostInfo(cost)
			.then(setCostInfo)
			.catch(() => setCostInfo(null));
	}, [cost]);

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

	const canGenerate = password.trim().length > 0;
	const canVerify = verifyPassword.trim().length > 0 && verifyHash.trim().length > 0;

	const estimatedTime = (() => {
		if (!costInfo) return 'Unknown';
		const ms = costInfo.estimated_time_ms;
		if (ms < 1000) return `~${Math.round(ms)}ms`;
		return `~${(ms / 1000).toFixed(1)}s`;
	})();

	const elapsedTimeDisplay = formatElapsedTime(elapsedMs);

	const handleGenerate = async () => {
		if (!canGenerate) return;
		setIsGenerating(true);
		generateCancelledRef.current = false;
		setGenerateError(null);
		setHashResult(null);
		startTimer();

		try {
			const result = await generateBcryptHash(password, cost);
			if (!generateCancelledRef.current) {
				setHashResult(result);
				setFlashCounter((c) => c + 1);
				toast.success('BCrypt hash generated successfully');
			}
		} catch (e) {
			if (!generateCancelledRef.current) {
				const message = getErrorMessage(e);
				setGenerateError(message);
				toast.error('Failed to generate hash', { description: message });
			}
		} finally {
			stopTimer();
			setIsGenerating(false);
		}
	};

	const handleCancelGenerate = async () => {
		generateCancelledRef.current = true;
		await cancelWorkerOperation();
		stopTimer();
		setIsGenerating(false);
		toast.info('Hash generation cancelled');
	};

	const handleVerify = async () => {
		if (!canVerify) return;
		setIsVerifying(true);
		verifyCancelledRef.current = false;
		setVerifyError(null);
		setVerifyResult(null);
		startTimer();

		try {
			const result = await verifyBcryptHash(verifyPassword, verifyHash);
			if (!verifyCancelledRef.current) {
				setVerifyResult(result);
				if (result.valid) {
					toast.success('Password matches the hash');
				} else {
					toast.error('Password does not match the hash');
				}
			}
		} catch (e) {
			if (!verifyCancelledRef.current) {
				const message = getErrorMessage(e);
				setVerifyError(message);
				toast.error('Verification failed', { description: message });
			}
		} finally {
			stopTimer();
			setIsVerifying(false);
		}
	};

	const handleCancelVerify = async () => {
		verifyCancelledRef.current = true;
		await cancelWorkerOperation();
		stopTimer();
		setIsVerifying(false);
		toast.info('Verification cancelled');
	};

	const handleClearGenerate = () => {
		setPassword('');
		setHashResult(null);
		setGenerateError(null);
	};

	const handleClearVerify = () => {
		setVerifyPassword('');
		setVerifyHash('');
		setVerifyResult(null);
		setVerifyError(null);
	};

	const valid: boolean | null =
		activeTab === 'generate'
			? hashResult
				? true
				: null
			: verifyResult
				? verifyResult.valid
				: null;

	return (
		<ToolShell
			valid={valid}
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			statusContent={
				activeTab === 'generate' && hashResult ? (
					<>
						<StatItem label="Cost" value={hashResult.cost} />
						<StatItem label="Algorithm" value="$2b$" />
					</>
				) : activeTab === 'verify' && verifyResult ? (
					<span className="flex items-center gap-1">
						{verifyResult.valid ? (
							<>
								<Check className="h-3 w-3 text-success" />
								<span className="text-success">Valid</span>
							</>
						) : (
							<>
								<X className="h-3 w-3 text-destructive" />
								<span className="text-destructive">Invalid</span>
							</>
						)}
					</span>
				) : null
			}
			rail={
				<>
					<FormSection title="Mode">
						<FormMode
							value={activeTab}
							onValueChange={setActiveTab}
							options={[
								{ value: 'generate', label: 'Generate', icon: Hash },
								{ value: 'verify', label: 'Verify', icon: ShieldCheck },
							]}
						/>
					</FormSection>

					{activeTab === 'generate' ? (
						<>
							<FormSection title="Password">
								<FormInput
									label="Password"
									type="password"
									showToggle
									value={password}
									onValueChange={setPassword}
									placeholder="Enter password to hash..."
									size="compact"
								/>
							</FormSection>

							<FormSection title="Cost Factor">
								<FormSlider
									label="Cost"
									value={cost}
									onValueChange={setCost}
									min={MIN_BCRYPT_COST}
									max={MAX_BCRYPT_COST}
									step={1}
									valueLabel={`${cost} (${costInfo?.security_level ?? '...'})`}
									hint={`Estimated time: ${estimatedTime}`}
									size="compact"
								/>
							</FormSection>

							<FormSection title="Actions">
								<div className="space-y-2">
									<ActionButton
										label="Generate Hash"
										icon={Hash}
										loading={isGenerating}
										loadingLabel="Generating..."
										disabled={!canGenerate}
										shortcut
										onClick={handleGenerate}
									/>
									{hashResult || password ? (
										<ActionButton label="Clear" variant="outline" onClick={handleClearGenerate} />
									) : null}
								</div>
							</FormSection>
						</>
					) : (
						<>
							<FormSection title="Password">
								<FormInput
									label="Password"
									type="password"
									showToggle
									value={verifyPassword}
									onValueChange={setVerifyPassword}
									placeholder="Enter password to verify..."
									size="compact"
								/>
							</FormSection>

							<FormSection title="Hash">
								<FormInput
									label="BCrypt Hash"
									value={verifyHash}
									onValueChange={setVerifyHash}
									placeholder="$2b$10$..."
									size="compact"
								/>
							</FormSection>

							<FormSection title="Actions">
								<div className="space-y-2">
									<ActionButton
										label="Verify Hash"
										icon={ShieldCheck}
										loading={isVerifying}
										loadingLabel="Verifying..."
										disabled={!canVerify}
										shortcut
										onClick={handleVerify}
									/>
									{verifyResult || verifyPassword || verifyHash ? (
										<ActionButton label="Clear" variant="outline" onClick={handleClearVerify} />
									) : null}
								</div>
							</FormSection>
						</>
					)}

					<FormSection title="About BCrypt">
						<FormInfo>
							<ul className="list-inside list-disc space-y-0.5">
								<li>Password hashing algorithm</li>
								<li>Salted and adaptive</li>
								<li>Cost factor controls security/speed tradeoff</li>
								<li>Recommended cost: 10-12 for most use cases</li>
							</ul>
						</FormInfo>
					</FormSection>

					<FormSection title="Cost Recommendations">
						<FormInfo showIcon={false}>
							<div className="space-y-0.5">
								<div className="flex justify-between">
									<span>4-7:</span>
									<span className="text-warning">Development only</span>
								</div>
								<div className="flex justify-between">
									<span>8-9:</span>
									<span>Low security</span>
								</div>
								<div className="flex justify-between">
									<span>10-11:</span>
									<span className="text-success">Standard</span>
								</div>
								<div className="flex justify-between">
									<span>12-13:</span>
									<span>High security</span>
								</div>
								<div className="flex justify-between">
									<span>14+:</span>
									<span>Very high security</span>
								</div>
							</div>
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="relative flex h-full flex-col overflow-hidden">
				<LoadingOverlay
					show={isGenerating || isVerifying}
					title={isGenerating ? 'Generating Hash...' : 'Verifying Hash...'}
					message="BCrypt computation in progress"
					estimatedTime={estimatedTime}
					elapsedTime={elapsedTimeDisplay}
					onCancel={isGenerating ? handleCancelGenerate : handleCancelVerify}
				/>
				<SectionHeader
					title={activeTab === 'generate' ? 'Generated Hash' : 'Verification Result'}
				/>

				<LiveStatusRegion className="flex-1 overflow-auto p-4">
					{activeTab === 'generate' ? (
						hashResult ? (
							<div key={flashCounter} className="animate-flash-success space-y-4 rounded-md">
								<Card density="compact">
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
										<CardTitle className="text-sm font-medium">BCrypt Hash</CardTitle>
										<CopyButton
											text={hashResult.hash}
											toastLabel="Hash"
											size="sm"
											showLabel
											className="h-7"
										/>
									</CardHeader>
									<CardContent>
										<CodeBlock padding="md" size="sm">
											{hashResult.hash}
										</CodeBlock>
									</CardContent>
								</Card>

								<Card density="compact">
									<CardHeader className="pb-3">
										<CardTitle className="text-sm font-medium">Hash Details</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-2 text-sm">
											<div className="flex justify-between">
												<span className="text-muted-foreground">Algorithm</span>
												<span className="font-mono">${hashResult.algorithm}$</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">Cost Factor</span>
												<span className="font-mono">{hashResult.cost}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">Security Level</span>
												<span>{costInfo?.security_level ?? 'Unknown'}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">Hash Length</span>
												<span className="font-mono">{hashResult.hash.length} chars</span>
											</div>
										</div>
									</CardContent>
								</Card>
							</div>
						) : generateError ? (
							<ErrorDisplay variant="centered" message={generateError} />
						) : (
							<EmptyState icon={Hash} title="Enter a password and generate a BCrypt hash" />
						)
					) : verifyResult ? (
						<div className="space-y-4">
							<div
								className={`rounded-lg border p-6 ${
									verifyResult.valid
										? 'border-success/30 bg-success/10'
										: 'border-destructive/30 bg-destructive/10'
								}`}
							>
								<div className="flex items-center justify-center gap-3">
									{verifyResult.valid ? (
										<>
											<Check className="h-8 w-8 text-success" />
											<div className="text-center">
												<p className="text-lg font-semibold text-success">Password Valid</p>
												<p className="text-sm text-muted-foreground">
													The password matches the hash
												</p>
											</div>
										</>
									) : (
										<>
											<X className="h-8 w-8 text-destructive" />
											<div className="text-center">
												<p className="text-lg font-semibold text-destructive">Password Invalid</p>
												<p className="text-sm text-muted-foreground">
													The password does not match the hash
												</p>
											</div>
										</>
									)}
								</div>
							</div>
						</div>
					) : verifyError ? (
						<ErrorDisplay variant="centered" message={verifyError} />
					) : (
						<EmptyState icon={ShieldCheck} title="Enter a password and hash to verify" />
					)}
				</LiveStatusRegion>
			</div>
		</ToolShell>
	);
}
