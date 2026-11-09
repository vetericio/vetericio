export { OricseWriteCoordinator } from "./lib/drive-write-coordinator.server";
import "./lib/error-capture";
import { setDriveCoordinatorBinding } from "./lib/drive-coordinator-binding.server";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type WorkerBindings = { ORICSE_WRITE_COORDINATOR?: unknown; ASSETS?: { fetch: (request: Request) => Promise<Response> } };

function getWorkerBindings(env?: unknown): WorkerBindings | undefined {
  // Nitro forwards the Cloudflare bindings to the outer Worker handler and
  // stores them on the runtime global before it invokes the SSR service. The
  // SSR service itself receives only the Request, so its `env` argument is
  // empty in production. Prefer the explicit argument for compatibility, but
  // use Nitro's runtime binding when it is the only source available.
  return (env as WorkerBindings | undefined)
    ?? (globalThis as typeof globalThis & { __env__?: WorkerBindings }).__env__;
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

function securityHeaders(response: Response, pathname?: string): Response {
  const headers = new Headers(response.headers);
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  headers.set(
    "content-security-policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.supabase.co https://drive.google.com; connect-src 'self' https://*.supabase.co https://fonts.googleapis.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
  );
  // Prévias do editor são sempre no mesmo domínio; sites externos continuam bloqueados.
  headers.set("x-frame-options", "SAMEORIGIN");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  // O HTML aponta para chunks com hash. Mantê-lo em cache depois de um deploy
  // faz o navegador pedir chunks que já não existem e quebra a navegação.
  const contentType = headers.get("content-type") ?? "";
  if (pathname === "/sw.js") {
    headers.set("cache-control", "no-store, max-age=0");
  } else if (contentType.includes("text/html")) {
    headers.set("cache-control", "no-store, max-age=0, must-revalidate");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function consultarCepNoServidor(cep: string): Promise<Response> {
  if (!/^\d{8}$/.test(cep)) return Response.json({ erro: "CEP inválido" }, { status: 400 });
  for (const url of [`https://brasilapi.com.br/api/cep/v1/${cep}`, `https://viacep.com.br/ws/${cep}/json/`]) {
    try {
      const resposta = await fetch(url, { signal: AbortSignal.timeout(5500), headers: { accept: "application/json" } });
      if (!resposta.ok) continue;
      const dado = await resposta.json() as Record<string, unknown>;
      if (dado.erro) continue;
      const brasil = url.includes("brasilapi");
      const endereco = {
        logradouro: String((brasil ? dado.street : dado.logradouro) || ""),
        bairro: String((brasil ? dado.neighborhood : dado.bairro) || ""),
        localidade: String((brasil ? dado.city : dado.localidade) || ""),
        uf: String((brasil ? dado.state : dado.uf) || ""),
      };
      if (endereco.localidade && /^[A-Z]{2}$/.test(endereco.uf)) {
        return Response.json(endereco, { headers: { "cache-control": "public, max-age=3600" } });
      }
    } catch (erro) { console.warn("Falha ao consultar provedor CEP", erro); }
  }
  return Response.json({ erro: "CEP não localizado" }, { status: 502 });
}

function sitemap(origin: string): Response {
  const urls = ["/", "/planos", "/login"]
    .map((path) => `  <url><loc>${origin}${path}</loc></url>`)
    .join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
    {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    setDriveCoordinatorBinding(getWorkerBindings(env)?.ORICSE_WRITE_COORDINATOR);
    try {
      const url = new URL(request.url);
      // Entrega os chunks existentes diretamente do pacote atual. Para chunks
      // antigos que não existem mais, deixa o fallback de recuperação agir.
      if (url.pathname.startsWith("/assets/")) {
        const assets = getWorkerBindings(env)?.ASSETS;
        if (assets) {
          const asset = await assets.fetch(request);
          if (asset.ok && !(asset.headers.get("content-type") || "").includes("text/html")) {
            return securityHeaders(asset, url.pathname);
          }
        }
      }
      if (url.pathname.startsWith("/api/cep/")) {
        if (request.method !== "GET") return securityHeaders(new Response(null, { status: 405 }), url.pathname);
        return securityHeaders(await consultarCepNoServidor(url.pathname.slice("/api/cep/".length)), url.pathname);
      }
      if (url.pathname === "/sitemap.xml") return securityHeaders(sitemap(url.origin), url.pathname);
      if (url.pathname === "/favicon.ico")
        return securityHeaders(Response.redirect(new URL("/oricse-favicon-32.png?v=16", url), 302), url.pathname);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      // Um navegador pode manter o HTML de uma versão anterior e pedir um
      // chunk que já não existe após o deploy. Em vez de entregar 404/HTML ao
      // import dinâmico, enviamos um módulo mínimo que leva à página de
      // recuperação, a qual limpa somente o cache do app e recarrega a URL.
      if (url.pathname.startsWith("/assets/") &&
          /\.(?:m?js|css)$/i.test(url.pathname) &&
          (!response.ok || (response.headers.get("content-type") || "").includes("text/html"))) {
        if (/\.m?js$/i.test(url.pathname)) {
          let destino = "/";
          const referer = request.headers.get("referer");
          if (referer) {
            try {
              const pagina = new URL(referer);
              if (pagina.origin === url.origin) destino = pagina.pathname + pagina.search + pagina.hash;
            } catch {}
          }
          const atualizar = "/atualizar.html?next=" + encodeURIComponent(destino);
          return securityHeaders(new Response(
            "location.replace(" + JSON.stringify(atualizar) + "); export {};",
            {
              status: 200,
              headers: {
                "content-type": "application/javascript; charset=utf-8",
                "cache-control": "no-store, max-age=0",
              },
            },
          ), url.pathname);
        }
        return securityHeaders(new Response("Arquivo desta versão não disponível.", {
          status: 404,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store, max-age=0",
          },
        }), url.pathname);
      }
      return securityHeaders(await normalizeCatastrophicSsrResponse(response), url.pathname);
    } catch (error) {
      console.error(error);
      return securityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        new URL(request.url).pathname,
      );
    }
  },
};
