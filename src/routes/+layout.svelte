<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import { injectAnalytics } from '$lib/analytics';

	let { children } = $props();

	onMount(() => {
		const splash = document.getElementById('pwa-splash');
		if (splash) {
			const teardown = () => splash.remove();
			const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			if (reducedMotion) {
				teardown();
			} else {
				const fallbackMs = 600;
				const tid = window.setTimeout(teardown, fallbackMs);
				splash.addEventListener(
					'transitionend',
					(e) => {
						if (e.target !== splash) return;
						window.clearTimeout(tid);
						teardown();
					},
					{ once: true }
				);
				requestAnimationFrame(() => splash.classList.add('pwa-splash--hide'));
			}
		}
		injectAnalytics();
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js');
		}
	});
</script>

<svelte:head>
	<link rel="icon" href="/icon.svg" />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#0F0F0F" media="(prefers-color-scheme: dark)" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content="Shopping List" />
</svelte:head>
{@render children()}
