import { platform } from '@tauri-apps/plugin-os';

export type Platform = 'macos' | 'windows' | 'linux' | 'unknown';

// Module-level cache for the resolved OS platform. Wrapped in a const
// holder so the binding itself is never reassigned.
const platformCache: { value: Platform | null } = { value: null };

export const getPlatform = async (): Promise<Platform> => {
	if (platformCache.value) return platformCache.value;

	try {
		const os = await platform();
		const resolved: Platform =
			os === 'macos'
				? 'macos'
				: os === 'windows'
					? 'windows'
					: os === 'linux'
						? 'linux'
						: 'unknown';
		platformCache.value = resolved;
		return resolved;
	} catch {
		return 'unknown';
	}
};

export const isMacOS = async (): Promise<boolean> => {
	const p = await getPlatform();
	return p === 'macos';
};
