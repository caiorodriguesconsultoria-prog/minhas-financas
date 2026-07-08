// Service worker mínimo — necessário para o navegador considerar o app "instalável" (PWA).
// Não implementa cache offline complexo por enquanto, apenas o essencial.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Passa direto para a rede (sem cache customizado por enquanto)
  event.respondWith(fetch(event.request));
});
