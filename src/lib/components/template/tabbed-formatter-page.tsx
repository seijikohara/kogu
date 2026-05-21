import { ArrowRightLeft, Code2, FileCheck, GitCompare, Play, Search } from 'lucide-react';
import type { ReactNode } from 'react';

import { ToolShell } from '@/lib/components/shell';
import { useDocumentTitle } from '@/lib/hooks';
import {
	useFormatterPage,
	type FormatterTabType,
	type TabStats,
} from '@/lib/hooks/use-formatter-page';

/**
 * Tab content props passed to renderTabContent.
 */
interface TabContentProps {
	readonly tab: FormatterTabType;
	readonly input: string;
	readonly onInputChange: (value: string) => void;
	readonly onStatsChange: (stats: TabStats) => void;
}

/**
 * Standard tab definitions for all formatter pages.
 */
const TABS = [
	{ id: 'format', label: 'Format', icon: Play },
	{ id: 'query', label: 'Query', icon: Search },
	{ id: 'compare', label: 'Compare', icon: GitCompare },
	{ id: 'convert', label: 'Convert', icon: ArrowRightLeft },
	{ id: 'schema', label: 'Schema', icon: FileCheck },
	{ id: 'generate', label: 'Generate', icon: Code2 },
] as const satisfies readonly {
	readonly id: FormatterTabType;
	readonly label: string;
	readonly icon: typeof Play;
}[];

interface TabbedFormatterPageProps<TStats> {
	/** Page title */
	readonly title: string;
	/** Function to calculate stats from input */
	readonly calculateStats: (input: string) => TStats | null;
	/**
	 * Optional `persisted` key for the active tab. Pass the tool slug
	 * (e.g. `xml-formatter`) so each tool tracks its tab independently.
	 */
	readonly persistKey?: string;
	/** Render prop for status bar content - receives liveStats */
	readonly renderStatusContent?: (liveStats: TStats | null) => ReactNode;
	/** Render prop for tab content - receives tab props */
	readonly renderTabContent: (props: TabContentProps) => ReactNode;
}

export function TabbedFormatterPage<TStats>({
	title,
	calculateStats,
	persistKey,
	renderStatusContent,
	renderTabContent,
}: TabbedFormatterPageProps<TStats>) {
	const page = useFormatterPage<TStats>({ calculateStats, persistKey });

	useDocumentTitle(title);

	const handleTabChange = (tab: string) => {
		page.tabSync.setActiveTab(tab as FormatterTabType);
	};

	return (
		<ToolShell
			layout="tabbed"
			tabs={TABS}
			activeTab={page.tabSync.activeTab}
			onTabChange={handleTabChange}
			valid={page.currentStats.valid}
			error={page.currentStats.error}
			statusContent={renderStatusContent ? renderStatusContent(page.liveStats) : null}
			renderTabContent={(tab) =>
				renderTabContent({
					tab: tab as FormatterTabType,
					input: page.sharedInput,
					onInputChange: page.setSharedInput,
					onStatsChange: page.handleStatsChange(tab as FormatterTabType),
				})
			}
		/>
	);
}

export type { TabbedFormatterPageProps, TabContentProps };
