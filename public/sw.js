const CACHE_NAME = "oricse-pwa-v12";
const APP_SHELL = [
  "/manifest.webmanifest?v=10",
  "/icon-192-v3.svg",
  "/icon-512-v3.svg",
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  // Nunca use uma cópia antiga do documento como fallback: ela pode referir
  // chunks removidos em uma nova publicação.
  if (event.request.mode === "navigate" || requestUrl.pathname === "/sw.js") {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
