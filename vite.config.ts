import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({ adapter: adapter({ runtime: 'nodejs22.x' }), preprocess: vitePreprocess() })
	],
	test: { include: ['src/**/*.test.ts'] }
});
