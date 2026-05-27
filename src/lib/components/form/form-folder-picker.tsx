import { FolderOpen, type LucideIcon } from 'lucide-react';

import { Button } from '@/lib/components/ui/button';

interface FormFolderPickerProps {
	readonly picked: boolean;
	readonly path?: string | null;
	readonly onPick: () => void;
	readonly icon?: LucideIcon;
	readonly emptyLabel?: string;
	readonly replaceLabel?: string;
	readonly disabled?: boolean;
}

export function FormFolderPicker({
	picked,
	path,
	onPick,
	icon: Icon = FolderOpen,
	emptyLabel = 'Pick folder…',
	replaceLabel = 'Choose another',
	disabled = false,
}: FormFolderPickerProps) {
	return (
		<div className="flex flex-col gap-2">
			<Button variant="default" size="sm" onClick={onPick} disabled={disabled}>
				<Icon className="h-3.5 w-3.5" />
				{picked ? replaceLabel : emptyLabel}
			</Button>
			{picked && path ? (
				<div className="rounded-md border bg-muted/30 p-2 font-mono text-2xs break-all">{path}</div>
			) : null}
		</div>
	);
}

export type { FormFolderPickerProps };
