import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { enviarArquivoPublicoPlataforma } from "@/lib/platform-drive.functions";
import { ArrowRight, ArrowUpRight, Check, Eye, Layers3, MousePointerClick, Sparkles } from "lucide-react";
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
  const [modelo, setModelo] = useState<ClinicSiteTemplate>(initialTemplate);
  const [imagens, setImagens] = useState<Partial<Record<ClinicSiteTemplate, Record<string, string>>>>({});
  const [podeEditar, setPodeEditar] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [uploadReadySlot, setUploadReadySlot] = useState<string | null>(null);
  const [hiddenUploadSlots, setHiddenUploadSlots] = useState<string[]>([]);
  const chaveFotos = "alvorada_vitrine_fotos_por_tema_v1";

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: current } = await (supabase as any)
        .from("oricse_config").select("valor").eq("chave", chaveFotos).maybeSingle();
      if (alive && current?.valor && typeof current.valor === "object" && !Array.isArray(current.valor))
        setImagens(current.valor as Partial<Record<ClinicSiteTemplate, Record<string, string>>>);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user?.id) return;
      const { data: access } = await (supabase as any)
        .from("app_users").select("role").eq("user_id", auth.user.id).maybeSingle();
      if (alive) setPodeEditar(access?.role === "admin");
    })().catch(() => {});
    return () => { alive = false; };
  }, []);

  async function enviarImagem(slot: string, file: File) {
    if (uploadingSlot) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type))
      return toast.error("Selecione PNG, JPG, WebP ou GIF.");
    if (file.size > 10 * 1024 * 1024)
      return toast.error("A imagem deve ter no máximo 10 MB.");
    setUploadingSlot(slot);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Erro ao ler a imagem."));
        reader.readAsDataURL(file);
      });
      const { data: session } = await supabase.auth.getSession();
      if (!podeEditar || !session.session?.access_token) {
        setImagens((current) => ({
          ...current,
          [modelo]: { ...(current[modelo] || {}), [slot]: base64 },
        }));
        setUploadReadySlot(`${modelo}:${slot}`);
        toast.success("Foto aplicada nesta visualização. Clique em OK para concluir.");
        return;
      }
      const response = await enviarArquivoPublicoPlataforma({
        data: {
          accessToken: session.session.access_token,
          nome: `alvorada-${modelo}-${slot}-${file.name}`.slice(0, 220),
          mimeType: file.type,
          base64,
        },
      });
      if (!response.url) throw new Error("O Google Drive não retornou o endereço da imagem.");
      // Atualiza o estado remoto primeiro para não apagar uploads de outras sessões.
      const { data: current, error: readError } = await (supabase as any)
        .from("oricse_config").select("id,valor").eq("chave", chaveFotos).maybeSingle();
      if (readError) throw readError;
      const remote = current?.valor && typeof current.valor === "object" && !Array.isArray(current.valor)
        ? current.valor as Partial<Record<ClinicSiteTemplate, Record<string, string>>> : {};
      const updated = {
        ...remote,
        [modelo]: { ...(remote[modelo] || {}), [slot]: response.url },
      };
      const { error } = await (supabase as any).from("oricse_config")
        .upsert({ ...(current?.id ? { id: current.id } : {}), chave: chaveFotos, valor: updated, updated_at: new Date().toISOString() },
          { onConflict: "chave" });
      if (error) throw error;
      setImagens(updated);
      setUploadReadySlot(`${modelo}:${slot}`);
      toast.success("Foto salva neste tema da Alvorada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio da foto.");
    } finally {
      setUploadingSlot(null);
    }
  }
  function confirmarUpload(slot: string) {
    const key = `${modelo}:${slot}`;
    if (uploadReadySlot !== key) return;
    setHiddenUploadSlots((current) => [...new Set([...current, key])]);
    setUploadReadySlot(null);
  }
  const preset = clinicSitePresets[modelo];
  // Use as fotos publicadas pela clínica; nunca as substitua por miniaturas.
  const configDeDemonstracao = useMemo<ClinicSiteConfig>(() => ({
    ...config,
    hiddenSections: config.hiddenSections.filter((section) => section !== "equipe"),
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
          <div role="tablist" aria-label="Versões dos sites disponíveis" className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin] lg:grid lg:grid-cols-7 lg:overflow-visible">
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
                    "group relative flex min-h-[42px] w-[125px] shrink-0 snap-start items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8d4a64] lg:w-full " +
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
        <ClinicSiteRenderer key={modelo} template={modelo} config={configDeDemonstracao} clinicSlug={clinicSlug}
          imageOverrides={imagens[modelo] || {}}
          onUploadImage={enviarImagem}
          uploadingSlot={uploadingSlot}
          uploadReadySlot={uploadReadySlot === `${modelo}:hero` || uploadReadySlot === `${modelo}:about` || uploadReadySlot?.startsWith(`${modelo}:gallery-`) || uploadReadySlot?.startsWith(`${modelo}:team-`) ? uploadReadySlot.slice(modelo.length + 1) : null}
          hiddenUploadSlots={hiddenUploadSlots.filter((key) => key.startsWith(`${modelo}:`)).map((key) => key.slice(modelo.length + 1))}
          onConfirmUpload={confirmarUpload} />
      </div>
    </div>
  );
}
