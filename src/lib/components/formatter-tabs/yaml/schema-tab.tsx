import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { FileCheck, Wand2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import * as yaml from 'yaml';

import { useReportStats, useValidation } from '@/lib/hooks';
import { CodeEditor } from '@/lib/components/editor';
import { FormCheckbox, FormCheckboxGroup, FormMode, FormSection } from '@/lib/components/form';
import { SplitPane } from '@/lib/components/layout';
import { Rail } from '@/lib/components/ui/rail';
import { Button } from '@/lib/components/ui/button';
import { inferJsonSchema } from '@/lib/services/formatters';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/utils';
import { copyToClipboard, pasteFromClipboard } from '@/lib/utils/file-operations';

type SchemaFormat = 'yaml' | 'json';

interface TabStats {
	readonly input: string;
	readonly valid: boolean | null;
	readonly error: string;
}

interface SchemaTabProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly onStatsChange?: (stats: TabStats) => void;
}

interface SchemaValidationResult {
	readonly valid: boolean;
	readonly errors: readonly string[];
}

export function SchemaTab({ input, onInputChange, onStatsChange }: SchemaTabProps) {
	const [schemaDefinition, setSchemaDefinition] = useState<string>('');
	const [schemaValidationResult, setSchemaValidationResult] =
		useState<SchemaValidationResult | null>(null);
	const [schemaError, setSchemaError] = useState<string>('');
	const [showOptions, setShowOptions] = useState(true);

	// Options.
	const [schemaStrictMode, setSchemaStrictMode] = useState<boolean>(false);
	const [schemaAllErrors, setSchemaAllErrors] = useState<boolean>(true);
	const [schemaCoerceTypes, setSchemaCoerceTypes] = useState<boolean>(false);
	const [schemaUseDefaults, setSchemaUseDefaults] = useState<boolean>(false);
	const [schemaRemoveAdditional, setSchemaRemoveAdditional] = useState<boolean>(false);
	const [schemaValidateFormats, setSchemaValidateFormats] = useState<boolean>(true);
	const [schemaVerboseErrors, setSchemaVerboseErrors] = useState<boolean>(false);
	const [outputSchemaFormat, setOutputSchemaFormat] = useState<SchemaFormat>('yaml');

	const inputValid = useValidation(input, (s) => {
		try {
			yaml.parse(s);
			return true;
		} catch {
			return false;
		}
	});

	const inferredSchema = useMemo<string>(() => {
		if (!input.trim()) return '';
		try {
			const data = yaml.parse(input);
			const jsonStr = JSON.stringify(data);
			const schema = inferJsonSchema(jsonStr);
			if (outputSchemaFormat === 'yaml') {
				return yaml.stringify(schema, { indent: 2 });
			}
			return JSON.stringify(schema, null, 2);
		} catch {
			return '';
		}
	}, [input, outputSchemaFormat]);

	const combinedError =
		schemaError ||
		(schemaValidationResult && !schemaValidationResult.valid
			? `${schemaValidationResult.errors.length} validation error(s)`
			: '');

	useReportStats(onStatsChange, input, inputValid, combinedError);

	const handleValidateSchema = useCallback(() => {
		if (!input.trim() || !schemaDefinition.trim()) {
			setSchemaError('Please enter YAML and a schema');
			return;
		}
		try {
			const data = yaml.parse(input);

			// Parse schema (accepts YAML or JSON). Use a try-block IIFE so the
			// resolved value can stay const regardless of which parser succeeds.
			const schema = ((): unknown => {
				try {
					return JSON.parse(schemaDefinition);
				} catch {
					return yaml.parse(schemaDefinition);
				}
			})();

			const ajv = new Ajv({
				allErrors: schemaAllErrors,
				strict: schemaStrictMode,
				coerceTypes: schemaCoerceTypes,
				useDefaults: schemaUseDefaults,
				removeAdditional: schemaRemoveAdditional,
				verbose: schemaVerboseErrors,
			});
			if (schemaValidateFormats) {
				addFormats(ajv);
			}
			const validate = ajv.compile(schema as object);
			const valid = validate(data);
			if (valid) {
				setSchemaValidationResult({ valid: true, errors: [] });
				toast.success('Valid');
			} else {
				const errors =
					validate.errors?.map((err) => {
						if (schemaVerboseErrors && err.data !== undefined) {
							return `${err.instancePath || '/'}: ${err.message} (value: ${JSON.stringify(err.data)})`;
						}
						return `${err.instancePath || '/'}: ${err.message}`;
					}) ?? [];
				setSchemaValidationResult({ valid: false, errors });
				toast.error(`${errors.length} error(s)`);
			}
			setSchemaError('');
		} catch (e) {
			setSchemaError(getErrorMessage(e, 'Validation failed'));
			setSchemaValidationResult(null);
		}
	}, [
		input,
		schemaDefinition,
		schemaAllErrors,
		schemaStrictMode,
		schemaCoerceTypes,
		schemaUseDefaults,
		schemaRemoveAdditional,
		schemaVerboseErrors,
		schemaValidateFormats,
	]);

	const handleUseInferredSchema = () => {
		if (inferredSchema) {
			setSchemaDefinition(inferredSchema);
			toast.success('Schema applied');
		}
	};

	const handlePaste = async () => {
		const text = await pasteFromClipboard();
		if (text) onInputChange(text);
	};

	const handleClear = () => {
		onInputChange('');
		setSchemaDefinition('');
		setSchemaValidationResult(null);
		setSchemaError('');
	};

	const handleCopySchema = () => {
		copyToClipboard(inferredSchema || schemaDefinition).catch(() => {
			// Clipboard write failed; ignore.
		});
	};

	const handleSchemaPaste = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) {
				setSchemaDefinition(text);
				toast.success('Pasted');
			}
		} catch {
			// Clipboard access denied.
		}
	};

	return (
		<div className="flex flex-1 overflow-hidden">
			<Rail
				show={showOptions}
				onClose={() => setShowOptions(false)}
				onOpen={() => setShowOptions(true)}
			>
				<FormSection title="Actions">
					<div className="flex flex-col gap-1.5">
						<Button
							variant="default"
							size="sm"
							className="w-full gap-1.5 text-xs"
							onClick={handleValidateSchema}
						>
							<FileCheck className="h-3.5 w-3.5" />
							Validate against Schema
						</Button>
						{inferredSchema ? (
							<Button
								variant="outline"
								size="sm"
								className="w-full gap-1.5 text-xs"
								onClick={handleUseInferredSchema}
							>
								<Wand2 className="h-3.5 w-3.5" />
								Use Inferred Schema
							</Button>
						) : null}
					</div>
					{schemaValidationResult ? (
						<div
							className={cn(
								'mt-2 rounded-md p-2 text-xs',
								schemaValidationResult.valid
									? 'bg-success/10 text-success'
									: 'bg-destructive/10 text-destructive'
							)}
						>
							{schemaValidationResult.valid
								? 'Schema validation passed'
								: `${schemaValidationResult.errors.length} error(s) found`}
						</div>
					) : null}
				</FormSection>

				<FormSection title="Schema Format">
					<FormMode
						value={outputSchemaFormat}
						onValueChange={setOutputSchemaFormat}
						options={[
							{ value: 'yaml', label: 'YAML' },
							{ value: 'json', label: 'JSON' },
						]}
					/>
				</FormSection>

				<FormSection title="Validation">
					<FormCheckboxGroup>
						<FormCheckbox
							label="Report all errors"
							checked={schemaAllErrors}
							onCheckedChange={setSchemaAllErrors}
							size="compact"
						/>
						<FormCheckbox
							label="Strict mode"
							checked={schemaStrictMode}
							onCheckedChange={setSchemaStrictMode}
							size="compact"
						/>
						<FormCheckbox
							label="Coerce types"
							checked={schemaCoerceTypes}
							onCheckedChange={setSchemaCoerceTypes}
							size="compact"
						/>
						<FormCheckbox
							label="Validate formats"
							checked={schemaValidateFormats}
							onCheckedChange={setSchemaValidateFormats}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Advanced">
					<FormCheckboxGroup>
						<FormCheckbox
							label="Use defaults"
							checked={schemaUseDefaults}
							onCheckedChange={setSchemaUseDefaults}
							size="compact"
						/>
						<FormCheckbox
							label="Remove additional properties"
							checked={schemaRemoveAdditional}
							onCheckedChange={setSchemaRemoveAdditional}
							size="compact"
						/>
						<FormCheckbox
							label="Verbose errors"
							checked={schemaVerboseErrors}
							onCheckedChange={setSchemaVerboseErrors}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Quick Help">
					<div className="space-y-1.5 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
						<p>
							<strong className="text-foreground">Validate:</strong> Check YAML against JSON Schema
						</p>
						<p>
							<strong className="text-foreground">Infer:</strong> Generate schema from YAML
						</p>
						<p>
							<strong className="text-foreground">Strict:</strong> Enforce JSON Schema draft rules
						</p>
						<p>
							<strong className="text-foreground">Coerce:</strong> Auto-convert types
							(string→number)
						</p>
					</div>
				</FormSection>
			</Rail>

			<SplitPane
				className="flex-1"
				left={
					<CodeEditor
						title="Input"
						value={input}
						onChange={onInputChange}
						mode="input"
						editorMode="yaml"
						placeholder="Enter YAML here..."
						onPaste={handlePaste}
						onClear={handleClear}
					/>
				}
				right={
					inferredSchema && !schemaDefinition ? (
						<CodeEditor
							title="Inferred Schema"
							value={inferredSchema}
							mode="readonly"
							editorMode={outputSchemaFormat}
							placeholder="Schema will appear here..."
							onCopy={handleCopySchema}
						/>
					) : (
						<CodeEditor
							title="JSON Schema"
							value={schemaDefinition}
							onChange={setSchemaDefinition}
							mode="input"
							editorMode="json"
							placeholder="Enter JSON Schema here (JSON or YAML)..."
							onPaste={handleSchemaPaste}
							onClear={() => setSchemaDefinition('')}
						/>
					)
				}
			/>
		</div>
	);
}

export type { SchemaTabProps };
