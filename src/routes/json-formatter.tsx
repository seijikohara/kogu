import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/json-formatter')({
	component: () => <PlaceholderPage tool="JSON Formatter" />,
});
