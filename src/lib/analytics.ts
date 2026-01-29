import { inject } from '@vercel/analytics';

let hasInjected = false;

export function injectAnalytics() {
	if (hasInjected || typeof window === 'undefined' || !import.meta.env.PROD) return;
	hasInjected = true;
	inject();
}
