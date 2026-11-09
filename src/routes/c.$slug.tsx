import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClinicSiteRenderer } from "@/components/clinic-site/ClinicSiteRenderer";
import { AlvoradaDemoShowcase } from "@/components/clinic-site/AlvoradaDemoShowcase";
import { clinicSiteTemplates, normalizeClinicSiteConfig } from "@/lib/clinic-site";
import { hostDaPagina } from "@/lib/tenant-context";
import { loadPublicClinicSite } from "@/lib/public-clinic-site";

export const Route = createFileRoute("/c/$slug")({
  loader: ({ params }) => loadPublicClinicSite(params.slug),
  component: ClinicPublicSite,
});

function ClinicPublicSite() {
  const site = Route.useLoaderData();
  const { slug } = Route.useParams();
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    setHost(hostDaPagina());
  }, []);

  if (!site) {
    return <main className="grid min-h-screen place-items-center bg-background p-6 text-center"><p className="text-muted-foreground">Esta página não está disponível.</p></main>;
  }
  // A entrada da Alvorada é encaminhada automaticamente a /c/alvorada.
  // Evita mostrar o site antigo primeiro, antes de montar a vitrine comercial.
  if (slug === "alvorada" && host === null) {
    return <main aria-live="polite" className="grid min-h-screen place-items-center bg-[#251729] p-6 text-center text-sm font-semibold text-white/80">Abrindo os modelos da Alvorada...</main>;
  }

  const template = clinicSiteTemplates.includes(site.template as (typeof clinicSiteTemplates)[number])
    ? site.template as (typeof clinicSiteTemplates)[number]
    : "prestige";
  const config = normalizeClinicSiteConfig(site.config);
  if (host === "alvorada.oricse.com.br" && slug === "alvorada") {
    return <AlvoradaDemoShowcase initialTemplate={template} config={config} clinicSlug={slug} />;
  }
  return <ClinicSiteRenderer template={template} config={config} clinicSlug={slug} />;
}
