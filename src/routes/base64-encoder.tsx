import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/base64-encoder')({
	component: () => <PlaceholderPage tool="Base64 Encoder" />,
});
