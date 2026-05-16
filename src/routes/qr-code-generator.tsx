import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/qr-code-generator')({
	component: () => <PlaceholderPage tool="QR Code Generator" />,
});
