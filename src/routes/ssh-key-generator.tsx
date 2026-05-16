import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/ssh-key-generator')({
	component: () => <PlaceholderPage tool="SSH Key Generator" />,
});
