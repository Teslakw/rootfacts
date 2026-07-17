importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

workbox.setConfig({ debug: false });

const { precacheAndRoute, cleanupOutdatedCaches } = workbox.precaching;
const { registerRoute } = workbox.routing;
const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;

precacheAndRoute([
  { url: '/', revision: '2.0.0' },
  { url: '/index.html', revision: '2.0.0' },
  { url: '/manifest.json', revision: '2.0.0' },
  { url: '/assets/css/styles.css', revision: '2.0.0' },
  { url: '/assets/js/core/app.js', revision: '2.0.0' },
  { url: '/assets/js/core/config.js', revision: '2.0.0' },
  { url: '/assets/js/core/utils.js', revision: '2.0.0' },
  { url: '/assets/js/services/camera.service.js', revision: '2.0.0' },
  { url: '/assets/js/services/detection.service.js', revision: '2.0.0' },
  { url: '/assets/js/services/facts.service.js', revision: '2.0.0' },
  { url: '/assets/js/ui/ui.handler.js', revision: '2.0.0' },
  { url: '/assets/icons/icon-192x192.png', revision: '2.0.0' },
  { url: '/assets/icons/icon-512x512.png', revision: '2.0.0' },
  { url: '/assets/icons/apple-touch-icon.png', revision: '2.0.0' },
  // Cache model secara eksplisit di awal (Precache)
  { url: '/model/model.json', revision: '2.0.0' },
  { url: '/model/metadata.json', revision: '2.0.0' },
  { url: '/model/weights.bin', revision: '2.0.0' },
]);

cleanupOutdatedCaches();

registerRoute(
  ({ url }) => url.pathname.startsWith('/model/'),
  new CacheFirst({
    cacheName: 'tf-model-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 tahun
      }),
    ],
  })
);

// Cache CDN scripts (TF.js, Teachable Machine, Transformers.js) — CacheFirst
registerRoute(
  ({ url }) =>
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'storage.googleapis.com' ||
    url.hostname === 'unpkg.com',
  new CacheFirst({
    cacheName: 'cdn-scripts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 hari
      }),
    ],
  })
);

// Cache Google Fonts — StaleWhileRevalidate
registerRoute(
  ({ url }) =>
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-cache',
  })
);

// Fallback: NetworkFirst untuk request lain
registerRoute(
  ({ request }) => request.destination === 'document',
  new NetworkFirst({
    cacheName: 'pages-cache',
    networkTimeoutSeconds: 5,
  })
);
