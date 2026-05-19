import { createFileRoute } from '@tanstack/react-router';

import {
	CompareTab,
	ConvertTab,
	FormatTab,
	GenerateTab,
	QueryTab,
	SchemaTab,
} from '@/lib/components/formatter-tabs/json';
import { StatItem } from '@/lib/components/status';
import { TabbedFormatterPage } from '@/lib/components/template';
import { Badge } from '@/lib/components/ui/badge';
import { calculateJsonStats, JSON_FORMAT_INFO, type JsonStats } from '@/lib/services/formatters';
import { useJsonFormatterOptions } from '@/lib/stores';

export const Route = createFileRoute('/json-formatter')({
	component: JsonFormatterPage,
});

function JsonFormatterPage() {
	const { value: jsonOptions } = useJsonFormatterOptions();
	const { inputFormat, outputFormat } = jsonOptions;

	return (
		<TabbedFormatterPage<JsonStats>
			title="JSON Formatter"
			calculateStats={(input) => calculateJsonStats(input, inputFormat)}
			persistKey="json-formatter"
			renderStatusContent={(liveStats) =>
				liveStats ? (
					<>
						<Badge variant="outline" className="font-mono text-2xs">
							{JSON_FORMAT_INFO[inputFormat].label} → {JSON_FORMAT_INFO[outputFormat].label}
						</Badge>
						<StatItem label="Keys" value={liveStats.keys} />
						<StatItem label="Values" value={liveStats.values} />
						<StatItem label="Depth" value={liveStats.depth} />
						<StatItem label="Size" value={liveStats.size} />
					</>
				) : null
			}
			renderTabContent={({ tab, input, onInputChange, onStatsChange }) => {
				switch (tab) {
					case 'format':
						return (
							<FormatTab
								input={input}
								onInputChange={onInputChange}
								onStatsChange={onStatsChange}
							/>
						);
					case 'query':
						return (
							<QueryTab input={input} onInputChange={onInputChange} onStatsChange={onStatsChange} />
						);
					case 'compare':
						return (
							<CompareTab
								input={input}
								onInputChange={onInputChange}
								onStatsChange={onStatsChange}
							/>
						);
					case 'convert':
						return (
							<ConvertTab
								input={input}
								onInputChange={onInputChange}
								onStatsChange={onStatsChange}
							/>
						);
					case 'schema':
						return (
							<SchemaTab
								input={input}
								onInputChange={onInputChange}
								onStatsChange={onStatsChange}
							/>
						);
					case 'generate':
						return (
							<GenerateTab
								input={input}
								onInputChange={onInputChange}
								onStatsChange={onStatsChange}
							/>
						);
					default:
						return null;
				}
			}}
		/>
	);
}
