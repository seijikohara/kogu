import { createFileRoute } from '@tanstack/react-router';

import {
	CompareTab,
	ConvertTab,
	FormatTab,
	GenerateTab,
	QueryTab,
	SchemaTab,
} from '@/lib/components/formatter-tabs/yaml';
import { StatItem } from '@/lib/components/status';
import { TabbedFormatterPage } from '@/lib/components/template';
import { calculateYamlStats, type YamlStats } from '@/lib/services/formatters';

export const Route = createFileRoute('/yaml-formatter')({
	component: YamlFormatterPage,
});

function YamlFormatterPage() {
	return (
		<TabbedFormatterPage<YamlStats>
			title="YAML Formatter"
			calculateStats={calculateYamlStats}
			persistKey="yaml-formatter"
			renderStatusContent={(liveStats) =>
				liveStats ? (
					<>
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
