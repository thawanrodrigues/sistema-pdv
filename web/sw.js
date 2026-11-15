// =====================================================
// Service Worker — Conecta Sistemas PDV
// Estratégia: Cache First para assets, Network First para navegação
// =====================================================

const CACHE_NAME = 'pdv-cache-v1';
const STATIC_CACHE = 'pdv-static-v1';

// Assets que serão pré-cacheados no install
const PRE_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/assets/images/favicon.png',
  '/assets/images/pwa-icon-512.png',
];

// ── Install: pré-cacheia os assets essenciais ─────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRE_CACHE_URLS).catch(() => {
        // Ignora falhas individuais de pré-cache (offline no primeiro acesso)
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: limpa caches antigos ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estratégia híbrida ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Só intercepta requests do mesmo domínio
  if (url.origin !== self.location.origin) return;

  // Navegação (HTML) → Network First com fallback para cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // Chunks JS/CSS/imagens → Cache First, atualiza em background
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Demais requests → Network First
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
