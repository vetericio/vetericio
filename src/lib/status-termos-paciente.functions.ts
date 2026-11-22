import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissaoClinica } from "@/lib/permissao-clinica.server";
import { codigoTermoPorUuid } from "@/lib/termos-clinicos-status";

const schema = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
  animalId: z.string().uuid(),
});

/**
 * Conferência de termos oficialmente registrados no prontuário.
 * Um PDF manualmente anexado NÃO equivale a um termo emitido pelo gerador.
 * Nenhum conteúdo ou metadado sigiloso é retornado ao navegador.
 */
export const obterStatusTermosPaciente = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: auth, error: erroAuth } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (erroAuth || !auth.user) throw new Error("Faça login novamente para consultar os termos.");
    await exigirPermissaoClinica(
      supabaseAdmin, auth.user.id, data.clinicaId,
      ["recepcao.cadastros.visualizar", "consultorio.atendimentos"], data.accessToken,
    );
    const { data: animal, error: erroAnimal } = await supabaseAdmin.from("oricse_animais")
      .select("id").eq("id", data.animalId).eq("clinica_id", data.clinicaId).maybeSingle();
    if (erroAnimal || !animal) throw new Error("Paciente não disponível nesta clínica.");

    const { data: documentos, error: erroDocumentos } = await supabaseAdmin
      .from("oricse_portal_documentos")
      .select("id,titulo,drive_arquivo_id,tipo")
      .eq("clinica_id", data.clinicaId)
      .eq("animal_id", data.animalId)
      .ilike("tipo", "termo%")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (erroDocumentos) throw new Error("Não foi possível consultar os documentos do paciente.");

    const ids = [...new Set((documentos || []).map(d => d.drive_arquivo_id).filter((v): v is string => Boolean(v)))];
    const metadados = new Map<string, Record<string, unknown>>();
    for (let indice = 0; indice < ids.length; indice += 100) {
      const { data: arquivos, error: erroArquivos } = await supabaseAdmin
        .from("drive_arquivos")
        .select("id,metadata")
        .eq("clinica_id", data.clinicaId)
        .eq("entidade_id", data.animalId)
        .in("id", ids.slice(indice, indice + 100));
      if (erroArquivos) throw new Error("Não foi possível conferir a origem dos termos.");
      for (const arquivo of arquivos || []) {
        const meta = arquivo.metadata && typeof arquivo.metadata === "object" && !Array.isArray(arquivo.metadata)
          ? arquivo.metadata as Record<string, unknown> : {};
        metadados.set(arquivo.id, meta);
      }
    }
    return {
      completo: (documentos || []).length < 1000,
      documentos: (documentos || []).map(d => {
        const meta = metadados.get(d.drive_arquivo_id || "") || {};
        const codigo = typeof meta.modeloId === "string" ? codigoTermoPorUuid(meta.modeloId) : null;
        return {
          documentoId: d.id,
          codigoTermo: codigo,
          previaSalva: Boolean(codigo && meta.origem === "previa_demonstrativa_termo" &&
            meta.codigoTermo === codigo && d.tipo === "Termo - Prévia demonstrativa"),
          geradoPeloOricse: Boolean(codigo && meta.origem === "modelo_clinico_assinado"),
        };
      }),
    };
  });
