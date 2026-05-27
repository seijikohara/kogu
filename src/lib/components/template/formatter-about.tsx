import { createContext, useContext, type ReactNode } from 'react';

import { FormInfo, FormSection } from '@/lib/components/form';
import { RelatedTools, type RelatedToolItem } from '@/lib/components/layout';

interface FormatterAboutValue {
	readonly aboutText?: ReactNode;
	readonly relatedItems?: readonly RelatedToolItem[];
}

const FormatterAboutContext = createContext<FormatterAboutValue>({});

interface FormatterAboutProviderProps {
	readonly value: FormatterAboutValue;
	readonly children: ReactNode;
}

/**
 * Carries the About / Related text down to every formatter tab template
 * so each rail can render the same footer without each tab having to
 * accept and forward a prop.
 */
export function FormatterAboutProvider({ value, children }: FormatterAboutProviderProps) {
	return <FormatterAboutContext.Provider value={value}>{children}</FormatterAboutContext.Provider>;
}

/**
 * Renders About + Related at the bottom of the rail when supplied via
 * `<FormatterAboutProvider>`. No-op when neither is provided so tab
 * templates can drop it in unconditionally.
 */
export function FormatterAboutFooter() {
	const { aboutText, relatedItems } = useContext(FormatterAboutContext);
	if (!aboutText && (!relatedItems || relatedItems.length === 0)) return null;
	return (
		<>
			{relatedItems && relatedItems.length > 0 ? (
				<FormSection title="Related">
					<RelatedTools items={relatedItems} />
				</FormSection>
			) : null}
			{aboutText ? (
				<FormSection title="About">
					<FormInfo>{aboutText}</FormInfo>
				</FormSection>
			) : null}
		</>
	);
}

export type { FormatterAboutProviderProps, FormatterAboutValue };
