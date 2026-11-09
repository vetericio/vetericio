import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { AlvoradaDemoShowcase } from "@/components/clinic-site/AlvoradaDemoShowcase";
import { ClinicSiteRenderer } from "@/components/clinic-site/ClinicSiteRenderer";
import {
  clinicSiteTemplates,
  normalizeClinicSiteConfig,
  type ClinicSiteTemplate,
} from "@/lib/clinic-site";
import {
  findPublicClinicSlug,
  isPlatformHostname,
  loadPublicClinicSite,
  normalizeHostname,
} from "@/lib/public-clinic-site";

/**
 * Resolva a clínica ANTES do HTML inicial ser renderizado.
 * O navegador nunca deve ver o conteúdo de oricse.com.br nem uma rota
 * intermediária de erro enquanto o subdomínio público é identificado.
 */
const resolverPaginaInicial = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("cache-control", "no-store");
  const request = getRequest();
  const hostDaUrl = normalizeHostname(new URL(request.url).hostname);
  const hostDoCabecalho = normalizeHostname(request.headers.get("host"));
  const hostname =
    isPlatformHostname(hostDaUrl) && !isPlatformHostname(hostDoCabecalho) && hostDoCabecalho
      ? hostDoCabecalho
      : hostDaUrl;

  if (!hostname || isPlatformHostname(hostname)) {
    // A página principal da ORICSE permanece com seu comportamento próprio.
    return { tipo: "plataforma" as const };
  }

  try {
    // *.oricse.com.br já identifica seu slug; não é necessário um segundo
    // redirecionamento nem uma consulta de domínio antes de ler o site.
    const subdominio = hostname.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)\.oricse\.com\.br$/);
    const slug = subdominio?.[1] ?? (await findPublicClinicSlug(hostname));
    if (!slug) return { tipo: "nao_encontrado" as const };

    const site = await loadPublicClinicSite(slug);
    if (!site) return { tipo: "nao_encontrado" as const };
    return { tipo: "clinica" as const, slug, site };
  } catch (error) {
    console.error("Não foi possível resolver a página pública da clínica:", error);
    return { tipo: "indisponivel" as const };
  }
});

export const Route = createFileRoute("/")({
  loader: () => resolverPaginaInicial(),
  component: PaginaInicial,
});

function PaginaInicial() {
  const resultado = Route.useLoaderData();
  if (resultado.tipo === "plataforma") return null;

  if (resultado.tipo === "clinica") {
    const { slug, site } = resultado;
    const template: ClinicSiteTemplate = clinicSiteTemplates.includes(site.template as ClinicSiteTemplate)
      ? (site.template as ClinicSiteTemplate)
      : "prestige";
    const config = normalizeClinicSiteConfig(site.config);

    return slug === "alvorada" ? (
      <AlvoradaDemoShowcase
        initialTemplate={template}
        config={config}
        clinicSlug={slug}
      />
    ) : (
      <ClinicSiteRenderer template={template} config={config} clinicSlug={slug} />
    );
  }

  // Em uma falha real nunca exiba a home da plataforma ou uma rota errada.
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4EE] p-6 text-[#173D35]">
      <section className="max-w-md text-center">
        <h1 className="text-2xl font-bold">
          {resultado.tipo === "indisponivel"
            ? "Site temporariamente indisponível"
            : "Endereço da clínica não encontrado"}
        </h1>
        <p className="mt-3 text-sm opacity-75">
          {resultado.tipo === "indisponivel"
            ? "Não foi possível carregar o site neste momento. Tente novamente."
            : "Confira se o endereço da clínica está correto."}
        </p>
        {resultado.tipo === "indisponivel" && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-full bg-[#173D35] px-6 py-3 text-sm font-semibold text-white"
          >
            Tentar novamente
          </button>
        )}
      </section>
    </main>
  );
}
