import { createFileRoute } from "@tanstack/react-router";
import { ClinicSiteRenderer } from "@/components/clinic-site/ClinicSiteRenderer";
import { clinicSiteTemplates, normalizeClinicSiteConfig } from "@/lib/clinic-site";
import { loadPublicClinicSite } from "@/lib/public-clinic-site";

export const Route = createFileRoute("/c/$slug")({
  loader: ({ params }) => loadPublicClinicSite(params.slug),
  component: ClinicPublicSite,
});

function ClinicPublicSite() {
  const site = Route.useLoaderData();
  if (!site) return <main className="grid min-h-screen place-items-center bg-background p-6 text-center"><p className="text-muted-foreground">Esta página não está disponível.</p></main>;
  const template = clinicSiteTemplates.includes(site.template as (typeof clinicSiteTemplates)[number]) ? site.template as (typeof clinicSiteTemplates)[number] : "prestige";
  return <ClinicSiteRenderer template={template} config={normalizeClinicSiteConfig(site.config)} />;
}
