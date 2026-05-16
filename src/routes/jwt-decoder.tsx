import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/jwt-decoder')({
	component: () => <PlaceholderPage tool="JWT Decoder" />,
});
