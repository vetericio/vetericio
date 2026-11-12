import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const prepararEnderecoOricse = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: autenticacao, error: erroAutenticacao } =
      await supabaseAdmin.auth.getUser(data.accessToken);
    if (erroAutenticacao || !autenticacao.user)
      throw new Error("Sessão inválida ou expirada. Entre novamente e tente de novo.");

    const { data: usuario, error: erroUsuario } = await supabaseAdmin
      .from("app_users")
      .select("role")
      .eq("user_id", autenticacao.user.id)
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

    const valores = {
      hostname,
      principal: true,
      // Registros legados em rascunho não podem herdar uma liberação pública indevida.
      publicar_site: existente?.hostname === hostname && existente.status === "ativo" ? existente.publicar_site : false,
      dns_alvo: "sites.oricse.com.br",
      verificacao_tipo: "automatica",
      status: "ativo",
      ssl_status: existente?.hostname === hostname ? existente.ssl_status : null,
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

    if (erroSalvar || !dominio)
      throw new Error(`Não foi possível preparar o endereço: ${erroSalvar?.message || "erro desconhecido"}`);
    return dominio;
  });
