import { createFileRoute } from '@tanstack/react-router';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Activity, FolderOpen, Pause, Play, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormInput,
	FormSection,
} from '@/lib/components/form';
import { RelatedTools } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { useDocumentTitle } from '@/lib/hooks';
import {
	EVENT_RING_CAPACITY,
	type FileWatchEvent,
	type FileWatchEventKind,
	useFileWatch,
} from '@/lib/services/file-watch';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import { cn } from '@/lib/utils';

const ALL_KINDS: readonly FileWatchEventKind[] = ['create', 'modify', 'delete', 'rename'];

const KIND_LABEL: Readonly<Record<FileWatchEventKind, string>> = {
	create: 'Create',
	modify: 'Modify',
	delete: 'Delete',
	rename: 'Rename',
};

// Distinct tones per event kind so a long log remains scannable.
const KIND_BADGE_CLASS: Readonly<Record<FileWatchEventKind, string>> = {
	create: 'border-success/40 bg-success/10 text-success',
	modify: 'border-info/40 bg-info/10 text-info',
	delete: 'border-destructive/40 bg-destructive/10 text-destructive',
	rename: 'border-warning/40 bg-warning/10 text-warning',
};

interface FileWatchPrefs {
	readonly enabledKinds: readonly FileWatchEventKind[];
	readonly lastPath: string;
}

const DEFAULT_PREFS: FileWatchPrefs = {
	enabledKinds: ['create', 'modify', 'delete', 'rename'],
	lastPath: '',
};

const useFileWatchPrefs = createToolOptionsStore<FileWatchPrefs>('file-watch', DEFAULT_PREFS);

export const Route = createFileRoute('/file-watch')({
	component: FileWatchPage,
});

function FileWatchPage() {
	useDocumentTitle('File Watch');

	const { value: prefs, patch } = useFileWatchPrefs();

	const [path, setPath] = useState(prefs.lastPath);
	const [showRail, setShowRail] = usePersistedRail('file-watch');
	const [error, setError] = useState<string | null>(null);

	const { events, watching, start, stop, clear } = useFileWatch();

	const enabledKindSet = useMemo(() => new Set(prefs.enabledKinds), [prefs.enabledKinds]);

	const filteredEvents = useMemo(
		() => events.filter((event) => enabledKindSet.has(event.kind)),
		[events, enabledKindSet]
	);

	const handleBrowse = useCallback(async () => {
		try {
			const selected = await openDialog({ multiple: false, directory: true });
			if (typeof selected === 'string' && selected.length > 0) {
				setPath(selected);
				patch({ lastPath: selected });
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			toast.error('Failed to open folder dialog', { description: message });
		}
	}, [patch]);

	const handleToggleWatch = useCallback(async () => {
		setError(null);
		if (watching) {
			await stop();
			return;
		}
		if (!path) {
			toast.error('Pick a path to watch');
			return;
		}
		try {
			await start(path);
			patch({ lastPath: path });
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			setError(message);
			toast.error('Failed to start watcher', { description: message });
		}
	}, [path, patch, start, stop, watching]);

	const handleToggleKind = useCallback(
		(kind: FileWatchEventKind, checked: boolean) => {
			const next = new Set(prefs.enabledKinds);
			if (checked) next.add(kind);
			else next.delete(kind);
			patch({ enabledKinds: ALL_KINDS.filter((k) => next.has(k)) });
		},
		[patch, prefs.enabledKinds]
	);

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			valid={watching ? true : null}
			error={error ?? undefined}
			statusContent={
				<>
					<StatItem label="Events" value={filteredEvents.length} />
					<StatItem label="Active watchers" value={watching ? 1 : 0} />
				</>
			}
			rail={
				<>
					<FormSection title="Watch path">
						<FormInput
							label="Path"
							value={path}
							placeholder="/path/to/watch"
							size="compact"
							onValueChange={setPath}
						/>
						<Button variant="outline" size="sm" onClick={handleBrowse}>
							<FolderOpen className="h-3.5 w-3.5" />
							Browse…
						</Button>
					</FormSection>

					<FormSection title="Control">
						<Button
							variant={watching ? 'outline' : 'default'}
							size="sm"
							onClick={handleToggleWatch}
						>
							{watching ? (
								<>
									<Pause className="h-3.5 w-3.5" />
									Stop
								</>
							) : (
								<>
									<Play className="h-3.5 w-3.5" />
									Start
								</>
							)}
						</Button>
						<Button variant="outline" size="sm" onClick={clear} disabled={events.length === 0}>
							<Trash2 className="h-3.5 w-3.5" />
							Clear log
						</Button>
					</FormSection>

					<FormSection title="Filter event types">
						<FormCheckboxGroup>
							{ALL_KINDS.map((kind) => (
								<FormCheckbox
									key={kind}
									label={KIND_LABEL[kind]}
									checked={enabledKindSet.has(kind)}
									onCheckedChange={(checked) => handleToggleKind(kind, checked)}
									size="compact"
								/>
							))}
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="Related">
						<RelatedTools
							items={[
								{ id: 'file-inspector', reason: 'Inspect a changed file in detail' },
								{ id: 'hex-editor', reason: 'View raw bytes of an updated file' },
								{ id: 'folder-tree-visualizer', reason: 'See size impact of the watched tree' },
							]}
						/>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							Recursive filesystem watcher. The most recent {EVENT_RING_CAPACITY} events are
							buffered in memory; older events are dropped.
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-hidden p-4">
				<Card density="compact" className="flex h-full min-h-0 flex-col">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-sm">
							<Activity className="h-4 w-4 text-muted-foreground" />
							Event log
						</CardTitle>
					</CardHeader>
					<CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
						{filteredEvents.length === 0 ? (
							<EmbeddedEmptyState
								icon={Activity}
								title={watching ? 'Listening for changes…' : 'No events yet'}
								description={
									watching
										? 'Modify a file inside the watched path to see events appear here.'
										: 'Pick a path in the rail and press Start to begin watching.'
								}
								fillHeight
							/>
						) : (
							<EventLog events={filteredEvents} />
						)}
					</CardContent>
				</Card>
			</div>
		</ToolShell>
	);
}

interface EventLogProps {
	readonly events: readonly FileWatchEvent[];
}

function EventLog({ events }: EventLogProps) {
	return (
		<div className="flex-1 overflow-auto">
			<ul className="divide-y">
				{events.map((event) => (
					<li key={event.seq} className="flex items-center gap-3 px-3 py-1.5 text-xs">
						<time className="w-24 shrink-0 font-mono text-2xs text-muted-foreground">
							{formatTime(event.timestamp)}
						</time>
						<Badge
							variant="outline"
							className={cn(
								'w-16 shrink-0 justify-center font-mono text-2xs',
								KIND_BADGE_CLASS[event.kind]
							)}
						>
							{KIND_LABEL[event.kind]}
						</Badge>
						<span className="min-w-0 flex-1 truncate font-mono text-2xs" title={event.path}>
							{event.path}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

// Compact HH:MM:SS.sss time format. The full date is rarely useful in
// a live log because every event was observed in the current session.
function formatTime(ms: number): string {
	const date = new Date(ms);
	const hh = String(date.getHours()).padStart(2, '0');
	const mm = String(date.getMinutes()).padStart(2, '0');
	const ss = String(date.getSeconds()).padStart(2, '0');
	const millis = String(date.getMilliseconds()).padStart(3, '0');
	return `${hh}:${mm}:${ss}.${millis}`;
}
