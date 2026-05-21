import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Hash, ShieldAlert, ShieldCheck } from 'lucide-react';

import { CopyButton } from '@/lib/components/action';
import { CodeEditor } from '@/lib/components/editor';
import { FormInfo, FormSection } from '@/lib/components/form';
import { SectionHeader } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import {
	formatBytes,
	generateAllHashes,
	HASH_ALGORITHMS,
	SAMPLE_TEXT_FOR_HASH,
} from '@/lib/services/encoders';

export const Route = createFileRoute('/hash-generator')({
	component: HashGeneratorPage,
});

function HashGeneratorPage() {
	const [textInput, setTextInput] = useState('');
	const [showOptions, setShowOptions] = useState(true);

	useEffect(() => {
		document.title = 'Hash Generator — Kogu';
	}, []);

	const textHashes = useMemo(() => {
		if (!textInput.trim()) return [];
		return generateAllHashes(textInput);
	}, [textInput]);

	const textStats = useMemo(() => {
		const bytes = new TextEncoder().encode(textInput).length;
		return {
			chars: textInput.length,
			bytes,
			size: formatBytes(bytes),
		};
	}, [textInput]);

	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) setTextInput(text);
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => setTextInput('');
	const handleSample = () => setTextInput(SAMPLE_TEXT_FOR_HASH);

	const isSecure = (algorithm: string): boolean =>
		HASH_ALGORITHMS.find((a) => a.algorithm === algorithm)?.secure ?? false;

	const hasInput = textInput.trim().length > 0;

	return (
		<ToolShell
			valid={hasInput ? true : null}
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			statusContent={
				hasInput ? (
					<>
						<StatItem label="Chars" value={textStats.chars} />
						<StatItem label="Size" value={textStats.size} />
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="About Hash">
						<FormInfo>
							<ul className="list-inside list-disc space-y-0.5">
								<li>One-way cryptographic function</li>
								<li>Same input always produces same output</li>
								<li>Cannot be reversed to original data</li>
								<li>Small change in input = completely different hash</li>
							</ul>
						</FormInfo>
					</FormSection>
					<FormSection title="Security">
						<FormInfo showIcon={false}>
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<ShieldCheck className="h-3 w-3 text-success" />
									<span className="text-success">Secure:</span>
									<span>SHA-256, SHA-384, SHA-512</span>
								</div>
								<div className="flex items-center gap-2">
									<ShieldAlert className="h-3 w-3 text-warning" />
									<span className="text-warning">Weak:</span>
									<span>MD5, SHA-1</span>
								</div>
							</div>
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="h-1/3 shrink-0 border-b">
					<CodeEditor
						title="Input Text"
						value={textInput}
						onChange={setTextInput}
						mode="input"
						editorMode="plain"
						placeholder="Enter text to hash..."
						showViewToggle={false}
						onPaste={handlePaste}
						onClear={handleClear}
						onSample={handleSample}
					/>
				</div>
				<div className="flex flex-1 flex-col overflow-hidden">
					<SectionHeader title="Hash Results" />
					<div
						className="flex-1 overflow-auto p-4"
						role="status"
						aria-live="polite"
						aria-atomic="false"
					>
						{textHashes.length > 0 ? (
							<div className="space-y-3">
								{textHashes.map((result) => (
									<Card key={result.algorithm} density="compact">
										<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
											<div className="flex items-center gap-2">
												<CardTitle className="font-mono text-sm">{result.algorithm}</CardTitle>
												<span className="text-xs tabular-nums text-muted-foreground">
													({result.bits} bits)
												</span>
												{isSecure(result.algorithm) ? (
													<Badge variant="outline" className="gap-1 bg-success/10 text-success">
														<ShieldCheck className="h-3 w-3" />
														Secure
													</Badge>
												) : (
													<Badge variant="outline" className="gap-1 bg-warning/10 text-warning">
														<ShieldAlert className="h-3 w-3" />
														Weak
													</Badge>
												)}
											</div>
											<CopyButton
												text={result.hash}
												toastLabel={result.algorithm}
												size="sm"
												showLabel
												className="h-7"
											/>
										</CardHeader>
										<CardContent>
											<code className="block break-all rounded bg-muted p-2 font-mono text-xs">
												{result.hash}
											</code>
										</CardContent>
									</Card>
								))}
							</div>
						) : (
							<EmbeddedEmptyState
								icon={Hash}
								title="Enter text to hash"
								description="Type or paste content above to compute MD5, SHA-1, SHA-256, and more."
								fillHeight
							/>
						)}
					</div>
				</div>
			</div>
		</ToolShell>
	);
}
