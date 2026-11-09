import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlvoradaDemoShowcase } from "@/components/clinic-site/AlvoradaDemoShowcase";
import { ClinicSiteRenderer } from "@/components/clinic-site/ClinicSiteRenderer";
import { clinicSiteTemplates, normalizeClinicSiteConfig } from "@/lib/clinic-site";
import { hostDaPagina } from "@/lib/tenant-context";
import { findPublicClinicSlug, isPlatformHostname, loadPublicClinicSite, type PublicClinicSite } from "@/lib/public-clinic-site";

export const Route = createFileRoute("/")({
  component: PublicClinicHome,
});

function PublicClinicHome() {
  const [site, setSite] = useState<PublicClinicSite | null>(null);
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"initial" | "loading" | "ready" | "unavailable">("initial");
  const [hostname, setHostname] = useState("");

  useEffect(() => {
    const host = hostDaPagina();
    setHostname(host);
    if (!host || isPlatformHostname(host)) return;
    let active = true;
    setStatus("loading");
    void (async () => {
      try {
        const resolved = await findPublicClinicSlug(host);
        if (!resolved) throw new Error("Clínica não encontrada.");
        const publishedSite = await loadPublicClinicSite(resolved);
        if (!publishedSite) throw new Error("Site não publicado.");
        if (!active) return;
        setSlug(resolved);
        setSite(publishedSite);
        setStatus("ready");
      } catch (error) {
        console.error("Falha ao abrir site público da clínica:", error);
        if (active) setStatus("unavailable");
      }
    })();
    return () => { active = false; };
  }, []);

  // A página principal do ORICSE é controlada pela vitrine da plataforma.
  if (!hostname || isPlatformHostname(hostname)) return null;
  if (status === "initial" || status === "loading") {
    return <main className="grid min-h-screen place-items-center bg-white p-6 text-center text-sm text-slate-500" aria-live="polite">Carregando site da clínica...</main>;
  }
  if (status !== "ready" || !site) {
    return <main className="grid min-h-screen place-items-center bg-white p-6 text-center"><p className="text-slate-600">Este site não está disponível.</p></main>;
  }

  const template = clinicSiteTemplates.includes(site.template as (typeof clinicSiteTemplates)[number])
    ? site.template as (typeof clinicSiteTemplates)[number]
    : "prestige";
  const config = normalizeClinicSiteConfig(site.config);

  if (hostname === "alvorada.oricse.com.br" && slug === "alvorada") {
    return <AlvoradaDemoShowcase initialTemplate={template} config={config} />;
  }
  return <ClinicSiteRenderer template={template} config={config} />;
}
