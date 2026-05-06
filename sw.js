// MaziwaTrack Pro - Service Worker
// Version: 1.0.0
// Provides offline support and asset caching for the dairy management app

const CACHE_NAME = 'maziwatrack-v1.0.0';
const OFFLINE_URL = 'index.html';

// Assets to cache for offline use (core app shell)
const ASSETS_TO_CACHE = [
  '/',
  'index.html',
  'style.css',
  'manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        // Force the waiting service worker to become active
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service Worker ready to handle fetches');
      return self.clients.claim();
    })
  );
});

// Helper function: determine if request is for an API/data endpoint
// We don't cache dynamic data, just the static app shell
function isDataRequest(request) {
  const url = new URL(request.url);
  // Exclude any API-like patterns (our app uses localforage, no external API)
  // But we also avoid caching external resources that might change
  const excludedPatterns = [
    'localforage',
    'indexedDB',
    'chrome-extension'
  ];
  return excludedPatterns.some(pattern => request.url.includes(pattern));
}

// Helper: network-first strategy for HTML to get latest content
async function networkFirst(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      // Cache the fresh response
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Network failed, falling back to cache for:', request.url);
  }
  
  // Fallback to cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If offline and no cache, return offline page
  if (request.mode === 'navigate') {
    return caches.match(OFFLINE_URL);
  }
  
  return new Response('Offline - content not available', {
    status: 404,
    statusText: 'Not Found'
  });
}

// Cache-first strategy for static assets (CSS, JS, icons)
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache-first failed for:', request.url);
    return new Response('Resource not available offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Fetch event - determine strategy based on request type
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip data/indexedDB/internal requests
  if (isDataRequest(request)) {
    return;
  }
  
  // For HTML navigation requests - use network-first to get latest version
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // For static assets (CSS, JS, images, fonts) - use cache-first
  if (url.pathname.match(/\.(css|js|json|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)$/i)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // For everything else (including chart.js CDN, localforage CDN) - network-first with cache fallback
  event.respondWith(networkFirst(request));
});

// Optional: Background sync for offline data (future enhancement)
// This allows queuing sales/cow updates when offline, then syncing when back online
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  if (event.tag === 'sync-sales') {
    event.waitUntil(syncSalesData());
  }
});

// Background sync handler - can be extended to sync offline changes
async function syncSalesData() {
  console.log('[SW] Syncing offline sales data...');
  // This function would read from IndexedDB and send to server if backend existed
  // For pure offline app, we just log; data is stored locally via localforage
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      message: 'Offline data sync complete'
    });
  });
}

// Listen for online/offline events to notify the client
self.addEventListener('online', () => {
  console.log('[SW] Browser is online');
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'NETWORK_ONLINE', message: 'Connection restored' });
    });
  });
});

self.addEventListener('offline', () => {
  console.log('[SW] Browser is offline');
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'NETWORK_OFFLINE', message: 'Working offline mode' });
    });
  });
});

// Message event to handle client requests (e.g., cache clearing)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] Clearing cache...');
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('[SW] Cache cleared');
        event.ports[0]?.postMessage({ success: true });
      })
    );
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Prefetch critical assets when idle
self.addEventListener('idle', () => {
  console.log('[SW] Browser idle, prefetching assets...');
  const urlsToPrefetch = [
    'style.css',
    'manifest.json'
  ];
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToPrefetch);
    }).catch(err => console.log('[SW] Prefetch error:', err))
  );
});

// Error handling for fetch failures
self.addEventListener('fetch', (event) => {
  // Add custom offline error page for failed requests
  event.respondWith(
    fetch(event.request).catch((error) => {
      console.warn('[SW] Fetch failed, returning offline response:', event.request.url);
      
      // For image requests, return a placeholder icon
      if (event.request.headers.get('accept').includes('image')) {
        return new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 8h-4v4h-4v-4H6V9h4V5h4v4h4v2z"/></svg>',
          { headers: { 'Content-Type': 'image/svg+xml' } }
        );
      }
      
      // For navigation requests, return the offline page
      if (event.request.mode === 'navigate') {
        return caches.match(OFFLINE_URL);
      }
      
      return new Response('Offline mode - please check connection', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({
          'Content-Type': 'text/plain'
        })
      });
    })
  );
});

// Periodic background sync (optional, requires user authorization)
// This helps keep the app updated when frequent usage
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'update-assets') {
      event.waitUntil(updateCachedAssets());
    }
  });
}

async function updateCachedAssets() {
  console.log('[SW] Periodic sync: updating cached assets');
  const cache = await caches.open(CACHE_NAME);
  for (const asset of ASSETS_TO_CACHE) {
    try {
      const response = await fetch(asset);
      if (response && response.status === 200) {
        await cache.put(asset, response);
      }
    } catch (error) {
      console.log('[SW] Failed to update asset:', asset);
    }
  }
}