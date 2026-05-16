import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/bcrypt-generator')({
	component: () => <PlaceholderPage tool="BCrypt Generator" />,
});
