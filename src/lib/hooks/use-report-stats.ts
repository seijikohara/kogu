import { useEffect } from 'react';

import type { TabStats } from './use-formatter-page';

// Re-runs `onStatsChange` whenever any of the three fields changes.
// Replaces the inline `useEffect(() => onStatsChange?.({input, valid, error}),
// [input, valid, error, onStatsChange])` ladder that appeared at 11 formatter
// tab call sites (json/xml/yaml × format/query/schema plus the shared
// template/convert-tab and template/generate-tab).
//
// The three values are passed positionally rather than as a single `stats`
// object so callers don't have to memoize the object on every render — React's
// referential equality on the primitive deps does the right thing.
export function useReportStats(
	onStatsChange: ((stats: TabStats) => void) | undefined,
	input: string,
	valid: boolean | null,
	error: string
): void {
	useEffect(() => {
		onStatsChange?.({ input, valid, error });
	}, [input, valid, error, onStatsChange]);
}
