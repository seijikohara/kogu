import { createFileRoute } from '@tanstack/react-router';

import {
	CompareTab,
	ConvertTab,
	FormatTab,
	GenerateTab,
	QueryTab,
	SchemaTab,
} from '@/lib/components/formatter-tabs/xml';
import { TabbedFormatterPage } from '@/lib/components/template';
import { StatItem } from '@/lib/components/status';
import { calculateXmlStats, type XmlStats } from '@/lib/services/formatters';

export const Route = createFileRoute('/xml-formatter')({
	component: XmlFormatterPage,
});

function XmlFormatterPage() {
	return (
		<TabbedFormatterPage<XmlStats>
			title="XML Formatter"
			calculateStats={calculateXmlStats}
			persistKey="xml-formatter"
			aboutText="Format, minify, query (XPath), compare, convert, generate schemas, or emit code from XML. All transforms run locally in the browser."
			relatedItems={[
				{ id: 'json-formatter', reason: 'Same actions in JSON' },
				{ id: 'yaml-formatter', reason: 'Same actions in YAML' },
				{ id: 'diff-viewer', reason: 'Compare arbitrary text' },
				{ id: 'x509-decoder', reason: 'Inspect certificates as XML/ASN.1' },
			]}
			renderStatusContent={(liveStats) =>
				liveStats ? (
					<>
						<StatItem label="Elements" value={liveStats.elements} />
						<StatItem label="Attributes" value={liveStats.attributes} />
						<StatItem label="Depth" value={liveStats.depth} />
						<StatItem label="Size" value={liveStats.size} />
					</>
				) : (
					<span className="text-xs text-muted-foreground/70">
						Paste, drop, or load sample to get started
					</span>
				)
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
