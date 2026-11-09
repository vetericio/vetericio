import { useMemo, useState } from "react";
import { ArrowUpRight, Check, Eye, Layers3, MousePointerClick, Sparkles } from "lucide-react";
import { ClinicSiteRenderer } from "@/components/clinic-site/ClinicSiteRenderer";
import {
  clinicSitePresets,
  clinicSiteTemplateDescriptions,
  clinicSiteTemplateLabels,
  clinicSiteTemplates,
  type ClinicSiteConfig,
  type ClinicSiteTemplate,
} from "@/lib/clinic-site";

type Props = {
  initialTemplate: ClinicSiteTemplate;
  config: ClinicSiteConfig;
  clinicSlug?: string;
};

/**
 * Vitrine comercial intencionalmente exclusiva do endereço
 * https://alvorada.oricse.com.br/ .
 * A troca do modelo é uma prévia local: nunca modifica as tabelas
 * clinic_sites / clinic_site_drafts e não depende de acesso administrativo.
 */
export function AlvoradaDemoShowcase({ initialTemplate, config, clinicSlug = "alvorada" }: Props) {
  const [modelo, setModelo] = useState<ClinicSiteTemplate>(initialTemplate === "prestige" ? "signatura" : initialTemplate);
  const preset = clinicSitePresets[modelo];
  const configDeDemonstracao = useMemo<ClinicSiteConfig>(() => ({
    ...config,
    primaryColor: preset.primaryColor,
    secondaryColor: preset.secondaryColor,
    backgroundColor: preset.backgroundColor,
    textColor: preset.textColor,
  }), [config, preset]);

  function escolherModelo(novo: ClinicSiteTemplate) {
    if (novo === modelo) return;
    setModelo(novo);
    // Mostra o novo cabeçalho e a nova composição, mesmo se a pessoa
    // estava rolando a versão anterior.
    document.getElementById("alvorada-vitrine-site")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const indice = clinicSiteTemplates.indexOf(modelo) + 1;

  return (
    <div className="min-h-screen bg-[#faf7f3]">
      <section aria-labelledby="alvorada-vitrine-titulo" className="relative isolate overflow-hidden bg-[#251729] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-28 h-80 w-80 rounded-full bg-[#a76c77]/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 left-1/3 h-72 w-96 rounded-full bg-[#b69564]/15 blur-3xl" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-5 px-5 pb-7 pt-7 sm:px-8 sm:pb-9 sm:pt-9 lg:flex-row lg:items-end lg:justify-between lg:gap-10 lg:px-10">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.22em] text-[#efc8a8]">
              <Sparkles size={16} aria-hidden="true" /> Oricse · Vitrine interativa
            </p>
            <h1 id="alvorada-vitrine-titulo" className="mt-3 font-semibold tracking-[-.045em] text-[clamp(1.9rem,3.8vw,3.6rem)] leading-[1.1]">
              Versões dos sites disponíveis
            </h1>
            <p className="mt-3 max-w-[680px] text-sm leading-6 text-white/80 sm:text-base sm:leading-7">
              Uma clínica, sete estilos para impressionar. Escolha um modelo abaixo e veja o site
              inteiro se transformar na hora — sem sair desta página.
            </p>
          </div>
          <a
            href="https://oricse.com.br/planos"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[#f6dcc6] px-6 py-3 text-sm font-extrabold text-[#321823] shadow-[0_10px_28px_rgba(0,0,0,.14)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white lg:self-end"
          >
            Quero um site assim <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
      </section>

      <div className="sticky top-0 z-50 border-b border-[#e8dfd6] bg-[#fffdfa]/95 shadow-[0_8px_30px_rgba(39,19,37,.08)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
            <p className="flex items-center gap-2 text-xs font-extrabold tracking-tight text-[#402535]">
              <Layers3 size={15} aria-hidden="true" className="text-[#9d6378]" />
              Explore os 7 modelos
              <span className="ml-1 hidden text-[11px] font-medium text-[#8d7680] sm:inline">
                · mesmo conteúdo, novas identidades
              </span>
            </p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#876b73]">
              <MousePointerClick size={14} aria-hidden="true" />
              Clique para trocar
            </span>
          </div>
          <div role="tablist" aria-label="Versões dos sites disponíveis" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {clinicSiteTemplates.map((item, idx) => {
              const active = item === modelo;
              const tone = clinicSitePresets[item];
              return (
                <button
                  key={item}
                  id={`modelo-alvorada-${item}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="alvorada-vitrine-site"
                  onClick={() => escolherModelo(item)}
                  className={
                    "group relative flex min-h-[56px] min-w-0 w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8d4a64] " +
                    (active
                      ? "border-[#682d45] bg-[#fff5ef] shadow-[0_5px_18px_rgba(104,45,69,.13)]"
                      : "border-[#e8deda] bg-white hover:-translate-y-0.5 hover:border-[#cbaeba] hover:bg-[#fff9f4]")
                  }
                  title={clinicSiteTemplateDescriptions[item]}
                >
                  <span
                    aria-hidden="true"
                    className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/5"
                    style={{ backgroundColor: tone.backgroundColor }}
                  >
                    <span
                      className="absolute bottom-0 left-0 h-4 w-full"
                      style={{ backgroundColor: tone.primaryColor }}
                    />
                    <span
                      className="absolute right-1 top-1 h-3 w-3 rounded-sm"
                      style={{ backgroundColor: tone.secondaryColor }}
                    />
                    <span className="absolute left-1 top-1 h-1 w-4 rounded-full bg-current/20" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-semibold text-[#a08a91]">{String(idx + 1).padStart(2, "0")}</span>
                    <span className="block whitespace-nowrap text-[11px] font-extrabold text-[#442938]">
                      {clinicSiteTemplateLabels[item]}
                    </span>
                  </span>
                  {active && <Check size={14} aria-label="Selecionado" className="absolute right-2 top-1.5 text-[#793d54]" />}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
            <p className="flex items-center gap-2 text-[#6a5260]">
              <Eye size={15} aria-hidden="true" className="text-[#97536b]" />
              <strong className="text-[#492b38]">{clinicSiteTemplateLabels[modelo]}</strong>
              <span className="hidden sm:inline">· {clinicSiteTemplateDescriptions[modelo]}</span>
            </p>
            <span className="font-semibold tabular-nums text-[#9a7e87]">Modelo {String(indice).padStart(2, "0")} de 07</span>
          </div>
        </div>
      </div>

      <div
        id="alvorada-vitrine-site"
        role="tabpanel"
        aria-labelledby={`modelo-alvorada-${modelo}`}
        className="scroll-mt-[110px] min-h-[65vh]"
      >
        <ClinicSiteRenderer key={modelo} template={modelo} config={configDeDemonstracao} clinicSlug={clinicSlug} />
      </div>
    </div>
  );
}
