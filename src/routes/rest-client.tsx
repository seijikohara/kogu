import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import {
	Code2,
	FileText,
	FlaskConical,
	Globe,
	Loader2,
	Plus,
	Send,
	Settings2,
	Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormError,
	FormInput,
	FormSection,
	FormSelect,
	FormSlider,
} from '@/lib/components/form';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Checkbox } from '@/lib/components/ui/checkbox';
import { Input } from '@/lib/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import { Textarea } from '@/lib/components/ui/textarea';
import { ToneBadge } from '@/lib/components/ui/tone-badge';
import { useDocumentTitle } from '@/lib/hooks';
import {
	createEmptyHeader,
	createHeaderId,
	exportAsCurl,
	formatBytes,
	formatResponseBody,
	HTTP_METHODS,
	type HeaderEntry,
	type HttpMethod,
	headerValue,
	headersToTuples,
	isHttpMethod,
	type RestResponse,
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

interface RestClientOptions {
	readonly method: HttpMethod;
	readonly url: string;
	readonly headers: readonly HeaderEntry[];
	readonly body: string;
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
	body: '',
	followRedirects: true,
	timeoutMs: TIMEOUT_DEFAULT_MS,
};

const useRestClientOptions = createToolOptionsStore<RestClientOptions>('rest-client', DEFAULTS);

const METHOD_OPTIONS = HTTP_METHODS.map((m) => ({ value: m, label: m }));

export const Route = createFileRoute('/rest-client')({
	component: RestClientPage,
});

type RequestTab = 'headers' | 'body';
type ResponseTab = 'body' | 'headers';

function RestClientPage() {
	const { value: options, patch } = useRestClientOptions();
	const { method, url, headers, body, followRedirects, timeoutMs } = options;

	const [response, setResponse] = useState<RestResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [sending, setSending] = useState(false);
	const [requestTab, setRequestTab] = useState<RequestTab>('headers');
	const [responseTab, setResponseTab] = useState<ResponseTab>('body');

	useDocumentTitle('HTTP REST Client');

	const canSend = url.trim().length > 0 && !sending;

	const enabledHeaderCount = useMemo(
		() => headers.filter((h) => h.enabled && h.key.trim().length > 0).length,
		[headers]
	);

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

	const handleLoadGetSample = () => {
		patch({ method: 'GET', url: SAMPLE_GET_URL, body: '' });
		setRequestTab('headers');
	};

	const handleLoadPostSample = () => {
		patch({
			method: 'POST',
			url: SAMPLE_POST_URL,
			body: SAMPLE_POST_BODY,
			headers: [
				...headers.filter((h) => h.key.trim().toLowerCase() !== 'content-type' || !h.enabled),
				{
					id: createHeaderId(),
					key: 'Content-Type',
					value: 'application/json',
					enabled: true,
				},
			],
		});
		setRequestTab('body');
	};

	const handleCopyCurl = async () => {
		if (!url.trim()) {
			toast.error('Enter a URL first');
			return;
		}
		const command = exportAsCurl({
			method,
			url,
			headers: headersToTuples(headers),
			body,
			followRedirects,
			timeoutMs,
		});
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
		try {
			const res = await sendRequest({
				method,
				url,
				headers: headersToTuples(headers),
				body,
				followRedirects,
				timeoutMs,
			});
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
		/>
	);

	const statusContent = <StatusBarContent response={response} />;

	return (
		<ToolShell
			valid={error ? false : response ? true : null}
			error={error ?? undefined}
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
							headers={headers}
							enabledHeaderCount={enabledHeaderCount}
							body={body}
							onHeaderChange={handleHeaderChange}
							onHeaderRemove={handleHeaderRemove}
							onHeaderAdd={() => patch({ headers: [...headers, createEmptyHeader()] })}
							onBodyChange={(e) => patch({ body: e.target.value })}
						/>

						{error ? <ErrorCard message={error} /> : null}

						<ResponseCard
							response={response}
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
	readonly headers: readonly HeaderEntry[];
	readonly enabledHeaderCount: number;
	readonly body: string;
	readonly onHeaderChange: (id: string, delta: Partial<HeaderEntry>) => void;
	readonly onHeaderRemove: (id: string) => void;
	readonly onHeaderAdd: () => void;
	readonly onBodyChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
}

function RequestPanel({
	activeTab,
	onTabChange,
	headers,
	enabledHeaderCount,
	body,
	onHeaderChange,
	onHeaderRemove,
	onHeaderAdd,
	onBodyChange,
}: RequestPanelProps) {
	const handleValueChange = (v: string) => {
		if (v === 'headers' || v === 'body') onTabChange(v);
	};

	return (
		<Card density="compact">
			<CardContent className="space-y-3">
				<Tabs value={activeTab} onValueChange={handleValueChange}>
					<TabsList className="grid w-full grid-cols-2">
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
							{body.trim().length > 0 ? (
								<Badge variant="secondary" className="ml-1 h-4 px-1.5 text-2xs">
									{body.length}
								</Badge>
							) : null}
						</TabsTrigger>
					</TabsList>

					<TabsContent value="headers" className="space-y-2 pt-3">
						<HeadersEditor
							headers={headers}
							onHeaderChange={onHeaderChange}
							onHeaderRemove={onHeaderRemove}
							onHeaderAdd={onHeaderAdd}
						/>
					</TabsContent>

					<TabsContent value="body" className="space-y-2 pt-3">
						<Textarea
							value={body}
							placeholder='{"key": "value"}'
							rows={10}
							className="font-mono text-sm"
							onChange={onBodyChange}
						/>
						<p className="text-xs text-muted-foreground">
							Content-Type defaults to <code className="font-mono">text/plain</code> unless set in
							Headers.
						</p>
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

interface ErrorCardProps {
	readonly message: string;
}

function ErrorCard({ message }: ErrorCardProps) {
	return (
		<Card density="compact" variant="destructive">
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-medium text-destructive">Request failed</CardTitle>
			</CardHeader>
			<CardContent>
				<FormError message={message} />
			</CardContent>
		</Card>
	);
}

interface ResponseCardProps {
	readonly response: RestResponse | null;
	readonly activeTab: ResponseTab;
	readonly onTabChange: (tab: ResponseTab) => void;
}

function ResponseCard({ response, activeTab, onTabChange }: ResponseCardProps) {
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
						<span>{response.elapsedMs} ms</span>
						<span>{formatBytes(response.bytesReceived)}</span>
					</div>
				) : null}
			</CardHeader>
			<CardContent>
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

interface ResponseTabsProps {
	readonly response: RestResponse;
	readonly activeTab: ResponseTab;
	readonly onTabChange: (tab: ResponseTab) => void;
}

function ResponseTabs({ response, activeTab, onTabChange }: ResponseTabsProps) {
	const contentType = headerValue(response.headers, 'content-type');
	const formattedBody = formatResponseBody(response.body, contentType);

	const handleValueChange = (v: string) => {
		if (v === 'body' || v === 'headers') onTabChange(v);
	};

	return (
		<Tabs value={activeTab} onValueChange={handleValueChange}>
			<TabsList className="grid w-full grid-cols-2">
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
			</TabsList>

			<TabsContent value="body" className="pt-3">
				<ResponseBody body={formattedBody} contentType={contentType} />
			</TabsContent>

			<TabsContent value="headers" className="pt-3">
				<ResponseHeaders headers={response.headers} />
			</TabsContent>
		</Tabs>
	);
}

interface ResponseBodyProps {
	readonly body: string;
	readonly contentType: string | undefined;
}

function ResponseBody({ body, contentType }: ResponseBodyProps) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<span className="font-mono text-xs text-muted-foreground">
					{contentType ?? 'no content-type'}
				</span>
				<CopyButton text={body} toastLabel="Response body" size="sm" />
			</div>
			{body.length > 0 ? (
				<pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
					{body}
				</pre>
			) : (
				<p className="text-sm text-muted-foreground">Empty response body.</p>
			)}
		</div>
	);
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
			<StatItem label="Size" value={formatBytes(response.bytesReceived)} />
		</>
	);
}
