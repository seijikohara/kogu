import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Fingerprint, RefreshCw } from 'lucide-react';
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
import { SectionHeader } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, LiveStatusRegion, StatItem } from '@/lib/components/status';
import { Card, CardContent } from '@/lib/components/ui/card';
import { createToolOptionsStore } from '@/lib/stores';
import {
	DEFAULT_COUNT,
	DEFAULT_FORMAT_OPTIONS,
	generateUuids,
	isUuidVersion,
	MAX_COUNT,
	MIN_COUNT,
	NAMESPACE_DNS,
	NAMESPACE_PRESETS,
	requiresNamespace,
	UUID_VERSIONS,
	type UuidFormatOptions,
	type UuidVersion,
} from '@/lib/services/uuid';

interface UuidOptions {
	readonly version: UuidVersion;
	readonly count: number;
	readonly format: UuidFormatOptions;
}

const useUuidOptions = createToolOptionsStore<UuidOptions>('uuid-generator', {
	version: 'v7',
	count: DEFAULT_COUNT,
	format: { ...DEFAULT_FORMAT_OPTIONS },
});

export const Route = createFileRoute('/uuid-generator')({
	component: UuidGeneratorPage,
});

function UuidGeneratorPage() {
	const { value: options, patch } = useUuidOptions();
	const { version, count, format } = options;

	const [namespace, setNamespace] = useState<string>(NAMESPACE_DNS);
	const [nameInput, setNameInput] = useState('');
	const [results, setResults] = useState<readonly string[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [showOptions, setShowOptions] = useState(true);
	const [flashCounter, setFlashCounter] = useState(0);

	useEffect(() => {
		document.title = 'UUID Generator — Kogu';
	}, []);

	const needsNamespace = requiresNamespace(version);
	const canGenerate = !needsNamespace || (namespace.length > 0 && nameInput.length > 0);

	const versionOptions = useMemo(
		() =>
			UUID_VERSIONS.map((info) => ({
				value: info.version,
				label: info.label,
				description: info.description,
			})),
		[]
	);

	const namespaceOptions = useMemo(
		() =>
			NAMESPACE_PRESETS.map((preset) => ({
				value: preset.value,
				label: preset.label,
				description: preset.value,
			})),
		[]
	);

	const handleVersionChange = (value: string) => {
		if (isUuidVersion(value)) patch({ version: value });
	};

	const handleGenerate = () => {
		setError(null);
		try {
			const next = generateUuids({
				version,
				count,
				namespace: needsNamespace ? namespace : undefined,
				name: needsNamespace ? nameInput : undefined,
				format,
			});
			setResults(next);
			setFlashCounter((c) => c + 1);
			toast.success(`Generated ${next.length} UUID${next.length > 1 ? 's' : ''}`);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			setError(message);
			setResults([]);
			toast.error('Failed to generate UUID', { description: message });
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
						<StatItem label="Version" value={version === 'nil' ? 'NIL' : version.toUpperCase()} />
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="Version">
						<FormSelect
							label="UUID Version"
							value={version}
							options={versionOptions}
							onValueChange={handleVersionChange}
							size="compact"
						/>
					</FormSection>

					{needsNamespace ? (
						<FormSection title="Namespace & Name">
							<FormSelect
								label="Namespace Preset"
								value={namespace}
								options={namespaceOptions}
								onValueChange={setNamespace}
								size="compact"
							/>
							<FormInput
								label="Custom Namespace UUID"
								value={namespace}
								onValueChange={setNamespace}
								placeholder="Or enter a custom UUID..."
								size="compact"
							/>
							<FormInput
								label="Name"
								value={nameInput}
								onValueChange={setNameInput}
								placeholder="e.g., example.com"
								size="compact"
							/>
						</FormSection>
					) : null}

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

					<FormSection title="Format">
						<FormCheckboxGroup>
							<FormCheckbox
								label="Uppercase"
								checked={format.uppercase}
								onCheckedChange={(v) => patch({ format: { ...format, uppercase: v } })}
								size="compact"
							/>
							<FormCheckbox
								label="Hyphens"
								checked={format.hyphens}
								onCheckedChange={(v) => patch({ format: { ...format, hyphens: v } })}
								size="compact"
							/>
							<FormCheckbox
								label="Wrap in braces"
								checked={format.braces}
								onCheckedChange={(v) => patch({ format: { ...format, braces: v } })}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="Actions">
						<div className="space-y-2">
							<ActionButton
								label="Generate"
								icon={Fingerprint}
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

					<FormSection title="About UUID">
						<FormInfo>
							<ul className="list-inside list-disc space-y-0.5">
								<li>Universally Unique Identifier (RFC 9562)</li>
								<li>v4 random is the most common choice</li>
								<li>v7 is time-ordered, ideal for DB primary keys</li>
								<li>v3 / v5 are deterministic from namespace + name</li>
							</ul>
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<SectionHeader
					title="Generated UUIDs"
					count={results.length || undefined}
					trailing={
						results.length > 0 ? (
							<CopyButton
								text={results.join('\n')}
								label="Copy All"
								toastLabel={`${results.length} UUID${results.length > 1 ? 's' : ''}`}
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
							{results.map((uuid) => (
								<Card key={uuid} density="compact">
									<CardContent className="flex items-center gap-2">
										<code className="flex-1 break-all font-mono text-sm">{uuid}</code>
										<CopyButton text={uuid} toastLabel="UUID" size="sm" showLabel={false} />
									</CardContent>
								</Card>
							))}
						</div>
					) : (
						<EmbeddedEmptyState
							icon={Fingerprint}
							title="Generate UUIDs"
							description="Pick a version on the left and click Generate to create unique identifiers."
							fillHeight
						/>
					)}
				</LiveStatusRegion>
			</div>
		</ToolShell>
	);
}
