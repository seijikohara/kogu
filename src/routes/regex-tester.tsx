import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/regex-tester')({
	component: () => <PlaceholderPage tool="Regex Tester" />,
});
