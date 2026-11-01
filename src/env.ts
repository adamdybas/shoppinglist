import { defineEnvVars } from '@sveltejs/kit/env';

// Keep credentials optional so either provider can be configured at runtime.
export const variables = defineEnvVars({
	VISION_PROVIDER: { schema: (value) => value ?? 'gemini' },
	GEMINI_API_KEY: { schema: (value) => value },
	ANTHROPIC_API_KEY: { schema: (value) => value }
});
