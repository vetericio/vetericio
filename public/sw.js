const CACHE_NAME = "oricse-pwa-v13";
const RUNTIME_CACHE = "oricse-runtime-v13";
const APP_SHELL = ["/manifest.webmanifest?v=10", "/icon-192-v3.svg", "/icon-512-v3.svg"];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(async () => {
        // Evita uma ida extra à rede quando o Service Worker acorda para abrir
        // uma página. O documento ainda é sempre obtido da rede.
        if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
        await self.clients.claim();
      }),
  );
});

function recursoCacheavel(url) {
  const imagem = /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i.test(url.pathname);
  const arquivoVersionado =
    url.origin === self.location.origin && url.pathname.startsWith("/assets/");
  const imagemDoApp = url.origin === self.location.origin && imagem;
  const imagemExterna =
    imagem &&
    (url.hostname.endsWith("supabase.co") ||
      url.hostname.endsWith("googleusercontent.com") ||
      url.hostname === "drive.google.com");
  return arquivoVersionado || imagemDoApp || imagemExterna;
}

async function buscarEAtualizar(request, event, url) {
  try {
    // Para navegação, o preload é mais rápido; para dados e imagens, fetch
    // normal mantém a requisição e a autenticação originais.
    const preload = event.request.mode === "navigate" ? await event.preloadResponse : undefined;
    const resposta = preload || (await fetch(request));
    if (recursoCacheavel(url) && (resposta.ok || resposta.type === "opaque")) {
      event.waitUntil(
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, resposta.clone())),
      );
    }
    return resposta;
  } catch (error) {
    if (recursoCacheavel(url)) {
      const cache = await caches.open(RUNTIME_CACHE);
      const armazenado = await cache.match(request);
      if (armazenado) return armazenado;
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  // Nunca use uma cópia antiga do documento como fallback: ela pode referir
  // chunks removidos em uma nova publicação.
  if (event.request.mode === "navigate" || requestUrl.pathname === "/sw.js") {
    event.respondWith(buscarEAtualizar(event.request, event, requestUrl));
    return;
  }
  event.respondWith(buscarEAtualizar(event.request, event, requestUrl));
});
