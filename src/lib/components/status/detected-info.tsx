import { FormInfo, FormSection } from '@/lib/components/form';

interface DetectedItem {
	readonly show: boolean;
	readonly label: string;
	readonly value: string | number | boolean;
	readonly warning?: boolean;
}

interface DetectedInfoProps {
	readonly title?: string;
	readonly items: readonly DetectedItem[];
	readonly showIcon?: boolean;
}

export function DetectedInfo({ title = 'Detected', items, showIcon = false }: DetectedInfoProps) {
	const visibleItems = items.filter((item) => item.show);
	if (visibleItems.length === 0) return null;

	return (
		<FormSection title={title}>
			<FormInfo showIcon={showIcon}>
				{visibleItems.map((item) => (
					<p key={item.label} className={item.warning ? 'text-warning' : ''}>
						<strong>{item.label}:</strong>{' '}
						{typeof item.value === 'boolean' ? (item.value ? 'Yes' : 'No') : item.value}
					</p>
				))}
			</FormInfo>
		</FormSection>
	);
}

export type { DetectedInfoProps, DetectedItem };
