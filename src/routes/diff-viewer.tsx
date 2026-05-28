import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Equal, GitCompare, Layers, Minus, Plus, SplitSquareHorizontal } from 'lucide-react';
import { readText } from '@tauri-apps/plugin-clipboard-manager';

import { CodeEditor } from '@/lib/components/editor';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormMode,
	FormSection,
	FormSlider,
} from '@/lib/components/form';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { EmbeddedEmptyState, EmptyState } from '@/lib/components/status';
import { useDocumentTitle } from '@/lib/hooks';
import { usePersistedRail } from '@/lib/stores';
import {
	areTextsIdentical,
	computeEnhancedDiff,
	type DiffOptions,
	type DiffSegment,
	defaultDiffOptions,
	formatHunkHeader,
	getDiffLeftLineBgClass,
	getDiffPrefixClass,
	getDiffRightLineBgClass,
	getDiffSegmentClass,
	getDiffUnifiedLineClass,
	getDiffUnifiedSegmentClass,
	SAMPLE_LEFT_TEXT,
	SAMPLE_RIGHT_TEXT,
} from '@/lib/services/text-diff';

type ViewMode = 'split' | 'unified';

interface UnifiedLineWithSegments {
	readonly kind: 'hunk-header' | 'line';
	readonly prefix?: '+' | '-' | ' ';
	readonly content: string;
	readonly type: 'equal' | 'insert' | 'delete' | 'header';
	readonly segments?: readonly DiffSegment[];
	readonly leftLineNumber?: number | null;
	readonly rightLineNumber?: number | null;
}

export const Route = createFileRoute('/diff-viewer')({
	component: DiffViewerPage,
});

function DiffViewerPage() {
	const [leftInput, setLeftInput] = useState('');
	const [rightInput, setRightInput] = useState('');
	const [viewMode, setViewMode] = useState<ViewMode>('split');
	const [showOptions, setShowOptions] = usePersistedRail('diff-viewer');

	const [ignoreWhitespace, setIgnoreWhitespace] = useState<boolean>(
		defaultDiffOptions.ignoreWhitespace
	);
	const [ignoreCase, setIgnoreCase] = useState<boolean>(defaultDiffOptions.ignoreCase);
	const [trimLines, setTrimLines] = useState<boolean>(defaultDiffOptions.trimLines);
	const [contextLines, setContextLines] = useState(3);
	const [showInlineDiff, setShowInlineDiff] = useState(true);

	useDocumentTitle('Diff Viewer');

	const diffOptions: Partial<DiffOptions> = { ignoreWhitespace, ignoreCase, trimLines };

	const enhancedDiff =
		!leftInput && !rightInput
			? null
			: computeEnhancedDiff(leftInput, rightInput, diffOptions, contextLines);

	const isIdentical = (() => {
		if (!leftInput && !rightInput) return null;
		return areTextsIdentical(leftInput, rightInput, diffOptions);
	})();

	const stats = enhancedDiff?.stats ?? null;
	const valid: boolean | null = !leftInput && !rightInput ? null : isIdentical === true;

	const unifiedWithSegments: readonly UnifiedLineWithSegments[] = (() => {
		if (!enhancedDiff) return [];
		const lines: UnifiedLineWithSegments[] = [];

		const flushChangeBlock = (
			deletes: UnifiedLineWithSegments[],
			inserts: UnifiedLineWithSegments[]
		) => {
			deletes.forEach((d) => lines.push(d));
			inserts.forEach((i) => lines.push(i));
		};

		enhancedDiff.hunks.forEach((hunk) => {
			lines.push({
				kind: 'hunk-header',
				content: formatHunkHeader(hunk),
				type: 'header',
			});

			// Buffers for the current change block. Held on a const cursor so
			// the in-place clears use field assignment instead of let-rebind.
			const pending: {
				deletes: UnifiedLineWithSegments[];
				inserts: UnifiedLineWithSegments[];
			} = { deletes: [], inserts: [] };

			hunk.lines.forEach((line) => {
				if (line.type === 'equal') {
					flushChangeBlock(pending.deletes, pending.inserts);
					pending.deletes = [];
					pending.inserts = [];
					lines.push({
						kind: 'line',
						prefix: ' ',
						content: line.leftContent,
						type: 'equal',
						leftLineNumber: line.leftLineNumber,
						rightLineNumber: line.rightLineNumber,
					});
				} else if (line.type === 'modified') {
					pending.deletes.push({
						kind: 'line',
						prefix: '-',
						content: line.leftContent,
						type: 'delete',
						segments: line.leftSegments,
						leftLineNumber: line.leftLineNumber,
						rightLineNumber: null,
					});
					pending.inserts.push({
						kind: 'line',
						prefix: '+',
						content: line.rightContent,
						type: 'insert',
						segments: line.rightSegments,
						leftLineNumber: null,
						rightLineNumber: line.rightLineNumber,
					});
				} else if (line.type === 'delete') {
					pending.deletes.push({
						kind: 'line',
						prefix: '-',
						content: line.leftContent,
						type: 'delete',
						leftLineNumber: line.leftLineNumber,
						rightLineNumber: null,
					});
				} else if (line.type === 'insert') {
					pending.inserts.push({
						kind: 'line',
						prefix: '+',
						content: line.rightContent,
						type: 'insert',
						leftLineNumber: null,
						rightLineNumber: line.rightLineNumber,
					});
				}
			});

			flushChangeBlock(pending.deletes, pending.inserts);
		});

		return lines;
	})();

	const handleLeftPaste = async () => {
		try {
			const text = await readText();
			if (text) setLeftInput(text);
		} catch {
			// Clipboard access denied
		}
	};

	const handleRightPaste = async () => {
		try {
			const text = await readText();
			if (text) setRightInput(text);
		} catch {
			// Clipboard access denied
		}
	};

	const handleLeftClear = () => setLeftInput('');
	const handleRightClear = () => setRightInput('');

	const handleSample = () => {
		setLeftInput(SAMPLE_LEFT_TEXT);
		setRightInput(SAMPLE_RIGHT_TEXT);
	};

	const renderInputs = () => (
		<div className="flex h-1/4 min-h-32 shrink-0 border-b">
			<div className="flex-1 border-r">
				<CodeEditor
					title="Original"
					value={leftInput}
					onChange={setLeftInput}
					mode="input"
					editorMode="plain"
					placeholder="Original text..."
					onSample={handleSample}
					onPaste={handleLeftPaste}
					onClear={handleLeftClear}
					showViewToggle={false}
				/>
			</div>
			<div className="flex-1">
				<CodeEditor
					title="Modified"
					value={rightInput}
					onChange={setRightInput}
					mode="input"
					editorMode="plain"
					placeholder="Modified text..."
					onPaste={handleRightPaste}
					onClear={handleRightClear}
					showViewToggle={false}
				/>
			</div>
		</div>
	);

	const emptyState = (
		<EmptyState
			icon={SplitSquareHorizontal}
			title="Enter text on both sides"
			description="Add input on the left and right to see differences."
		/>
	);

	const identicalState = (
		<EmbeddedEmptyState
			icon={Equal}
			title="Files are identical"
			description="No differences found"
			tone="success"
			fillHeight
		/>
	);

	return (
		<ToolShell
			valid={valid}
			showRail={showOptions}
			onShowRailChange={setShowOptions}
			statusContent={
				stats ? (
					<>
						<span className="flex items-center gap-1 text-success">
							<Plus className="h-3 w-3" />
							<strong>{stats.addedLines}</strong>
						</span>
						<span className="flex items-center gap-1 text-destructive">
							<Minus className="h-3 w-3" />
							<strong>{stats.removedLines}</strong>
						</span>
						{stats.modifiedLines > 0 ? (
							<span className="flex items-center gap-1 text-warning">
								<GitCompare className="h-3 w-3" />
								<strong>{stats.modifiedLines}</strong>
							</span>
						) : null}
						<span className="flex items-center gap-1 text-muted-foreground">
							<Equal className="h-3 w-3" />
							<strong className="text-foreground">{stats.unchangedLines}</strong>
						</span>
						{stats.hunkCount > 0 ? (
							<span className="flex items-center gap-1 text-muted-foreground">
								<Layers className="h-3 w-3" />
								<strong className="text-foreground">{stats.hunkCount}</strong>
								<span className="text-xs">chunks</span>
							</span>
						) : null}
						{isIdentical ? (
							<span className="rounded bg-success/20 px-1.5 py-0.5 text-xs font-medium text-success">
								Identical
							</span>
						) : null}
					</>
				) : null
			}
			rail={
				<>
					<FormSection title="View">
						<FormMode
							value={viewMode}
							onValueChange={setViewMode}
							options={[
								{ value: 'split', label: 'Split' },
								{ value: 'unified', label: 'Unified' },
							]}
						/>
					</FormSection>

					<FormSection title="Display">
						<FormCheckbox
							label="Inline character diff"
							checked={showInlineDiff}
							onCheckedChange={setShowInlineDiff}
							size="compact"
						/>
						<FormSlider
							label="Context lines"
							value={contextLines}
							onValueChange={setContextLines}
							min={0}
							max={10}
							step={1}
							showValue
							size="compact"
						/>
					</FormSection>

					<FormSection title="Comparison">
						<FormCheckboxGroup>
							<FormCheckbox
								label="Ignore whitespace"
								checked={ignoreWhitespace}
								onCheckedChange={setIgnoreWhitespace}
								size="compact"
							/>
							<FormCheckbox
								label="Ignore case"
								checked={ignoreCase}
								onCheckedChange={setIgnoreCase}
								size="compact"
							/>
							<FormCheckbox
								label="Trim lines"
								checked={trimLines}
								onCheckedChange={setTrimLines}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="Legend">
						<FormInfo showIcon={false}>
							<div className="space-y-1.5 text-xs">
								<div className="flex items-center gap-2">
									<span className="inline-block h-3 w-3 rounded-sm bg-destructive/30" />
									<span>Removed lines</span>
								</div>
								<div className="flex items-center gap-2">
									<span className="inline-block h-3 w-3 rounded-sm bg-success/30" />
									<span>Added lines</span>
								</div>
								<div className="flex items-center gap-2">
									<span className="inline-block h-3 w-3 rounded-sm bg-warning/20" />
									<span>Modified lines</span>
								</div>
								{showInlineDiff ? (
									<div className="mt-2 border-t pt-2">
										<div className="flex items-center gap-2">
											<span className="inline-block rounded-sm bg-destructive/40 px-1 text-xs">
												abc
											</span>
											<span>Deleted chars</span>
										</div>
										<div className="flex items-center gap-2">
											<span className="inline-block rounded-sm bg-success/40 px-1 text-xs">
												xyz
											</span>
											<span>Added chars</span>
										</div>
									</div>
								) : null}
							</div>
						</FormInfo>
					</FormSection>

					<ToolFooter
						aboutText={
							<ul className="list-inside list-disc space-y-0.5">
								<li>LCS algorithm for line diff</li>
								<li>Character-level inline diff</li>
								<li>Git-style hunk grouping</li>
							</ul>
						}
					/>
				</>
			}
		>
			{viewMode === 'split' ? (
				<div className="flex h-full flex-col overflow-hidden">
					{renderInputs()}
					<div className="flex flex-1 flex-col overflow-hidden">
						<div className="flex h-9 shrink-0 items-center justify-between border-b bg-surface-3 px-3">
							<span className="text-xs font-medium text-muted-foreground">Side-by-Side Diff</span>
							{stats && stats.hunkCount > 0 ? (
								<span className="text-xs text-muted-foreground">
									{stats.addedChars} chars added, {stats.removedChars} chars removed
								</span>
							) : null}
						</div>
						<div className="flex-1 overflow-auto">
							{enhancedDiff && enhancedDiff.hunks.length > 0 && (leftInput || rightInput) ? (
								<div className="font-mono text-sm">
									{enhancedDiff.hunks.map((hunk, hunkIdx) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: hunks are immutable and ordered
										<div key={`hunk-${hunkIdx}-${formatHunkHeader(hunk)}`}>
											<div className="sticky top-0 z-10 flex min-h-7 items-center border-y bg-info/10 px-3 text-xs font-semibold text-info">
												<span className="font-mono">{formatHunkHeader(hunk)}</span>
											</div>
											{hunk.lines.map((line, lineIdx) => (
												// biome-ignore lint/suspicious/noArrayIndexKey: diff result is immutable and ordered
												<div key={`l-${hunkIdx}-${lineIdx}-${line.type}`} className="flex min-h-6">
													<div
														className={`flex flex-1 border-r ${line.type === 'insert' ? 'bg-muted/20' : getDiffLeftLineBgClass(line.type)}`}
													>
														<span className="w-12 shrink-0 select-none border-r bg-muted/50 px-2 text-right text-xs text-muted-foreground">
															{line.type !== 'insert' ? (line.leftLineNumber ?? '') : ''}
														</span>
														<span
															className={`w-6 shrink-0 select-none text-center text-xs font-bold ${line.type === 'delete' || line.type === 'modified' ? 'text-destructive' : 'text-transparent'}`}
														>
															{line.type === 'delete' || line.type === 'modified' ? '−' : ''}
														</span>
														<span className="flex-1 whitespace-pre px-2">
															{line.type === 'insert' ? null : showInlineDiff &&
															  line.leftSegments &&
															  line.leftSegments.length > 0 ? (
																line.leftSegments.map((seg, sIdx) => (
																	<span
																		// biome-ignore lint/suspicious/noArrayIndexKey: diff segment list is immutable
																		key={`ls-${hunkIdx}-${lineIdx}-${sIdx}`}
																		className={getDiffSegmentClass(seg.type, 'left')}
																	>
																		{seg.value}
																	</span>
																))
															) : (
																<span
																	className={
																		line.type === 'delete' || line.type === 'modified'
																			? 'text-destructive'
																			: ''
																	}
																>
																	{line.leftContent}
																</span>
															)}
														</span>
													</div>
													<div
														className={`flex flex-1 ${line.type === 'delete' ? 'bg-muted/20' : getDiffRightLineBgClass(line.type)}`}
													>
														<span className="w-12 shrink-0 select-none border-r bg-muted/50 px-2 text-right text-xs text-muted-foreground">
															{line.type !== 'delete' ? (line.rightLineNumber ?? '') : ''}
														</span>
														<span
															className={`w-6 shrink-0 select-none text-center text-xs font-bold ${line.type === 'insert' || line.type === 'modified' ? 'text-success' : 'text-transparent'}`}
														>
															{line.type === 'insert' || line.type === 'modified' ? '+' : ''}
														</span>
														<span className="flex-1 whitespace-pre px-2">
															{line.type === 'delete' ? null : showInlineDiff &&
															  line.rightSegments &&
															  line.rightSegments.length > 0 ? (
																line.rightSegments.map((seg, sIdx) => (
																	<span
																		// biome-ignore lint/suspicious/noArrayIndexKey: diff segment list is immutable
																		key={`rs-${hunkIdx}-${lineIdx}-${sIdx}`}
																		className={getDiffSegmentClass(seg.type, 'right')}
																	>
																		{seg.value}
																	</span>
																))
															) : (
																<span
																	className={
																		line.type === 'insert' || line.type === 'modified'
																			? 'text-success'
																			: ''
																	}
																>
																	{line.rightContent}
																</span>
															)}
														</span>
													</div>
												</div>
											))}
											{hunkIdx < enhancedDiff.hunks.length - 1 ? (
												<div className="h-2 border-b bg-muted/20" />
											) : null}
										</div>
									))}
								</div>
							) : !leftInput && !rightInput ? (
								emptyState
							) : isIdentical ? (
								identicalState
							) : null}
						</div>
					</div>
				</div>
			) : (
				<div className="flex h-full flex-col overflow-hidden">
					{renderInputs()}
					<div className="flex flex-1 flex-col overflow-hidden">
						<div className="flex h-9 shrink-0 items-center justify-between border-b bg-surface-3 px-3">
							<span className="text-xs font-medium text-muted-foreground">Unified Diff</span>
							{stats && stats.hunkCount > 0 ? (
								<span className="text-xs text-muted-foreground">
									{stats.addedChars} chars added, {stats.removedChars} chars removed
								</span>
							) : null}
						</div>
						<div className="flex-1 overflow-auto">
							{unifiedWithSegments.length > 0 ? (
								<div className="font-mono text-sm">
									{unifiedWithSegments.map((line, lIdx) => {
										if (line.kind === 'hunk-header') {
											return (
												<div
													// biome-ignore lint/suspicious/noArrayIndexKey: diff result is immutable and ordered
													key={`u-h-${lIdx}-${line.content}`}
													className="sticky top-0 z-10 flex min-h-7 items-center border-y bg-info/10 px-3 text-xs font-semibold text-info"
												>
													<span className="font-mono">{line.content}</span>
												</div>
											);
										}
										const lineType = line.type as 'equal' | 'insert' | 'delete';
										return (
											<div
												// biome-ignore lint/suspicious/noArrayIndexKey: diff result is immutable and ordered
												key={`u-l-${lIdx}-${lineType}`}
												className={`flex min-h-6 ${getDiffUnifiedLineClass(lineType)}`}
											>
												<span className="w-10 shrink-0 select-none border-r bg-muted/50 px-1 text-right text-xs text-muted-foreground">
													{line.leftLineNumber ?? ''}
												</span>
												<span className="w-10 shrink-0 select-none border-r bg-muted/50 px-1 text-right text-xs text-muted-foreground">
													{line.rightLineNumber ?? ''}
												</span>
												<span
													className={`w-6 shrink-0 select-none text-center font-bold ${getDiffPrefixClass(lineType)}`}
												>
													{line.prefix}
												</span>
												<span
													className={`flex-1 whitespace-pre px-2 ${lineType === 'insert' ? 'text-success' : lineType === 'delete' ? 'text-destructive' : ''}`}
												>
													{showInlineDiff &&
													line.segments &&
													line.segments.length > 0 &&
													lineType !== 'equal'
														? line.segments.map((seg, sIdx) => (
																<span
																	// biome-ignore lint/suspicious/noArrayIndexKey: diff segment list is immutable
																	key={`u-s-${lIdx}-${sIdx}`}
																	className={getDiffUnifiedSegmentClass(seg.type, lineType)}
																>
																	{seg.value}
																</span>
															))
														: line.content}
												</span>
											</div>
										);
									})}
								</div>
							) : !leftInput && !rightInput ? (
								emptyState
							) : isIdentical ? (
								identicalState
							) : null}
						</div>
					</div>
				</div>
			)}
		</ToolShell>
	);
}
