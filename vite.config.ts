import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const TAURI_DEV_HOST = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
	plugins: [
		TanStackRouterVite({
			routesDirectory: './src/routes',
			generatedRouteTree: './src/route-tree.gen.ts',
			autoCodeSplitting: true,
		}),
		react(),
		tailwindcss(),
	],
	resolve: {
		alias: {
			'@': path.resolve(import.meta.dirname, './src'),
			'@lib': path.resolve(import.meta.dirname, './src/lib'),
		},
	},
	clearScreen: false,
	server: {
		port: 1420,
		strictPort: true,
		host: TAURI_DEV_HOST || false,
		hmr: TAURI_DEV_HOST
			? {
					protocol: 'ws',
					host: TAURI_DEV_HOST,
					port: 1421,
				}
			: undefined,
		watch: {
			ignored: ['**/src-tauri/**'],
		},
	},
	envPrefix: ['VITE_', 'TAURI_ENV_*'],
	build: {
		target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
		minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
		sourcemap: !!process.env.TAURI_ENV_DEBUG,
	},
}));
