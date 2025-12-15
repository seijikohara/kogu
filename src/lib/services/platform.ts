import { platform } from '@tauri-apps/plugin-os';

export type Platform = 'macos' | 'windows' | 'linux' | 'unknown';

let cachedPlatform: Platform | null = null;

export const getPlatform = async (): Promise<Platform> => {
	if (cachedPlatform) return cachedPlatform;

	try {
		const os = await platform();
		cachedPlatform =
			os === 'macos'
				? 'macos'
				: os === 'windows'
					? 'windows'
					: os === 'linux'
						? 'linux'
						: 'unknown';
		return cachedPlatform;
	} catch {
		return 'unknown';
	}
};

export const isMacOS = async (): Promise<boolean> => {
	const p = await getPlatform();
	return p === 'macos';
};
