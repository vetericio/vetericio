// Service Worker de aposentadoria.
// A Oricse não mantém mais JavaScript/CSS em Cache Storage: em publicações
// novas, um HTML anterior poderia apontar para um chunk que já não existe.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("oricse-"))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
      .catch(() => undefined),
  );
});

// Sem handler fetch: navegação, módulos e arquivos estáticos sempre usam rede.
