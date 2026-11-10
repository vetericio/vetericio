import { ClinicSiteFull } from "./ClinicSiteFull";
import type { ClinicSiteConfig, ClinicSiteTemplate } from "@/lib/clinic-site";

export function ClinicSiteRenderer({
  template,
  config,
  clinicSlug,
  onUploadImage,
  uploadingSlot,
}: {
  template: ClinicSiteTemplate;
  config: ClinicSiteConfig;
  clinicSlug?: string;
  onUploadImage?: (slot: "hero" | "about", file: File) => void;
  uploadingSlot?: "hero" | "about" | null;
}) {
  return <ClinicSiteFull template={template} config={config} clinicSlug={clinicSlug} onUploadImage={onUploadImage} uploadingSlot={uploadingSlot} />;
}
