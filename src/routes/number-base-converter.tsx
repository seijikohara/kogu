import { createFileRoute } from '@tanstack/react-router';
import { type CSSProperties, useMemo, useState } from 'react';

import { CopyButton } from '@/lib/components/action';
import {
	FormCheckbox,
	FormCheckboxGroup,
	FormInfo,
	FormInput,
	FormMode,
	FormSection,
	FormSelect,
	FormSlider,
} from '@/lib/components/form';
import { useDocumentTitle } from '@/lib/hooks';
import { ToolFooter, ToolShell } from '@/lib/components/shell';
import { StatItem } from '@/lib/components/status';
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/lib/components/ui/accordion';
import { Button } from '@/lib/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Input } from '@/lib/components/ui/input';
import { ToneBadge } from '@/lib/components/ui/tone-badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/lib/components/ui/tooltip';
import { createToolOptionsStore, usePersistedRail } from '@/lib/stores';
import { cn } from '@/lib/utils';
import {
	asciiInfo,
	BASE_LABEL,
	BASE_PREFIX,
	BASES,
	BIT_WIDTHS,
	bitwiseAnd,
	bitwiseNot,
	bitwiseOr,
	bitwiseXor,
	type Base,
	type BitWidth,
	type FloatWidth,
	floatToBits,
	formatInBase,
	FLOAT_PRESETS,
	type IeeeBreakdown,
	ieeeBreakdown,
	parseInBase,
	popcount,
	PRESETS,
	shiftLeft,
	shiftRight,
	signBit,
	signedMax,
	signedMin,
	type Signedness,
	toggleBit,
	toSigned,
	toUnsigned,
	widthMask,
} from '@/lib/services/number-base';

interface NumberBaseOptions {
	readonly bitWidth: BitWidth;
	readonly signedness: Signedness;
	readonly primaryBase: Base;
	readonly group: boolean;
	readonly uppercase: boolean;
	readonly pad: boolean;
	readonly floatWidth: FloatWidth;
}

const DEFAULTS: NumberBaseOptions = {
	bitWidth: 32,
	signedness: 'unsigned',
	primaryBase: 10,
	group: true,
	uppercase: true,
	pad: true,
	floatWidth: 32,
};

const useNumberBaseOptions = createToolOptionsStore<NumberBaseOptions>(
	'number-base-converter',
	DEFAULTS
);

export const Route = createFileRoute('/number-base-converter')({
	component: NumberBaseConverterPage,
});

const BIT_WIDTH_OPTIONS = BIT_WIDTHS.map((w) => ({
	value: String(w),
	label: `${w}-bit`,
}));

const SIGNEDNESS_OPTIONS = [
	{ value: 'unsigned', label: 'Unsigned' },
	{ value: 'signed', label: 'Signed' },
] as const;

const PRIMARY_BASE_OPTIONS = BASES.map((b) => ({
	value: String(b),
	label: BASE_LABEL[b],
}));

const FLOAT_WIDTH_OPTIONS = [
	{ value: '32', label: '32-bit (f32)' },
	{ value: '64', label: '64-bit (f64)' },
] as const;

const isBitWidth = (v: number): v is BitWidth => v === 8 || v === 16 || v === 32 || v === 64;
const isBase = (v: number): v is Base => v === 2 || v === 8 || v === 10 || v === 16;
const isFloatWidth = (v: number): v is FloatWidth => v === 32 || v === 64;

function NumberBaseConverterPage() {
	const { value: options, patch } = useNumberBaseOptions();
	const { bitWidth, signedness, primaryBase, group, uppercase, pad, floatWidth } = options;

	useDocumentTitle('Number Base Converter');

	const [showRail, setShowRail] = usePersistedRail('number-base-converter');

	// Canonical state: unsigned bit pattern within the current bit width.
	const [valueA, setValueA] = useState<bigint>(0n);
	const [valueB, setValueB] = useState<bigint>(0n);
	const [shiftN, setShiftN] = useState<number>(1);

	// Per-base text drafts: when the user is mid-typing, the formatted
	// representation should not steal focus. Each field's raw text is preserved
	// here until the input is reformatted (clear button, preset, etc.).
	const [drafts, setDrafts] = useState<Record<Base, string | null>>({
		2: null,
		8: null,
		10: null,
		16: null,
	});
	const [draftsB, setDraftsB] = useState<string | null>(null);

	const formatOpts = useMemo(() => ({ group, uppercase, pad }), [group, uppercase, pad]);

	// Clamp shift amount to the current width whenever width changes.
	const maxShift = bitWidth;
	const clampedShift = Math.min(shiftN, maxShift);

	// Whenever bit width changes, re-mask the operands so we do not silently
	// retain bits outside the new range.
	const maskedA = toUnsigned(valueA, bitWidth);
	const maskedB = toUnsigned(valueB, bitWidth);

	const signedA = toSigned(maskedA, bitWidth);
	const isNegative = signedness === 'signed' && signedA < 0n;

	const resultAnd = bitwiseAnd(maskedA, maskedB, bitWidth);
	const resultOr = bitwiseOr(maskedA, maskedB, bitWidth);
	const resultXor = bitwiseXor(maskedA, maskedB, bitWidth);
	const resultNot = bitwiseNot(maskedA, bitWidth);
	const resultShl = shiftLeft(maskedA, clampedShift, bitWidth);
	const resultShr = shiftRight(maskedA, clampedShift, bitWidth, signedness);

	const hammingWeight = popcount(maskedA, bitWidth);

	const baseFormatted = (value: bigint, base: Base): string =>
		formatInBase(value, base, bitWidth, signedness, formatOpts);

	const handleBaseChange = (base: Base, text: string) => {
		setDrafts((prev) => ({ ...prev, [base]: text }));
		const parsed = parseInBase(text, base, bitWidth, signedness);
		if (parsed !== null) setValueA(parsed);
	};

	const handleBaseBlur = (base: Base) => {
		setDrafts((prev) => ({ ...prev, [base]: null }));
	};

	const handleOperandBChange = (text: string) => {
		setDraftsB(text);
		const parsed = parseInBase(text, primaryBase, bitWidth, signedness);
		if (parsed !== null) setValueB(parsed);
	};

	const handleBitWidthChange = (raw: string) => {
		const next = Number(raw);
		if (!isBitWidth(next)) return;
		patch({ bitWidth: next });
		// Re-mask both operands to the new width.
		setValueA((current) => toUnsigned(current, next));
		setValueB((current) => toUnsigned(current, next));
		setShiftN((current) => Math.min(current, next));
		setDrafts({ 2: null, 8: null, 10: null, 16: null });
		setDraftsB(null);
	};

	const handleSignednessChange = (next: string) => {
		if (next !== 'signed' && next !== 'unsigned') return;
		patch({ signedness: next });
		setDrafts({ 2: null, 8: null, 10: null, 16: null });
		setDraftsB(null);
	};

	const handlePrimaryBaseChange = (raw: string) => {
		const next = Number(raw);
		if (!isBase(next)) return;
		patch({ primaryBase: next });
		setDraftsB(null);
	};

	const handleFloatWidthChange = (raw: string) => {
		const next = Number(raw);
		if (!isFloatWidth(next)) return;
		patch({ floatWidth: next });
	};

	const handleToggleBit = (index: number) => {
		setValueA((current) => toggleBit(toUnsigned(current, bitWidth), index, bitWidth));
		setDrafts({ 2: null, 8: null, 10: null, 16: null });
	};

	const handleApplyPresetToA = (compute: (w: BitWidth, s: Signedness) => bigint) => {
		setValueA(compute(bitWidth, signedness));
		setDrafts({ 2: null, 8: null, 10: null, 16: null });
	};

	const handleApplyPresetToB = (compute: (w: BitWidth, s: Signedness) => bigint) => {
		setValueB(compute(bitWidth, signedness));
		setDraftsB(null);
	};

	const handleSwapAB = () => {
		setValueA(maskedB);
		setValueB(maskedA);
		setDrafts({ 2: null, 8: null, 10: null, 16: null });
		setDraftsB(null);
	};

	const handleApplyFloatPreset = (bits: bigint) => {
		setValueA(toUnsigned(bits, bitWidth));
		setDrafts({ 2: null, 8: null, 10: null, 16: null });
	};

	const handleInterpretFloatInput = (text: string) => {
		const numeric = Number(text);
		if (
			!Number.isFinite(numeric) &&
			text.trim().toLowerCase() !== 'nan' &&
			text.trim().toLowerCase() !== 'infinity' &&
			text.trim().toLowerCase() !== '-infinity'
		) {
			return;
		}
		const parsed = Number.parseFloat(text);
		const bits = floatToBits(parsed, floatWidth);
		setValueA(toUnsigned(bits, bitWidth));
		setDrafts({ 2: null, 8: null, 10: null, 16: null });
	};

	const presetButtons = useMemo(
		() => PRESETS.filter((p) => !p.availableFor || p.availableFor(bitWidth, signedness)),
		[bitWidth, signedness]
	);

	const supportsIeee =
		bitWidth >= 32 && (floatWidth === 32 || floatWidth === 64) && floatWidth <= bitWidth;
	const ieee = supportsIeee ? ieeeBreakdown(maskedA, floatWidth) : null;

	const showAscii = bitWidth === 8;
	const asciiData = showAscii ? asciiInfo(maskedA, 8) : null;

	const rangeText = useMemo(() => {
		if (signedness === 'signed') {
			return `${signedMin(bitWidth)} … ${signedMax(bitWidth)}`;
		}
		return `0 … ${widthMask(bitWidth)}`;
	}, [bitWidth, signedness]);

	const operandBPlaceholder = `Operand B in ${BASE_LABEL[primaryBase].toLowerCase()}…`;

	return (
		<ToolShell
			valid={null}
			showRail={showRail}
			onShowRailChange={setShowRail}
			statusContent={
				<>
					<StatItem label="Bits" value={bitWidth} />
					<StatItem label="Bytes" value={bitWidth / 8} />
					<StatItem label="Mode" value={signedness === 'signed' ? 'Signed' : 'Unsigned'} />
					<StatItem label="Pop" value={hammingWeight} />
					{isNegative ? <StatItem label="Sign" value="-" variant="error" /> : null}
				</>
			}
			rail={
				<>
					<FormSection title="Format">
						<FormSelect
							label="Bit Width"
							value={String(bitWidth)}
							options={BIT_WIDTH_OPTIONS}
							onValueChange={handleBitWidthChange}
							size="compact"
						/>
						<FormMode<Signedness>
							label="Signedness"
							value={signedness}
							options={
								SIGNEDNESS_OPTIONS as unknown as readonly { value: Signedness; label: string }[]
							}
							onValueChange={(v) => handleSignednessChange(v)}
						/>
						<FormSelect
							label="Primary Base (for operand B)"
							value={String(primaryBase)}
							options={PRIMARY_BASE_OPTIONS}
							onValueChange={handlePrimaryBaseChange}
							size="compact"
						/>
						<FormCheckboxGroup>
							<FormCheckbox
								label="Group digits"
								checked={group}
								onCheckedChange={(v) => patch({ group: v })}
								size="compact"
							/>
							<FormCheckbox
								label="Uppercase hex"
								checked={uppercase}
								onCheckedChange={(v) => patch({ uppercase: v })}
								size="compact"
							/>
							<FormCheckbox
								label="Pad to width"
								checked={pad}
								onCheckedChange={(v) => patch({ pad: v })}
								size="compact"
							/>
						</FormCheckboxGroup>
					</FormSection>

					<FormSection title="Bitwise Operand B">
						<FormInput
							label={`Operand B (${BASE_LABEL[primaryBase].toLowerCase()})`}
							value={draftsB ?? baseFormatted(maskedB, primaryBase)}
							placeholder={operandBPlaceholder}
							onValueChange={handleOperandBChange}
							onBlur={() => setDraftsB(null)}
							size="compact"
							className="font-mono"
						/>
						<FormSlider
							label="Shift amount (n)"
							value={clampedShift}
							onValueChange={setShiftN}
							min={0}
							max={maxShift}
							step={1}
							valueLabel={String(clampedShift)}
							size="compact"
						/>
						<div className="flex gap-1">
							<Button variant="outline" size="sm" className="flex-1" onClick={handleSwapAB}>
								Swap A ↔ B
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="flex-1"
								onClick={() => handleApplyPresetToB(() => 0n)}
							>
								B = 0
							</Button>
						</div>
					</FormSection>

					<FormSection title="IEEE 754">
						<FormSelect
							label="Float width"
							value={String(floatWidth)}
							options={
								FLOAT_WIDTH_OPTIONS as unknown as readonly { value: string; label: string }[]
							}
							onValueChange={handleFloatWidthChange}
							size="compact"
						/>
						<FormInfo>
							{bitWidth < 32
								? 'Switch bit width to 32 or 64 to enable IEEE 754 inspection.'
								: floatWidth > bitWidth
									? `Increase bit width to ${floatWidth} or shrink float width.`
									: 'Float bits are read from the high bits of A.'}
						</FormInfo>
					</FormSection>

					<FormSection title="Presets">
						<div className="grid grid-cols-2 gap-1">
							{presetButtons.map((preset) => (
								<Button
									key={preset.id}
									variant="outline"
									size="sm"
									className="h-7 justify-start truncate px-2 text-xs"
									onClick={() => handleApplyPresetToA(preset.compute)}
								>
									{preset.label}
								</Button>
							))}
						</div>
					</FormSection>

					<ToolFooter
						aboutText={
							<ul className="list-inside list-disc space-y-0.5">
								<li>Edit any base to update the rest</li>
								<li>Click bits in the grid to toggle them</li>
								<li>Signed mode renders two's complement</li>
								<li>Range: {rangeText}</li>
							</ul>
						}
					/>
				</>
			}
		>
			<div className="flex h-full flex-col overflow-auto p-3">
				<div className="space-y-3">
					<BasesGrid
						value={maskedA}
						drafts={drafts}
						bitWidth={bitWidth}
						signedness={signedness}
						formatOpts={formatOpts}
						onBaseChange={handleBaseChange}
						onBaseBlur={handleBaseBlur}
					/>
					<BitGridCard
						value={maskedA}
						bitWidth={bitWidth}
						signedness={signedness}
						onToggleBit={handleToggleBit}
					/>
					<BitwiseTable
						a={maskedA}
						b={maskedB}
						resultAnd={resultAnd}
						resultOr={resultOr}
						resultXor={resultXor}
						resultNot={resultNot}
						resultShl={resultShl}
						resultShr={resultShr}
						shiftN={clampedShift}
						bitWidth={bitWidth}
						signedness={signedness}
						formatOpts={formatOpts}
					/>
					{showAscii && asciiData ? <AsciiCard info={asciiData} /> : null}
					<Card density="compact">
						<Accordion type="single" collapsible>
							<AccordionItem value="ieee">
								<CardHeader className="pb-0">
									<AccordionTrigger className="py-0">
										<CardTitle>IEEE 754 ({floatWidth}-bit)</CardTitle>
									</AccordionTrigger>
								</CardHeader>
								<AccordionContent>
									<CardContent>
										{ieee ? (
											<IeeeSection
												breakdown={ieee}
												maskedA={maskedA}
												bitWidth={bitWidth}
												floatWidth={floatWidth}
												onApplyFloatPreset={handleApplyFloatPreset}
												onInterpretFloatInput={handleInterpretFloatInput}
											/>
										) : (
											<p className="text-xs text-muted-foreground">
												Increase bit width to {floatWidth} bits to inspect IEEE 754 components.
											</p>
										)}
									</CardContent>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					</Card>
				</div>
			</div>
		</ToolShell>
	);
}

interface BasesGridProps {
	readonly value: bigint;
	readonly drafts: Record<Base, string | null>;
	readonly bitWidth: BitWidth;
	readonly signedness: Signedness;
	readonly formatOpts: {
		readonly group: boolean;
		readonly uppercase: boolean;
		readonly pad: boolean;
	};
	readonly onBaseChange: (base: Base, text: string) => void;
	readonly onBaseBlur: (base: Base) => void;
}

function BasesGrid({
	value,
	drafts,
	bitWidth,
	signedness,
	formatOpts,
	onBaseChange,
	onBaseBlur,
}: BasesGridProps) {
	return (
		<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
			{BASES.map((base) => {
				const draft = drafts[base];
				const formatted = formatInBase(value, base, bitWidth, signedness, formatOpts);
				const display = draft ?? formatted;
				return (
					<Card key={base} density="compact">
						<CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
							<div className="flex min-w-0 items-center gap-2">
								<CardTitle className="truncate">{BASE_LABEL[base]}</CardTitle>
								{BASE_PREFIX[base] ? (
									<span className="rounded-sm bg-muted px-1 py-0.5 font-mono text-2xs text-muted-foreground">
										{BASE_PREFIX[base]}
									</span>
								) : null}
								<span className="ml-1 text-2xs text-muted-foreground/70">base {base}</span>
							</div>
							<CopyButton
								text={formatted}
								toastLabel={BASE_LABEL[base]}
								size="sm"
								showLabel={false}
							/>
						</CardHeader>
						<CardContent>
							<Input
								value={display}
								onChange={(e) => onBaseChange(base, e.target.value)}
								onBlur={() => onBaseBlur(base)}
								spellCheck={false}
								autoCorrect="off"
								autoCapitalize="off"
								className="h-8 font-mono text-sm tabular-nums"
							/>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}

interface BitGridCardProps {
	readonly value: bigint;
	readonly bitWidth: BitWidth;
	readonly signedness: Signedness;
	readonly onToggleBit: (index: number) => void;
}

function BitGridCard({ value, bitWidth, signedness, onToggleBit }: BitGridCardProps) {
	// Render most-significant-bit on the left.
	const indices = useMemo(() => {
		const out: number[] = [];
		for (let i = bitWidth - 1; i >= 0; i -= 1) out.push(i);
		return out;
	}, [bitWidth]);

	const signBitIndex = bitWidth - 1;
	const signBitMask = signBit(bitWidth);
	const isSignBitSet = (value & signBitMask) === signBitMask;
	const signActive = signedness === 'signed' && isSignBitSet;

	return (
		<Card density="compact">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between gap-2">
					<CardTitle>Bit Grid</CardTitle>
					<div className="flex items-center gap-1 text-2xs text-muted-foreground">
						<span className="inline-block size-2 rounded-sm bg-primary" />
						<span>set</span>
						<span className="ml-2 inline-block size-2 rounded-sm border border-border bg-background" />
						<span>clear</span>
						{signedness === 'signed' ? (
							<>
								<span className="ml-2 inline-block size-2 rounded-sm bg-destructive" />
								<span>sign bit</span>
							</>
						) : null}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div
					className="grid w-full gap-y-1.5 overflow-x-auto"
					style={{ '--bit-cols': bitWidth } as CSSProperties}
				>
					<div
						className="grid gap-x-0.5"
						style={{ gridTemplateColumns: `repeat(${bitWidth}, minmax(1.25rem, 1fr))` }}
					>
						{indices.map((idx) => {
							const isByteStart = idx % 8 === 7;
							return (
								<span
									key={`label-${idx}`}
									className={cn(
										'text-center font-mono text-[10px] leading-none text-muted-foreground tabular-nums',
										isByteStart && 'text-foreground/70'
									)}
								>
									{idx}
								</span>
							);
						})}
					</div>
					<div
						className="grid gap-x-0.5"
						style={{ gridTemplateColumns: `repeat(${bitWidth}, minmax(1.25rem, 1fr))` }}
					>
						{indices.map((idx) => {
							const bit = (value >> BigInt(idx)) & 1n;
							const isSet = bit === 1n;
							const isSignBit = idx === signBitIndex && signedness === 'signed';
							const isByteBoundary = idx % 8 === 0;
							const placeValue = 1n << BigInt(idx);
							return (
								<Tooltip key={`bit-${idx}`}>
									<TooltipTrigger asChild>
										<button
											type="button"
											aria-label={`Toggle bit ${idx}`}
											aria-pressed={isSet}
											onClick={() => onToggleBit(idx)}
											className={cn(
												'flex h-6 items-center justify-center rounded-sm border font-mono text-xs leading-none tabular-nums transition-colors',
												isByteBoundary && 'mr-1',
												isSet
													? signActive && isSignBit
														? 'border-destructive bg-destructive text-destructive-foreground'
														: 'border-primary bg-primary text-primary-foreground'
													: signActive && isSignBit
														? 'border-destructive/60 bg-destructive/10 text-destructive'
														: 'border-border bg-background text-muted-foreground hover:bg-muted'
											)}
										>
											{isSet ? '1' : '0'}
										</button>
									</TooltipTrigger>
									<TooltipContent>
										<span className="font-mono text-2xs">
											bit {idx} · 2^{idx} = {placeValue.toString(10)}
										</span>
									</TooltipContent>
								</Tooltip>
							);
						})}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

interface BitwiseTableProps {
	readonly a: bigint;
	readonly b: bigint;
	readonly resultAnd: bigint;
	readonly resultOr: bigint;
	readonly resultXor: bigint;
	readonly resultNot: bigint;
	readonly resultShl: bigint;
	readonly resultShr: bigint;
	readonly shiftN: number;
	readonly bitWidth: BitWidth;
	readonly signedness: Signedness;
	readonly formatOpts: {
		readonly group: boolean;
		readonly uppercase: boolean;
		readonly pad: boolean;
	};
}

function BitwiseTable({
	a,
	b,
	resultAnd,
	resultOr,
	resultXor,
	resultNot,
	resultShl,
	resultShr,
	shiftN,
	bitWidth,
	signedness,
	formatOpts,
}: BitwiseTableProps) {
	const rows: readonly { readonly label: string; readonly value: bigint }[] = [
		{ label: 'A', value: a },
		{ label: 'B', value: b },
		{ label: 'A & B', value: resultAnd },
		{ label: 'A | B', value: resultOr },
		{ label: 'A ^ B', value: resultXor },
		{ label: '~A', value: resultNot },
		{ label: `A << ${shiftN}`, value: resultShl },
		{ label: `A >> ${shiftN}`, value: resultShr },
	];

	return (
		<Card density="compact">
			<CardHeader className="pb-2">
				<CardTitle>Bitwise Operations</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="overflow-x-auto">
					<table className="w-full min-w-max border-collapse text-xs">
						<thead>
							<tr className="border-b border-border/60 text-left text-2xs uppercase tracking-wide text-muted-foreground">
								<th className="py-1.5 pr-3 font-semibold">Expression</th>
								{BASES.map((base) => (
									<th key={base} className="py-1.5 pr-3 font-semibold">
										{BASE_LABEL[base]}
									</th>
								))}
								<th className="py-1.5 pr-1 text-right" />
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={row.label} className="border-b border-border/30 last:border-b-0">
									<td className="py-1.5 pr-3 font-mono text-foreground/90">{row.label}</td>
									{BASES.map((base) => {
										const text = formatInBase(row.value, base, bitWidth, signedness, formatOpts);
										return (
											<td
												key={base}
												className="py-1.5 pr-3 font-mono tabular-nums text-foreground/80"
											>
												{text}
											</td>
										);
									})}
									<td className="py-1.5 pr-1 text-right">
										<CopyButton
											text={formatInBase(row.value, 10, bitWidth, signedness, formatOpts)}
											toastLabel={`${row.label} (decimal)`}
											size="sm"
											showLabel={false}
											variant="ghost"
										/>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
}

interface AsciiCardProps {
	readonly info: NonNullable<ReturnType<typeof asciiInfo>>;
}

function AsciiCard({ info }: AsciiCardProps) {
	const codeHex = `0x${info.codePoint.toString(16).toUpperCase().padStart(2, '0')}`;
	const codeDec = info.codePoint.toString(10);

	return (
		<Card density="compact">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between gap-2">
					<CardTitle>ASCII / Latin-1</CardTitle>
					<ToneBadge
						tone={
							info.category === 'printable'
								? 'success'
								: info.category === 'extended'
									? 'info'
									: 'warning'
						}
					>
						{info.category}
					</ToneBadge>
				</div>
			</CardHeader>
			<CardContent>
				<div className="flex items-center gap-4">
					<div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border bg-muted font-mono text-3xl tabular-nums">
						{info.glyph ?? info.controlAbbr ?? '?'}
					</div>
					<div className="flex flex-col gap-1 text-sm">
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground">Name:</span>
							<span className="font-medium">{info.name}</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground">Hex:</span>
							<span className="font-mono">{codeHex}</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground">Decimal:</span>
							<span className="font-mono">{codeDec}</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground">Printable:</span>
							<span>{info.printable ? 'yes' : 'no'}</span>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

interface IeeeSectionProps {
	readonly breakdown: IeeeBreakdown;
	readonly maskedA: bigint;
	readonly bitWidth: BitWidth;
	readonly floatWidth: FloatWidth;
	readonly onApplyFloatPreset: (bits: bigint) => void;
	readonly onInterpretFloatInput: (text: string) => void;
}

function IeeeSection({
	breakdown,
	maskedA,
	bitWidth,
	floatWidth,
	onApplyFloatPreset,
	onInterpretFloatInput,
}: IeeeSectionProps) {
	const {
		sign,
		biasedExponent,
		unbiasedExponent,
		mantissa,
		exponentBits,
		mantissaBits,
		bias,
		numericValue,
		classification,
		hexValue,
	} = breakdown;
	const [floatInput, setFloatInput] = useState<string>('');

	// When the bit width exceeds the float width, the float bits live in the
	// lower `floatWidth` bits. (DataView round-trip ignores higher bits.)
	const floatBits = maskedA & ((1n << BigInt(floatWidth)) - 1n);
	const totalBits = floatWidth;

	const cellWidthClass = totalBits === 32 ? 'min-w-6' : 'min-w-4';

	const bitCells: readonly {
		readonly bit: 0 | 1;
		readonly zone: 'sign' | 'exponent' | 'mantissa';
		readonly index: number;
	}[] = useMemo(() => {
		const cells: { bit: 0 | 1; zone: 'sign' | 'exponent' | 'mantissa'; index: number }[] = [];
		for (let i = totalBits - 1; i >= 0; i -= 1) {
			const bit = ((floatBits >> BigInt(i)) & 1n) === 1n ? 1 : 0;
			let zone: 'sign' | 'exponent' | 'mantissa';
			if (i === totalBits - 1) zone = 'sign';
			else if (i >= mantissaBits) zone = 'exponent';
			else zone = 'mantissa';
			cells.push({ bit, zone, index: i });
		}
		return cells;
	}, [floatBits, totalBits, mantissaBits]);

	const zoneClass = (zone: 'sign' | 'exponent' | 'mantissa', bit: 0 | 1): string => {
		const base =
			'flex h-6 items-center justify-center rounded-sm border font-mono text-xs leading-none tabular-nums';
		if (zone === 'sign') {
			return cn(
				base,
				bit === 1
					? 'border-destructive bg-destructive text-destructive-foreground'
					: 'border-destructive/40 bg-destructive/10 text-destructive'
			);
		}
		if (zone === 'exponent') {
			return cn(
				base,
				bit === 1
					? 'border-warning bg-warning/80 text-warning-foreground'
					: 'border-warning/30 bg-warning/10 text-warning'
			);
		}
		return cn(
			base,
			bit === 1
				? 'border-info bg-info/80 text-info-foreground'
				: 'border-info/30 bg-info/10 text-info'
		);
	};

	const classificationTone =
		classification === 'normal' || classification === 'zero'
			? 'success'
			: classification === 'subnormal'
				? 'info'
				: 'warning';

	const numericDisplay = Number.isNaN(numericValue)
		? 'NaN'
		: !Number.isFinite(numericValue)
			? numericValue > 0
				? '+Infinity'
				: '-Infinity'
			: numericValue.toString();

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
				<span>
					Bit width <span className="font-mono text-foreground">{bitWidth}</span> · float width{' '}
					<span className="font-mono text-foreground">{floatWidth}</span>
				</span>
				<ToneBadge tone={classificationTone}>{classification}</ToneBadge>
				<span className="font-mono text-foreground">{hexValue}</span>
			</div>
			<div className="overflow-x-auto">
				<div
					className="grid gap-x-0.5"
					style={{ gridTemplateColumns: `repeat(${totalBits}, minmax(1rem, 1fr))` }}
				>
					{bitCells.map(({ bit, zone, index }) => (
						<Tooltip key={`f-${index}`}>
							<TooltipTrigger asChild>
								<span className={cn(zoneClass(zone, bit), cellWidthClass)}>{bit}</span>
							</TooltipTrigger>
							<TooltipContent>
								<span className="font-mono text-2xs">
									bit {index} · {zone}
								</span>
							</TooltipContent>
						</Tooltip>
					))}
				</div>
			</div>
			<div className="grid gap-3 sm:grid-cols-3">
				<div className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
					<div className="font-semibold text-destructive">Sign (1 bit)</div>
					<div className="font-mono text-sm">{sign}</div>
					<div className="text-muted-foreground">{sign === 1 ? 'negative' : 'positive'}</div>
				</div>
				<div className="space-y-1 rounded-md border border-warning/30 bg-warning/5 p-2 text-xs">
					<div className="font-semibold text-warning">Exponent ({exponentBits} bits)</div>
					<div className="font-mono text-sm">
						raw {biasedExponent} − bias {bias} = {unbiasedExponent}
					</div>
				</div>
				<div className="space-y-1 rounded-md border border-info/30 bg-info/5 p-2 text-xs">
					<div className="font-semibold text-info">Mantissa ({mantissaBits} bits)</div>
					<div className="font-mono text-sm break-all">
						0x
						{mantissa
							.toString(16)
							.toUpperCase()
							.padStart(Math.ceil(mantissaBits / 4), '0')}
					</div>
				</div>
			</div>
			<div className="space-y-1 text-sm">
				<div className="flex items-center gap-2">
					<span className="text-muted-foreground">Numeric value:</span>
					<span className="font-mono">{numericDisplay}</span>
				</div>
			</div>
			<div className="space-y-2 rounded-md border bg-muted/30 p-2">
				<div className="text-xs font-semibold text-muted-foreground">Interpret a float</div>
				<div className="flex gap-2">
					<Input
						value={floatInput}
						placeholder="e.g. 3.14159 or -1.5e-3"
						onChange={(e) => setFloatInput(e.target.value)}
						className="h-7 flex-1 font-mono text-xs"
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={() => onInterpretFloatInput(floatInput)}
						disabled={floatInput.trim().length === 0}
					>
						To bits
					</Button>
				</div>
				<div className="flex flex-wrap gap-1">
					{FLOAT_PRESETS.filter((p) => p.width === floatWidth).map((preset) => (
						<Button
							key={preset.id}
							variant="outline"
							size="sm"
							className="h-6 px-2 text-2xs"
							onClick={() => onApplyFloatPreset(preset.bits)}
						>
							{preset.label}
						</Button>
					))}
				</div>
			</div>
		</div>
	);
}
