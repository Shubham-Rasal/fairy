import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['src/**/*.test.ts'],
	},
	resolve: {
		alias: {
			// Stub out Obsidian and CodeMirror — provided by the runtime, not npm
			'obsidian': new URL('./src/__mocks__/obsidian.ts', import.meta.url).pathname,
			'@codemirror/view': new URL('./src/__mocks__/codemirror-view.ts', import.meta.url).pathname,
			'@codemirror/state': new URL('./src/__mocks__/codemirror-state.ts', import.meta.url).pathname,
		}
	}
});
