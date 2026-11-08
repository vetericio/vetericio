import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkOricseHttps, normalizeDomain } from "@/lib/clinic-domain";

const inputSchema = z.object({
  clinicaId: z.string().uuid(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const prepararEnderecoOricse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase: supabaseAdmin } = context;
    const { data: usuario, error: erroUsuario } = await supabaseAdmin
      .from("app_users")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (erroUsuario || usuario?.role !== "admin")
      throw new Error("Somente a administração da Oricse pode preparar endereços.");

    const hostname = `${data.slug}.oricse.com.br`;
    const { data: existente, error: erroConsulta } = await supabaseAdmin
      .from("oricse_dominios_clinica")
      .select("id, status, hostname, publicar_site, ssl_status")
      .eq("clinica_id", data.clinicaId)
      .eq("tipo", "oricse")
      .maybeSingle();
    if (erroConsulta) throw new Error(`Não foi possível verificar o endereço: ${erroConsulta.message}`);
    if (existente?.status === "ativo" && existente.hostname !== hostname)
      throw new Error("Este endereço já está ativo. Altere o nome somente depois de migrar o DNS.");

    const { data: conflito, error: erroConflito } = await supabaseAdmin
      .from("oricse_dominios_clinica").select("id, clinica_id").eq("hostname", hostname).maybeSingle();
    if (erroConflito) throw new Error("Não foi possível conferir o domínio existente.");
    if (conflito && conflito.clinica_id !== data.clinicaId)
      throw new Error("Este endereço já pertence a outra clínica.");

    const valores = {
      hostname,
      principal: true,
      publicar_site: existente?.publicar_site ?? true,
      dns_alvo: "sites.oricse.com.br",
      verificacao_tipo: "automatica",
      status: existente?.status || "aguardando_dns",
      ssl_status: existente?.ssl_status || null,
      ultimo_erro: null,
      atualizado_em: new Date().toISOString(),
    };
    const { data: dominio, error: erroSalvar } = existente
      ? await supabaseAdmin
          .from("oricse_dominios_clinica")
          .update(valores)
          .eq("id", existente.id)
          .select("id, hostname, status, publicar_site, ssl_status")
          .single()
      : await supabaseAdmin
          .from("oricse_dominios_clinica")
          .insert({ ...valores, clinica_id: data.clinicaId, tipo: "oricse" })
          .select("id, hostname, status, publicar_site, ssl_status")
          .single();

    if (erroSalvar?.code === "23505") {
      const { data: atual } = await supabaseAdmin.from("oricse_dominios_clinica")
        .select("id, hostname, status, publicar_site, ssl_status")
        .eq("clinica_id", data.clinicaId).eq("tipo", "oricse").eq("hostname", hostname).maybeSingle();
      if (atual) return atual;
      throw new Error("Este endereço já está cadastrado. Atualize a lista antes de tentar novamente.");
    }
    if (erroSalvar || !dominio)
      throw new Error(`Não foi possível preparar o endereço: ${erroSalvar?.message || "erro desconhecido"}`);
    return dominio;
  });

const domainInput = z.object({ clinicaId: z.string().uuid(), dominioId: z.string().uuid() });

export const verificarDominioClinica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => domainInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: user, error: roleError } = await context.supabase.from("app_users")
      .select("role").eq("user_id", context.userId).maybeSingle();
    if (roleError || user?.role !== "admin") throw new Error("Somente a administração pode verificar domínios.");
    const { data: row, error } = await context.supabase.from("oricse_dominios_clinica")
      .select("hostname,tipo,status,publicar_site").eq("id", data.dominioId).eq("clinica_id", data.clinicaId).single();
    if (error || !row) throw new Error("Domínio não encontrado nesta clínica.");
    if (!row.publicar_site || row.status !== "ativo" || row.tipo !== "oricse")
      return { status: "nao_verificado" as const };
    return { status: await checkOricseHttps(normalizeDomain(row.hostname)) };
  });

export const excluirDominioClinica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => domainInput.extend({ confirmacao: z.string(), confirmarInterrupcao: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: user, error: roleError } = await context.supabase.from("app_users")
      .select("role").eq("user_id", context.userId).maybeSingle();
    if (roleError || user?.role !== "admin") throw new Error("Somente a administração pode excluir domínios.");
    const { data: row, error } = await context.supabase.from("oricse_dominios_clinica")
      .select("id,hostname,tipo").eq("id", data.dominioId).eq("clinica_id", data.clinicaId).single();
    if (error || !row) throw new Error("Domínio não encontrado nesta clínica. Atualize a lista.");
    if (normalizeDomain(data.confirmacao) !== normalizeDomain(row.hostname) ||
      (row.tipo === "oricse" && !data.confirmarInterrupcao)) throw new Error("Confirme o endereço e a interrupção antes de excluir.");
    // Conditional cleanup cannot overwrite a different/newly configured domain.
    if (row.tipo === "proprio") {
      const { error: cleanupError } = await context.supabase.from("clinicas")
        .update({ dominio: null, updated_at: new Date().toISOString() })
        .eq("id", data.clinicaId).eq("dominio", row.hostname);
      if (cleanupError) throw new Error("Não foi possível limpar a referência da clínica. Nada foi excluído.");
    }
    const { data: deleted, error: deleteError } = await context.supabase.from("oricse_dominios_clinica")
      .delete().eq("id", row.id).eq("clinica_id", data.clinicaId).select("id").single();
    if (deleteError || !deleted) throw new Error("Não foi possível excluir o domínio. Atualize a lista e tente novamente.");
    return { id: deleted.id };
  });
