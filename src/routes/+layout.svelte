<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import { injectAnalytics } from '$lib/analytics';

	let { children } = $props();

	const appleStartupImages = [
		{ file: 'iphone-se-1', width: 320, height: 568, ratio: 2 },
		{ file: 'iphone-se-2', width: 375, height: 667, ratio: 2 },
		{ file: 'iphone-x-11pro', width: 375, height: 812, ratio: 3 },
		{ file: 'iphone-xr-11', width: 414, height: 896, ratio: 2 },
		{ file: 'iphone-max-legacy', width: 414, height: 896, ratio: 3 },
		{ file: 'iphone-12-14', width: 390, height: 844, ratio: 3 },
		{ file: 'iphone-15-pro', width: 393, height: 852, ratio: 3 },
		{ file: 'iphone-12-14-plus', width: 428, height: 926, ratio: 3 },
		{ file: 'iphone-15-plus', width: 430, height: 932, ratio: 3 }
	];

	onMount(() => {
		injectAnalytics();
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js');
		}
	});
</script>

<svelte:head>
	<link rel="icon" href="/icon.svg" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.json" />
	{#each appleStartupImages as image}
		<link
			rel="apple-touch-startup-image"
			media={`(prefers-color-scheme: light) and (device-width: ${image.width}px) and (device-height: ${image.height}px) and (-webkit-device-pixel-ratio: ${image.ratio}) and (orientation: portrait)`}
			href={`/apple-startup/${image.file}-light.png`}
		/>
		<link
			rel="apple-touch-startup-image"
			media={`(prefers-color-scheme: dark) and (device-width: ${image.width}px) and (device-height: ${image.height}px) and (-webkit-device-pixel-ratio: ${image.ratio}) and (orientation: portrait)`}
			href={`/apple-startup/${image.file}-dark.png`}
		/>
	{/each}
	<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#0F0F0F" media="(prefers-color-scheme: dark)" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content="Shopping List" />
</svelte:head>
{@render children()}
