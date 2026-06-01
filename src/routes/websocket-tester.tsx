import { createFileRoute } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, FlaskConical, Plug, PlugZap, Send, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ActionButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormInput,
	FormMode,
	FormSection,
	FormTextarea,
} from '@/lib/components/form';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent } from '@/lib/components/ui/card';
import { ToneBadge, type ToneBadgeTone } from '@/lib/components/ui/tone-badge';
import { useDocumentTitle } from '@/lib/hooks';
import {
	formatHexDump,
	onWsMessage,
	onWsState,
	parseSubprotocols,
	SAMPLE_URL,
	tryPrettifyJson,
	wsClose,
	wsConnect,
	wsSend,
	type WsConnectionState,
	type WsDirection,
	type WsFrame,
	type WsFrameKind,
} from '@/lib/services/websocket';
import { createToolOptionsStore } from '@/lib/stores';
import { cn, getErrorMessage } from '@/lib/utils';

type ComposeKind = 'text' | 'binary';

interface WebSocketTesterOptions {
	readonly url: string;
	readonly subprotocols: string;
	readonly autoDecodeJson: boolean;
	readonly composeKind: ComposeKind;
	readonly composeText: string;
	readonly composeHex: string;
}

const DEFAULTS: WebSocketTesterOptions = {
	url: '',
	subprotocols: '',
	autoDecodeJson: true,
	composeKind: 'text',
	composeText: '',
	composeHex: '',
};

const useWebSocketTesterOptions = createToolOptionsStore<WebSocketTesterOptions>(
	'websocket-tester',
	DEFAULTS
);

interface LogEntry extends WsFrame {
	readonly logId: string;
}

const STATE_TONE: Record<WsConnectionState, ToneBadgeTone | null> = {
	idle: null,
	connecting: 'info',
	open: 'success',
	closing: 'warning',
	closed: 'destructive',
};

const STATE_LABEL: Record<WsConnectionState, string> = {
	idle: 'Idle',
	connecting: 'Connecting...',
	open: 'Open',
	closing: 'Closing...',
	closed: 'Closed',
};

const KIND_LABEL: Record<WsFrameKind, string> = {
	text: 'text',
	binary: 'binary',
	ping: 'ping',
	pong: 'pong',
	close: 'close',
};

const formatTimestamp = (timestampMs: number): string => {
	const date = new Date(timestampMs);
	const hh = date.getHours().toString().padStart(2, '0');
	const mm = date.getMinutes().toString().padStart(2, '0');
	const ss = date.getSeconds().toString().padStart(2, '0');
	const ms = date.getMilliseconds().toString().padStart(3, '0');
	return `${hh}:${mm}:${ss}.${ms}`;
};

const formatBytes = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
};

export const Route = createFileRoute('/websocket-tester')({
	component: WebSocketTesterPage,
});

function WebSocketTesterPage() {
	const { value: options, patch } = useWebSocketTesterOptions();
	const { url, subprotocols, autoDecodeJson, composeKind, composeText, composeHex } = options;

	const [connId, setConnId] = useState<string>(() => crypto.randomUUID());
	const [state, setState] = useState<WsConnectionState>('idle');
	const [closeReason, setCloseReason] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [frames, setFrames] = useState<readonly LogEntry[]>([]);

	const connIdRef = useRef(connId);
	connIdRef.current = connId;

	const logRef = useRef<HTMLDivElement | null>(null);

	useDocumentTitle('WebSocket Tester');

	// Event subscriptions: register once on mount, unsubscribe on unmount.
	useEffect(() => {
		let unMessage: (() => void) | null = null;
		let unState: (() => void) | null = null;
		let cancelled = false;

		const init = async () => {
			const msgUnlisten = await onWsMessage((frame) => {
				if (frame.connId !== connIdRef.current) return;
				setFrames((prev) => [...prev, { ...frame, logId: `${frame.timestampMs}-${prev.length}` }]);
			});
			const stateUnlisten = await onWsState((change) => {
				if (change.connId !== connIdRef.current) return;
				setState(change.state);
				if (change.state === 'closed') {
					setCloseReason(change.reason ?? null);
				} else {
					setCloseReason(null);
				}
			});
			if (cancelled) {
				msgUnlisten();
				stateUnlisten();
				return;
			}
			unMessage = msgUnlisten;
			unState = stateUnlisten;
		};
		init().catch(() => {
			toast.error('Failed to subscribe to WebSocket events');
		});

		return () => {
			cancelled = true;
			unMessage?.();
			unState?.();
		};
	}, []);

	// Auto-scroll to bottom whenever new frames arrive.
	useEffect(() => {
		const el = logRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [frames]);

	const canConnect = url.trim().length > 0 && (state === 'idle' || state === 'closed');
	const canDisconnect = state === 'open' || state === 'connecting';
	const canSend = state === 'open';

	const sentCount = useMemo(() => frames.filter((f) => f.direction === 'sent').length, [frames]);
	const receivedCount = useMemo(
		() => frames.filter((f) => f.direction === 'received').length,
		[frames]
	);

	const handleConnect = useCallback(async () => {
		if (!canConnect) return;
		setError(null);
		setCloseReason(null);
		// Use a fresh connection id so leftover events from a previous session
		// (which already unsubscribed) cannot cross-contaminate this one.
		const nextId = crypto.randomUUID();
		setConnId(nextId);
		try {
			await wsConnect(nextId, url.trim(), [], parseSubprotocols(subprotocols));
		} catch (e) {
			const message = getErrorMessage(e);
			setError(message);
			toast.error('Connect failed', { description: message });
		}
	}, [canConnect, url, subprotocols]);

	const handleDisconnect = useCallback(async () => {
		if (!canDisconnect) return;
		try {
			await wsClose(connId);
		} catch (e) {
			toast.error('Disconnect failed', { description: getErrorMessage(e) });
		}
	}, [canDisconnect, connId]);

	const handleSend = useCallback(async () => {
		if (!canSend) return;
		const payload = composeKind === 'text' ? composeText : composeHex;
		if (payload.length === 0) {
			toast.warning('Nothing to send', {
				description: 'Enter a message before sending.',
			});
			return;
		}
		try {
			await wsSend(connId, composeKind, payload);
			if (composeKind === 'text') {
				patch({ composeText: '' });
			} else {
				patch({ composeHex: '' });
			}
		} catch (e) {
			toast.error('Send failed', { description: getErrorMessage(e) });
		}
	}, [canSend, composeKind, composeText, composeHex, connId, patch]);

	const handleLoadSample = useCallback(() => {
		patch({ url: SAMPLE_URL });
		toast.success('Sample loaded', { description: SAMPLE_URL });
	}, [patch]);

	const handleClearLog = useCallback(() => {
		setFrames([]);
	}, []);

	const stateTone = STATE_TONE[state];
	const stateLabel =
		state === 'closed' && closeReason
			? `${STATE_LABEL.closed}: ${closeReason}`
			: STATE_LABEL[state];

	const rail = (
		<WebSocketTesterRail
			state={state}
			canConnect={canConnect}
			canDisconnect={canDisconnect}
			subprotocols={subprotocols}
			autoDecodeJson={autoDecodeJson}
			onSubprotocolsChange={(v) => patch({ subprotocols: v })}
			onAutoDecodeJsonChange={(v) => patch({ autoDecodeJson: v })}
			onConnect={() => {
				handleConnect().catch(() => {});
			}}
			onDisconnect={() => {
				handleDisconnect().catch(() => {});
			}}
			onLoadSample={handleLoadSample}
			onClearLog={handleClearLog}
		/>
	);

	const statusContent = (
		<>
			<StatItem label="State" value={STATE_LABEL[state]} />
			<StatItem label="Frames" value={frames.length} />
			<StatItem label="Sent" value={sentCount} />
			<StatItem label="Received" value={receivedCount} />
		</>
	);

	return (
		<ToolShell
			valid={error ? false : state === 'open' ? true : null}
			error={error ?? undefined}
			rail={rail}
			statusContent={statusContent}
		>
			<div className="flex h-full flex-col overflow-hidden">
				<ConnectionBar
					url={url}
					state={state}
					stateLabel={stateLabel}
					stateTone={stateTone}
					canConnect={canConnect}
					canDisconnect={canDisconnect}
					onUrlChange={(v) => patch({ url: v })}
					onConnect={() => {
						handleConnect().catch(() => {});
					}}
					onDisconnect={() => {
						handleDisconnect().catch(() => {});
					}}
				/>

				<div ref={logRef} className="flex-1 overflow-auto p-4">
					<div className="mx-auto flex max-w-3xl flex-col gap-2">
						{frames.length === 0 ? (
							<EmbeddedEmptyState
								icon={Plug}
								title="No frames yet"
								description="Connect to a WebSocket endpoint to start exchanging frames."
							/>
						) : (
							frames.map((frame) => (
								<FrameBubble key={frame.logId} frame={frame} autoDecodeJson={autoDecodeJson} />
							))
						)}
					</div>
				</div>

				<ComposerBar
					composeKind={composeKind}
					composeText={composeText}
					composeHex={composeHex}
					canSend={canSend}
					onKindChange={(v) => patch({ composeKind: v })}
					onTextChange={(v) => patch({ composeText: v })}
					onHexChange={(v) => patch({ composeHex: v })}
					onSend={() => {
						handleSend().catch(() => {});
					}}
				/>
			</div>
		</ToolShell>
	);
}

interface WebSocketTesterRailProps {
	readonly state: WsConnectionState;
	readonly canConnect: boolean;
	readonly canDisconnect: boolean;
	readonly subprotocols: string;
	readonly autoDecodeJson: boolean;
	readonly onSubprotocolsChange: (value: string) => void;
	readonly onAutoDecodeJsonChange: (value: boolean) => void;
	readonly onConnect: () => void;
	readonly onDisconnect: () => void;
	readonly onLoadSample: () => void;
	readonly onClearLog: () => void;
}

function WebSocketTesterRail({
	state,
	canConnect,
	canDisconnect,
	subprotocols,
	autoDecodeJson,
	onSubprotocolsChange,
	onAutoDecodeJsonChange,
	onConnect,
	onDisconnect,
	onLoadSample,
	onClearLog,
}: WebSocketTesterRailProps) {
	const connecting = state === 'connecting';
	return (
		<>
			<FormSection title="Connection">
				{canDisconnect ? (
					<ActionButton
						label="Disconnect"
						icon={Plug}
						variant="destructive"
						loading={state === 'closing'}
						loadingLabel="Closing..."
						onClick={onDisconnect}
					/>
				) : (
					<ActionButton
						label="Connect"
						icon={PlugZap}
						loading={connecting}
						loadingLabel="Connecting..."
						disabled={!canConnect}
						onClick={onConnect}
					/>
				)}
			</FormSection>

			<FormSection title="Subprotocols">
				<FormInput
					label="Subprotocols"
					value={subprotocols}
					placeholder="graphql-ws, graphql-transport-ws"
					hint="Comma-separated. Sent in Sec-WebSocket-Protocol on connect."
					onValueChange={onSubprotocolsChange}
					size="compact"
				/>
			</FormSection>

			<FormSection title="Display">
				<FormCheckbox
					label="Auto-decode JSON"
					hint="Pretty-print received text frames when they parse as JSON."
					checked={autoDecodeJson}
					onCheckedChange={onAutoDecodeJsonChange}
					size="compact"
				/>
			</FormSection>

			<FormSection title="Samples">
				<Button variant="outline" size="sm" className="w-full" onClick={onLoadSample}>
					<FlaskConical className="h-3.5 w-3.5" />
					Load echo sample
				</Button>
			</FormSection>

			<FormSection title="Actions">
				<Button variant="outline" size="sm" className="w-full" onClick={onClearLog}>
					<Trash2 className="h-3.5 w-3.5" />
					Clear log
				</Button>
			</FormSection>

			<ToolFooter
				relatedItems={[
					{ id: 'rest-client', reason: 'Build and send HTTP requests' },
					{ id: 'curl-builder', reason: 'Build and parse cURL commands' },
					{ id: 'webhook-receiver', reason: 'Inspect incoming HTTP requests' },
				]}
				aboutText={
					<>
						Local WebSocket client. Connections go directly from your machine. Custom request
						headers are deferred to a follow-up change.
					</>
				}
			/>
		</>
	);
}

interface ConnectionBarProps {
	readonly url: string;
	readonly state: WsConnectionState;
	readonly stateLabel: string;
	readonly stateTone: ToneBadgeTone | null;
	readonly canConnect: boolean;
	readonly canDisconnect: boolean;
	readonly onUrlChange: (value: string) => void;
	readonly onConnect: () => void;
	readonly onDisconnect: () => void;
}

function ConnectionBar({
	url,
	state,
	stateLabel,
	stateTone,
	canConnect,
	canDisconnect,
	onUrlChange,
	onConnect,
	onDisconnect,
}: ConnectionBarProps) {
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && canConnect) {
			e.preventDefault();
			onConnect();
		}
	};

	return (
		<div className="shrink-0 border-b bg-surface-2 px-4 py-3">
			<div className="mx-auto flex max-w-3xl items-end gap-2">
				<div className="flex-1">
					<label htmlFor="ws-url" className="mb-1 block text-xs font-medium text-muted-foreground">
						WebSocket URL
					</label>
					<input
						id="ws-url"
						type="text"
						value={url}
						placeholder="wss://example.com/socket"
						onChange={(e) => onUrlChange(e.target.value)}
						onKeyDown={handleKeyDown}
						className="flex h-9 w-full rounded-md border bg-background px-3 py-1 font-mono text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					/>
				</div>
				{canDisconnect ? (
					<Button
						type="button"
						variant="destructive"
						className="h-9"
						onClick={onDisconnect}
						aria-label="Disconnect WebSocket"
					>
						<Plug className="h-4 w-4" />
						Disconnect
					</Button>
				) : (
					<Button
						type="button"
						className="h-9"
						disabled={!canConnect}
						onClick={onConnect}
						aria-label="Connect WebSocket"
					>
						<PlugZap className="h-4 w-4" />
						Connect
					</Button>
				)}
			</div>
			<div className="mx-auto mt-2 flex max-w-3xl items-center gap-2">
				<span className="text-xs font-medium text-muted-foreground">State:</span>
				{stateTone ? (
					<ToneBadge tone={stateTone}>{stateLabel}</ToneBadge>
				) : (
					<Badge variant="outline">{stateLabel}</Badge>
				)}
				<span className="text-xs text-muted-foreground" aria-hidden="true">
					{state === 'connecting' || state === 'closing' ? '...' : ''}
				</span>
			</div>
		</div>
	);
}

interface FrameBubbleProps {
	readonly frame: LogEntry;
	readonly autoDecodeJson: boolean;
}

function FrameBubble({ frame, autoDecodeJson }: FrameBubbleProps) {
	const isSent = frame.direction === 'sent';
	const DirectionIcon = isSent ? ArrowRight : ArrowLeft;
	const directionLabel: WsDirection = frame.direction;

	const isBinary = frame.kind === 'binary' || frame.kind === 'ping' || frame.kind === 'pong';
	const displayText =
		!isBinary && autoDecodeJson && frame.kind === 'text'
			? tryPrettifyJson(frame.data).text
			: frame.data;

	const formattedBody = isBinary ? formatHexDump(frame.data) : displayText;

	return (
		<div className={cn('flex w-full', isSent ? 'justify-end' : 'justify-start')}>
			<Card
				density="compact"
				className={cn(
					'max-w-[85%] min-w-0',
					isSent
						? 'border-primary/30 bg-primary/5'
						: frame.kind === 'close'
							? 'border-destructive/30 bg-destructive/5'
							: 'bg-muted/40'
				)}
			>
				<CardContent className="space-y-1.5">
					<div className="flex items-center gap-2 text-2xs text-muted-foreground">
						<DirectionIcon className="h-3 w-3" aria-hidden="true" />
						<span className="sr-only">{directionLabel}</span>
						<span className="font-mono tabular-nums">{formatTimestamp(frame.timestampMs)}</span>
						<Badge variant="secondary" className="h-4 px-1.5 text-2xs uppercase">
							{KIND_LABEL[frame.kind]}
						</Badge>
						<span className="font-mono tabular-nums">{formatBytes(frame.sizeBytes)}</span>
					</div>
					<pre
						className={cn(
							'whitespace-pre-wrap break-words font-mono text-xs leading-snug',
							isBinary && 'break-all'
						)}
					>
						{formattedBody || (isBinary ? '(empty)' : '')}
					</pre>
				</CardContent>
			</Card>
		</div>
	);
}

interface ComposerBarProps {
	readonly composeKind: ComposeKind;
	readonly composeText: string;
	readonly composeHex: string;
	readonly canSend: boolean;
	readonly onKindChange: (value: ComposeKind) => void;
	readonly onTextChange: (value: string) => void;
	readonly onHexChange: (value: string) => void;
	readonly onSend: () => void;
}

function ComposerBar({
	composeKind,
	composeText,
	composeHex,
	canSend,
	onKindChange,
	onTextChange,
	onHexChange,
	onSend,
}: ComposerBarProps) {
	return (
		<div className="shrink-0 border-t bg-surface-2 px-4 py-3">
			<div className="mx-auto flex max-w-3xl flex-col gap-2">
				<FormMode<ComposeKind>
					label="Compose"
					value={composeKind}
					layout="stacked"
					descriptionDisplay="selected"
					options={[
						{
							value: 'text',
							label: 'Text',
							description: 'Send a UTF-8 string. Press Ctrl/Cmd+Enter to send.',
						},
						{
							value: 'binary',
							label: 'Binary (hex)',
							description: 'Send raw bytes. Accepts spaces and colons (e.g. 48 65 6c 6c 6f).',
						},
					]}
					onValueChange={onKindChange}
				/>
				<div className="flex items-end gap-2">
					<div className="flex-1">
						{composeKind === 'text' ? (
							<FormTextarea
								label="Message"
								value={composeText}
								rows={3}
								placeholder='{"type":"ping"}'
								onValueChange={onTextChange}
								size="compact"
							/>
						) : (
							<FormInput
								label="Hex bytes"
								value={composeHex}
								placeholder="48 65 6c 6c 6f"
								onValueChange={onHexChange}
								size="compact"
							/>
						)}
					</div>
					<Button
						type="button"
						className="h-9"
						disabled={!canSend}
						onClick={onSend}
						aria-label="Send WebSocket frame"
					>
						<Send className="h-4 w-4" />
						Send
					</Button>
				</div>
			</div>
		</div>
	);
}
