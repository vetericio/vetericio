import { ClinicSiteFull } from "./ClinicSiteFull";
import type { ClinicSiteConfig, ClinicSiteTemplate } from "@/lib/clinic-site";

export function ClinicSiteRenderer({
  template,
  config,
}: {
  template: ClinicSiteTemplate;
  config: ClinicSiteConfig;
}) {
  return <ClinicSiteFull template={template} config={config}/>;
}
