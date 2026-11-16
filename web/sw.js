// =====================================================
// Service Worker — Conecta Sistemas PDV v5
// Estratégia: Network First para garantir atualizações imediatas
// =====================================================

const CACHE_NAME = 'pdv-cache-v5';
const STATIC_CACHE = 'pdv-static-v5';

// Assets essenciais
const PRE_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/assets/images/favicon.png',
  '/assets/images/pwa-icon-512.png',
];

// ── Install: ativa imediatamente sem esperar ───────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRE_CACHE_URLS).catch(() => {});
    })
  );
});

// ── Activate: limpa TODOS os caches antigos ──────────────────────────────────
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

// ── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests de outro domínio
  if (url.origin !== self.location.origin) return;

  // NUNCA interceptar chamadas da API
  if (url.pathname.startsWith('/api')) return;

  // Network First para tudo: busca sempre versão atualizada na rede
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Se estiver offline, tenta responder do cache
        return caches.match(request).then((cached) => cached || caches.match('/'));
      })
  );
});
