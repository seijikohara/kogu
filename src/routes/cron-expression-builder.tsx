import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/cron-expression-builder')({
	component: () => <PlaceholderPage tool="Cron Expression Builder" />,
});
