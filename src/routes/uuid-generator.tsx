import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Fingerprint, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { ActionButton } from '@/lib/components/action';
import { getErrorMessage } from '@/lib/utils';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormInput,
	FormSection,
	FormSelect,
	FormSlider,
} from '@/lib/components/form';
import { GeneratedListPanel } from '@/lib/components/panel';
import { ToolShell } from '@/lib/components/shell';
import { StatItem } from '@/lib/components/status';
import { createToolOptionsStore } from '@/lib/stores';
import { useDocumentTitle } from '@/lib/hooks';
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

	useDocumentTitle('UUID Generator');

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
			const message = getErrorMessage(e);
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
			primaryAction={{ run: handleGenerate, canRun: canGenerate }}
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
								shortcutHint
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
			<GeneratedListPanel
				title="Generated UUIDs"
				itemToastLabel="UUID"
				copyAllToastLabel={(n) => `${n} UUID${n > 1 ? 's' : ''}`}
				emptyIcon={Fingerprint}
				emptyTitle="Generate UUIDs"
				emptyDescription="Pick a version on the left and click Generate to create unique identifiers."
				results={results}
				flashCounter={flashCounter}
			/>
		</ToolShell>
	);
}
