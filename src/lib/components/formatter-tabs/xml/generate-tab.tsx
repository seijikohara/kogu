import { GenerateTabTemplate, type GenerateTabStats } from '@/lib/components/template';
import { xmlToJsonObject } from '@/lib/services/formatters';

interface GenerateTabProps {
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly onStatsChange?: (stats: GenerateTabStats) => void;
}

// XML wrapper for the shared `GenerateTabTemplate`. Routes input through
// `xmlToJsonObject` (the canonical XML→JSON pipeline used by the convert /
// schema tabs) before delegating to the language code generators, and
// validates by attempting a DOMParser parse — both rooted in the browser
// XML APIs already shipped by the runtime.
export function GenerateTab(props: GenerateTabProps) {
	return (
		<GenerateTabTemplate
			{...props}
			parseInput={xmlToJsonObject}
			validateInput={(text) => {
				if (!text.trim()) return null;
				try {
					const parser = new DOMParser();
					const doc = parser.parseFromString(text, 'application/xml');
					return doc.querySelector('parsererror') === null;
				} catch {
					return false;
				}
			}}
			inputEditorMode="xml"
			inputTitle="Input XML"
			inputPlaceholder="Enter XML here..."
			emptyTitle="Enter XML to generate code"
		/>
	);
}

export type { GenerateTabProps };
