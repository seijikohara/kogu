import { GenerateTabTemplate, type GenerateTabStats } from '@/lib/components/template';
import { parseJson, validateJson } from '@/lib/services/formatters';
import { useJsonFormatterOptions } from '@/lib/stores';

import { JsonFormatSection } from './json-format-section';

interface GenerateTabProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly onStatsChange?: (stats: GenerateTabStats) => void;
}

// JSON wrapper for the shared `GenerateTabTemplate`. Threads the project-wide
// JSON input-format option through `parseJson` / `validateJson`, injects the
// `JsonFormatSection` rail at the top of the OptionsPanel, and resets cleared
// input to `'{}'` so an empty editor still parses.
export function GenerateTab({ input, onInputChange, onStatsChange }: GenerateTabProps) {
	const { value: jsonOptions } = useJsonFormatterOptions();
	const { inputFormat } = jsonOptions;

	return (
		<GenerateTabTemplate
			input={input}
			onInputChange={onInputChange}
			onStatsChange={onStatsChange}
			parseInput={(text) => parseJson(text, inputFormat)}
			validateInput={(text) => {
				if (!text.trim()) return null;
				return validateJson(text, inputFormat).valid;
			}}
			inputEditorMode="json"
			inputTitle="Input JSON"
			inputPlaceholder="Enter JSON here..."
			emptyTitle="Enter JSON to generate code"
			emptyClearValue="{}"
			extraOptions={<JsonFormatSection showOutput={false} />}
		/>
	);
}

export type { GenerateTabProps };
