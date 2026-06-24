const CACHE_NAME = 'shopping-list-v7';
const urlsToCache = ['/', '/manifest.json'];

// Install event - cache essential files
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(urlsToCache);
		})
	);
	self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if (cacheName !== CACHE_NAME) {
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
	self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
	// Don't intercept API calls or non-GET requests — the Cache API only
	// supports GET, and POST /api/scan must hit the network directly.
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
		return;
	}

	event.respondWith(
		caches.match(event.request).then((response) => {
			if (response) {
				return response;
			}

			return fetch(event.request).then((response) => {
				if (!response || response.status !== 200 || response.type === 'error') {
					return response;
				}

				const responseToCache = response.clone();
				caches.open(CACHE_NAME).then((cache) => {
					cache.put(event.request, responseToCache);
				});

				return response;
			});
		})
	);
});
