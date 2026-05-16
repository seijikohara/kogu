import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/lib/components/system/placeholder-page';

export const Route = createFileRoute('/gpg-key-generator')({
	component: () => <PlaceholderPage tool="GPG Key Generator" />,
});
