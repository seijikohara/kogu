import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/curl-builder')({
	component: () => <PlaceholderPage tool="cURL Builder" />,
});
