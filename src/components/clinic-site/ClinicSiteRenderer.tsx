import { ClinicSiteFull } from "./ClinicSiteFull";
import type { ClinicSiteConfig, ClinicSiteTemplate } from "@/lib/clinic-site";

export function ClinicSiteRenderer({
  template,
  config,
  clinicSlug,
  onUploadImage,
  uploadingSlot,
  imageOverrides,
  uploadReadySlot,
  hiddenUploadSlots,
  onConfirmUpload,
}: {
  template: ClinicSiteTemplate;
  config: ClinicSiteConfig;
  clinicSlug?: string;
  onUploadImage?: (slot: string, file: File) => void;
  uploadingSlot?: string | null;
  imageOverrides?: Record<string, string>;
  uploadReadySlot?: string | null;
  hiddenUploadSlots?: string[];
  onConfirmUpload?: (slot: string) => void;
}) {
  return (
    <ClinicSiteFull
      template={template}
      config={config}
      clinicSlug={clinicSlug}
      onUploadImage={onUploadImage}
      uploadingSlot={uploadingSlot}
      imageOverrides={imageOverrides}
      uploadReadySlot={uploadReadySlot}
      hiddenUploadSlots={hiddenUploadSlots}
      onConfirmUpload={onConfirmUpload}
    />
  );
}
