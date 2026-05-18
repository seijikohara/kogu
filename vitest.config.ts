import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@': path.resolve(import.meta.dirname, './src'),
			'@lib': path.resolve(import.meta.dirname, './src/lib'),
		},
	},
	test: {
		// Use jsdom for DOM simulation
		environment: 'jsdom',
		// Setup file for custom matchers
		setupFiles: ['./vitest-setup.ts'],
		// Include test files
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
		// Exclude node_modules and build outputs
		exclude: ['node_modules', 'dist', 'build', 'src-tauri'],
		// Enable globals (describe, it, expect)
		globals: true,
		// Coverage configuration
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			include: ['src/lib/**/*.{ts,tsx}'],
			exclude: ['src/lib/**/*.test.{ts,tsx}', 'src/lib/**/*.spec.{ts,tsx}'],
		},
	},
});
