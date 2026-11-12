import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { clinicSiteTemplates, normalizeClinicSiteConfig, prestigeDefault, type ClinicSiteTemplate } from "@/lib/clinic-site";

const ativarSchema = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
});

/**
 * Ação única de publicação: alinha o slug da clínica, preserva o conteúdo editado,
 * publica o registro real e libera o subdomínio. Não declara HTTPS confirmado:
 * essa confirmação é feita separadamente contra o endereço público.
 */
export const ativarSiteOricse = createServerFn({ method: "POST" })
  .validator((entrada: unknown) => ativarSchema.parse(entrada))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: auth, error: erroAuth } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (erroAuth || !auth.user) throw new Error("Sessão expirada. Faça login novamente.");

    const { data: perfil, error: erroPerfil } = await supabaseAdmin
      .from("app_users")
      .select("role")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (erroPerfil || perfil?.role !== "admin")
      throw new Error("Somente o administrador da plataforma pode publicar sites.");

    const { data: clinica, error: erroClinica } = await supabaseAdmin
      .from("clinicas")
      .select("id,nome,slug,status,excluido_em,logo_url")
      .eq("id", data.clinicaId)
      .maybeSingle();
    if (erroClinica || !clinica || clinica.excluido_em)
      throw new Error("Clínica indisponível. Confira o cadastro antes de publicar.");
    if (clinica.status !== "ativa")
      throw new Error("Ative o acesso da clínica antes de publicar o site.");
    const slug = String(clinica.slug || "").toLowerCase().trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      throw new Error("Endereço inválido. Corrija o campo 'Nome do endereço ORICSE' em Cadastro.");
    if (slug === "alvorada")
      throw new Error("O site de demonstração Alvorada está protegido contra alterações.");

    const hostname = slug + ".oricse.com.br";
    const [siteQuery, draftQuery, dominioQuery, conflitoSite, conflitoDominio] = await Promise.all([
      supabaseAdmin.from("clinic_sites").select("id,slug,status,template,config").eq("clinica_id", data.clinicaId).maybeSingle(),
      supabaseAdmin.from("clinic_site_drafts").select("template,config").eq("clinica_id", data.clinicaId).maybeSingle(),
      supabaseAdmin.from("oricse_dominios_clinica").select("id,hostname,status,publicar_site,ssl_status").eq("clinica_id", data.clinicaId).eq("tipo", "oricse").maybeSingle(),
      supabaseAdmin.from("clinic_sites").select("id,clinica_id").eq("slug", slug).maybeSingle(),
      supabaseAdmin.from("oricse_dominios_clinica").select("id,clinica_id").eq("hostname", hostname).maybeSingle(),
    ]);
    for (const consulta of [siteQuery, draftQuery, dominioQuery, conflitoSite, conflitoDominio])
      if (consulta.error) throw new Error("Falha ao consultar as configurações do site: " + consulta.error.message);

    const atual = siteQuery.data;
    const dominio = dominioQuery.data;
    if (conflitoSite.data && conflitoSite.data.clinica_id !== data.clinicaId)
      throw new Error("Esse endereço já pertence ao site de outra clínica.");
    if (conflitoDominio.data && conflitoDominio.data.clinica_id !== data.clinicaId)
      throw new Error("O subdomínio já pertence a outra clínica.");
    if (dominio?.hostname && dominio.hostname !== hostname && dominio.status === "ativo")
      throw new Error("O subdomínio anterior continua ativo. Revise a migração do endereço antes de publicar.");
    if (dominio?.status === "suspenso")
      throw new Error("O endereço está suspenso. Revise a situação administrativa antes de liberar.");

    const configuracaoBase = atual?.status === "publicado"
      ? atual.config
      : draftQuery.data?.config || atual?.config;
    const criadaDoZero = !atual && !draftQuery.data;
    const config = normalizeClinicSiteConfig(configuracaoBase || {
      ...prestigeDefault,
      name: clinica.nome,
      logoUrl: clinica.logo_url || "",
    });
    if (!config.name.trim() || config.name.trim() === prestigeDefault.name) config.name = clinica.nome;
    if (!config.logoUrl && clinica.logo_url) config.logoUrl = clinica.logo_url;

    const sugestaoTemplate = atual?.status === "publicado"
      ? atual.template
      : draftQuery.data?.template || atual?.template;
    const template: ClinicSiteTemplate = clinicSiteTemplates.includes(sugestaoTemplate as ClinicSiteTemplate)
      ? (sugestaoTemplate as ClinicSiteTemplate)
      : "prestige";
    const agora = new Date().toISOString();
    const payload = { slug, status: "publicado" as const, template, config, publicado_em: agora, updated_at: agora };

    const gravacaoSite = atual
      ? await supabaseAdmin.from("clinic_sites")
          .update(payload).eq("id", atual.id).eq("clinica_id", data.clinicaId)
          .select("id,slug,status").single()
      : await supabaseAdmin.from("clinic_sites")
          .insert({ ...payload, clinica_id: data.clinicaId })
          .select("id,slug,status").single();
    if (gravacaoSite.error || gravacaoSite.data?.slug !== slug || gravacaoSite.data?.status !== "publicado")
      throw new Error("Não foi possível publicar o conteúdo: " + (gravacaoSite.error?.message || "gravação não confirmada"));

    // Não forçar ssl_status='ativo': HTTPS precisa ser testado no navegador real.
    const dominioPayload = {
      hostname,
      tipo: "oricse" as const,
      principal: true,
      publicar_site: true,
      status: "ativo" as const,
      dns_alvo: "sites.oricse.com.br",
      verificacao_tipo: "automatica" as const,
      atualizado_em: agora,
    };
    const gravacaoDominio = dominio
      ? await supabaseAdmin.from("oricse_dominios_clinica")
          .update({ ...dominioPayload, ssl_status: dominio.hostname === hostname ? dominio.ssl_status : null, ultimo_erro: null })
          .eq("id", dominio.id).eq("clinica_id", data.clinicaId)
          .select("id,hostname,status,publicar_site").single()
      : await supabaseAdmin.from("oricse_dominios_clinica")
          .insert({ ...dominioPayload, clinica_id: data.clinicaId })
          .select("id,hostname,status,publicar_site").single();
    if (gravacaoDominio.error || gravacaoDominio.data?.hostname !== hostname || !gravacaoDominio.data?.publicar_site)
      throw new Error("Conteúdo publicado, mas não foi possível liberar o subdomínio: " + (gravacaoDominio.error?.message || "gravação não confirmada"));

    // Elimina o rascunho só se ele foi efetivamente incorporado à publicação.
    if (draftQuery.data && atual?.status !== "publicado") {
      const limpeza = await supabaseAdmin.from("clinic_site_drafts").delete().eq("clinica_id", data.clinicaId);
      if (limpeza.error) console.warn("Rascunho anterior mantido após publicação:", limpeza.error.message);
    }

    return {
      hostname,
      url: "https://" + hostname,
      dominioId: gravacaoDominio.data.id,
      template,
      criouModeloInicial: criadaDoZero,
      publicado: true,
      httpsConfirmado: false,
    };
  });
