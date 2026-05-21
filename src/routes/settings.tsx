import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { confirm } from '@tauri-apps/plugin-dialog';
import { AlertTriangle, Check, ChevronsUpDown, Globe, RotateCcw, Settings } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/lib/components/ui/alert';
import { Button } from '@/lib/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/lib/components/ui/card';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/lib/components/ui/command';
import { Label } from '@/lib/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/lib/components/ui/popover';
import { FormCheckbox, FormSlider } from '@/lib/components/form';
import {
	applyAllSettings,
	DEFAULT_SETTINGS,
	type FontSettings,
	getMonospaceSystemFonts,
	getSettings,
	getSettingsFilePath,
	getSystemFonts,
	resetSettings,
	updateSettings,
} from '@/lib/services/settings';
import { getGoogleFontsByCategory, loadGoogleFont } from '@/lib/services/google-fonts';

export const Route = createFileRoute('/settings')({
	component: SettingsPage,
});

function SettingsPage() {
	const [fontSettings, setFontSettings] = useState<FontSettings>({ ...DEFAULT_SETTINGS.font });
	const [systemFonts, setSystemFonts] = useState<readonly string[]>([]);
	const [monospaceFonts, setMonospaceFonts] = useState<readonly string[]>([]);
	const [settingsFilePath, setSettingsFilePath] = useState('');
	const [uiFontOpen, setUiFontOpen] = useState(false);
	const [codeFontOpen, setCodeFontOpen] = useState(false);

	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const initializedRef = useRef(false);

	const googleUiFonts = getGoogleFontsByCategory('sans-serif');
	const googleCodeFonts = getGoogleFontsByCategory('monospace');

	useEffect(() => {
		document.title = 'Settings — Kogu';
	}, []);

	useEffect(() => {
		getSettings()
			.then((settings) => {
				setFontSettings({ ...settings.font });
				initializedRef.current = true;
			})
			.catch(() => {
				initializedRef.current = true;
			});

		getSystemFonts()
			.then(setSystemFonts)
			.catch(() => {});
		getMonospaceSystemFonts()
			.then(setMonospaceFonts)
			.catch(() => {});
		getSettingsFilePath()
			.then(setSettingsFilePath)
			.catch(() => {});
	}, []);

	useEffect(() => {
		if (!initializedRef.current) return;
		const settings = { font: fontSettings };
		clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(() => {
			updateSettings(settings)
				.then(() => applyAllSettings(settings))
				.catch(() => toast.error('Failed to save settings'));
		}, 300);
		return () => clearTimeout(saveTimerRef.current);
	}, [fontSettings]);

	const handleReset = async () => {
		const confirmed = await confirm(
			'This will reset all settings including fonts and window position.',
			{
				title: 'Reset All Settings',
				kind: 'warning',
				okLabel: 'Reset',
				cancelLabel: 'Cancel',
			}
		);
		if (!confirmed) return;

		const defaults = await resetSettings();
		setFontSettings({ ...defaults.font });
		applyAllSettings(defaults);
		toast.success('All settings have been reset');
	};

	const selectGoogleFont = (
		field: 'ui_family' | 'code_family',
		fontName: string,
		closePopover: () => void
	) => {
		loadGoogleFont(fontName);
		setFontSettings((prev) => ({ ...prev, [field]: fontName }));
		closePopover();
	};

	return (
		<div className="flex h-full flex-col">
			<main className="flex-1 overflow-y-auto p-6">
				<div className="mx-auto max-w-2xl space-y-6">
					<div className="flex items-center gap-3">
						<Settings className="h-6 w-6 text-muted-foreground" />
						<h1 className="text-xl font-bold">Settings</h1>
					</div>

					<Card density="compact" id="appearance">
						<CardHeader>
							<CardTitle>Appearance</CardTitle>
							<CardDescription>Customize fonts used throughout the application</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="space-y-1.5">
								<Label className="text-sm font-medium">UI Font Family</Label>
								<Popover open={uiFontOpen} onOpenChange={setUiFontOpen}>
									<PopoverTrigger asChild>
										<Button variant="outline" className="w-full justify-between font-normal">
											<span
												className="truncate"
												style={{
													fontFamily: fontSettings.ui_family
														? `"${fontSettings.ui_family}"`
														: undefined,
												}}
											>
												{fontSettings.ui_family || 'System Default'}
											</span>
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent
										className="w-[var(--radix-popover-trigger-width)] p-0"
										align="start"
									>
										<Command>
											<CommandInput placeholder="Search fonts..." />
											<CommandList className="max-h-48">
												<CommandEmpty>No fonts found.</CommandEmpty>
												<CommandGroup heading="System Fonts">
													<CommandItem
														value="System Default"
														onSelect={() => {
															setFontSettings((prev) => ({ ...prev, ui_family: '' }));
															setUiFontOpen(false);
														}}
													>
														<span>System Default</span>
														{!fontSettings.ui_family ? <Check className="ml-auto h-4 w-4" /> : null}
													</CommandItem>
													{systemFonts.map((font) => (
														<CommandItem
															key={font}
															value={font}
															onSelect={() => {
																setFontSettings((prev) => ({ ...prev, ui_family: font }));
																setUiFontOpen(false);
															}}
														>
															<span style={{ fontFamily: `"${font}"` }}>{font}</span>
															{fontSettings.ui_family === font ? (
																<Check className="ml-auto h-4 w-4" />
															) : null}
														</CommandItem>
													))}
												</CommandGroup>
												{fontSettings.google_fonts_enabled ? (
													<CommandGroup heading="Google Fonts">
														{googleUiFonts.map((gf) => (
															<CommandItem
																key={gf.name}
																value={`Google: ${gf.name}`}
																onSelect={() =>
																	selectGoogleFont('ui_family', gf.name, () => setUiFontOpen(false))
																}
															>
																<Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
																<span style={{ fontFamily: `"${gf.name}"` }}>{gf.name}</span>
																{fontSettings.ui_family === gf.name ? (
																	<Check className="ml-auto h-4 w-4" />
																) : null}
															</CommandItem>
														))}
													</CommandGroup>
												) : null}
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
							</div>

							<FormSlider
								label="UI Font Size"
								value={fontSettings.ui_size}
								valueLabel={`${fontSettings.ui_size}px`}
								min={10}
								max={24}
								step={1}
								onValueChange={(v) => setFontSettings((prev) => ({ ...prev, ui_size: v }))}
							/>

							<div className="space-y-1.5">
								<Label className="text-sm font-medium">Code Font Family</Label>
								<Popover open={codeFontOpen} onOpenChange={setCodeFontOpen}>
									<PopoverTrigger asChild>
										<Button variant="outline" className="w-full justify-between font-normal">
											<span
												className="truncate"
												style={{
													fontFamily: fontSettings.code_family
														? `"${fontSettings.code_family}"`
														: undefined,
												}}
											>
												{fontSettings.code_family || 'System Default'}
											</span>
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent
										className="w-[var(--radix-popover-trigger-width)] p-0"
										align="start"
									>
										<Command>
											<CommandInput placeholder="Search fonts..." />
											<CommandList className="max-h-48">
												<CommandEmpty>No fonts found.</CommandEmpty>
												<CommandGroup heading="System Monospace Fonts">
													<CommandItem
														value="System Default"
														onSelect={() => {
															setFontSettings((prev) => ({ ...prev, code_family: '' }));
															setCodeFontOpen(false);
														}}
													>
														<span>System Default</span>
														{!fontSettings.code_family ? (
															<Check className="ml-auto h-4 w-4" />
														) : null}
													</CommandItem>
													{monospaceFonts.map((font) => (
														<CommandItem
															key={font}
															value={font}
															onSelect={() => {
																setFontSettings((prev) => ({ ...prev, code_family: font }));
																setCodeFontOpen(false);
															}}
														>
															<span style={{ fontFamily: `"${font}"` }}>{font}</span>
															{fontSettings.code_family === font ? (
																<Check className="ml-auto h-4 w-4" />
															) : null}
														</CommandItem>
													))}
												</CommandGroup>
												{fontSettings.google_fonts_enabled ? (
													<CommandGroup heading="Google Fonts">
														{googleCodeFonts.map((gf) => (
															<CommandItem
																key={gf.name}
																value={`Google: ${gf.name}`}
																onSelect={() =>
																	selectGoogleFont('code_family', gf.name, () =>
																		setCodeFontOpen(false)
																	)
																}
															>
																<Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
																<span style={{ fontFamily: `"${gf.name}"` }}>{gf.name}</span>
																{fontSettings.code_family === gf.name ? (
																	<Check className="ml-auto h-4 w-4" />
																) : null}
															</CommandItem>
														))}
													</CommandGroup>
												) : null}
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
							</div>

							<FormSlider
								label="Code Font Size"
								value={fontSettings.code_size}
								valueLabel={`${fontSettings.code_size}px`}
								min={10}
								max={24}
								step={1}
								onValueChange={(v) => setFontSettings((prev) => ({ ...prev, code_size: v }))}
							/>

							<div className="space-y-3">
								<FormCheckbox
									label="Enable Google Fonts"
									checked={fontSettings.google_fonts_enabled}
									onCheckedChange={(v) =>
										setFontSettings((prev) => ({ ...prev, google_fonts_enabled: v }))
									}
								/>

								{fontSettings.google_fonts_enabled ? (
									<Alert variant="destructive">
										<AlertTriangle className="size-4" />
										<AlertTitle>Privacy Notice</AlertTitle>
										<AlertDescription>
											Google Fonts are loaded from Google's servers. Your IP address will be sent to
											Google when fonts are loaded. Only enable this if you understand and accept
											these privacy implications.
										</AlertDescription>
									</Alert>
								) : null}
							</div>

							<div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
								<p className="text-xs font-medium text-muted-foreground">Preview</p>
								<p
									style={{
										fontFamily: fontSettings.ui_family
											? `"${fontSettings.ui_family}", system-ui, sans-serif`
											: undefined,
										fontSize:
											fontSettings.ui_size !== DEFAULT_SETTINGS.font.ui_size
												? `${fontSettings.ui_size}px`
												: undefined,
									}}
								>
									The quick brown fox jumps over the lazy dog.
								</p>
								<pre
									className="rounded-md bg-muted p-2"
									style={{
										fontFamily: fontSettings.code_family
											? `"${fontSettings.code_family}", ui-monospace, monospace`
											: undefined,
										fontSize:
											fontSettings.code_size !== DEFAULT_SETTINGS.font.code_size
												? `${fontSettings.code_size}px`
												: undefined,
									}}
								>
									<code>{'const hello = "world"; // 0123456789'}</code>
								</pre>
							</div>
						</CardContent>
					</Card>

					<Card density="compact" id="data">
						<CardHeader>
							<CardTitle>Data</CardTitle>
							<CardDescription>Settings file location and reset options</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{settingsFilePath ? (
								<div className="space-y-1">
									<Label className="text-xs text-muted-foreground">Settings file</Label>
									<p className="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
										{settingsFilePath}
									</p>
								</div>
							) : null}
							<div className="space-y-2">
								<Button variant="destructive" size="sm" onClick={handleReset}>
									<RotateCcw className="h-4 w-4" />
									Reset All Settings
								</Button>
								<p className="text-xs text-muted-foreground">
									Resets all preferences including fonts and window position to defaults.
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</main>
		</div>
	);
}
