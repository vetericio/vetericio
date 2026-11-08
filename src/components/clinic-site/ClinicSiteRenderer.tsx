import { Atelier } from "./Atelier";
import { Cuidado } from "./Cuidado";
import { Essencial } from "./Essencial";
import { Popular } from "./Popular";
import { PrestigeSite } from "./PrestigeSite";
import type { ClinicSiteConfig, ClinicSiteTemplate } from "@/lib/clinic-site";
export function ClinicSiteRenderer({
  template,
  config,
}: {
  template: ClinicSiteTemplate;
  config: ClinicSiteConfig;
}) {
  return {
    prestige: <PrestigeSite config={config} />,
    atelier: <Atelier config={config} />,
    cuidado: <Cuidado config={config} />,
    popular: <Popular config={config} />,
    essencial: <Essencial config={config} />,
  }[template];
}
