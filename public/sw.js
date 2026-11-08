const CACHE_NAME = "oricse-pwa-v15";
const RUNTIME_CACHE = "oricse-runtime-v15";
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
            .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE && key !== "oricse-runtime-v14")
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

function respostaDeAssetInvalida(resposta, url) {
  const asset = url.origin === self.location.origin && url.pathname.startsWith("/assets/");
  if (!asset) return false;
  const mime = (resposta.headers.get("content-type") || "").toLowerCase();
  const modulo = /\.(?:m?js)$/i.test(url.pathname);
  const estilo = /\.css$/i.test(url.pathname);
  return !resposta.ok || resposta.redirected ||
    (modulo && !/javascript|ecmascript/.test(mime)) ||
    (estilo && !/text\/css/.test(mime));
}

async function cacheDeAssetValido(request, url) {
  for (const nome of [RUNTIME_CACHE, "oricse-runtime-v14"]) {
    const resposta = await (await caches.open(nome)).match(request);
    if (resposta && !respostaDeAssetInvalida(resposta, url)) return resposta;
  }
  return undefined;
}

async function buscarEAtualizar(request, event, url) {
  try {
    // Nunca devolve HTML do SSR no lugar de JavaScript (erro de chunk em deploy).
    const preload = event.request.mode === "navigate" ? await event.preloadResponse : undefined;
    const resposta = preload || (await fetch(request));
    if (respostaDeAssetInvalida(resposta, url)) {
      return (await cacheDeAssetValido(request, url)) ||
        new Response("Módulo atualizado; recarregue a página.", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
    }
    if (recursoCacheavel(url) && (resposta.ok || resposta.type === "opaque")) {
      event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) =>
        cache.put(request, resposta.clone())).catch(() => undefined));
    }
    return resposta;
  } catch (error) {
    if (recursoCacheavel(url)) {
      const armazenado = await cacheDeAssetValido(request, url);
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
