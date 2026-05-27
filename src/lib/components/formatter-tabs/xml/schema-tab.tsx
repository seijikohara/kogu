import { FileCheck, Wand2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useReportStats, useValidation } from '@/lib/hooks';
import { CodeEditor } from '@/lib/components/editor';
import { FormCheckbox, FormCheckboxGroup, FormSection } from '@/lib/components/form';
import { SplitPane } from '@/lib/components/layout';
import { Rail } from '@/lib/components/ui/rail';

import { FormatterAboutFooter } from '@/lib/components/template';
import { Button } from '@/lib/components/ui/button';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/utils';
import { copyToClipboard, pasteFromClipboard } from '@/lib/utils/file-operations';

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

/**
 * Infer an XSD schema by walking the parsed XML tree.
 */
const inferXsdSchema = (xmlInput: string): string => {
	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(xmlInput, 'application/xml');
		const parserError = doc.querySelector('parsererror');
		if (parserError) {
			throw new Error('Invalid XML');
		}

		const rootElement = doc.documentElement;
		const elements = new Map<string, { attributes: Set<string>; children: Set<string> }>();

		const analyzeElement = (element: Element) => {
			const tagName = element.tagName;
			if (!elements.has(tagName)) {
				elements.set(tagName, { attributes: new Set(), children: new Set() });
			}
			const info = elements.get(tagName);
			if (!info) return;

			Array.from(element.attributes).forEach((attr) => info.attributes.add(attr.name));

			Array.from(element.children).forEach((child) => {
				info.children.add(child.tagName);
				analyzeElement(child);
			});
		};

		analyzeElement(rootElement);

		const header = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">

`;

		const elementDefs = Array.from(elements.entries())
			.map(([tagName, info]) => {
				const childrenSeq =
					info.children.size > 0
						? [
								'      <xs:sequence>',
								...Array.from(info.children).map(
									(child) =>
										`        <xs:element ref="${child}" minOccurs="0" maxOccurs="unbounded"/>`
								),
								'      </xs:sequence>',
							].join('\n')
						: [
								'      <xs:simpleContent>',
								'        <xs:extension base="xs:string">',
								...Array.from(info.attributes).map(
									(attr) => `          <xs:attribute name="${attr}" type="xs:string"/>`
								),
								'        </xs:extension>',
								'      </xs:simpleContent>',
							].join('\n');

				const topLevelAttrs =
					info.children.size > 0 && info.attributes.size > 0
						? Array.from(info.attributes)
								.map((attr) => `      <xs:attribute name="${attr}" type="xs:string"/>`)
								.join('\n')
						: '';

				return [
					`  <xs:element name="${tagName}">`,
					'    <xs:complexType>',
					childrenSeq,
					topLevelAttrs,
					'    </xs:complexType>',
					'  </xs:element>',
				]
					.filter(Boolean)
					.join('\n');
			})
			.join('\n\n');

		return `${header}${elementDefs}\n\n</xs:schema>`;
	} catch (e) {
		throw new Error(getErrorMessage(e, 'Failed to infer schema'));
	}
};

export function SchemaTab({ input, onInputChange, onStatsChange }: SchemaTabProps) {
	const [schemaDefinition, setSchemaDefinition] = useState<string>('');
	const [schemaValidationResult, setSchemaValidationResult] =
		useState<SchemaValidationResult | null>(null);
	const [schemaError, setSchemaError] = useState<string>('');
	const [showOptions, setShowOptions] = useState(true);

	const [validateNamespaces, setValidateNamespaces] = useState<boolean>(true);
	const [validateDtd, setValidateDtd] = useState<boolean>(false);

	const inputValid = useValidation(input, (s) => {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(s, 'application/xml');
			return doc.querySelector('parsererror') === null;
		} catch {
			return false;
		}
	});

	const inferredSchema = useMemo<string>(() => {
		if (!input.trim()) return '';
		try {
			return inferXsdSchema(input);
		} catch {
			return '';
		}
	}, [input]);

	const combinedError =
		schemaError ||
		(schemaValidationResult && !schemaValidationResult.valid
			? `${schemaValidationResult.errors.length} validation error(s)`
			: '');

	useReportStats(onStatsChange, input, inputValid, combinedError);

	const handleValidateSchema = useCallback(() => {
		if (!input.trim() || !schemaDefinition.trim()) {
			setSchemaError('Please enter XML and a schema');
			return;
		}

		try {
			const parser = new DOMParser();

			const xmlDoc = parser.parseFromString(input, 'application/xml');
			const xmlError = xmlDoc.querySelector('parsererror');
			if (xmlError) {
				setSchemaError(`Invalid XML: ${xmlError.textContent ?? ''}`);
				setSchemaValidationResult(null);
				return;
			}

			const xsdDoc = parser.parseFromString(schemaDefinition, 'application/xml');
			const xsdError = xsdDoc.querySelector('parsererror');
			if (xsdError) {
				setSchemaError(`Invalid XSD schema: ${xsdError.textContent ?? ''}`);
				setSchemaValidationResult(null);
				return;
			}

			const errors: string[] = [];
			const rootElement = xmlDoc.documentElement;
			const schemaElements = xsdDoc.querySelectorAll('element');
			const definedElements = new Set(
				Array.from(schemaElements)
					.map((el) => el.getAttribute('name'))
					.filter((name): name is string => name !== null)
			);

			const checkElements = (element: Element, path: string) => {
				const tagName = element.tagName;
				if (!definedElements.has(tagName) && definedElements.size > 0) {
					errors.push(`${path}/${tagName}: Element not defined in schema`);
				}

				if (validateNamespaces && element.namespaceURI) {
					const schemaNamespace = xsdDoc.documentElement.getAttribute('targetNamespace');
					if (schemaNamespace && element.namespaceURI !== schemaNamespace) {
						errors.push(
							`${path}/${tagName}: Namespace mismatch (expected: ${schemaNamespace}, got: ${element.namespaceURI})`
						);
					}
				}

				Array.from(element.children).forEach((child) => checkElements(child, `${path}/${tagName}`));
			};

			checkElements(rootElement, '');

			if (errors.length === 0) {
				setSchemaValidationResult({ valid: true, errors: [] });
				toast.success('XML is valid against schema');
			} else {
				setSchemaValidationResult({ valid: false, errors });
				toast.error(`${errors.length} validation error(s) found`);
			}
			setSchemaError('');
		} catch (e) {
			setSchemaError(getErrorMessage(e, 'Validation failed'));
			setSchemaValidationResult(null);
		}
	}, [input, schemaDefinition, validateNamespaces]);

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
						<>
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
							{!schemaValidationResult.valid && schemaValidationResult.errors.length > 0 ? (
								<div className="mt-2 max-h-32 overflow-auto rounded-md bg-muted/50 p-2 text-xs">
									{schemaValidationResult.errors.map((error) => (
										<div key={error} className="text-destructive">
											{error}
										</div>
									))}
								</div>
							) : null}
						</>
					) : null}
				</FormSection>

				<FormSection title="Validation Options">
					<FormCheckboxGroup>
						<FormCheckbox
							label="Validate namespaces"
							checked={validateNamespaces}
							onCheckedChange={setValidateNamespaces}
							size="compact"
						/>
						<FormCheckbox
							label="Validate DTD (if present)"
							checked={validateDtd}
							onCheckedChange={setValidateDtd}
							size="compact"
						/>
					</FormCheckboxGroup>
				</FormSection>

				<FormSection title="Quick Help">
					<div className="space-y-1.5 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
						<p>
							<strong className="text-foreground">Validate:</strong> Check XML against XSD schema
						</p>
						<p>
							<strong className="text-foreground">Infer:</strong> Generate XSD from XML structure
						</p>
						<p className="text-xs italic">
							Note: Full XSD validation requires a backend service. This provides basic structure
							validation.
						</p>
					</div>
				</FormSection>
				<FormatterAboutFooter />
			</Rail>

			<SplitPane
				className="flex-1"
				left={
					<CodeEditor
						title="Input"
						value={input}
						onChange={onInputChange}
						mode="input"
						editorMode="xml"
						placeholder="Enter XML here..."
						onPaste={handlePaste}
						onClear={handleClear}
					/>
				}
				right={
					inferredSchema && !schemaDefinition ? (
						<CodeEditor
							title="Inferred Schema (XSD)"
							value={inferredSchema}
							mode="readonly"
							editorMode="xml"
							placeholder="Schema will appear here..."
							onCopy={handleCopySchema}
						/>
					) : (
						<CodeEditor
							title="XML Schema (XSD)"
							value={schemaDefinition}
							onChange={setSchemaDefinition}
							mode="input"
							editorMode="xml"
							placeholder="Enter XSD schema here..."
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
