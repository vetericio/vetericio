import { createFileRoute } from "@tanstack/react-router";
import { ClinicSiteRenderer } from "@/components/clinic-site/ClinicSiteRenderer";
import { normalizeClinicSiteConfig, resolveClinicSiteTemplate } from "@/lib/clinic-site";
import type { PublicClinicSite } from "@/lib/public-clinic-site";
import { supabaseBanco } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/c/$slug")({ component: ClinicPublicSite });

function ClinicPublicSite() {
  const { slug } = Route.useParams();
  const [consulta, setConsulta] = useState<{ slug: string; site: PublicClinicSite | null; falhou: boolean }>();
  useEffect(() => {
    let ativa = true;
    void (async () => {
      const { data, error } = await (supabaseBanco as any)
        .from("clinic_sites")
        .select("template,config,slug")
        .eq("slug", slug)
        .eq("status", "publicado")
        .maybeSingle();
      if (error) throw error;
      if (ativa) setConsulta({ slug, site: data, falhou: false });
    })().catch(() => { if (ativa) setConsulta({ slug, site: null, falhou: true }); });
    return () => { ativa = false; };
  }, [slug]);
  const atual = consulta?.slug === slug ? consulta : undefined;
  if (!atual?.site)
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <p className="text-muted-foreground">{!atual ? "Carregando página da clínica…" : atual.falhou ? "Não foi possível carregar a página. Tente novamente." : "Endereço da clínica não encontrado."}</p>
      </main>
    );
  return (
    <ClinicSiteRenderer
      template={resolveClinicSiteTemplate(atual.site.template)}
      config={normalizeClinicSiteConfig(atual.site.config)}
      clinicSlug={slug}
    />
  );
}
