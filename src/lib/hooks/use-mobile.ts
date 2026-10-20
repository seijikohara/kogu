import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

const subscribe = (onChange: () => void): (() => void) => {
	const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
	mql.addEventListener('change', onChange);
	return () => mql.removeEventListener('change', onChange);
};

const getSnapshot = (): boolean => window.innerWidth < MOBILE_BREAKPOINT;

// Without a window (server render) there is no viewport, so report desktop.
const getServerSnapshot = (): boolean => false;

export function useIsMobile() {
	return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
