import { useEffect } from 'react';

const APP_NAME = 'Kogu';
const TITLE_SEPARATOR = '—';

// Set the document title for the lifetime of the component, restoring the
// previous value on unmount. The final title is `"${title} ${TITLE_SEPARATOR}
// Kogu"`. Centralises the side-effect that every tool route used to spell
// out by hand, and pins one canonical separator (em-dash) across the app —
// before extraction the routes split between `—` and `-` for the same
// position.
export function useDocumentTitle(title: string): void {
	useEffect(() => {
		const previous = document.title;
		document.title = `${title} ${TITLE_SEPARATOR} ${APP_NAME}`;
		return () => {
			document.title = previous;
		};
	}, [title]);
}
