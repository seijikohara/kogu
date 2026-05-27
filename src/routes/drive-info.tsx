import { createFileRoute } from '@tanstack/react-router';
import {
	HardDrive,
	HardDriveDownload,
	Loader2,
	Lock,
	RefreshCw,
	ShieldAlert,
	Usb,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { FormCheckbox, FormInfo, FormSection } from '@/lib/components/form';
import { DefinitionList, RelatedTools, SectionLabel } from '@/lib/components/layout';
import { ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, StatItem } from '@/lib/components/status';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Progress } from '@/lib/components/ui/progress';
import { useDocumentTitle } from '@/lib/hooks';
import {
	type DriveInfo,
	humanSize,
	isSystemFilesystem,
	listDrives,
	type UsageTier,
	usagePercent,
	usageTier,
} from '@/lib/services/drive-info';
import { createToolOptionsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

interface DriveInfoPrefs {
	readonly showSystem: boolean;
}

const DEFAULT_PREFS: DriveInfoPrefs = {
	showSystem: false,
};

const useDriveInfoPrefs = createToolOptionsStore<DriveInfoPrefs>('drive-info', DEFAULT_PREFS);

// Map the three usage tiers onto semantic palette tones so the
// progress bar and the inline badge share the same color story.
const TIER_PROGRESS_CLASS: Record<UsageTier, string> = {
	normal: '[&_[data-slot=progress-indicator]]:bg-success',
	warning: '[&_[data-slot=progress-indicator]]:bg-warning',
	critical: '[&_[data-slot=progress-indicator]]:bg-destructive',
};

const TIER_TEXT_CLASS: Record<UsageTier, string> = {
	normal: 'text-success',
	warning: 'text-warning',
	critical: 'text-destructive',
};

const TIER_BADGE_CLASS: Record<UsageTier, string> = {
	normal: 'border-success/40 bg-success/10 text-success',
	warning: 'border-warning/40 bg-warning/10 text-warning',
	critical: 'border-destructive/40 bg-destructive/10 text-destructive',
};

export const Route = createFileRoute('/drive-info')({
	component: DriveInfoPage,
});

function DriveInfoPage() {
	useDocumentTitle('Drive Info');

	const { value: prefs, patch } = useDriveInfoPrefs();

	const [drives, setDrives] = useState<readonly DriveInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [showRail, setShowRail] = useState(true);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const next = await listDrives();
			setDrives(next);
			setLoaded(true);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			setError(message);
			toast.error('Failed to enumerate drives', { description: message });
		} finally {
			setLoading(false);
		}
	}, []);

	// Initial load on mount. The backend snapshot is cheap; subsequent
	// refreshes go through the toolbar button so the user controls the
	// timing (avoids reloads racing while a removable drive mounts).
	useEffect(() => {
		refresh().catch(() => undefined);
	}, [refresh]);

	const visibleDrives = useMemo(() => {
		if (prefs.showSystem) return drives;
		return drives.filter((drive) => !isSystemFilesystem(drive.fileSystem));
	}, [drives, prefs.showSystem]);

	const hiddenCount = drives.length - visibleDrives.length;

	const totalCapacity = useMemo(
		() => visibleDrives.reduce((sum, drive) => sum + drive.totalBytes, 0),
		[visibleDrives]
	);
	const totalUsed = useMemo(
		() => visibleDrives.reduce((sum, drive) => sum + drive.usedBytes, 0),
		[visibleDrives]
	);
	const totalAvailable = useMemo(
		() => visibleDrives.reduce((sum, drive) => sum + drive.availableBytes, 0),
		[visibleDrives]
	);

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			valid={loaded ? true : null}
			error={error ?? undefined}
			toolbarLeading={
				<Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
					{loading ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<RefreshCw className="h-3.5 w-3.5" />
					)}
					Refresh
				</Button>
			}
			statusContent={
				<>
					<StatItem label="Drives" value={visibleDrives.length} />
					<StatItem label="Capacity" value={humanSize(totalCapacity)} />
					<StatItem label="Free" value={humanSize(totalAvailable)} />
				</>
			}
			rail={
				<>
					<FormSection title="Display">
						<FormCheckbox
							label="Show system / virtual filesystems"
							checked={prefs.showSystem}
							onCheckedChange={(checked) => patch({ showSystem: checked })}
							size="compact"
						/>
						{hiddenCount > 0 && !prefs.showSystem ? (
							<p className="text-2xs text-muted-foreground">
								{hiddenCount} system filesystem{hiddenCount === 1 ? '' : 's'} hidden.
							</p>
						) : null}
					</FormSection>

					<FormSection title="Related">
						<RelatedTools
							items={[
								{ id: 'duplicate-finder', reason: 'Reclaim space by removing duplicates' },
								{ id: 'folder-tree-visualizer', reason: 'Find the largest folders on a drive' },
								{ id: 'file-inspector', reason: 'Inspect a file on a drive' },
							]}
						/>
					</FormSection>

					<FormSection title="About">
						<FormInfo>
							Read-only snapshot of every disk the OS reports. Capacity and free space come from a
							single stat call per drive; click Refresh to re-query.
						</FormInfo>
					</FormSection>
				</>
			}
		>
			<DriveList
				drives={visibleDrives}
				loaded={loaded}
				loading={loading}
				totalCapacity={totalCapacity}
				totalUsed={totalUsed}
				totalAvailable={totalAvailable}
			/>
		</ToolShell>
	);
}

interface DriveListProps {
	readonly drives: readonly DriveInfo[];
	readonly loaded: boolean;
	readonly loading: boolean;
	readonly totalCapacity: number;
	readonly totalUsed: number;
	readonly totalAvailable: number;
}

function DriveList({
	drives,
	loaded,
	loading,
	totalCapacity,
	totalUsed,
	totalAvailable,
}: DriveListProps) {
	if (!loaded && loading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (drives.length === 0) {
		return (
			<EmbeddedEmptyState
				icon={HardDrive}
				title="No drives reported"
				description="The OS did not report any mounted drives. Try Refresh, or enable system filesystems in the rail."
				fillHeight
			/>
		);
	}

	const aggregateTier = usageTier(totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0);

	return (
		<div className="h-full overflow-auto p-4">
			<div className="mx-auto flex max-w-4xl flex-col gap-3">
				<TotalsCard
					capacity={totalCapacity}
					used={totalUsed}
					available={totalAvailable}
					tier={aggregateTier}
					count={drives.length}
				/>
				<div>
					<SectionLabel icon={HardDrive}>Mounted drives ({drives.length})</SectionLabel>
					<div className="flex flex-col gap-2">
						{drives.map((drive) => (
							<DriveCard key={`${drive.mountPoint}:${drive.name}`} drive={drive} />
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

interface TotalsCardProps {
	readonly capacity: number;
	readonly used: number;
	readonly available: number;
	readonly tier: UsageTier;
	readonly count: number;
}

function TotalsCard({ capacity, used, available, tier, count }: TotalsCardProps) {
	const percent = capacity > 0 ? (used / capacity) * 100 : 0;
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-sm">
					<HardDrive className="h-4 w-4 text-muted-foreground" />
					Aggregate usage
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				<Progress value={percent} className={cn('h-1.5', TIER_PROGRESS_CLASS[tier])} />
				<dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
					<dt className="text-muted-foreground">Drives</dt>
					<dd className="font-mono">{count}</dd>
					<dt className="text-muted-foreground">Capacity</dt>
					<dd className="font-mono">{humanSize(capacity)}</dd>
					<dt className="text-muted-foreground">Used</dt>
					<dd className={cn('font-mono', TIER_TEXT_CLASS[tier])}>
						{humanSize(used)} ({percent.toFixed(1)}%)
					</dd>
					<dt className="text-muted-foreground">Free</dt>
					<dd className="font-mono">{humanSize(available)}</dd>
				</dl>
			</CardContent>
		</Card>
	);
}

function DriveCard({ drive }: { readonly drive: DriveInfo }) {
	const percent = usagePercent(drive);
	const tier = usageTier(percent);
	const KindIcon = pickKindIcon(drive);
	return (
		<Card density="compact">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-sm">
					<KindIcon className="h-4 w-4 text-muted-foreground" />
					<span className="min-w-0 flex-1 truncate font-mono">{drive.name}</span>
					<div className="flex shrink-0 items-center gap-1">
						<Badge variant="outline" className="font-mono text-2xs">
							{drive.kind}
						</Badge>
						{drive.isRemovable ? (
							<Badge variant="outline" className="gap-1 font-mono text-2xs">
								<Usb className="h-3 w-3" />
								Removable
							</Badge>
						) : null}
						{drive.isReadOnly ? (
							<Badge
								variant="outline"
								className="gap-1 border-warning/40 bg-warning/10 font-mono text-2xs text-warning"
							>
								<Lock className="h-3 w-3" />
								Read only
							</Badge>
						) : null}
					</div>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				<Progress value={percent} className={cn('h-1.5', TIER_PROGRESS_CLASS[tier])} />
				<div className="flex items-center justify-between text-xs">
					<span className={cn('font-mono', TIER_TEXT_CLASS[tier])}>{percent.toFixed(1)}% used</span>
					<Badge variant="outline" className={cn('font-mono text-2xs', TIER_BADGE_CLASS[tier])}>
						{tier === 'critical' ? (
							<ShieldAlert className="h-3 w-3" />
						) : (
							<HardDrive className="h-3 w-3" />
						)}
						{humanSize(drive.availableBytes)} free
					</Badge>
				</div>
				<DefinitionList
					items={[
						{ key: 'Mount point', value: drive.mountPoint, break: true },
						{ key: 'Filesystem', value: drive.fileSystem || '—' },
						{
							key: 'Total',
							value: `${humanSize(drive.totalBytes)} (${drive.totalBytes.toLocaleString()} B)`,
						},
						{ key: 'Used', value: humanSize(drive.usedBytes) },
						{ key: 'Free', value: humanSize(drive.availableBytes) },
					]}
				/>
			</CardContent>
		</Card>
	);
}

/**
 * Pick a Lucide glyph for a drive based on its removable / kind hint.
 * Falls back to the generic disk icon when neither hint matches.
 */
const pickKindIcon = (drive: DriveInfo): LucideIcon => {
	if (drive.isRemovable) return Usb;
	if (drive.kind === 'SSD' || drive.kind === 'HDD') return HardDriveDownload;
	return HardDrive;
};
