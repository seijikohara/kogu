import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/network-interfaces')({
	component: () => <PlaceholderPage tool="Network Interfaces" />,
});
