import { createFileRoute } from '@tanstack/react-router';
import {
	Activity,
	Clock,
	Code2,
	Eraser,
	Inbox,
	Play,
	RotateCcw,
	Server,
	Square,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { CopyButton } from '@/lib/components/action';
import { FormInfo, FormInput, FormSection, FormTextarea } from '@/lib/components/form';
import { RelatedTools, SubsectionLabel } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { ToneBadge } from '@/lib/components/ui/tone-badge';
import { useDocumentTitle } from '@/lib/hooks';
import {
	exportAsCurl,
	formatBytes,
	formatTimestamp,
	headerValue,
	methodTone,
	onWebhookRequest,
	parseQueryPairs,
	tryPrettifyJson,
	webhookStart,
	webhookStatus,
	webhookStop,
	type WebhookRequest,
	type WebhookStatus,
} from '@/lib/services/webhook';
import { createToolOptionsStore } from '@/lib/stores';
import { cn, getErrorMessage } from '@/lib/utils';

interface WebhookReceiverOptions {
	readonly port: string;
	readonly responseStatus: string;
	readonly responseContentType: string;
	readonly responseBody: string;
}

const DEFAULT_RESPONSE_BODY = `{
  "received": true
}`;

const DEFAULTS: WebhookReceiverOptions = {
	port: '',
	responseStatus: '200',
	responseContentType: 'application/json',
	responseBody: DEFAULT_RESPONSE_BODY,
};

const SAMPLE_ECHO_JSON = `{
  "received": true,
  "method": "$method",
  "path": "$path"
}`;

const SAMPLE_PLAIN_OK = 'OK';

const MAX_LOG_ENTRIES = 500;

const useWebhookOptions = createToolOptionsStore<WebhookReceiverOptions>(
	'webhook-receiver',
	DEFAULTS
);

export const Route = createFileRoute('/webhook-receiver')({
	component: WebhookReceiverPage,
});

function WebhookReceiverPage() {
	const { value: options, patch, reset } = useWebhookOptions();
	const { port, responseStatus, responseContentType, responseBody } = options;

	const [serverStatus, setServerStatus] = useState<WebhookStatus | null>(null);
	const [requests, setRequests] = useState<readonly WebhookRequest[]>([]);
	const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useDocumentTitle('Webhook Receiver');

	useEffect(() => {
		let unlisten: (() => void) | undefined;
		let cancelled = false;
		(async () => {
			const off = await onWebhookRequest((req) => {
				setRequests((prev) => {
					const next = [req, ...prev];
					return next.length > MAX_LOG_ENTRIES ? next.slice(0, MAX_LOG_ENTRIES) : next;
				});
			});
			if (cancelled) {
				off();
				return;
			}
			unlisten = off;
		})().catch(() => {
			// Listener registration failures are non-fatal; the user simply
			// will not see live updates until the next page mount.
		});
		webhookStatus()
			.then((s) => setServerStatus(s))
			.catch(() => setServerStatus(null));
		return () => {
			cancelled = true;
			unlisten?.();
		};
	}, []);

	const isRunning = serverStatus?.running ?? false;
	const boundAddress = serverStatus?.address ?? null;

	const handleStart = useCallback(async () => {
		setError(null);
		setBusy(true);
		try {
			const portNumber = port.trim().length > 0 ? Number.parseInt(port.trim(), 10) : undefined;
			if (port.trim().length > 0 && (!Number.isFinite(portNumber) || (portNumber ?? 0) < 0)) {
				throw new Error(`Invalid port: ${port}`);
			}
			const statusNumber = Number.parseInt(responseStatus.trim(), 10);
			if (!Number.isFinite(statusNumber) || statusNumber < 100 || statusNumber > 599) {
				throw new Error(`Status code must be between 100 and 599 (got ${responseStatus})`);
			}
			const result = await webhookStart({
				port: portNumber,
				status: statusNumber,
				responseBody,
				responseContentType,
			});
			setServerStatus({ running: true, address: result.address, port: result.port });
			toast.success(`Listening on ${result.address}`);
		} catch (e) {
			const message = getErrorMessage(e);
			setError(message);
			toast.error('Failed to start listener', { description: message });
		} finally {
			setBusy(false);
		}
	}, [port, responseBody, responseContentType, responseStatus]);

	const handleStop = useCallback(async () => {
		setBusy(true);
		try {
			await webhookStop();
			setServerStatus({ running: false, address: null, port: null });
			toast.success('Listener stopped');
		} catch (e) {
			toast.error('Failed to stop listener', { description: getErrorMessage(e) });
		} finally {
			setBusy(false);
		}
	}, []);

	const handleClearLog = useCallback(() => {
		setRequests([]);
		setSelectedRequestId(null);
	}, []);

	const selectedRequest = useMemo(
		() => (selectedRequestId ? (requests.find((r) => r.id === selectedRequestId) ?? null) : null),
		[requests, selectedRequestId]
	);

	const lastRequestLabel = useMemo(() => {
		const latest = requests[0];
		if (!latest) return '—';
		return formatTimestamp(latest.timestampMs);
	}, [requests]);

	const rail = (
		<WebhookRail
			isRunning={isRunning}
			busy={busy}
			port={port}
			responseStatus={responseStatus}
			responseContentType={responseContentType}
			responseBody={responseBody}
			onPatch={patch}
			onReset={reset}
			onStart={handleStart}
			onStop={handleStop}
			onLoadEcho={() =>
				patch({ responseContentType: 'application/json', responseBody: SAMPLE_ECHO_JSON })
			}
			onLoadPlain={() =>
				patch({ responseContentType: 'text/plain', responseBody: SAMPLE_PLAIN_OK })
			}
			onClearLog={handleClearLog}
		/>
	);

	const statusContent = (
		<StatusBarContent
			isRunning={isRunning}
			port={serverStatus?.port ?? null}
			requestCount={requests.length}
			lastRequestLabel={lastRequestLabel}
		/>
	);

	return (
		<ToolShell
			valid={error ? false : isRunning ? true : null}
			error={error ?? undefined}
			rail={rail}
			statusContent={statusContent}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="flex-1 overflow-auto p-4">
					<div className="mx-auto flex max-w-5xl flex-col gap-4">
						<ServerStatusCard
							isRunning={isRunning}
							busy={busy}
							address={boundAddress}
							onStart={handleStart}
							onStop={handleStop}
						/>

						<RequestLogCard
							requests={requests}
							selectedId={selectedRequestId}
							onSelect={setSelectedRequestId}
						/>

						{selectedRequest ? (
							<RequestDetailCard request={selectedRequest} address={boundAddress} />
						) : null}
					</div>
				</div>
			</div>
		</ToolShell>
	);
}

interface WebhookRailProps {
	readonly isRunning: boolean;
	readonly busy: boolean;
	readonly port: string;
	readonly responseStatus: string;
	readonly responseContentType: string;
	readonly responseBody: string;
	readonly onPatch: (delta: Partial<WebhookReceiverOptions>) => void;
	readonly onReset: () => void;
	readonly onStart: () => void;
	readonly onStop: () => void;
	readonly onLoadEcho: () => void;
	readonly onLoadPlain: () => void;
	readonly onClearLog: () => void;
}

function WebhookRail({
	isRunning,
	busy,
	port,
	responseStatus,
	responseContentType,
	responseBody,
	onPatch,
	onReset,
	onStart,
	onStop,
	onLoadEcho,
	onLoadPlain,
	onClearLog,
}: WebhookRailProps) {
	return (
		<>
			<FormSection title="Server">
				<FormInput
					label="Port"
					value={port}
					placeholder="Leave empty for ephemeral"
					hint="When empty, the OS picks an unused port."
					size="compact"
					onValueChange={(v) => onPatch({ port: v })}
				/>
				{isRunning ? (
					<Button
						type="button"
						className="w-full"
						variant="destructive"
						onClick={onStop}
						disabled={busy}
					>
						<Square className="h-3.5 w-3.5" />
						Stop listener
					</Button>
				) : (
					<Button type="button" className="w-full" onClick={onStart} disabled={busy}>
						<Play className="h-3.5 w-3.5" />
						Start listener
					</Button>
				)}
			</FormSection>

			<FormSection title="Response">
				<FormInput
					label="Status code"
					value={responseStatus}
					placeholder="200"
					size="compact"
					onValueChange={(v) => onPatch({ responseStatus: v })}
				/>
				<FormInput
					label="Content-Type"
					value={responseContentType}
					placeholder="application/json"
					size="compact"
					onValueChange={(v) => onPatch({ responseContentType: v })}
				/>
				<FormTextarea
					label="Body"
					value={responseBody}
					rows={6}
					size="compact"
					onValueChange={(v) => onPatch({ responseBody: v })}
				/>
				<Button variant="outline" size="sm" className="w-full" onClick={onReset}>
					<RotateCcw className="h-3.5 w-3.5" />
					Reset to defaults
				</Button>
			</FormSection>

			<FormSection title="Samples">
				<Button variant="outline" size="sm" className="w-full" onClick={onLoadEcho}>
					Echo JSON
				</Button>
				<Button variant="outline" size="sm" className="w-full" onClick={onLoadPlain}>
					Plain text OK
				</Button>
			</FormSection>

			<FormSection title="Actions">
				<Button variant="outline" size="sm" className="w-full" onClick={onClearLog}>
					<Eraser className="h-3.5 w-3.5" />
					Clear log
				</Button>
			</FormSection>

			<FormSection title="Related">
				<RelatedTools items={[{ id: 'rest-client', reason: 'Replay a captured request' }]} />
			</FormSection>

			<FormSection title="About">
				<FormInfo>
					Binds to 127.0.0.1 only — never reachable from another machine. Restart the app to reset
					listener state if a command fails.
				</FormInfo>
			</FormSection>
		</>
	);
}

interface ServerStatusCardProps {
	readonly isRunning: boolean;
	readonly busy: boolean;
	readonly address: string | null;
	readonly onStart: () => void;
	readonly onStop: () => void;
}

function ServerStatusCard({ isRunning, busy, address, onStart, onStop }: ServerStatusCardProps) {
	return (
		<Card density="compact">
			<CardHeader className="pb-3">
				<div className="flex items-center gap-2">
					<Server className="h-4 w-4 text-muted-foreground" />
					<CardTitle className="text-sm font-medium">Listener</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				<div className="flex flex-wrap items-center gap-3">
					<ToneBadge tone={isRunning ? 'success' : 'warning'}>
						{isRunning ? 'Running' : 'Stopped'}
					</ToneBadge>
					{isRunning && address ? (
						<>
							<code className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
								{address}
							</code>
							<CopyButton text={address} label="Copy URL" />
						</>
					) : (
						<span className="flex-1 text-sm text-muted-foreground">
							Start the listener to receive requests.
						</span>
					)}
					{isRunning ? (
						<Button type="button" variant="destructive" size="sm" onClick={onStop} disabled={busy}>
							<Square className="h-3.5 w-3.5" />
							Stop
						</Button>
					) : (
						<Button type="button" size="sm" onClick={onStart} disabled={busy}>
							<Play className="h-3.5 w-3.5" />
							Start
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

interface RequestLogCardProps {
	readonly requests: readonly WebhookRequest[];
	readonly selectedId: string | null;
	readonly onSelect: (id: string) => void;
}

function RequestLogCard({ requests, selectedId, onSelect }: RequestLogCardProps) {
	return (
		<Card density="compact">
			<CardHeader className="pb-3">
				<div className="flex items-center gap-2">
					<Inbox className="h-4 w-4 text-muted-foreground" />
					<CardTitle className="text-sm font-medium">
						Requests
						{requests.length > 0 ? (
							<span className="ml-1.5 text-xs font-normal text-muted-foreground">
								({requests.length})
							</span>
						) : null}
					</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				{requests.length === 0 ? (
					<EmbeddedEmptyState
						icon={Inbox}
						title="Waiting for requests"
						description="Start the listener, then send an HTTP request to the bound address. Each request appears here as it arrives."
					/>
				) : (
					<RequestTable requests={requests} selectedId={selectedId} onSelect={onSelect} />
				)}
			</CardContent>
		</Card>
	);
}

interface RequestTableProps {
	readonly requests: readonly WebhookRequest[];
	readonly selectedId: string | null;
	readonly onSelect: (id: string) => void;
}

function RequestTable({ requests, selectedId, onSelect }: RequestTableProps) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-xs">
				<thead>
					<tr className="border-b text-left text-muted-foreground">
						<th className="py-1.5 pr-3 font-medium">Time</th>
						<th className="py-1.5 pr-3 font-medium">Method</th>
						<th className="py-1.5 pr-3 font-medium">Path</th>
						<th className="py-1.5 pr-3 font-medium">Content-Type</th>
						<th className="py-1.5 pr-3 font-medium">Size</th>
					</tr>
				</thead>
				<tbody>
					{requests.map((req) => {
						const isSelected = req.id === selectedId;
						const contentType = headerValue(req.headers, 'content-type') ?? '—';
						return (
							<tr
								key={req.id}
								onClick={() => onSelect(req.id)}
								className={cn(
									'cursor-pointer border-b border-border/40 transition-colors hover:bg-interactive-hover',
									isSelected && 'bg-interactive-hover'
								)}
							>
								<td className="py-1.5 pr-3 font-mono text-muted-foreground">
									{formatTimestamp(req.timestampMs)}
								</td>
								<td className="py-1.5 pr-3">
									<ToneBadge tone={methodTone(req.method)}>{req.method}</ToneBadge>
								</td>
								<td className="py-1.5 pr-3 font-mono">
									{req.path}
									{req.query ? <span className="text-muted-foreground">?{req.query}</span> : null}
								</td>
								<td className="py-1.5 pr-3 font-mono text-muted-foreground">{contentType}</td>
								<td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
									{formatBytes(req.bodyBytes)}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

interface RequestDetailCardProps {
	readonly request: WebhookRequest;
	readonly address: string | null;
}

function RequestDetailCard({ request, address }: RequestDetailCardProps) {
	const contentType = headerValue(request.headers, 'content-type');
	const { text: prettyBody, isJson } = useMemo(
		() => tryPrettifyJson(request.body, contentType),
		[request.body, contentType]
	);

	const queryPairs = useMemo(() => parseQueryPairs(request.query), [request.query]);
	const replayUrl = useMemo(() => {
		const origin = address ?? 'http://127.0.0.1';
		const trimmed = origin.endsWith('/') ? origin.slice(0, -1) : origin;
		return `${trimmed}${request.path}${request.query ? `?${request.query}` : ''}`;
	}, [address, request.path, request.query]);

	const handleCopyCurl = useCallback(async () => {
		const command = exportAsCurl(request, replayUrl);
		try {
			await navigator.clipboard.writeText(command);
			toast.success('cURL command copied to clipboard');
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	}, [request, replayUrl]);

	return (
		<Card density="compact">
			<CardHeader className="pb-3">
				<div className="flex flex-wrap items-center gap-2">
					<ToneBadge tone={methodTone(request.method)}>{request.method}</ToneBadge>
					<code className="flex-1 truncate font-mono text-sm">
						{request.path}
						{request.query ? <span className="text-muted-foreground">?{request.query}</span> : null}
					</code>
					<span className="text-xs text-muted-foreground">from {request.remoteAddr}</span>
					<Button variant="outline" size="sm" onClick={handleCopyCurl}>
						<Code2 className="h-3.5 w-3.5" />
						Copy as cURL
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<DetailSection title={`Headers (${request.headers.length})`}>
					<KeyValueTable rows={request.headers.map(([k, v]) => [k, v] as const)} />
				</DetailSection>

				<DetailSection title={`Query (${queryPairs.length})`}>
					{queryPairs.length === 0 ? (
						<p className="text-xs text-muted-foreground">No query parameters.</p>
					) : (
						<KeyValueTable rows={queryPairs.map(([k, v]) => [k, v] as const)} />
					)}
				</DetailSection>

				<DetailSection title={`Body (${formatBytes(request.bodyBytes)}${isJson ? ' · JSON' : ''})`}>
					{request.body.length === 0 ? (
						<p className="text-xs text-muted-foreground">Empty body.</p>
					) : (
						<pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
							{prettyBody}
						</pre>
					)}
				</DetailSection>
			</CardContent>
		</Card>
	);
}

interface DetailSectionProps {
	readonly title: string;
	readonly children: React.ReactNode;
}

function DetailSection({ title, children }: DetailSectionProps) {
	return (
		<section className="space-y-2">
			<SubsectionLabel>{title}</SubsectionLabel>
			{children}
		</section>
	);
}

interface KeyValueTableProps {
	readonly rows: readonly (readonly [string, string])[];
}

function KeyValueTable({ rows }: KeyValueTableProps) {
	if (rows.length === 0) {
		return <p className="text-xs text-muted-foreground">No entries.</p>;
	}
	// Headers and query strings can legitimately repeat the same key (e.g.
	// multiple `Set-Cookie`), so the key + value pair is the most stable
	// React key available without rebuilding the source data.
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-xs">
				<tbody>
					{rows.map(([key, value]) => (
						<tr key={`${key}=${value}`} className="border-b border-border/40 last:border-b-0">
							<td className="w-1/3 py-1 pr-3 font-mono text-muted-foreground">{key}</td>
							<td className="py-1 break-all font-mono">{value}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

interface StatusBarContentProps {
	readonly isRunning: boolean;
	readonly port: number | null;
	readonly requestCount: number;
	readonly lastRequestLabel: string;
}

function StatusBarContent({
	isRunning,
	port,
	requestCount,
	lastRequestLabel,
}: StatusBarContentProps) {
	return (
		<>
			<StatItem
				label="Status"
				value={isRunning ? 'Running' : 'Stopped'}
				icon={Activity}
				variant={isRunning ? 'success' : 'default'}
			/>
			<StatItem label="Port" value={port ?? '—'} />
			<StatItem label="Requests" value={requestCount} />
			<StatItem label="Last" value={lastRequestLabel} icon={Clock} />
		</>
	);
}
