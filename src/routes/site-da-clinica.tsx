import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/usePermissoes";
import {
  clinicSiteTemplates,
  clinicSiteTemplateLabels,
  clinicSiteTemplateDescriptions,
  clinicSiteTones,
  normalizeClinicSiteConfig,
  prestigeDefault,
  type ClinicSiteConfig,
  type ClinicSiteTemplate,
} from "@/lib/clinic-site";
import { ClinicSiteRenderer } from "@/components/clinic-site/ClinicSiteRenderer";

export const Route = createFileRoute("/site-da-clinica")({ component: SiteDaClinica });

function SiteDaClinica() {
  const { clinicaId, carregando, pode } = usePermissoes();
  const [config, setConfig] = useState<ClinicSiteConfig>(prestigeDefault);
  const [template, setTemplate] = useState<ClinicSiteTemplate>("prestige");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"rascunho" | "publicado">("rascunho");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!clinicaId) return;
    void (async () => {
      const { data, error } = await (supabaseBanco as any)
        .from("clinic_sites")
        .select("slug,status,template,config")
        .eq("clinica_id", clinicaId)
        .maybeSingle();
      if (error) return toast.error(error.message);
      if (data) {
        setSlug(data.slug);
        setStatus(data.status);
        if (clinicSiteTemplates.includes(data.template)) setTemplate(data.template);
        setConfig(normalizeClinicSiteConfig(data.config));
      }
    })();
  }, [clinicaId]);
  const change = (key: keyof ClinicSiteConfig, value: string | boolean) =>
    setConfig((current) => ({ ...current, [key]: value }));
  async function save(publish = false) {
    if (!clinicaId || !slug.trim()) return toast.error("Informe um slug para o endereço público.");
    setSaving(true);
    const nextStatus = publish ? "publicado" : status;
    const { error } = await (supabaseBanco as any).from("clinic_sites").upsert(
      {
        clinica_id: clinicaId,
        slug: slug.trim().toLowerCase(),
        status: nextStatus,
        template,
        config,
        publicado_em: nextStatus === "publicado" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clinica_id" },
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    setStatus(nextStatus);
    toast.success(nextStatus === "publicado" ? "Página publicada." : "Rascunho salvo.");
  }
  if (carregando) return <main className="p-6 text-sm text-muted-foreground">Carregando…</main>;
  if (!pode("administracao.site"))
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-bold">Sem permissão</h1>
        <p className="mt-2 text-muted-foreground">Seu perfil não pode editar o site da clínica.</p>
      </main>
    );
  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/configuracao-site" className="text-sm font-semibold text-muted-foreground">
              ← Configurações
            </Link>
            <h1 className="mt-2 text-3xl font-bold">Site da clínica</h1>
            <p className="text-sm text-muted-foreground">
              Escolha um dos cinco modelos e acompanhe a prévia ao vivo.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void save(false)}
              disabled={saving}
              className="rounded-xl border bg-card px-4 py-2 font-semibold"
            >
              Salvar rascunho
            </button>
            <button
              onClick={() => void save(true)}
              disabled={saving}
              className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground"
            >
              Publicar
            </button>
          </div>
        </div>
        <div className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
          <section className="space-y-4 rounded-2xl border bg-card p-5">
            <label className="block text-sm font-semibold">
              Endereço{" "}
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                placeholder="nome-da-clinica"
                className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
              />
            </label>
            <p className="text-xs text-muted-foreground">Status: {status}</p>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Modelo do site</legend>
              <div className="grid grid-cols-1 gap-2">
                {clinicSiteTemplates.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setTemplate(item)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm font-bold capitalize ${template === item ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
                  >
                    <span className="block">{clinicSiteTemplateLabels[item]}</span>
                    <span className="mt-1 block text-xs font-normal opacity-80">
                      {clinicSiteTemplateDescriptions[item]}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Tom principal</legend>
              <p className="mb-2 text-xs text-muted-foreground">
                Até 10 tons prontos para cada página.
              </p>
              <div className="flex flex-wrap gap-2">
                {clinicSiteTones.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    aria-label={`Usar tom ${tone}`}
                    onClick={() => change("primaryColor", tone)}
                    className={`h-9 w-9 rounded-full border-2 ${config.primaryColor === tone ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: tone }}
                  />
                ))}
              </div>
            </fieldset>
            {(
              [
                ["name", "Nome da clínica"],
                ["slogan", "Título principal"],
                ["description", "Apresentação"],
                ["phone", "Telefone"],
                ["whatsapp", "WhatsApp"],
                ["address", "Endereço"],
                ["hours", "Horários"],
                ["heroImageUrl", "URL da imagem principal"],
                ["logoUrl", "URL do logo"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm font-semibold">
                {label}
                <input
                  value={String(config[key])}
                  onChange={(e) => change(key, e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"
                />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={config.emergency24h}
                onChange={(e) => change("emergency24h", e.target.checked)}
              />{" "}
              Emergência 24h
            </label>
          </section>
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="border-b px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Prévia · {clinicSiteTemplateLabels[template]}
            </div>
            <div className="max-h-[calc(100vh-150px)] overflow-auto">
              <ClinicSiteRenderer template={template} config={config} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
