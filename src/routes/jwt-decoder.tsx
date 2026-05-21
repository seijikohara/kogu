import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Info, KeyRound } from 'lucide-react';

import { CopyButton } from '@/lib/components/action';
import { CodeEditor } from '@/lib/components/editor';
import { FormInfo, FormSection } from '@/lib/components/form';
import { SectionHeader } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmptyState } from '@/lib/components/status';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/lib/components/ui/tooltip';
import {
	decodeJwt,
	JWT_STANDARD_CLAIMS,
	type JwtDecoded,
	SAMPLE_JWT,
	validateJwt,
} from '@/lib/services/encoders';

const ALG_DESCRIPTIONS: Readonly<Record<string, string>> = {
	HS256: 'HMAC + SHA-256 (symmetric)',
	HS384: 'HMAC + SHA-384 (symmetric)',
	HS512: 'HMAC + SHA-512 (symmetric)',
	RS256: 'RSA + SHA-256 (asymmetric)',
	RS384: 'RSA + SHA-384 (asymmetric)',
	RS512: 'RSA + SHA-512 (asymmetric)',
	ES256: 'ECDSA + SHA-256 over P-256 (asymmetric)',
	ES384: 'ECDSA + SHA-384 over P-384 (asymmetric)',
	ES512: 'ECDSA + SHA-512 over P-521 (asymmetric)',
	PS256: 'RSASSA-PSS + SHA-256',
	none: 'No signature — INSECURE',
};

const formatJson = (obj: unknown): string => JSON.stringify(obj, null, 2);

const formatDate = (date: Date | undefined): string => {
	if (!date) return 'N/A';
	return date.toLocaleString();
};

const getTimeRemaining = (expDate: Date | undefined): string | null => {
	if (!expDate) return null;
	const diff = expDate.getTime() - Date.now();
	if (diff <= 0) return 'Expired';
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
	if (days > 0) return `${days}d ${hours}h remaining`;
	if (hours > 0) return `${hours}h ${minutes}m remaining`;
	return `${minutes}m remaining`;
};

const getClaimDescription = (claim: string): string | undefined =>
	JWT_STANDARD_CLAIMS.find((c) => c.claim === claim)?.name;

const getAlgDescription = (alg: string): string | null => ALG_DESCRIPTIONS[alg] ?? null;

export const Route = createFileRoute('/jwt-decoder')({
	component: JwtDecoderPage,
});

function JwtDecoderPage() {
	const [input, setInput] = useState('');
	const [showOptions, setShowOptions] = useState(true);

	useEffect(() => {
		document.title = 'JWT Decoder — Kogu';
	}, []);

	const { decoded, error } = ((): { decoded: JwtDecoded | null; error: string } => {
		if (!input.trim()) return { decoded: null, error: '' };
		const validation = validateJwt(input);
		if (!validation.valid) {
			return { decoded: null, error: validation.error || 'Invalid JWT' };
		}
		const result = decodeJwt(input);
		if (!result) return { decoded: null, error: 'Failed to decode JWT' };
		return { decoded: result, error: '' };
	})();

	const valid: boolean | null = !input.trim() ? null : !error;

	const headerAlg = typeof decoded?.header.alg === 'string' ? decoded.header.alg : null;
	const algDescription = headerAlg ? getAlgDescription(headerAlg) : null;

	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) setInput(text);
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => setInput('');
	const handleSample = () => setInput(SAMPLE_JWT);

	return (
		<ToolShell
			valid={valid}
			error={error || undefined}
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			statusContent={
				decoded ? (
					decoded.isExpired ? (
						<span className="flex items-center gap-1 text-destructive">
							<AlertTriangle className="h-3 w-3" />
							Expired
						</span>
					) : (
						<>
							<span className="flex items-center gap-1 text-success">
								<CheckCircle className="h-3 w-3" />
								Valid
							</span>
							{decoded.expiresAt ? (
								<span className="flex items-center gap-1 text-muted-foreground">
									<Clock className="h-3 w-3" />
									{getTimeRemaining(decoded.expiresAt)}
								</span>
							) : null}
						</>
					)
				) : null
			}
			rail={
				<>
					<FormSection title="About JWT">
						<FormInfo>
							<ul className="list-inside list-disc space-y-0.5">
								<li>JSON Web Token</li>
								<li>Compact, URL-safe format</li>
								<li>Three parts: Header.Payload.Signature</li>
								<li>Self-contained authentication</li>
							</ul>
						</FormInfo>
					</FormSection>

					<FormSection title="Structure">
						<FormInfo showIcon={false}>
							<div className="space-y-1.5">
								<div className="flex items-center gap-2">
									<span className="h-2 w-2 rounded-full bg-destructive" />
									<span className="text-destructive">Header:</span>
									<span>Algorithm & type</span>
								</div>
								<div className="flex items-center gap-2">
									<span className="h-2 w-2 rounded-full bg-primary" />
									<span className="text-primary">Payload:</span>
									<span>Claims & data</span>
								</div>
								<div className="flex items-center gap-2">
									<span className="h-2 w-2 rounded-full bg-info" />
									<span className="text-info">Signature:</span>
									<span>Verification hash</span>
								</div>
							</div>
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="h-1/4 shrink-0 border-b">
					<CodeEditor
						title="JWT Token"
						value={input}
						onChange={setInput}
						mode="input"
						editorMode="plain"
						placeholder="Enter JWT token here..."
						showViewToggle={false}
						onPaste={handlePaste}
						onClear={handleClear}
						onSample={handleSample}
					/>
				</div>

				<div className="flex flex-1 flex-col overflow-hidden">
					<SectionHeader title="Decoded Token" />
					{decoded ? (
						<div
							className="flex-1 space-y-4 overflow-auto p-4"
							role="status"
							aria-live="polite"
							aria-atomic="false"
						>
							{decoded.isExpired ? (
								<div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
									<AlertTriangle className="h-4 w-4" />
									<span>
										This token has expired
										{decoded.expiresAt ? ` on ${formatDate(decoded.expiresAt)}` : ''}
									</span>
								</div>
							) : null}

							<Card density="compact">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
									<CardTitle className="text-sm font-medium text-destructive">Header</CardTitle>
									<CopyButton
										text={formatJson(decoded.header)}
										toastLabel="Header"
										size="sm"
										showLabel
										className="h-7"
									/>
								</CardHeader>
								<CardContent>
									{headerAlg ? (
										<div className="mb-2 flex items-center gap-2 text-xs">
											<span className="font-mono font-medium text-muted-foreground">alg:</span>
											<code className="rounded bg-muted px-1.5 py-0.5 font-mono">{headerAlg}</code>
											{algDescription ? (
												<Tooltip>
													<TooltipTrigger asChild>
														<button
															type="button"
															className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
														>
															<Info className="h-3.5 w-3.5" />
															<span className="sr-only">Algorithm details</span>
														</button>
													</TooltipTrigger>
													<TooltipContent>{algDescription}</TooltipContent>
												</Tooltip>
											) : null}
										</div>
									) : null}
									<pre className="overflow-auto rounded bg-muted p-3 font-mono text-xs">
										{formatJson(decoded.header)}
									</pre>
								</CardContent>
							</Card>

							<Card density="compact">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
									<CardTitle className="text-sm font-medium text-primary">Payload</CardTitle>
									<CopyButton
										text={formatJson(decoded.payload)}
										toastLabel="Payload"
										size="sm"
										showLabel
										className="h-7"
									/>
								</CardHeader>
								<CardContent>
									<pre className="overflow-auto rounded bg-muted p-3 font-mono text-xs">
										{formatJson(decoded.payload)}
									</pre>
								</CardContent>
							</Card>

							{Object.keys(decoded.payload).some((k) =>
								JWT_STANDARD_CLAIMS.some((c) => c.claim === k)
							) ? (
								<Card density="compact">
									<CardHeader className="pb-3">
										<CardTitle className="text-sm font-medium">Standard Claims</CardTitle>
									</CardHeader>
									<CardContent className="p-0">
										<div className="divide-y border-t">
											{Object.entries(decoded.payload)
												.filter(([k]) => JWT_STANDARD_CLAIMS.some((c) => c.claim === k))
												.map(([key, value]) => (
													<div key={key} className="flex items-center gap-4 px-4 py-2 text-xs">
														<span className="w-20 font-mono font-medium text-primary">{key}</span>
														<span className="w-32 text-muted-foreground">
															{getClaimDescription(key)}
														</span>
														<span className="flex-1 font-mono">
															{key === 'exp' || key === 'iat' || key === 'nbf' ? (
																<>
																	{formatDate(new Date(Number(value) * 1000))}
																	<span className="ml-2 text-muted-foreground">
																		({String(value)})
																	</span>
																</>
															) : (
																JSON.stringify(value)
															)}
														</span>
													</div>
												))}
										</div>
									</CardContent>
								</Card>
							) : null}

							<Card density="compact">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
									<CardTitle className="text-sm font-medium text-info">Signature</CardTitle>
									<CopyButton
										text={decoded.signature}
										toastLabel="Signature"
										size="sm"
										showLabel
										className="h-7"
									/>
								</CardHeader>
								<CardContent>
									<code className="block break-all rounded bg-muted p-3 font-mono text-xs">
										{decoded.signature}
									</code>
									<p className="mt-2 text-xs text-muted-foreground">
										Note: Signature verification requires the secret key and is not performed
										client-side.
									</p>
								</CardContent>
							</Card>
						</div>
					) : (
						<div className="flex-1">
							{error ? (
								<div className="flex h-full items-center justify-center text-muted-foreground">
									<div className="text-center">
										<AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" />
										<p className="text-sm">{error}</p>
									</div>
								</div>
							) : (
								<EmptyState icon={KeyRound} title="Enter a JWT token to decode" />
							)}
						</div>
					)}
				</div>
			</div>
		</ToolShell>
	);
}
