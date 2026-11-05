import { createFileRoute } from "@tanstack/react-router";
import { PrestigeSite } from "@/components/clinic-site/PrestigeSite";
import { normalizeClinicSiteConfig } from "@/lib/clinic-site";
import { supabaseBanco } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/c/$slug")({ component: ClinicPublicSite });

function ClinicPublicSite() {
  const { slug } = Route.useParams();
  const [site, setSite] = useState<any>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await (supabaseBanco as any)
        .from("clinic_sites")
        .select("template,config,slug")
        .eq("slug", slug)
        .eq("status", "publicado")
        .maybeSingle();
      setSite(data);
    })();
  }, [slug]);
  if (!site)
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <p className="text-muted-foreground">Carregando página da clínica…</p>
      </main>
    );
  return <PrestigeSite config={normalizeClinicSiteConfig(site.config)} />;
}
