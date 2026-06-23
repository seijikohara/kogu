import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
	ClipboardPaste,
	Code2,
	Cookie,
	Download,
	FileText,
	FlaskConical,
	Globe,
	KeyRound,
	Link2,
	Loader2,
	Plus,
	Search,
	Send,
	Settings2,
	Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormInput,
	FormSection,
	FormSelect,
	FormSlider,
} from '@/lib/components/form';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, ErrorDisplay, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Checkbox } from '@/lib/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/lib/components/ui/dialog';
import { Input } from '@/lib/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import { Textarea } from '@/lib/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/lib/components/ui/toggle-group';
import { ToneBadge } from '@/lib/components/ui/tone-badge';
import { useDocumentTitle } from '@/lib/hooks';
import {
	type ApiKeyLocation,
	applyAuth,
	type AuthConfig,
	type AuthType,
	type BodyMode,
	buildUrlWithParams,
	countMatches,
	createEmptyHeader,
	createHeaderId,
	type CurlImport,
	DEFAULT_AUTH,
	exportAsCurl,
	importCurl,
	formatBytes,
	formatJson,
	formatResponseBody,
	type HighlightSegment,
	HTTP_METHODS,
	type HeaderEntry,
	type HttpMethod,
	headerValue,
	headersToTuples,
	isHttpMethod,
	type ParsedCookie,
	parseQueryParams,
	parseSetCookie,
	type QueryParam,
	resolveBody,
	responseFilename,
	type RestResponse,
	splitHighlight,
	validateJson,
	withContentType,
	SAMPLE_GET_URL,
	SAMPLE_POST_BODY,
	SAMPLE_POST_URL,
	sendRequest,
	statusTone,
	TIMEOUT_DEFAULT_MS,
	TIMEOUT_MAX_MS,
	TIMEOUT_MIN_MS,
	TIMEOUT_STEP_MS,
} from '@/lib/services/rest-client';
import { createToolOptionsStore } from '@/lib/stores';
import { cn, getErrorMessage } from '@/lib/utils';
import { downloadTextFile } from '@/lib/utils/file-operations';

interface RestClientOptions {
	readonly method: HttpMethod;
	readonly url: string;
	readonly headers: readonly HeaderEntry[];
	readonly auth: AuthConfig;
	readonly bodyMode: BodyMode;
	readonly body: string;
	readonly formFields: readonly HeaderEntry[];
	readonly followRedirects: boolean;
	readonly timeoutMs: number;
}

const DEFAULT_HEADERS: readonly HeaderEntry[] = [
	{ id: 'hdr_default_accept', key: 'Accept', value: '*/*', enabled: true },
];

const DEFAULTS: RestClientOptions = {
	method: 'GET',
	url: '',
	headers: DEFAULT_HEADERS,
	auth: DEFAULT_AUTH,
	bodyMode: 'none',
	body: '',
	formFields: [],
	followRedirects: true,
	timeoutMs: TIMEOUT_DEFAULT_MS,
};

const useRestClientOptions = createToolOptionsStore<RestClientOptions>('rest-client', DEFAULTS);

const METHOD_OPTIONS = HTTP_METHODS.map((m) => ({ value: m, label: m }));

export const Route = createFileRoute('/rest-client')({
	component: RestClientPage,
});

type RequestTab = 'params' | 'auth' | 'headers' | 'body';
type ResponseTab = 'body' | 'headers' | 'cookies';

function RestClientPage() {
	const { value: options, patch } = useRestClientOptions();
	const { method, url, headers, body, followRedirects, timeoutMs } = options;
	// `auth`, `bodyMode`, and `formFields` were added after the options store
	// shipped; persisted state from before that lacks the fields, so fall back to
	// defaults to stay backward-compatible with rehydrated stores. An existing
	// body with no mode keeps sending as raw rather than silently dropping.
	const auth = options.auth ?? DEFAULT_AUTH;
	const bodyMode = options.bodyMode ?? (body.trim().length > 0 ? 'raw' : 'none');
	const formFields = options.formFields ?? [];

	const [response, setResponse] = useState<RestResponse | null>(null);
	// The effective URL sent with the last request, captured so the response can
	// flag a redirect by comparing it against the backend's `finalUrl`.
	const [sentUrl, setSentUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [sending, setSending] = useState(false);
	const [requestTab, setRequestTab] = useState<RequestTab>('params');
	const [responseTab, setResponseTab] = useState<ResponseTab>('body');

	// Query parameters are an editable view of the URL's query string. Keeping a
	// local model (instead of re-parsing on every render) preserves input focus
	// while typing. The effect re-syncs only when the URL changes from outside
	// the table (paste, sample, history), guarded so table edits don't loop.
	const [paramRows, setParamRows] = useState<readonly QueryParam[]>(() => parseQueryParams(url));
	const paramsFromTableRef = useRef(false);

	useEffect(() => {
		if (paramsFromTableRef.current) {
			paramsFromTableRef.current = false;
			return;
		}
		setParamRows(parseQueryParams(url));
	}, [url]);

	const commitParams = (next: readonly QueryParam[]) => {
		setParamRows(next);
		paramsFromTableRef.current = true;
		patch({ url: buildUrlWithParams(url, next) });
	};

	useDocumentTitle('HTTP REST Client');

	const canSend = url.trim().length > 0 && !sending;

	const enabledHeaderCount = useMemo(
		() => headers.filter((h) => h.enabled && h.key.trim().length > 0).length,
		[headers]
	);

	const enabledParamCount = useMemo(
		() => paramRows.filter((p) => p.enabled && p.key.trim().length > 0).length,
		[paramRows]
	);

	const handleParamChange = (id: string, delta: Partial<QueryParam>) => {
		commitParams(paramRows.map((p) => (p.id === id ? { ...p, ...delta } : p)));
	};

	const handleParamRemove = (id: string) => {
		commitParams(paramRows.filter((p) => p.id !== id));
	};

	const handleParamAdd = () => {
		// New rows live in the local model until they gain a key; an empty key is
		// filtered out of the rebuilt URL by buildUrlWithParams.
		setParamRows([...paramRows, { id: createHeaderId(), key: '', value: '', enabled: true }]);
	};

	const handleMethodChange = (value: string) => {
		if (isHttpMethod(value)) patch({ method: value });
	};

	const handleHeaderChange = (id: string, delta: Partial<HeaderEntry>) => {
		patch({
			headers: headers.map((h) => (h.id === id ? { ...h, ...delta } : h)),
		});
	};

	const handleHeaderRemove = (id: string) => {
		patch({ headers: headers.filter((h) => h.id !== id) });
	};

	const handleFormFieldChange = (id: string, delta: Partial<HeaderEntry>) => {
		patch({ formFields: formFields.map((f) => (f.id === id ? { ...f, ...delta } : f)) });
	};

	const handleFormFieldRemove = (id: string) => {
		patch({ formFields: formFields.filter((f) => f.id !== id) });
	};

	const handleFormatJson = () => {
		patch({ body: formatJson(body) });
	};

	const handleLoadGetSample = () => {
		patch({ method: 'GET', url: SAMPLE_GET_URL, bodyMode: 'none', body: '' });
		setRequestTab('params');
	};

	const handleLoadPostSample = () => {
		// The JSON body mode supplies Content-Type at send time, so the sample no
		// longer needs to inject a header row.
		patch({ method: 'POST', url: SAMPLE_POST_URL, bodyMode: 'json', body: SAMPLE_POST_BODY });
		setRequestTab('body');
	};

	// Compose the wire request: fold auth into headers/URL, resolve the body for
	// the selected mode, and add the mode's Content-Type unless the user set one.
	const buildEffectiveRequest = () => {
		const withAuth = applyAuth(headersToTuples(headers), url, auth);
		const resolved = resolveBody(bodyMode, body, formFields);
		return {
			method,
			url: withAuth.url,
			headers: withContentType(withAuth.headers, resolved.contentType),
			body: resolved.body,
			followRedirects,
			timeoutMs,
		};
	};

	// Replace the whole request with the decoded cURL command. Auth and form
	// fields reset so only the imported headers/body define the wire request,
	// avoiding a stale credential folding in on top of the import.
	const handleImportCurl = (imported: CurlImport) => {
		patch({
			method: imported.method,
			url: imported.url,
			headers: [...imported.headers],
			auth: DEFAULT_AUTH,
			bodyMode: imported.bodyMode,
			body: imported.body,
			formFields: [],
			followRedirects: imported.followRedirects,
			...(imported.timeoutMs !== null ? { timeoutMs: imported.timeoutMs } : {}),
		});
		setRequestTab(imported.bodyMode === 'none' ? 'headers' : 'body');
	};

	const handleCopyCurl = async () => {
		if (!url.trim()) {
			toast.error('Enter a URL first');
			return;
		}
		const command = exportAsCurl(buildEffectiveRequest());
		try {
			await navigator.clipboard.writeText(command);
			toast.success('cURL command copied to clipboard');
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	};

	const handleSend = async () => {
		if (!canSend) return;
		setSending(true);
		setError(null);
		const request = buildEffectiveRequest();
		setSentUrl(request.url);
		try {
			const res = await sendRequest(request);
			setResponse(res);
			setResponseTab('body');
		} catch (e) {
			setError(getErrorMessage(e));
			setResponse(null);
		} finally {
			setSending(false);
		}
	};

	const rail = (
		<RestClientRail
			sending={sending}
			canSend={canSend}
			followRedirects={followRedirects}
			timeoutMs={timeoutMs}
			onSend={handleSend}
			onPatch={patch}
			onLoadGetSample={handleLoadGetSample}
			onLoadPostSample={handleLoadPostSample}
			onCopyCurl={handleCopyCurl}
			onImportCurl={handleImportCurl}
		/>
	);

	const statusContent = <StatusBarContent response={response} />;

	return (
		<ToolShell
			valid={error ? false : response ? true : null}
			primaryAction={{ run: () => handleSend().catch(() => undefined), canRun: canSend }}
			rail={rail}
			statusContent={statusContent}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="flex-1 overflow-auto p-4">
					<div className="mx-auto flex max-w-5xl flex-col gap-4">
						<RequestBar
							method={method}
							url={url}
							sending={sending}
							canSend={canSend}
							onMethodChange={handleMethodChange}
							onUrlChange={(v) => patch({ url: v })}
							onSend={handleSend}
						/>

						<RequestPanel
							activeTab={requestTab}
							onTabChange={setRequestTab}
							params={paramRows}
							enabledParamCount={enabledParamCount}
							auth={auth}
							headers={headers}
							enabledHeaderCount={enabledHeaderCount}
							bodyMode={bodyMode}
							body={body}
							formFields={formFields}
							onParamChange={handleParamChange}
							onParamRemove={handleParamRemove}
							onParamAdd={handleParamAdd}
							onAuthChange={(delta) => patch({ auth: { ...auth, ...delta } })}
							onHeaderChange={handleHeaderChange}
							onHeaderRemove={handleHeaderRemove}
							onHeaderAdd={() => patch({ headers: [...headers, createEmptyHeader()] })}
							onBodyModeChange={(m) => patch({ bodyMode: m })}
							onBodyChange={(e) => patch({ body: e.target.value })}
							onFormFieldChange={handleFormFieldChange}
							onFormFieldRemove={handleFormFieldRemove}
							onFormFieldAdd={() => patch({ formFields: [...formFields, createEmptyHeader()] })}
							onFormatJson={handleFormatJson}
						/>

						{error ? <ErrorDisplay variant="banner" message={error} /> : null}

						<ResponseCard
							response={response}
							requestUrl={sentUrl}
							activeTab={responseTab}
							onTabChange={setResponseTab}
						/>
					</div>
				</div>
			</div>
		</ToolShell>
	);
}

interface RestClientRailProps {
	readonly sending: boolean;
	readonly canSend: boolean;
	readonly followRedirects: boolean;
	readonly timeoutMs: number;
	readonly onSend: () => void;
	readonly onPatch: (delta: Partial<RestClientOptions>) => void;
	readonly onLoadGetSample: () => void;
	readonly onLoadPostSample: () => void;
	readonly onCopyCurl: () => void;
	readonly onImportCurl: (imported: CurlImport) => void;
}

function RestClientRail({
	sending,
	canSend,
	followRedirects,
	timeoutMs,
	onSend,
	onPatch,
	onLoadGetSample,
	onLoadPostSample,
	onCopyCurl,
	onImportCurl,
}: RestClientRailProps) {
	return (
		<>
			<FormSection title="Send">
				<Button
					type="button"
					className="w-full"
					onClick={onSend}
					disabled={!canSend}
					aria-label="Send HTTP request"
				>
					<SendButtonContent sending={sending} label="Send Request" />
				</Button>
			</FormSection>

			<FormSection title="Options">
				<FormCheckbox
					label="Follow redirects"
					hint="Cap of 10 hops when enabled."
					checked={followRedirects}
					onCheckedChange={(v) => onPatch({ followRedirects: v })}
					size="compact"
				/>
				<FormSlider
					label="Timeout (ms)"
					value={timeoutMs}
					min={TIMEOUT_MIN_MS}
					max={TIMEOUT_MAX_MS}
					step={TIMEOUT_STEP_MS}
					valueLabel={`${timeoutMs.toLocaleString()} ms`}
					size="compact"
					onValueChange={(v) => onPatch({ timeoutMs: v })}
				/>
			</FormSection>

			<FormSection title="Samples">
				<Button variant="outline" size="sm" className="w-full" onClick={onLoadGetSample}>
					<FlaskConical className="h-3.5 w-3.5" />
					Load GET sample
				</Button>
				<Button variant="outline" size="sm" className="w-full" onClick={onLoadPostSample}>
					<FlaskConical className="h-3.5 w-3.5" />
					Load POST sample
				</Button>
			</FormSection>

			<FormSection title="Import">
				<ImportCurlDialog onImport={onImportCurl} />
			</FormSection>

			<FormSection title="Export">
				<Button variant="outline" size="sm" className="w-full" onClick={onCopyCurl}>
					<Code2 className="h-3.5 w-3.5" />
					Copy as cURL
				</Button>
			</FormSection>

			<ToolFooter
				relatedItems={[
					{ id: 'http-status-codes', reason: 'Look up a response status code' },
					{ id: 'mime-types', reason: 'Find a Content-Type or extension' },
					{ id: 'curl-builder', reason: 'Build or parse a cURL command' },
				]}
				aboutText={
					<>
						Local HTTP client. Requests go directly from your machine; not proxied. CORS does not
						apply (Tauri backend).
					</>
				}
			/>
		</>
	);
}

interface SendButtonContentProps {
	readonly sending: boolean;
	readonly label: string;
}

function SendButtonContent({ sending, label }: SendButtonContentProps) {
	if (sending) {
		return (
			<>
				<Loader2 className="h-4 w-4 animate-spin" />
				Sending...
			</>
		);
	}
	return (
		<>
			<Send className="h-4 w-4" />
			{label}
		</>
	);
}

interface ImportCurlDialogProps {
	readonly onImport: (imported: CurlImport) => void;
}

function ImportCurlDialog({ onImport }: ImportCurlDialogProps) {
	const [open, setOpen] = useState(false);
	const [text, setText] = useState('');

	const handleImport = () => {
		const result = importCurl(text);
		if (!result.ok) {
			toast.error('Could not parse cURL', { description: result.error });
			return;
		}
		onImport(result.value);
		toast.success('Imported cURL command');
		setText('');
		setOpen(false);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="w-full">
					<ClipboardPaste className="h-3.5 w-3.5" />
					Import cURL
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Import cURL command</DialogTitle>
					<DialogDescription>
						Paste a cURL command to populate the method, URL, headers, and body.
					</DialogDescription>
				</DialogHeader>
				<Textarea
					value={text}
					placeholder="curl 'https://example.com/api' -H 'Accept: application/json'"
					rows={8}
					className="font-mono text-xs"
					onChange={(e) => setText(e.target.value)}
				/>
				<DialogFooter>
					<Button onClick={handleImport} disabled={text.trim().length === 0}>
						Import
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

interface RequestBarProps {
	readonly method: string;
	readonly url: string;
	readonly sending: boolean;
	readonly canSend: boolean;
	readonly onMethodChange: (value: string) => void;
	readonly onUrlChange: (value: string) => void;
	readonly onSend: () => void;
}

function RequestBar({
	method,
	url,
	sending,
	canSend,
	onMethodChange,
	onUrlChange,
	onSend,
}: RequestBarProps) {
	return (
		<Card density="compact">
			<CardHeader className="pb-3">
				<div className="flex items-center gap-2">
					<Globe className="h-4 w-4 text-muted-foreground" />
					<CardTitle className="text-sm font-medium">Request</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-[120px_1fr_auto] items-end gap-2">
					<FormSelect
						label="Method"
						value={method}
						options={METHOD_OPTIONS}
						onValueChange={onMethodChange}
					/>
					<FormInput
						label="URL"
						value={url}
						placeholder="https://example.com/api"
						onValueChange={onUrlChange}
					/>
					<Button
						type="button"
						className="h-9"
						onClick={onSend}
						disabled={!canSend}
						aria-label="Send HTTP request"
					>
						<SendButtonContent sending={sending} label="Send" />
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

interface RequestPanelProps {
	readonly activeTab: RequestTab;
	readonly onTabChange: (tab: RequestTab) => void;
	readonly params: readonly QueryParam[];
	readonly enabledParamCount: number;
	readonly auth: AuthConfig;
	readonly headers: readonly HeaderEntry[];
	readonly enabledHeaderCount: number;
	readonly bodyMode: BodyMode;
	readonly body: string;
	readonly formFields: readonly HeaderEntry[];
	readonly onParamChange: (id: string, delta: Partial<QueryParam>) => void;
	readonly onParamRemove: (id: string) => void;
	readonly onParamAdd: () => void;
	readonly onAuthChange: (delta: Partial<AuthConfig>) => void;
	readonly onHeaderChange: (id: string, delta: Partial<HeaderEntry>) => void;
	readonly onHeaderRemove: (id: string) => void;
	readonly onHeaderAdd: () => void;
	readonly onBodyModeChange: (mode: BodyMode) => void;
	readonly onBodyChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
	readonly onFormFieldChange: (id: string, delta: Partial<HeaderEntry>) => void;
	readonly onFormFieldRemove: (id: string) => void;
	readonly onFormFieldAdd: () => void;
	readonly onFormatJson: () => void;
}

function RequestPanel({
	activeTab,
	onTabChange,
	params,
	enabledParamCount,
	auth,
	headers,
	enabledHeaderCount,
	bodyMode,
	body,
	formFields,
	onParamChange,
	onParamRemove,
	onParamAdd,
	onAuthChange,
	onHeaderChange,
	onHeaderRemove,
	onHeaderAdd,
	onBodyModeChange,
	onBodyChange,
	onFormFieldChange,
	onFormFieldRemove,
	onFormFieldAdd,
	onFormatJson,
}: RequestPanelProps) {
	const handleValueChange = (v: string) => {
		if (v === 'params' || v === 'auth' || v === 'headers' || v === 'body') onTabChange(v);
	};

	return (
		<Card density="compact">
			<CardContent className="space-y-3">
				<Tabs value={activeTab} onValueChange={handleValueChange} className="contents">
					<TabsList className="grid w-full grid-cols-4">
						<TabsTrigger value="params" className="gap-2">
							<Link2 className="h-3.5 w-3.5" />
							Params
							{enabledParamCount > 0 ? (
								<Badge variant="secondary" className="ml-1 h-4 px-1.5 text-2xs">
									{enabledParamCount}
								</Badge>
							) : null}
						</TabsTrigger>
						<TabsTrigger value="auth" className="gap-2">
							<KeyRound className="h-3.5 w-3.5" />
							Auth
							{auth.type !== 'none' ? (
								<Badge variant="secondary" className="ml-1 h-4 px-1.5 text-2xs uppercase">
									{auth.type}
								</Badge>
							) : null}
						</TabsTrigger>
						<TabsTrigger value="headers" className="gap-2">
							<Settings2 className="h-3.5 w-3.5" />
							Headers
							{enabledHeaderCount > 0 ? (
								<Badge variant="secondary" className="ml-1 h-4 px-1.5 text-2xs">
									{enabledHeaderCount}
								</Badge>
							) : null}
						</TabsTrigger>
						<TabsTrigger value="body" className="gap-2">
							<FileText className="h-3.5 w-3.5" />
							Body
							{bodyMode !== 'none' ? (
								<Badge variant="secondary" className="ml-1 h-4 px-1.5 text-2xs uppercase">
									{bodyMode}
								</Badge>
							) : null}
						</TabsTrigger>
					</TabsList>

					<TabsContent value="params" className="space-y-2 pt-3">
						<ParamsEditor
							params={params}
							onParamChange={onParamChange}
							onParamRemove={onParamRemove}
							onParamAdd={onParamAdd}
						/>
					</TabsContent>

					<TabsContent value="auth" className="space-y-3 pt-3">
						<AuthEditor auth={auth} onAuthChange={onAuthChange} />
					</TabsContent>

					<TabsContent value="headers" className="space-y-2 pt-3">
						<HeadersEditor
							headers={headers}
							onHeaderChange={onHeaderChange}
							onHeaderRemove={onHeaderRemove}
							onHeaderAdd={onHeaderAdd}
						/>
					</TabsContent>

					<TabsContent value="body" className="space-y-3 pt-3">
						<BodyEditor
							bodyMode={bodyMode}
							body={body}
							formFields={formFields}
							onBodyModeChange={onBodyModeChange}
							onBodyChange={onBodyChange}
							onFormFieldChange={onFormFieldChange}
							onFormFieldRemove={onFormFieldRemove}
							onFormFieldAdd={onFormFieldAdd}
							onFormatJson={onFormatJson}
						/>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}

interface HeadersEditorProps {
	readonly headers: readonly HeaderEntry[];
	readonly onHeaderChange: (id: string, delta: Partial<HeaderEntry>) => void;
	readonly onHeaderRemove: (id: string) => void;
	readonly onHeaderAdd: () => void;
}

function HeadersEditor({
	headers,
	onHeaderChange,
	onHeaderRemove,
	onHeaderAdd,
}: HeadersEditorProps) {
	return (
		<>
			{headers.length === 0 ? (
				<EmbeddedEmptyState
					icon={Settings2}
					title="No headers"
					description="Add headers to send with this request."
				/>
			) : (
				<div className="space-y-1.5">
					{headers.map((entry) => (
						<HeaderRow
							key={entry.id}
							entry={entry}
							onChange={(delta) => onHeaderChange(entry.id, delta)}
							onRemove={() => onHeaderRemove(entry.id)}
						/>
					))}
				</div>
			)}
			<Button variant="outline" size="sm" onClick={onHeaderAdd}>
				<Plus className="h-3.5 w-3.5" />
				Add header
			</Button>
		</>
	);
}

interface HeaderRowProps {
	readonly entry: HeaderEntry;
	readonly onChange: (delta: Partial<HeaderEntry>) => void;
	readonly onRemove: () => void;
}

function HeaderRow({ entry, onChange, onRemove }: HeaderRowProps) {
	return (
		<div
			className={cn(
				'grid grid-cols-[auto_minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-2',
				!entry.enabled && 'opacity-50'
			)}
		>
			<Checkbox
				checked={entry.enabled}
				onCheckedChange={(v) => onChange({ enabled: Boolean(v) })}
				aria-label="Include header"
			/>
			<Input
				value={entry.key}
				placeholder="Header"
				className="h-8 font-mono text-xs"
				onChange={(e) => onChange({ key: e.target.value })}
			/>
			<Input
				value={entry.value}
				placeholder="Value"
				className="h-8 font-mono text-xs"
				onChange={(e) => onChange({ value: e.target.value })}
			/>
			<Button
				variant="ghost"
				size="icon-sm"
				className="h-8 w-8 text-muted-foreground hover:text-destructive"
				onClick={onRemove}
				aria-label="Remove header"
			>
				<Trash2 className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}

interface ParamsEditorProps {
	readonly params: readonly QueryParam[];
	readonly onParamChange: (id: string, delta: Partial<QueryParam>) => void;
	readonly onParamRemove: (id: string) => void;
	readonly onParamAdd: () => void;
}

function ParamsEditor({ params, onParamChange, onParamRemove, onParamAdd }: ParamsEditorProps) {
	return (
		<>
			{params.length === 0 ? (
				<EmbeddedEmptyState
					icon={Link2}
					title="No query parameters"
					description="Add parameters or type them after ? in the URL."
				/>
			) : (
				<div className="space-y-1.5">
					{params.map((entry) => (
						<ParamRow
							key={entry.id}
							entry={entry}
							onChange={(delta) => onParamChange(entry.id, delta)}
							onRemove={() => onParamRemove(entry.id)}
						/>
					))}
				</div>
			)}
			<Button variant="outline" size="sm" onClick={onParamAdd}>
				<Plus className="h-3.5 w-3.5" />
				Add parameter
			</Button>
		</>
	);
}

interface ParamRowProps {
	readonly entry: QueryParam;
	readonly onChange: (delta: Partial<QueryParam>) => void;
	readonly onRemove: () => void;
}

function ParamRow({ entry, onChange, onRemove }: ParamRowProps) {
	return (
		<div
			className={cn(
				'grid grid-cols-[auto_minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-2',
				!entry.enabled && 'opacity-50'
			)}
		>
			<Checkbox
				checked={entry.enabled}
				onCheckedChange={(v) => onChange({ enabled: Boolean(v) })}
				aria-label="Include parameter"
			/>
			<Input
				value={entry.key}
				placeholder="Key"
				className="h-8 font-mono text-xs"
				onChange={(e) => onChange({ key: e.target.value })}
			/>
			<Input
				value={entry.value}
				placeholder="Value"
				className="h-8 font-mono text-xs"
				onChange={(e) => onChange({ value: e.target.value })}
			/>
			<Button
				variant="ghost"
				size="icon-sm"
				className="h-8 w-8 text-muted-foreground hover:text-destructive"
				onClick={onRemove}
				aria-label="Remove parameter"
			>
				<Trash2 className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}

const BODY_MODE_OPTIONS: readonly { readonly value: BodyMode; readonly label: string }[] = [
	{ value: 'none', label: 'None' },
	{ value: 'json', label: 'JSON' },
	{ value: 'form', label: 'Form URL-encoded' },
	{ value: 'raw', label: 'Raw' },
];

interface BodyEditorProps {
	readonly bodyMode: BodyMode;
	readonly body: string;
	readonly formFields: readonly HeaderEntry[];
	readonly onBodyModeChange: (mode: BodyMode) => void;
	readonly onBodyChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
	readonly onFormFieldChange: (id: string, delta: Partial<HeaderEntry>) => void;
	readonly onFormFieldRemove: (id: string) => void;
	readonly onFormFieldAdd: () => void;
	readonly onFormatJson: () => void;
}

function BodyEditor({
	bodyMode,
	body,
	formFields,
	onBodyModeChange,
	onBodyChange,
	onFormFieldChange,
	onFormFieldRemove,
	onFormFieldAdd,
	onFormatJson,
}: BodyEditorProps) {
	const handleModeChange = (v: string) => {
		if (v === 'none' || v === 'json' || v === 'form' || v === 'raw') onBodyModeChange(v);
	};
	const jsonValid = bodyMode === 'json' ? validateJson(body) : null;

	return (
		<>
			<FormSelect
				label="Body type"
				value={bodyMode}
				options={BODY_MODE_OPTIONS}
				onValueChange={handleModeChange}
				size="compact"
			/>

			{bodyMode === 'none' ? (
				<p className="text-xs text-muted-foreground">This request will be sent without a body.</p>
			) : null}

			{bodyMode === 'json' ? (
				<>
					<div className="flex items-center justify-between gap-2">
						<JsonValidity valid={jsonValid} />
						<Button
							variant="outline"
							size="sm"
							onClick={onFormatJson}
							disabled={jsonValid !== true}
						>
							Format
						</Button>
					</div>
					<Textarea
						value={body}
						placeholder='{"key": "value"}'
						rows={10}
						className="font-mono text-sm"
						onChange={onBodyChange}
					/>
				</>
			) : null}

			{bodyMode === 'form' ? (
				<>
					{formFields.length === 0 ? (
						<EmbeddedEmptyState
							icon={FileText}
							title="No form fields"
							description="Add fields sent as application/x-www-form-urlencoded."
						/>
					) : (
						<div className="space-y-1.5">
							{formFields.map((entry) => (
								<ParamRow
									key={entry.id}
									entry={entry}
									onChange={(delta) => onFormFieldChange(entry.id, delta)}
									onRemove={() => onFormFieldRemove(entry.id)}
								/>
							))}
						</div>
					)}
					<Button variant="outline" size="sm" onClick={onFormFieldAdd}>
						<Plus className="h-3.5 w-3.5" />
						Add field
					</Button>
				</>
			) : null}

			{bodyMode === 'raw' ? (
				<Textarea
					value={body}
					placeholder="Raw request body"
					rows={10}
					className="font-mono text-sm"
					onChange={onBodyChange}
				/>
			) : null}
		</>
	);
}

function JsonValidity({ valid }: { readonly valid: boolean | null }): ReactNode {
	if (valid === true) return <ToneBadge tone="success">Valid JSON</ToneBadge>;
	if (valid === false) return <ToneBadge tone="destructive">Invalid JSON</ToneBadge>;
	return <span className="text-xs text-muted-foreground">Enter a JSON body</span>;
}

const AUTH_TYPE_OPTIONS: readonly { readonly value: AuthType; readonly label: string }[] = [
	{ value: 'none', label: 'No Auth' },
	{ value: 'bearer', label: 'Bearer Token' },
	{ value: 'basic', label: 'Basic Auth' },
	{ value: 'apikey', label: 'API Key' },
];

const API_KEY_LOCATION_OPTIONS: readonly {
	readonly value: ApiKeyLocation;
	readonly label: string;
}[] = [
	{ value: 'header', label: 'Header' },
	{ value: 'query', label: 'Query parameter' },
];

interface AuthEditorProps {
	readonly auth: AuthConfig;
	readonly onAuthChange: (delta: Partial<AuthConfig>) => void;
}

function AuthEditor({ auth, onAuthChange }: AuthEditorProps) {
	const handleTypeChange = (v: string) => {
		if (v === 'none' || v === 'bearer' || v === 'basic' || v === 'apikey')
			onAuthChange({ type: v });
	};
	const handleLocationChange = (v: string) => {
		if (v === 'header' || v === 'query') onAuthChange({ apiKeyLocation: v });
	};

	return (
		<>
			<FormSelect
				label="Type"
				value={auth.type}
				options={AUTH_TYPE_OPTIONS}
				onValueChange={handleTypeChange}
				size="compact"
			/>

			{auth.type === 'bearer' ? (
				<FormInput
					label="Token"
					type="password"
					value={auth.token}
					placeholder="Bearer token"
					onValueChange={(v) => onAuthChange({ token: v })}
				/>
			) : null}

			{auth.type === 'basic' ? (
				<>
					<FormInput
						label="Username"
						value={auth.username}
						onValueChange={(v) => onAuthChange({ username: v })}
					/>
					<FormInput
						label="Password"
						type="password"
						value={auth.password}
						onValueChange={(v) => onAuthChange({ password: v })}
					/>
				</>
			) : null}

			{auth.type === 'apikey' ? (
				<>
					<FormInput
						label="Key"
						value={auth.apiKeyName}
						placeholder="X-API-Key"
						onValueChange={(v) => onAuthChange({ apiKeyName: v })}
					/>
					<FormInput
						label="Value"
						type="password"
						value={auth.apiKeyValue}
						onValueChange={(v) => onAuthChange({ apiKeyValue: v })}
					/>
					<FormSelect
						label="Add to"
						value={auth.apiKeyLocation}
						options={API_KEY_LOCATION_OPTIONS}
						onValueChange={handleLocationChange}
						size="compact"
					/>
				</>
			) : null}

			{auth.type === 'none' ? (
				<p className="text-xs text-muted-foreground">
					This request will be sent without authentication.
				</p>
			) : null}
		</>
	);
}

interface ResponseCardProps {
	readonly response: RestResponse | null;
	readonly requestUrl: string | null;
	readonly activeTab: ResponseTab;
	readonly onTabChange: (tab: ResponseTab) => void;
}

function ResponseCard({ response, requestUrl, activeTab, onTabChange }: ResponseCardProps) {
	const redirected = response !== null && requestUrl !== null && response.finalUrl !== requestUrl;

	return (
		<Card density="compact">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
				<div className="flex items-center gap-2">
					<CardTitle className="text-sm font-medium">Response</CardTitle>
					{response ? (
						<ToneBadge tone={statusTone(response.status)} className="font-mono">
							{response.status} {response.statusText}
						</ToneBadge>
					) : null}
				</div>
				{response ? (
					<div className="flex items-center gap-3 text-xs text-muted-foreground">
						<TimingSummary response={response} />
						<span>{formatBytes(response.bytesReceived)}</span>
					</div>
				) : null}
			</CardHeader>
			<CardContent className="space-y-3">
				{redirected ? <RedirectNotice finalUrl={response.finalUrl} /> : null}
				{response ? (
					<ResponseTabs response={response} activeTab={activeTab} onTabChange={onTabChange} />
				) : (
					<EmbeddedEmptyState
						icon={Send}
						title="No response yet"
						description="Send a request to see the response here."
					/>
				)}
			</CardContent>
		</Card>
	);
}

interface RedirectNoticeProps {
	readonly finalUrl: string;
}

// Surface the post-redirect destination so a 200 that silently moved (HTTPS
// upgrade, trailing-slash, auth redirect) is not mistaken for a direct hit.
function RedirectNotice({ finalUrl }: RedirectNoticeProps) {
	return (
		<div className="flex items-center gap-2 rounded-md border bg-info/10 px-3 py-2 text-xs">
			<Link2 className="h-3.5 w-3.5 shrink-0 text-info" />
			<span className="text-muted-foreground">Redirected to</span>
			<span className="break-all font-mono text-foreground">{finalUrl}</span>
		</div>
	);
}

interface TimingSummaryProps {
	readonly response: RestResponse;
}

// Show the total elapsed time, plus the wait/download split when the body read
// took a measurable slice. The breakdown helps separate a slow server (high
// TTFB) from a large or slow transfer (high download time).
function TimingSummary({ response }: TimingSummaryProps): ReactNode {
	const showBreakdown = response.downloadMs > 0;
	return (
		<span
			title={`Wait ${response.ttfbMs} ms · Download ${response.downloadMs} ms`}
			className="font-mono"
		>
			{response.elapsedMs} ms
			{showBreakdown ? (
				<span className="ml-1 text-muted-foreground/70">
					({response.ttfbMs} + {response.downloadMs})
				</span>
			) : null}
		</span>
	);
}

interface ResponseTabsProps {
	readonly response: RestResponse;
	readonly activeTab: ResponseTab;
	readonly onTabChange: (tab: ResponseTab) => void;
}

function ResponseTabs({ response, activeTab, onTabChange }: ResponseTabsProps) {
	const contentType = headerValue(response.headers, 'content-type');
	const formattedBody = formatResponseBody(response.body, contentType);
	const cookies = parseSetCookie(response.headers);

	const handleValueChange = (v: string) => {
		if (v === 'body' || v === 'headers' || v === 'cookies') onTabChange(v);
	};

	return (
		<Tabs value={activeTab} onValueChange={handleValueChange} className="contents">
			<TabsList className="grid w-full grid-cols-3">
				<TabsTrigger value="body" className="gap-2">
					<FileText className="h-3.5 w-3.5" />
					Body
				</TabsTrigger>
				<TabsTrigger value="headers" className="gap-2">
					<Settings2 className="h-3.5 w-3.5" />
					Headers
					<Badge variant="secondary" className="ml-1 h-4 px-1.5 text-2xs">
						{response.headers.length}
					</Badge>
				</TabsTrigger>
				<TabsTrigger value="cookies" className="gap-2">
					<Cookie className="h-3.5 w-3.5" />
					Cookies
					{cookies.length > 0 ? (
						<Badge variant="secondary" className="ml-1 h-4 px-1.5 text-2xs">
							{cookies.length}
						</Badge>
					) : null}
				</TabsTrigger>
			</TabsList>

			<TabsContent value="body" className="pt-3">
				<ResponseBody raw={response.body} formatted={formattedBody} contentType={contentType} />
			</TabsContent>

			<TabsContent value="headers" className="pt-3">
				<ResponseHeaders headers={response.headers} />
			</TabsContent>

			<TabsContent value="cookies" className="pt-3">
				<ResponseCookies cookies={cookies} />
			</TabsContent>
		</Tabs>
	);
}

type BodyView = 'pretty' | 'raw';

interface ResponseBodyProps {
	readonly raw: string;
	readonly formatted: string;
	readonly contentType: string | undefined;
}

function ResponseBody({ raw, formatted, contentType }: ResponseBodyProps) {
	const [view, setView] = useState<BodyView>('pretty');
	const [query, setQuery] = useState('');
	// Offer the toggle only when pretty-printing actually changed the payload.
	const canPretty = formatted !== raw;
	const shown = canPretty && view === 'pretty' ? formatted : raw;

	const segments = useMemo(() => splitHighlight(shown, query), [shown, query]);
	const matchCount = useMemo(() => countMatches(shown, query), [shown, query]);

	const handleDownload = () => {
		downloadTextFile(shown, responseFilename(contentType)).catch(() => undefined);
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<span className="font-mono text-xs text-muted-foreground">
					{contentType ?? 'no content-type'}
				</span>
				<div className="flex items-center gap-2">
					{canPretty ? (
						<ToggleGroup
							type="single"
							size="sm"
							variant="outline"
							value={view}
							onValueChange={(v) => {
								if (v === 'pretty' || v === 'raw') setView(v);
							}}
						>
							<ToggleGroupItem value="pretty" className="text-xs">
								Pretty
							</ToggleGroupItem>
							<ToggleGroupItem value="raw" className="text-xs">
								Raw
							</ToggleGroupItem>
						</ToggleGroup>
					) : null}
					<Button
						variant="ghost"
						size="icon-sm"
						className="h-8 w-8 text-muted-foreground"
						onClick={handleDownload}
						disabled={shown.length === 0}
						aria-label="Download response body"
					>
						<Download className="h-3.5 w-3.5" />
					</Button>
					<CopyButton text={shown} toastLabel="Response body" size="sm" />
				</div>
			</div>
			{shown.length > 0 ? (
				<>
					<div className="relative">
						<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={query}
							placeholder="Search response body"
							className="h-8 pl-8 font-mono text-xs"
							onChange={(e) => setQuery(e.target.value)}
						/>
						{query.length > 0 ? (
							<span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-muted-foreground">
								{matchCount} {matchCount === 1 ? 'match' : 'matches'}
							</span>
						) : null}
					</div>
					<pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
						<HighlightedBody segments={segments} />
					</pre>
				</>
			) : (
				<p className="text-sm text-muted-foreground">Empty response body.</p>
			)}
		</div>
	);
}

interface HighlightedBodyProps {
	readonly segments: readonly HighlightSegment[];
}

// Render the body with matched runs wrapped in <mark>. A plain (empty-query)
// body is a single non-match segment, so this collapses to a bare string. Keys
// come from the running character offset (strictly increasing) so they stay
// unique and stable without relying on the array index.
function HighlightedBody({ segments }: HighlightedBodyProps): ReactNode {
	return segments.reduce<{ readonly offset: number; readonly nodes: readonly ReactNode[] }>(
		(acc, segment) => {
			const key = `${acc.offset}:${segment.text.length}`;
			const node = segment.match ? (
				<mark key={key} className="rounded-[2px] bg-warning/40 text-foreground">
					{segment.text}
				</mark>
			) : (
				<span key={key}>{segment.text}</span>
			);
			return { offset: acc.offset + segment.text.length, nodes: [...acc.nodes, node] };
		},
		{ offset: 0, nodes: [] }
	).nodes;
}

interface ResponseHeadersProps {
	readonly headers: readonly (readonly [string, string])[];
}

function ResponseHeaders({ headers }: ResponseHeadersProps): ReactNode {
	if (headers.length === 0) {
		return <p className="text-sm text-muted-foreground">No response headers.</p>;
	}
	// Disambiguate duplicate header names (Set-Cookie, etc.) by counting
	// occurrences so React keys are stable when re-rendering the same response.
	const seen = new Map<string, number>();
	const rows = headers.map(([key, value]) => {
		const occurrence = (seen.get(key) ?? 0) + 1;
		seen.set(key, occurrence);
		return { id: `${key}#${occurrence}`, key, value };
	});
	return (
		<div className="space-y-1">
			{rows.map((row) => (
				<div
					key={row.id}
					className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 border-b px-2 py-1.5 last:border-b-0"
				>
					<span className="break-all font-mono text-xs font-medium">{row.key}</span>
					<span className="break-all font-mono text-xs text-muted-foreground">{row.value}</span>
				</div>
			))}
		</div>
	);
}

interface ResponseCookiesProps {
	readonly cookies: readonly ParsedCookie[];
}

function ResponseCookies({ cookies }: ResponseCookiesProps): ReactNode {
	if (cookies.length === 0) {
		return <p className="text-sm text-muted-foreground">No cookies set by this response.</p>;
	}
	// Disambiguate cookies that share a name so React keys stay stable across
	// re-renders, mirroring the occurrence-counting in ResponseHeaders.
	const seen = new Map<string, number>();
	const rows = cookies.map((cookie) => {
		const occurrence = (seen.get(cookie.name) ?? 0) + 1;
		seen.set(cookie.name, occurrence);
		return { id: `${cookie.name}#${occurrence}`, cookie };
	});
	return (
		<div className="space-y-2">
			{rows.map(({ id, cookie }) => (
				<div key={id} className="space-y-1.5 rounded-md border px-3 py-2">
					<div className="flex items-baseline gap-2">
						<span className="break-all font-mono text-xs font-medium">{cookie.name}</span>
						<span className="break-all font-mono text-xs text-muted-foreground">
							{cookie.value}
						</span>
					</div>
					{cookie.attributes.length > 0 ? (
						<div className="flex flex-wrap gap-1">
							{cookie.attributes.map(([key, value]) => (
								<Badge
									key={`${id}:${key}`}
									variant="outline"
									className="font-mono text-2xs font-normal"
								>
									{value.length > 0 ? `${key}=${value}` : key}
								</Badge>
							))}
						</div>
					) : null}
				</div>
			))}
		</div>
	);
}

interface StatusBarContentProps {
	readonly response: RestResponse | null;
}

function StatusBarContent({ response }: StatusBarContentProps): ReactNode {
	if (!response) return null;
	const statusVariant: 'success' | 'warning' | 'error' =
		response.status >= 200 && response.status < 400
			? 'success'
			: response.status >= 400 && response.status < 500
				? 'warning'
				: 'error';
	return (
		<>
			<StatItem
				label="Status"
				value={`${response.status} ${response.statusText}`}
				variant={statusVariant}
			/>
			<StatItem label="Elapsed" value={`${response.elapsedMs} ms`} />
			<StatItem label="TTFB" value={`${response.ttfbMs} ms`} />
			<StatItem label="Size" value={formatBytes(response.bytesReceived)} />
		</>
	);
}
