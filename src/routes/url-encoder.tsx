import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowRightLeft, BookOpen, ExternalLink, Hammer, Link2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { CopyButton } from '@/lib/components/action';
import { getErrorMessage } from '@/lib/utils';
import { CodeEditor } from '@/lib/components/editor';
import {
	FormCheckbox,
	FormInfo,
	FormInput,
	FormMode,
	FormSection,
	FormSelect,
	FormSlider,
} from '@/lib/components/form';
import { SplitPane } from '@/lib/components/layout';
import { Rail } from '@/lib/components/ui/rail';
import { ToolShell } from '@/lib/components/shell';
import { StatItem } from '@/lib/components/status';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Input } from '@/lib/components/ui/input';
import { IconTooltip } from '@/lib/components/ui/icon-tooltip';
import { CodeBlock } from '@/lib/components/ui/code-block';
import { useActiveTab, useTabStore, usePersistedRail } from '@/lib/stores';
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks';
import {
	buildUrl,
	decodeUrlWithOptions,
	defaultUrlDecodeOptions,
	defaultUrlEncodeOptions,
	encodeUrlWithOptions,
	getEncodingDepth,
	isDoubleEncoded,
	parseUrl,
	type QueryParameter,
	SAMPLE_URL,
	URL_ENCODING_EXAMPLES,
	type UrlDecodeOptions,
	type UrlEncodeMode,
	type UrlEncodeOptions,
	type UrlHexCase,
	type UrlInvalidHandling,
	type UrlNewlineHandling,
	type UrlSpaceEncoding,
} from '@/lib/services/encoders';

type Tab = 'encode' | 'parse' | 'build' | 'reference';
type Mode = 'encode' | 'decode';

const TABS = [
	{ id: 'encode' as const, label: 'Encode/Decode', icon: ArrowRightLeft },
	{ id: 'parse' as const, label: 'Parse URL', icon: Link2 },
	{ id: 'build' as const, label: 'Build URL', icon: Hammer },
	{ id: 'reference' as const, label: 'Reference', icon: BookOpen },
] as const;

const PERSIST_KEY = 'url-encoder';

export const Route = createFileRoute('/url-encoder')({
	component: UrlEncoderPage,
});

function UrlEncoderPage() {
	const persistedTab = useActiveTab(PERSIST_KEY);
	const setActive = useTabStore((s) => s.setActive);
	const activeTab: Tab = (persistedTab as Tab | undefined) ?? 'encode';
	const handleTabChange = (tab: string) => setActive(PERSIST_KEY, tab);

	const [mode, setMode] = useState<Mode>('encode');
	const [input, setInput] = useState('');
	const [showOptions, setShowOptions] = usePersistedRail('url-encoder');

	const [encodeMode, setEncodeMode] = useState<UrlEncodeMode>(defaultUrlEncodeOptions.mode);
	const [spaceEncoding, setSpaceEncoding] = useState<UrlSpaceEncoding>(
		defaultUrlEncodeOptions.spaceEncoding
	);
	const [hexCase, setHexCase] = useState<UrlHexCase>(defaultUrlEncodeOptions.hexCase);
	const [newlineHandling, setNewlineHandling] = useState<UrlNewlineHandling>(
		defaultUrlEncodeOptions.newlineHandling
	);
	const [preserveChars, setPreserveChars] = useState(defaultUrlEncodeOptions.preserveChars);
	const [encodeNonAscii, setEncodeNonAscii] = useState<boolean>(
		defaultUrlEncodeOptions.encodeNonAscii
	);

	const [plusAsSpace, setPlusAsSpace] = useState<boolean>(defaultUrlDecodeOptions.plusAsSpace);
	const [invalidHandling, setInvalidHandling] = useState<UrlInvalidHandling>(
		defaultUrlDecodeOptions.invalidHandling
	);
	const [decodeMultiple, setDecodeMultiple] = useState<boolean>(
		defaultUrlDecodeOptions.decodeMultiple
	);
	const [maxIterations, setMaxIterations] = useState(defaultUrlDecodeOptions.maxIterations);

	const [parseInput, setParseInput] = useState('');
	const [baseUrl, setBaseUrl] = useState('https://example.com/path');
	const [queryParams, setQueryParams] = useState<QueryParameter[]>([
		{ key: 'query', value: 'hello world' },
		{ key: 'name', value: 'test' },
	]);

	useDocumentTitle('URL Encoder');

	const encodeOptions: Partial<UrlEncodeOptions> = {
		mode: encodeMode,
		spaceEncoding,
		hexCase,
		newlineHandling,
		preserveChars,
		encodeNonAscii,
	};

	const decodeOptions: Partial<UrlDecodeOptions> = {
		plusAsSpace,
		invalidHandling,
		decodeMultiple,
		maxIterations,
	};

	// Debounce input feeding the encode / decode helpers so detection and
	// transform calls do not retrigger on every keystroke. 100ms matches
	// the cheap-route default for consistency across the app.
	const debouncedInput = useDebouncedValue(input, 100);

	const detectedDoubleEncoded =
		mode === 'decode' && debouncedInput.trim() ? isDoubleEncoded(debouncedInput) : false;
	const detectedEncodingDepth =
		mode === 'decode' && debouncedInput.trim() ? getEncodingDepth(debouncedInput) : 0;

	const { output, error } = ((): { output: string; error: string } => {
		if (!debouncedInput.trim()) return { output: '', error: '' };
		try {
			const result =
				mode === 'encode'
					? encodeUrlWithOptions(debouncedInput, encodeOptions)
					: decodeUrlWithOptions(debouncedInput, decodeOptions);
			return { output: result, error: '' };
		} catch (e) {
			return { output: '', error: getErrorMessage(e, 'Invalid input') };
		}
	})();

	const parsedUrl = parseInput.trim() ? parseUrl(parseInput) : null;
	const builtUrl = buildUrl(baseUrl, queryParams);

	const valid: boolean | null = (() => {
		if (activeTab === 'encode') return !input.trim() ? null : !error;
		if (activeTab === 'parse') return !parseInput.trim() ? null : parsedUrl !== null;
		return null;
	})();

	const handlePaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) setInput(text);
		} catch {
			// Clipboard access denied
		}
	};

	const handleClear = () => setInput('');

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(output);
			toast.success('Copied to clipboard');
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	const handleSample = () => setInput(SAMPLE_URL);
	const handleParseSample = () => setParseInput(SAMPLE_URL);

	const addQueryParam = () => setQueryParams((prev) => [...prev, { key: '', value: '' }]);
	const removeQueryParam = (index: number) =>
		setQueryParams((prev) => prev.filter((_, i) => i !== index));
	const updateQueryParam = (index: number, field: 'key' | 'value', value: string) =>
		setQueryParams((prev) =>
			prev.map((param, i) => (i === index ? { ...param, [field]: value } : param))
		);

	const renderEncodeTab = () => (
		<div className="flex flex-1 overflow-hidden">
			<Rail
				show={showOptions}
				onClose={() => setShowOptions(false)}
				onOpen={() => setShowOptions(true)}
			>
				<FormSection title="Mode">
					<FormMode
						value={mode}
						onValueChange={(v) => {
							setMode(v);
							setInput('');
						}}
						options={[
							{ value: 'encode', label: 'Encode' },
							{ value: 'decode', label: 'Decode' },
						]}
					/>
				</FormSection>

				{mode === 'encode' ? (
					<>
						<FormSection title="Encoding">
							<FormSelect
								label="Mode"
								value={encodeMode}
								onValueChange={(v) => setEncodeMode(v as UrlEncodeMode)}
								options={[
									{
										value: 'component',
										label: 'Component',
										description: 'Strict: encodes reserved chars',
									},
									{
										value: 'uri',
										label: 'URI',
										description: 'Preserves URI structure characters',
									},
									{
										value: 'form',
										label: 'Form',
										description: 'application/x-www-form-urlencoded',
									},
									{ value: 'path', label: 'Path segment' },
									{ value: 'custom', label: 'Custom' },
								]}
								size="compact"
							/>
							<FormSelect
								label="Space Encoding"
								value={spaceEncoding}
								onValueChange={(v) => setSpaceEncoding(v as UrlSpaceEncoding)}
								options={[
									{ value: 'percent', label: '%20', description: 'RFC 3986 standard' },
									{
										value: 'plus',
										label: '+',
										description: 'Form data (application/x-www-form-urlencoded)',
									},
								]}
								size="compact"
							/>
							<FormSelect
								label="Hex Case"
								value={hexCase}
								onValueChange={(v) => setHexCase(v as UrlHexCase)}
								options={[
									{ value: 'upper', label: 'Uppercase (%2F)' },
									{ value: 'lower', label: 'Lowercase (%2f)' },
								]}
								size="compact"
							/>
							<FormSelect
								label="Newline Handling"
								value={newlineHandling}
								onValueChange={(v) => setNewlineHandling(v as UrlNewlineHandling)}
								options={[
									{ value: 'encode', label: 'Encode as-is' },
									{ value: 'crlf', label: 'Convert to CRLF' },
									{ value: 'lf', label: 'Convert to LF' },
									{ value: 'remove', label: 'Remove' },
								]}
								size="compact"
							/>
							<div className="pt-1">
								<FormCheckbox
									label="Encode non-ASCII characters"
									checked={encodeNonAscii}
									onCheckedChange={setEncodeNonAscii}
									size="compact"
								/>
							</div>
						</FormSection>

						{encodeMode === 'custom' ? (
							<FormSection title="Custom Settings">
								<FormInput
									label="Preserve Characters"
									value={preserveChars}
									onValueChange={setPreserveChars}
									placeholder="e.g., -_.~"
									size="compact"
								/>
								<FormInfo>
									<p>Characters listed here will not be encoded.</p>
								</FormInfo>
							</FormSection>
						) : null}

						<FormSection title="Info" open={false}>
							<FormInfo title="Encoding Modes">
								<p>
									<strong>Component:</strong> Encodes all special chars including /, ?, &amp;, =, #
								</p>
								<p className="mt-1">
									<strong>URI:</strong> Preserves URL structure characters (/, ?, &amp;, =, #, :)
								</p>
								<p className="mt-1">
									<strong>Form:</strong> Like component but uses + for spaces
								</p>
								<p className="mt-1">
									<strong>Path:</strong> Preserves / but encodes other special chars
								</p>
								<p className="mt-1">
									<strong>Custom:</strong> Configure preserved characters manually
								</p>
							</FormInfo>
						</FormSection>
					</>
				) : (
					<>
						<FormSection title="Decoding">
							<FormCheckbox
								label="Treat + as space"
								checked={plusAsSpace}
								onCheckedChange={setPlusAsSpace}
								size="compact"
							/>
							<FormSelect
								label="Invalid Sequences"
								value={invalidHandling}
								onValueChange={(v) => setInvalidHandling(v as UrlInvalidHandling)}
								options={[
									{ value: 'error', label: 'Throw error' },
									{ value: 'skip', label: 'Skip (remove)' },
									{ value: 'keep', label: 'Keep as-is' },
								]}
								size="compact"
							/>
							<FormCheckbox
								label="Decode multiple layers"
								checked={decodeMultiple}
								onCheckedChange={setDecodeMultiple}
								size="compact"
							/>
							{decodeMultiple ? (
								<div className="pt-1">
									<FormSlider
										label="Max Iterations"
										value={maxIterations}
										onValueChange={setMaxIterations}
										min={1}
										max={10}
										step={1}
										size="compact"
									/>
								</div>
							) : null}
						</FormSection>

						{detectedDoubleEncoded || detectedEncodingDepth > 1 ? (
							<FormSection title="Detected">
								<FormInfo showIcon={false}>
									{detectedDoubleEncoded ? (
										<p>
											<strong>Warning:</strong> Double-encoded content detected
										</p>
									) : null}
									{detectedEncodingDepth > 1 ? (
										<p className="mt-1">
											<strong>Encoding Depth:</strong> {detectedEncodingDepth} layers
										</p>
									) : null}
								</FormInfo>
							</FormSection>
						) : null}

						<FormSection title="Info" open={false}>
							<FormInfo title="Decoding Options">
								<p>
									<strong>+ as space:</strong> Treats + as space (form data format)
								</p>
								<p className="mt-1">
									<strong>Invalid sequences:</strong> How to handle malformed % sequences
								</p>
								<p className="mt-1">
									<strong>Multiple layers:</strong> Recursively decode double/triple encoded content
								</p>
							</FormInfo>
						</FormSection>
					</>
				)}
			</Rail>

			<SplitPane
				className="h-full flex-1"
				left={
					<CodeEditor
						title={mode === 'encode' ? 'Text Input' : 'URL Encoded Input'}
						value={input}
						onChange={setInput}
						mode="input"
						editorMode="plain"
						placeholder={
							mode === 'encode' ? 'Enter text to encode...' : 'Enter URL encoded text to decode...'
						}
						onSample={handleSample}
						onPaste={handlePaste}
						onClear={handleClear}
						showViewToggle={false}
					/>
				}
				right={
					<CodeEditor
						title={mode === 'encode' ? 'URL Encoded Output' : 'Decoded Text'}
						value={output}
						mode="readonly"
						editorMode="plain"
						placeholder={mode === 'encode' ? 'Encoded output...' : 'Decoded output...'}
						onCopy={handleCopy}
						showViewToggle={false}
					/>
				}
			/>
		</div>
	);

	const renderParseTab = () => (
		<div className="flex flex-1 flex-col overflow-hidden p-4">
			<div className="mb-4">
				<FormInput
					label="URL to Parse"
					value={parseInput}
					onValueChange={setParseInput}
					placeholder="https://example.com/path?query=value"
					className="font-mono"
					trailing={
						<Button variant="outline" size="sm" onClick={handleParseSample}>
							Sample
						</Button>
					}
				/>
			</div>

			{parsedUrl ? (
				<div className="flex-1 space-y-4 overflow-auto">
					<Card density="compact">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-medium">URL Components</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid gap-2 text-xs">
								{Object.entries(parsedUrl.components)
									.filter(([, v]) => v)
									.map(([key, value]) => (
										<div key={key} className="flex items-center gap-2">
											<span className="w-24 font-medium text-muted-foreground">{key}:</span>
											<code className="flex-1 rounded bg-muted px-2 py-1 font-mono">
												{value as string}
											</code>
											<CopyButton
												text={String(value)}
												toastLabel={key}
												size="icon"
												className="h-6 w-6"
											/>
										</div>
									))}
							</div>
						</CardContent>
					</Card>

					{parsedUrl.params.length > 0 ? (
						<Card density="compact">
							<CardHeader className="pb-3">
								<CardTitle className="text-sm font-medium">
									Query Parameters{' '}
									<span className="text-muted-foreground">({parsedUrl.params.length})</span>
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{parsedUrl.params.map((param, idx) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: query params keep insertion order
										<div key={`${idx}-${param.key}`} className="flex items-center gap-2 text-xs">
											<code className="rounded bg-primary/10 px-2 py-1 font-mono text-primary">
												{param.key}
											</code>
											<span className="text-muted-foreground">=</span>
											<code className="flex-1 rounded bg-muted px-2 py-1 font-mono">
												{param.value}
											</code>
											<CopyButton
												text={param.value}
												toastLabel={param.key}
												size="icon"
												className="h-6 w-6"
											/>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					) : null}
				</div>
			) : parseInput.trim() ? (
				<div className="flex flex-1 items-center justify-center text-muted-foreground">
					Invalid URL format
				</div>
			) : (
				<div className="flex flex-1 items-center justify-center text-muted-foreground">
					Enter a URL to parse
				</div>
			)}
		</div>
	);

	const renderBuildTab = () => (
		<div className="flex flex-1 flex-col overflow-hidden p-4">
			<div className="mb-4">
				<FormInput
					label="Base URL"
					value={baseUrl}
					onValueChange={setBaseUrl}
					placeholder="https://example.com/path"
					className="font-mono"
				/>
			</div>

			<div className="mb-4 flex-1 overflow-auto">
				<div className="mb-2 flex items-center justify-between">
					<span className="text-xs font-medium text-muted-foreground">Query Parameters</span>
					<Button variant="outline" size="sm" onClick={addQueryParam}>
						<Plus className="h-3 w-3" />
						Add Parameter
					</Button>
				</div>
				<div className="space-y-2">
					{queryParams.map((param, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: parameter rows are user-controlled position
						<div key={index} className="flex items-center gap-2">
							<Input
								type="text"
								placeholder="Key"
								value={param.key}
								onChange={(e) => updateQueryParam(index, 'key', e.currentTarget.value)}
								className="w-1/3 font-mono text-sm"
							/>
							<span className="text-muted-foreground">=</span>
							<Input
								type="text"
								placeholder="Value"
								value={param.value}
								onChange={(e) => updateQueryParam(index, 'value', e.currentTarget.value)}
								className="flex-1 font-mono text-sm"
							/>
							<IconTooltip label="Remove parameter">
								<Button variant="ghost" size="icon" onClick={() => removeQueryParam(index)}>
									<Trash2 className="h-4 w-4" />
									<span className="sr-only">Remove parameter</span>
								</Button>
							</IconTooltip>
						</div>
					))}
				</div>
			</div>

			<Card density="compact">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
					<CardTitle className="text-sm font-medium">Generated URL</CardTitle>
					<div className="flex gap-1">
						<CopyButton text={builtUrl} toastLabel="URL" size="sm" showLabel className="h-7" />
						<Button variant="ghost" size="sm" onClick={() => window.open(builtUrl, '_blank')}>
							<ExternalLink className="h-3 w-3" />
							Open
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<CodeBlock padding="md" size="sm">
						{builtUrl}
					</CodeBlock>
				</CardContent>
			</Card>
		</div>
	);

	const renderReferenceTab = () => (
		<div className="flex-1 overflow-auto p-4">
			<Card density="compact">
				<CardHeader className="pb-3">
					<CardTitle className="text-sm font-medium">Common URL Encoded Characters</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
						{URL_ENCODING_EXAMPLES.map((example) => (
							<div
								key={example.char}
								className="flex items-center gap-2 rounded bg-muted/50 p-2 text-xs"
							>
								<code className="rounded bg-background px-2 py-1 font-mono">
									{example.char === ' ' ? '␣' : example.char}
								</code>
								<span className="text-muted-foreground">→</span>
								<code className="rounded bg-primary/10 px-2 py-1 font-mono text-primary">
									{example.encoded}
								</code>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);

	const renderTab = (tab: string) => {
		if (tab === 'encode') return renderEncodeTab();
		if (tab === 'parse') return renderParseTab();
		if (tab === 'build') return renderBuildTab();
		if (tab === 'reference') return renderReferenceTab();
		return null;
	};

	return (
		<ToolShell
			layout="tabbed"
			tabs={TABS}
			activeTab={activeTab}
			onTabChange={handleTabChange}
			valid={valid}
			error={activeTab === 'encode' ? error || undefined : undefined}
			statusContent={
				activeTab === 'encode' ? (
					input.trim() && output ? (
						<>
							<StatItem label="Input" value={`${input.length} chars`} />
							<StatItem label="Output" value={`${output.length} chars`} />
						</>
					) : null
				) : activeTab === 'parse' ? (
					parsedUrl ? (
						<StatItem label="Params" value={parsedUrl.params.length} />
					) : null
				) : activeTab === 'build' ? (
					<StatItem label="Params" value={queryParams.length} />
				) : null
			}
			renderTabContent={renderTab}
		/>
	);
}
