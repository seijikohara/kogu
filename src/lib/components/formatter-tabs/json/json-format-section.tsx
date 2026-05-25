import { FormSection, FormSelect } from '@/lib/components/form';
import type { JsonInputFormat, JsonOutputFormat } from '@/lib/services/formatters';
import { JSON_FORMAT_OPTIONS } from '@/lib/services/formatters';
import { useJsonFormatterOptions } from '@/lib/stores';

interface JsonFormatSectionProps {
	/**
	 * Whether to render the output variant selector. Tabs whose output is
	 * not JSON (Convert produces YAML / XML, Generate produces TS / Go /
	 * etc.) hide it to avoid presenting a no-op control.
	 */
	readonly showOutput?: boolean;
}

/**
 * Persistent JSON input / output variant selector. Rendered at the top
 * of every JSON tab's Rail so the user can toggle JSON / JSON5 /
 * JSONC / NDJSON without losing the rest of their per-tab options.
 */
export function JsonFormatSection({ showOutput = true }: JsonFormatSectionProps) {
	const { value, patch } = useJsonFormatterOptions();

	return (
		<FormSection title="Format">
			<FormSelect
				label="Input"
				size="compact"
				value={value.inputFormat}
				options={JSON_FORMAT_OPTIONS}
				onValueChange={(next) => patch({ inputFormat: next as JsonInputFormat })}
			/>
			{showOutput ? (
				<FormSelect
					label="Output"
					size="compact"
					value={value.outputFormat}
					options={JSON_FORMAT_OPTIONS}
					onValueChange={(next) => patch({ outputFormat: next as JsonOutputFormat })}
				/>
			) : null}
		</FormSection>
	);
}

export type { JsonFormatSectionProps };
