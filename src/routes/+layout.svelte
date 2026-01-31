<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import { injectAnalytics } from '$lib/analytics';

	let { children } = $props();

	onMount(() => {
		injectAnalytics();
		// Register service worker for PWA
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker
				.register('/service-worker.js')
				.then((registration) => {
					console.log('Service Worker registered:', registration);
				})
				.catch((error) => {
					console.log('Service Worker registration failed:', error);
				});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href="/icon.svg" />
	<link rel="manifest" href="/manifest.json" />
	<meta name="theme-color" content="#6366f1" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content="Shopping List" />
</svelte:head>
{@render children()}
