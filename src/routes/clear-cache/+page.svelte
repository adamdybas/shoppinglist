<script>
	import { onMount } from 'svelte';
	
	let status = $state('Ready to clear...');
	
	onMount(() => {
		clearEverything();
	});
	
	async function clearEverything() {
		try {
			// Unregister all service workers
			if ('serviceWorker' in navigator) {
				const registrations = await navigator.serviceWorker.getRegistrations();
				for (let registration of registrations) {
					await registration.unregister();
				}
				status = 'Service workers cleared!';
			}
			
			// Clear IndexedDB
			await indexedDB.deleteDatabase('ShoppingListDB');
			status = 'All caches cleared! Redirecting...';
			
			// Redirect to home after 1 second
			setTimeout(() => {
				window.location.href = '/?nocache=' + Date.now();
			}, 1000);
		} catch (err) {
			status = 'Error: ' + err.message;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
	<div class="rounded-lg bg-white p-8 text-center shadow-lg">
		<h1 class="mb-4 text-2xl font-bold text-gray-800">Clearing Cache...</h1>
		<p class="text-gray-600">{status}</p>
	</div>
</div>
