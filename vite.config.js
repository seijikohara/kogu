import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const host = process.env['TAURI_DEV_HOST'];

// https://vite.dev/config/
export default defineConfig(async () => ({
	plugins: [sveltekit(), tailwindcss()],

	// @vizel/svelte ships uncompiled .svelte files that need Svelte plugin
	// compilation. Exclude from pre-bundling so Vite compiles each .svelte
	// file individually. Re-include transitive deps via nested dep syntax
	// so they share the same pre-bundled ProseMirror singletons.
	// Ref: https://vite.dev/config/dep-optimization-options#optimizedeps-include
	optimizeDeps: {
		exclude: ['@vizel/svelte'],
		include: ['@vizel/svelte > @vizel/core', '@vizel/svelte > @iconify/svelte'],
	},
	ssr: {
		noExternal: ['@vizel/svelte'],
	},

	// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
	//
	// 1. prevent Vite from obscuring rust errors
	clearScreen: false,
	// 2. tauri expects a fixed port, fail if that port is not available
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: 'ws',
					host,
					port: 1421,
				}
			: undefined,
		watch: {
			// 3. tell Vite to ignore watching `src-tauri`
			ignored: ['**/src-tauri/**'],
		},
	},
}));
