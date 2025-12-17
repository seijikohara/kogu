import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	test: {
		// Use jsdom for DOM simulation
		environment: 'jsdom',
		// Setup file for custom matchers
		setupFiles: ['./vitest-setup.ts'],
		// Include test files
		include: ['src/**/*.{test,spec}.{js,ts}'],
		// Exclude node_modules and build outputs
		exclude: ['node_modules', '.svelte-kit', 'build', 'src-tauri'],
		// Enable globals (describe, it, expect)
		globals: true,
		// Coverage configuration
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			include: ['src/lib/**/*.ts'],
			exclude: ['src/lib/**/*.svelte', 'src/lib/**/*.test.ts', 'src/lib/**/*.spec.ts'],
		},
	},
});
