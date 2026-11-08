import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type MouseEvent } from "react";
import { ClinicSiteRenderer } from "@/components/clinic-site/ClinicSiteRenderer";
import {
  clinicSiteTemplates,
  normalizeClinicSiteConfig,
  type ClinicSiteTemplate,
  type ClinicSiteConfig,
} from "@/lib/clinic-site";

export const Route = createFileRoute("/site-da-clinica-preview")({
  component: PreviewClinica,
});

// A prévia nunca consulta pedidos, prontuários ou dados privados e nunca grava.
// Só recebe informações de apresentação da janela editora, na mesma origem.
function PreviewClinica() {
  const [site, setSite] = useState<{
    template: ClinicSiteTemplate;
    config: ClinicSiteConfig;
  } | null>(null);
  const [selected, setSelected] = useState("");
  useEffect(() => {
    if (window.parent === window) return;
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const data = event.data;
      if (!data || data.type !== "oricse-clinic-site-preview-v1") return;
      const template = data.template as ClinicSiteTemplate;
      if (!clinicSiteTemplates.includes(template)) return;
      const config = normalizeClinicSiteConfig(data.config);
      setSite({ template, config });
      setSelected(String(data.selected || ""));
    };
    window.addEventListener("message", receive);
    window.parent.postMessage(
      { type: "oricse-clinic-site-preview-ready-v1" },
      window.location.origin,
    );
    return () => window.removeEventListener("message", receive);
  }, []);
  const selectSection = (event: MouseEvent<HTMLDivElement>) => {
    if (!site) return;
    const node = (event.target as HTMLElement).closest<HTMLElement>("[data-clinic-section]");
    if (!node) return;
    event.preventDefault();
    event.stopPropagation();
    window.parent.postMessage(
      {
        type: "oricse-clinic-site-select-v1",
        section: node.dataset.clinicSection,
      },
      window.location.origin,
    );
  };
  return (
    <div onClickCapture={selectSection}>
      {site ? (
        <>
          <style>
            {'[data-clinic-section="' +
              selected +
              '"]{outline:3px solid #8a4964!important;outline-offset:-3px;position:relative;}'}
          </style>
          <ClinicSiteRenderer template={site.template} config={site.config} />
        </>
      ) : (
        <main className="grid min-h-screen place-items-center bg-white p-6 text-center text-sm text-slate-600">
          Prévia visual da clínica
        </main>
      )}
    </div>
  );
}
