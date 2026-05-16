import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/hash-generator')({
	component: () => <PlaceholderPage tool="Hash Generator" />,
});
