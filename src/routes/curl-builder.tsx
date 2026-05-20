import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import {
	Code2,
	FileCode,
	FlaskConical,
	Globe,
	Lock,
	Pencil,
	Search,
	Settings2,
	Terminal,
} from 'lucide-react';

import { CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormInfo,
	FormInput,
	FormSection,
	FormSelect,
	FormTextarea,
} from '@/lib/components/form';
import { SectionHeader } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/lib/components/ui/card';
import { useActiveTab, useTabStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import {
	AUTH_SCHEMES,
	BODY_MODES,
	buildCurl,
	type CurlRequest,
	DEFAULT_BUILD_OPTIONS,
	DEFAULT_REQUEST,
	formatHeaderLines,
	generateFetchCode,
	generateGoCode,
	generatePythonCode,
	HTTP_METHODS,
	type HttpMethod,
	isAuthScheme,
	isBodyMode,
	isHttpMethod,
	type KeyValue,
	parseCurl,
	parseHeaderLines,
	SAMPLE_CURL_COMMAND,
} from '@/lib/services/curl';

type CurlTab = 'build' | 'parse' | 'code';
type Language = 'fetch' | 'python' | 'go';

const TABS = [
	{ id: 'build' as const, label: 'Build', icon: Pencil },
	{ id: 'parse' as const, label: 'Parse', icon: Search },
	{ id: 'code' as const, label: 'Code', icon: Code2 },
] as const;

const PERSIST_KEY = 'curl-builder';

const METHOD_DESCRIPTIONS: Record<HttpMethod, string> = {
	GET: 'Retrieve a resource',
	POST: 'Create a resource or submit form',
	PUT: 'Replace a resource',
	PATCH: 'Partially update a resource',
	DELETE: 'Remove a resource',
	HEAD: 'Retrieve headers only',
	OPTIONS: 'List allowed methods (CORS preflight)',
};

const LANGUAGES: { readonly id: Language; readonly label: string; readonly hint: string }[] = [
	{ id: 'fetch', label: 'JavaScript (fetch)', hint: 'Modern browser / Node 18+ fetch API' },
	{ id: 'python', label: 'Python (requests)', hint: 'Synchronous HTTP via requests' },
	{ id: 'go', label: 'Go (net/http)', hint: 'Standard library http.Client' },
];

export const Route = createFileRoute('/curl-builder')({
	component: CurlBuilderPage,
});

function CurlBuilderPage() {
	const persistedTab = useActiveTab(PERSIST_KEY);
	const setActive = useTabStore((s) => s.setActive);
	const activeTab: CurlTab = (persistedTab as CurlTab | undefined) ?? 'build';
	const handleTabChange = (tab: string) => {
		if (tab === 'build' || tab === 'parse' || tab === 'code') setActive(PERSIST_KEY, tab);
	};

	const [request, setRequest] = useState<CurlRequest>({ ...DEFAULT_REQUEST });
	const [headersText, setHeadersText] = useState<string>(
		formatHeaderLines(DEFAULT_REQUEST.headers)
	);
	const [formText, setFormText] = useState<string>('');
	const [multiline, setMultiline] = useState<boolean>(DEFAULT_BUILD_OPTIONS.multiline);

	const [parseInput, setParseInput] = useState<string>('');
	const [codeLang, setCodeLang] = useState<Language>('fetch');

	useEffect(() => {
		document.title = 'cURL Builder — Kogu';
	}, []);

	const headers = useMemo(() => parseHeaderLines(headersText), [headersText]);

	const formFields = useMemo<readonly KeyValue[]>(
		() =>
			formText
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line.length > 0 && line.includes('='))
				.map((line) => {
					const idx = line.indexOf('=');
					return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
				}),
		[formText]
	);

	const fullRequest = useMemo<CurlRequest>(() => {
		const base = { ...request, headers };
		if (request.body.mode === 'form') {
			return { ...base, body: { mode: 'form', fields: formFields } };
		}
		return base;
	}, [request, headers, formFields]);

	const buildCommand = useMemo(
		() => buildCurl(fullRequest, { multiline }),
		[fullRequest, multiline]
	);
	const buildValid = request.url.length > 0;

	const parsedCurl = useMemo(() => parseCurl(parseInput), [parseInput]);

	const code = useMemo(() => {
		if (codeLang === 'fetch') return generateFetchCode(fullRequest);
		if (codeLang === 'python') return generatePythonCode(fullRequest);
		return generateGoCode(fullRequest);
	}, [codeLang, fullRequest]);

	const currentStats = (() => {
		if (activeTab === 'build') return { command: buildCommand, valid: buildValid };
		if (activeTab === 'parse')
			return { command: parseInput, valid: parsedCurl.ok || parseInput.length === 0 };
		return { command: code, valid: fullRequest.url.length > 0 };
	})();

	const methodOptions = useMemo(
		() =>
			HTTP_METHODS.map((m) => ({
				value: m,
				label: m,
				description: METHOD_DESCRIPTIONS[m],
			})),
		[]
	);
	const authOptions = useMemo(
		() =>
			AUTH_SCHEMES.map((info) => ({
				value: info.id,
				label: info.label,
				description: info.description,
			})),
		[]
	);
	const bodyOptions = useMemo(
		() =>
			BODY_MODES.map((info) => ({
				value: info.id,
				label: info.label,
				description: info.description,
			})),
		[]
	);

	const handleMethodChange = (value: string) => {
		if (isHttpMethod(value)) setRequest((prev) => ({ ...prev, method: value }));
	};
	const handleAuthChange = (value: string) => {
		if (!isAuthScheme(value)) return;
		if (value === 'none') setRequest((prev) => ({ ...prev, auth: { scheme: 'none' } }));
		else if (value === 'basic')
			setRequest((prev) => ({ ...prev, auth: { scheme: 'basic', username: '', password: '' } }));
		else if (value === 'bearer')
			setRequest((prev) => ({ ...prev, auth: { scheme: 'bearer', token: '' } }));
		else
			setRequest((prev) => ({
				...prev,
				auth: { scheme: 'apikey', headerName: 'X-API-Key', value: '' },
			}));
	};
	const handleBodyChange = (value: string) => {
		if (!isBodyMode(value)) return;
		if (value === 'none') setRequest((prev) => ({ ...prev, body: { mode: 'none' } }));
		else if (value === 'raw')
			setRequest((prev) => ({ ...prev, body: { mode: 'raw', content: '' } }));
		else if (value === 'json')
			setRequest((prev) => ({
				...prev,
				body: { mode: 'json', content: '{\n  "key": "value"\n}' },
			}));
		else setRequest((prev) => ({ ...prev, body: { mode: 'form', fields: [] } }));
	};

	const renderBuildTab = () => (
		<div className="flex h-full flex-col overflow-hidden">
			<SectionHeader
				title="Build"
				trailing={<CopyButton text={buildCommand} toastLabel="Command" size="sm" className="h-7" />}
			/>

			<div className="flex-1 overflow-auto p-4">
				<div className="mx-auto flex max-w-5xl flex-col gap-4">
					<Card density="compact">
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<Globe className="h-4 w-4 text-muted-foreground" />
								<CardTitle className="text-sm font-medium">Request</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="grid gap-3 sm:grid-cols-[140px_1fr]">
							<FormSelect
								label="Method"
								value={request.method}
								options={methodOptions}
								onValueChange={handleMethodChange}
							/>
							<FormInput
								label="URL"
								value={request.url}
								onValueChange={(v) => setRequest((prev) => ({ ...prev, url: v }))}
								placeholder="https://api.example.com/users"
							/>
						</CardContent>
					</Card>

					<Card density="compact">
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<Lock className="h-4 w-4 text-muted-foreground" />
								<CardTitle className="text-sm font-medium">Authentication</CardTitle>
								<Badge variant="outline" className="ml-auto text-2xs uppercase">
									{request.auth.scheme}
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<FormSelect
								label="Scheme"
								value={request.auth.scheme}
								options={authOptions}
								onValueChange={handleAuthChange}
							/>
							{request.auth.scheme === 'basic' && (
								<>
									<FormInput
										label="Username"
										value={request.auth.username}
										onValueChange={(v) =>
											setRequest((prev) => {
												if (prev.auth.scheme !== 'basic') return prev;
												return {
													...prev,
													auth: { scheme: 'basic', username: v, password: prev.auth.password },
												};
											})
										}
									/>
									<FormInput
										label="Password"
										type="password"
										showToggle
										value={request.auth.password}
										onValueChange={(v) =>
											setRequest((prev) => {
												if (prev.auth.scheme !== 'basic') return prev;
												return {
													...prev,
													auth: { scheme: 'basic', username: prev.auth.username, password: v },
												};
											})
										}
									/>
								</>
							)}
							{request.auth.scheme === 'bearer' && (
								<FormInput
									label="Token"
									value={request.auth.token}
									onValueChange={(v) =>
										setRequest((prev) => ({ ...prev, auth: { scheme: 'bearer', token: v } }))
									}
									placeholder="eyJhbGc..."
									className="font-mono"
								/>
							)}
							{request.auth.scheme === 'apikey' && (
								<>
									<FormInput
										label="Header name"
										value={request.auth.headerName}
										onValueChange={(v) =>
											setRequest((prev) => {
												if (prev.auth.scheme !== 'apikey') return prev;
												return {
													...prev,
													auth: { scheme: 'apikey', headerName: v, value: prev.auth.value },
												};
											})
										}
										className="font-mono"
									/>
									<FormInput
										label="Value"
										value={request.auth.value}
										onValueChange={(v) =>
											setRequest((prev) => {
												if (prev.auth.scheme !== 'apikey') return prev;
												return {
													...prev,
													auth: {
														scheme: 'apikey',
														headerName: prev.auth.headerName,
														value: v,
													},
												};
											})
										}
										className="font-mono"
									/>
								</>
							)}
						</CardContent>
					</Card>

					<Card density="compact">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-medium">Headers</CardTitle>
							<CardDescription className="text-xs">
								One header per line in{' '}
								<code className="rounded bg-muted px-1 font-mono">Key: Value</code> format. Auth
								headers are added automatically based on the scheme above.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<FormTextarea
								label=""
								value={headersText}
								onValueChange={setHeadersText}
								placeholder="Accept: application/json"
								rows={4}
								className="font-mono text-sm"
							/>
						</CardContent>
					</Card>

					<Card density="compact">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-medium">Body</CardTitle>
							<CardDescription className="text-xs">
								When set, the method auto-promotes to POST and the matching Content-Type header is
								appended.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<FormSelect
								label="Type"
								value={request.body.mode}
								options={bodyOptions}
								onValueChange={handleBodyChange}
							/>
							{request.body.mode === 'raw' && (
								<FormTextarea
									label="Body"
									value={request.body.content}
									onValueChange={(v) =>
										setRequest((prev) => ({ ...prev, body: { mode: 'raw', content: v } }))
									}
									rows={6}
									className="font-mono text-sm"
								/>
							)}
							{request.body.mode === 'json' && (
								<FormTextarea
									label="JSON body"
									value={request.body.content}
									onValueChange={(v) =>
										setRequest((prev) => ({ ...prev, body: { mode: 'json', content: v } }))
									}
									rows={6}
									className="font-mono text-sm"
								/>
							)}
							{request.body.mode === 'form' && (
								<FormTextarea
									label="Form fields"
									value={formText}
									onValueChange={setFormText}
									placeholder={'name=alice\nrole=admin'}
									hint="One field per line in key=value format. Values are URL-encoded automatically."
									rows={5}
									className="font-mono text-sm"
								/>
							)}
						</CardContent>
					</Card>

					<Card density="compact">
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<Settings2 className="h-4 w-4 text-muted-foreground" />
								<CardTitle className="text-sm font-medium">Options</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<FormCheckbox
								label="Multi-line output"
								hint="Wrap each argument onto its own line with backslash continuations."
								checked={multiline}
								onCheckedChange={setMultiline}
								size="compact"
							/>
							<FormCheckbox
								label="Follow redirects (-L)"
								checked={request.followRedirects}
								onCheckedChange={(v) => setRequest((prev) => ({ ...prev, followRedirects: v }))}
								size="compact"
							/>
							<FormCheckbox
								label="Allow insecure TLS (-k)"
								hint="Disables certificate validation. Use only against trusted hosts."
								checked={request.insecure}
								onCheckedChange={(v) => setRequest((prev) => ({ ...prev, insecure: v }))}
								size="compact"
							/>
							<FormCheckbox
								label="Include response headers (-i)"
								checked={request.includeHeaders}
								onCheckedChange={(v) => setRequest((prev) => ({ ...prev, includeHeaders: v }))}
								size="compact"
							/>
							<FormInput
								label="Timeout (seconds)"
								value={String(request.timeoutSeconds || '')}
								onValueChange={(v) => {
									const n = Number.parseFloat(v);
									setRequest((prev) => ({
										...prev,
										timeoutSeconds: Number.isFinite(n) ? n : 0,
									}));
								}}
								placeholder="0 = no timeout"
								hint="Maps to --max-time"
								className="font-mono"
							/>
						</CardContent>
					</Card>

					<Card density="compact">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
							<div className="flex items-center gap-2">
								<Terminal className="h-4 w-4 text-muted-foreground" />
								<CardTitle className="text-sm font-medium">Generated command</CardTitle>
							</div>
							{buildValid && <CopyButton text={buildCommand} toastLabel="Command" size="sm" />}
						</CardHeader>
						<CardContent>
							{buildValid ? (
								<pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-sm">
									{buildCommand}
								</pre>
							) : (
								<EmbeddedEmptyState
									icon={Terminal}
									title="Enter a URL to build the command"
									description="The generated cURL command will appear here once a request URL is set."
								/>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);

	const renderParseTab = () => (
		<div className="flex h-full flex-col overflow-hidden">
			<SectionHeader
				title="Parse"
				trailing={<CopyButton text={parseInput} toastLabel="Command" size="sm" className="h-7" />}
			/>

			<div className="flex-1 overflow-auto p-4">
				<div className="mx-auto flex max-w-5xl flex-col gap-4">
					<Card density="compact">
						<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
							<div className="space-y-1.5">
								<CardTitle className="text-sm font-medium">cURL command</CardTitle>
								<CardDescription className="text-xs">
									Supports <code className="rounded bg-muted px-1 font-mono">-X</code>,{' '}
									<code className="rounded bg-muted px-1 font-mono">-H</code>,{' '}
									<code className="rounded bg-muted px-1 font-mono">
										-d / --data / --data-raw / --data-binary
									</code>
									, <code className="rounded bg-muted px-1 font-mono">-G</code>,{' '}
									<code className="rounded bg-muted px-1 font-mono">-L</code>,{' '}
									<code className="rounded bg-muted px-1 font-mono">-k</code>,{' '}
									<code className="rounded bg-muted px-1 font-mono">-i</code>,{' '}
									<code className="rounded bg-muted px-1 font-mono">--max-time</code>; backslash
									continuations are joined.
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="h-7 shrink-0"
								onClick={() => setParseInput(SAMPLE_CURL_COMMAND)}
							>
								<FlaskConical className="mr-1.5 h-3.5 w-3.5" />
								Sample
							</Button>
						</CardHeader>
						<CardContent>
							<FormTextarea
								label=""
								value={parseInput}
								onValueChange={setParseInput}
								placeholder="curl -X GET 'https://example.com'"
								rows={6}
								className="font-mono text-sm"
							/>
						</CardContent>
					</Card>

					{parseInput.trim().length === 0 ? (
						<Card density="compact">
							<CardContent className="py-10">
								<EmbeddedEmptyState
									icon={Terminal}
									title="Paste a cURL command"
									description="Click Sample to load a representative request, or paste your own command."
								/>
							</CardContent>
						</Card>
					) : parsedCurl.ok ? (
						<>
							<div className="grid gap-4 lg:grid-cols-3">
								<Card density="compact">
									<CardHeader className="pb-3">
										<div className="flex items-center gap-2">
											<Globe className="h-4 w-4 text-muted-foreground" />
											<CardTitle className="text-sm font-medium">Method</CardTitle>
										</div>
									</CardHeader>
									<CardContent>
										<Badge className="font-mono text-base">{parsedCurl.value.method}</Badge>
									</CardContent>
								</Card>

								<Card density="compact" className="lg:col-span-2">
									<CardHeader className="pb-3">
										<div className="flex items-center gap-2">
											<Globe className="h-4 w-4 text-muted-foreground" />
											<CardTitle className="text-sm font-medium">URL</CardTitle>
										</div>
									</CardHeader>
									<CardContent>
										<code className="block break-all font-mono text-sm">
											{parsedCurl.value.url}
										</code>
									</CardContent>
								</Card>
							</div>

							<Card density="compact">
								<CardHeader className="pb-3">
									<CardTitle className="text-sm font-medium">
										Headers{' '}
										<span className="text-muted-foreground">
											({parsedCurl.value.headers.length})
										</span>
									</CardTitle>
								</CardHeader>
								<CardContent>
									{parsedCurl.value.headers.length > 0 ? (
										<div className="space-y-1.5">
											{parsedCurl.value.headers.map((header, idx) => (
												<div
													// biome-ignore lint/suspicious/noArrayIndexKey: parsed header list reflects positional curl args
													key={idx}
													className="flex items-baseline gap-2 rounded-md border bg-card px-3 py-2"
												>
													<Badge variant="outline" className="font-mono text-2xs">
														{header.key}
													</Badge>
													<span className="break-all font-mono text-xs text-muted-foreground">
														{header.value}
													</span>
												</div>
											))}
										</div>
									) : (
										<EmbeddedEmptyState
											icon={Globe}
											title="No headers"
											description="No -H flags were present in the command."
										/>
									)}
								</CardContent>
							</Card>

							<Card density="compact">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
									<CardTitle className="text-sm font-medium">Body</CardTitle>
									{parsedCurl.value.body.length > 0 && (
										<CopyButton text={parsedCurl.value.body} toastLabel="Body" size="sm" />
									)}
								</CardHeader>
								<CardContent>
									{parsedCurl.value.body.length > 0 ? (
										<pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-sm">
											{parsedCurl.value.body}
										</pre>
									) : (
										<p className="text-sm text-muted-foreground">No body.</p>
									)}
								</CardContent>
							</Card>

							<Card density="compact">
								<CardHeader className="pb-3">
									<div className="flex items-center gap-2">
										<Settings2 className="h-4 w-4 text-muted-foreground" />
										<CardTitle className="text-sm font-medium">Options</CardTitle>
									</div>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-2 text-xs">
									<Badge variant={parsedCurl.value.followRedirects ? 'default' : 'outline'}>
										{parsedCurl.value.followRedirects ? '✓' : '×'} Follow redirects
									</Badge>
									<Badge variant={parsedCurl.value.insecure ? 'default' : 'outline'}>
										{parsedCurl.value.insecure ? '✓' : '×'} Insecure TLS
									</Badge>
									<Badge variant={parsedCurl.value.includeHeaders ? 'default' : 'outline'}>
										{parsedCurl.value.includeHeaders ? '✓' : '×'} Include headers
									</Badge>
									{parsedCurl.value.timeoutSeconds > 0 && (
										<Badge variant="outline">timeout: {parsedCurl.value.timeoutSeconds}s</Badge>
									)}
								</CardContent>
							</Card>
						</>
					) : (
						<Card density="compact" className="border-destructive/40 bg-destructive/5">
							<CardHeader className="pb-3">
								<div className="flex items-center gap-2">
									<Terminal className="h-4 w-4 text-destructive" />
									<CardTitle className="text-sm font-medium text-destructive">
										Parse error
									</CardTitle>
								</div>
							</CardHeader>
							<CardContent>
								<p className="text-sm">{parsedCurl.error}</p>
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</div>
	);

	const renderCodeTab = () => {
		const selectedLang = LANGUAGES.find((l) => l.id === codeLang);
		const selectedLabel = selectedLang?.label ?? '';
		return (
			<div className="flex h-full flex-col overflow-hidden">
				<SectionHeader
					title="Code"
					trailing={<CopyButton text={code} toastLabel={selectedLabel} size="sm" className="h-7" />}
				/>

				<div className="flex-1 overflow-auto p-4">
					<div className="mx-auto flex max-w-5xl flex-col gap-4">
						<Card density="compact">
							<CardHeader className="pb-3">
								<div className="flex items-center gap-2">
									<Code2 className="h-4 w-4 text-muted-foreground" />
									<CardTitle className="text-sm font-medium">Language</CardTitle>
								</div>
								<CardDescription className="text-xs">
									Generated from the Build tab's request — switch tabs to see other clients.
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-wrap gap-2">
								{LANGUAGES.map((lang) => (
									<Button
										key={lang.id}
										variant="outline"
										size="sm"
										className={cn(
											'h-auto justify-start gap-2 px-3 py-1.5 text-xs',
											codeLang === lang.id && 'border-primary bg-primary/5'
										)}
										onClick={() => setCodeLang(lang.id)}
									>
										<span className="font-medium">{lang.label}</span>
										<span className="text-2xs text-muted-foreground">{lang.hint}</span>
									</Button>
								))}
							</CardContent>
						</Card>

						<Card density="compact">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
								<div className="flex items-center gap-2">
									<FileCode className="h-4 w-4 text-muted-foreground" />
									<CardTitle className="text-sm font-medium">{selectedLabel}</CardTitle>
									<Badge variant="outline" className="font-mono text-2xs">
										{codeLang}
									</Badge>
								</div>
								<CopyButton text={code} toastLabel="Snippet" size="sm" />
							</CardHeader>
							<CardContent>
								<pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-sm">
									{code}
								</pre>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		);
	};

	const rail = (
		<>
			<FormSection title="Tabs">
				<FormInfo>
					<ul className="list-inside list-disc space-y-0.5">
						<li>
							<strong>Build</strong> — compose a request with form controls
						</li>
						<li>
							<strong>Parse</strong> — paste an existing command to inspect it
						</li>
						<li>
							<strong>Code</strong> — convert the request to other languages
						</li>
					</ul>
				</FormInfo>
			</FormSection>

			<FormSection title="Authentication">
				<FormInfo>
					<ul className="list-inside list-disc space-y-0.5">
						<li>
							<strong>None</strong> — no auth header
						</li>
						<li>
							<strong>Basic</strong> — <code className="font-mono">user:password</code> via -u
						</li>
						<li>
							<strong>Bearer</strong> — <code className="font-mono">Authorization: Bearer …</code>
						</li>
						<li>
							<strong>API key</strong> — custom header name + value
						</li>
					</ul>
				</FormInfo>
			</FormSection>

			<FormSection title="Body types">
				<FormInfo>
					<ul className="list-inside list-disc space-y-0.5">
						<li>
							<strong>JSON</strong> — application/json, raw payload via -d
						</li>
						<li>
							<strong>Form</strong> — urlencoded, --data-urlencode per field
						</li>
						<li>
							<strong>Multipart</strong> — -F for files and form parts
						</li>
						<li>
							<strong>Raw</strong> — arbitrary text body
						</li>
					</ul>
				</FormInfo>
			</FormSection>

			<FormSection title="Common flags">
				<FormInfo>
					<ul className="list-inside list-disc space-y-0.5">
						<li>
							<code className="font-mono">-i</code> — include response headers
						</li>
						<li>
							<code className="font-mono">-L</code> — follow redirects
						</li>
						<li>
							<code className="font-mono">-k</code> — skip TLS verification
						</li>
						<li>
							<code className="font-mono">--max-time</code> — total timeout in seconds
						</li>
					</ul>
				</FormInfo>
			</FormSection>
		</>
	);

	return (
		<ToolShell
			layout="tabbed"
			tabs={TABS}
			activeTab={activeTab}
			onTabChange={handleTabChange}
			valid={currentStats.valid}
			rail={rail}
			statusContent={
				currentStats.command ? (
					<StatItem label="Length" value={currentStats.command.length} />
				) : null
			}
			renderTabContent={(tab) => {
				if (tab === 'build') return renderBuildTab();
				if (tab === 'parse') return renderParseTab();
				return renderCodeTab();
			}}
		/>
	);
}
