import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/string-case-converter')({
	component: () => <PlaceholderPage tool="String Case Converter" />,
});
