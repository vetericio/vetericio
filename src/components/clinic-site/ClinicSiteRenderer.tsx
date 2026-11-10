import { ClinicSiteFull } from "./ClinicSiteFull";
import type { ClinicSiteConfig, ClinicSiteTemplate } from "@/lib/clinic-site";

export function ClinicSiteRenderer({
  template,
  config,
  clinicSlug,
  onUploadImage,
  uploadingSlot,
  imageOverrides,
}: {
  template: ClinicSiteTemplate;
  config: ClinicSiteConfig;
  clinicSlug?: string;
  onUploadImage?: (slot: string, file: File) => void;
  uploadingSlot?: string | null;
  imageOverrides?: Record<string, string>;
}) {
  return <ClinicSiteFull template={template} config={config} clinicSlug={clinicSlug} onUploadImage={onUploadImage} uploadingSlot={uploadingSlot} imageOverrides={imageOverrides} />;
}
