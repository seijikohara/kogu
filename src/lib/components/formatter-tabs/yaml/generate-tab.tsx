import * as yaml from 'yaml';

import { GenerateTabTemplate, type GenerateTabStats } from '@/lib/components/template';

interface GenerateTabProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly onStatsChange?: (stats: GenerateTabStats) => void;
}

// YAML wrapper for the shared `GenerateTabTemplate`. Both parse and validate
// route through `yaml.parse` from the `yaml` package — the library throws on
// invalid input, so the template's try / catch around `parseInput` is the
// error boundary the user-facing error toast feeds off.
export function GenerateTab(props: GenerateTabProps) {
	return (
		<GenerateTabTemplate
			{...props}
			parseInput={(text) => yaml.parse(text)}
			validateInput={(text) => {
				if (!text.trim()) return null;
				try {
					yaml.parse(text);
					return true;
				} catch {
					return false;
				}
			}}
			inputEditorMode="yaml"
			inputTitle="Input YAML"
			inputPlaceholder="Enter YAML here..."
			emptyTitle="Enter YAML to generate code"
		/>
	);
}

export type { GenerateTabProps };
