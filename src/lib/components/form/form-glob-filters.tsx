import { FormInput } from './form-input';

interface FormGlobFiltersProps {
	readonly include: string;
	readonly exclude: string;
	readonly onIncludeChange: (value: string) => void;
	readonly onExcludeChange: (value: string) => void;
	readonly includePlaceholder?: string;
	readonly excludePlaceholder?: string;
	readonly includeHint?: string;
	readonly excludeHint?: string;
}

export function FormGlobFilters({
	include,
	exclude,
	onIncludeChange,
	onExcludeChange,
	includePlaceholder = '*.jpg, *.png (empty = all)',
	excludePlaceholder = 'node_modules, .git',
	includeHint = 'Comma- or whitespace-separated; matched against file name and path components.',
	excludeHint = 'Skip files / directories matching any pattern.',
}: FormGlobFiltersProps) {
	return (
		<>
			<FormInput
				label="Include globs"
				value={include}
				placeholder={includePlaceholder}
				size="compact"
				onValueChange={onIncludeChange}
				hint={includeHint}
			/>
			<FormInput
				label="Exclude globs"
				value={exclude}
				placeholder={excludePlaceholder}
				size="compact"
				onValueChange={onExcludeChange}
				hint={excludeHint}
			/>
		</>
	);
}

export type { FormGlobFiltersProps };
