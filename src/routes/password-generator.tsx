import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Lock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { ActionButton, CopyButton } from '@/lib/components/action';
import { getErrorMessage } from '@/lib/utils';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormSection,
	FormSlider,
} from '@/lib/components/form';
import { SectionHeader } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, LiveStatusRegion, StatItem } from '@/lib/components/status';
import { Card, CardContent } from '@/lib/components/ui/card';
import { createToolOptionsStore } from '@/lib/stores';
import { useDocumentTitle } from '@/lib/hooks';
import {
	buildCharacterPool,
	calculateEntropy,
	classifyEntropy,
	DEFAULT_COUNT,
	DEFAULT_PASSWORD_OPTIONS,
	generatePasswords,
	MAX_COUNT,
	MAX_LENGTH,
	MIN_COUNT,
	MIN_LENGTH,
	type PasswordOptions,
} from '@/lib/services/password';

interface PasswordPrefs {
	readonly options: PasswordOptions;
	readonly count: number;
}

const usePasswordPrefs = createToolOptionsStore<PasswordPrefs>('password-generator', {
	options: { ...DEFAULT_PASSWORD_OPTIONS },
	count: DEFAULT_COUNT,
});

export const Route = createFileRoute('/password-generator')({
	component: PasswordGeneratorPage,
});

function PasswordGeneratorPage() {
	const { value: prefs, patch } = usePasswordPrefs();
	const { options, count } = prefs;

	const [results, setResults] = useState<readonly string[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [showOptions, setShowOptions] = useState(true);
	const [flashCounter, setFlashCounter] = useState(0);

	useDocumentTitle('Password Generator');

	const pool = buildCharacterPool(options);
	const entropy = calculateEntropy(options.length, pool.length);
	const strength = classifyEntropy(entropy);
	const canGenerate = pool.length > 0;

	const toneClass = (tone: string, kind: 'text' | 'bg'): string => {
		const prefix = kind === 'text' ? 'text' : 'bg';
		if (tone === 'destructive') return `${prefix}-destructive`;
		if (tone === 'warning') return `${prefix}-warning`;
		if (tone === 'success') return `${prefix}-success`;
		return `${prefix}-info`;
	};

	const strengthClass = toneClass(strength.tone, 'text');
	const strengthBarClass = toneClass(strength.tone, 'bg');
	const strengthPercent = Math.min(100, (entropy / 128) * 100);

	const patchOptions = (delta: Partial<PasswordOptions>) =>
		patch({ options: { ...options, ...delta } });

	const handleGenerate = () => {
		setError(null);
		try {
			const next = generatePasswords(options, count);
			setResults(next);
			setFlashCounter((c) => c + 1);
			toast.success(`Generated ${next.length} password${next.length > 1 ? 's' : ''}`);
		} catch (e) {
			const message = getErrorMessage(e);
			setError(message);
			setResults([]);
			toast.error('Failed to generate password', { description: message });
		}
	};

	const handleClear = () => {
		setResults([]);
		setError(null);
	};

	return (
		<ToolShell
			valid={results.length > 0 ? true : null}
			error={error ?? undefined}
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			statusContent={
				results.length > 0 ? (
					<>
						<StatItem label="Count" value={results.length} />
						<StatItem label="Length" value={options.length} />
						<StatItem label="Entropy" value={`${entropy.toFixed(1)} bits`} />
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Length">
						<FormSlider
							label="Length"
							value={options.length}
							onValueChange={(v) => patchOptions({ length: v })}
							min={MIN_LENGTH}
							max={MAX_LENGTH}
							step={1}
							valueLabel={String(options.length)}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Character Classes">
						<FormCheckboxGroup>
							<FormCheckbox
								label="Lowercase (a-z)"
								checked={options.lowercase}
								onCheckedChange={(v) => patchOptions({ lowercase: v })}
								size="compact"
							/>
							<FormCheckbox
								label="Uppercase (A-Z)"
								checked={options.uppercase}
								onCheckedChange={(v) => patchOptions({ uppercase: v })}
								size="compact"
							/>
							<FormCheckbox
								label="Numbers (0-9)"
								checked={options.numbers}
								onCheckedChange={(v) => patchOptions({ numbers: v })}
								size="compact"
							/>
							<FormCheckbox
								label="Symbols (!@#$...)"
								checked={options.symbols}
								onCheckedChange={(v) => patchOptions({ symbols: v })}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="Exclusions">
						<FormCheckboxGroup>
							<FormCheckbox
								label="Exclude similar characters"
								hint="0/O, 1/l/I, |"
								checked={options.excludeSimilar}
								onCheckedChange={(v) => patchOptions({ excludeSimilar: v })}
								size="compact"
							/>
							<FormCheckbox
								label="Exclude ambiguous symbols"
								hint="Brackets, quotes, slashes"
								checked={options.excludeAmbiguous}
								onCheckedChange={(v) => patchOptions({ excludeAmbiguous: v })}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="Quantity">
						<FormSlider
							label="Count"
							value={count}
							onValueChange={(v) => patch({ count: v })}
							min={MIN_COUNT}
							max={MAX_COUNT}
							step={1}
							valueLabel={String(count)}
							size="compact"
						/>
					</FormSection>

					<FormSection title="Strength">
						<div className="space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Pool size</span>
								<span className="font-mono tabular-nums">{pool.length}</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Entropy</span>
								<span className="font-mono tabular-nums">{entropy.toFixed(1)} bits</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Rating</span>
								<span className={`font-medium ${strengthClass}`}>{strength.label}</span>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
								<div
									className={`h-full transition-all duration-300 ${strengthBarClass}`}
									style={{ width: `${strengthPercent}%` }}
								/>
							</div>
						</div>
					</FormSection>

					<FormSection title="Actions">
						<div className="space-y-2">
							<ActionButton
								label="Generate"
								icon={Lock}
								disabled={!canGenerate}
								shortcut
								onClick={handleGenerate}
							/>
							{results.length > 0 ? (
								<>
									<ActionButton
										label="Regenerate"
										icon={RefreshCw}
										variant="outline"
										onClick={handleGenerate}
									/>
									<ActionButton label="Clear" variant="outline" onClick={handleClear} />
								</>
							) : null}
						</div>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							<ul className="list-inside list-disc space-y-0.5">
								<li>Cryptographically secure (Web Crypto)</li>
								<li>Entropy is log2(pool) × length</li>
								<li>≥ 60 bits resists offline attacks</li>
								<li>≥ 128 bits is overkill for human use</li>
							</ul>
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<SectionHeader
					title="Generated Passwords"
					count={results.length || undefined}
					trailing={
						results.length > 0 ? (
							<CopyButton
								text={results.join('\n')}
								label="Copy All"
								toastLabel={`${results.length} password${results.length > 1 ? 's' : ''}`}
								size="sm"
								// SectionHeader is bg-surface-2; restore visible hover affordance.
								className="h-7 hover:bg-interactive-hover"
							/>
						) : null
					}
				/>
				<LiveStatusRegion className="flex-1 overflow-auto p-4">
					{results.length > 0 ? (
						<div key={flashCounter} className="animate-flash-success space-y-2 rounded-md">
							{results.map((password) => (
								<Card key={password} density="compact">
									<CardContent className="flex items-center gap-2">
										<code className="flex-1 break-all font-mono text-sm">{password}</code>
										<CopyButton text={password} toastLabel="Password" size="sm" showLabel={false} />
									</CardContent>
								</Card>
							))}
						</div>
					) : (
						<EmbeddedEmptyState
							icon={Lock}
							title="Generate passwords"
							description="Adjust the options on the left and click Generate to create secure passwords."
							fillHeight
						/>
					)}
				</LiveStatusRegion>
			</div>
		</ToolShell>
	);
}
