import { ClinicSiteFull } from "./ClinicSiteFull";
import type { ClinicSiteConfig, ClinicSiteTemplate } from "@/lib/clinic-site";

export function ClinicSiteRenderer({
  template,
  config,
  clinicSlug,
}: {
  template: ClinicSiteTemplate;
  config: ClinicSiteConfig;
  clinicSlug?: string;
}) {
  return <ClinicSiteFull template={template} config={config} clinicSlug={clinicSlug} />;
}
