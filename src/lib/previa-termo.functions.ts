import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { contaDemoAlvorada, exigirEmissaoDisponivel } from "@/lib/demo-alvorada";
import { exigirPermissaoClinica } from "@/lib/permissao-clinica.server";
import { BIBLIOTECA_TERMOS } from "@/lib/termos-clinicos-validacao";
import { UUID_MODELOS_TERMO } from "@/lib/termos-clinicos-status";

const entrada = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
  animalId: z.string().uuid(),
  tutorId: z.string().uuid(),
  registroId: z.string().uuid(),
  tipoTermo: z.string().refine(
    (tipo) => Object.hasOwn(UUID_MODELOS_TERMO, tipo),
    "Modelo de termo desconhecido.",
  ),
});

/**
 * Arquiva SOMENTE uma prévia interna, sem homologar ou emitir termos oficiais.
 * O PDF deve ter sido enviado previamente pelo fluxo privado de anexos.
 */
export const salvarPreviaTermoNoProntuario = createServerFn({ method: "POST" })
  .validator((input: unknown) => entrada.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: autenticacao, error: erroAuth } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (erroAuth || !autenticacao.user) throw new Error("Sessão expirada. Entre novamente.");
    exigirEmissaoDisponivel(contaDemoAlvorada(autenticacao.user));
    const usuarioId = autenticacao.user.id;
    await exigirPermissaoClinica(
      supabaseAdmin, usuarioId, data.clinicaId, ["consultorio.atendimentos"], data.accessToken,
    );

    const termo = BIBLIOTECA_TERMOS.find(item => item.id === data.tipoTermo);
    if (!termo) throw new Error("Termo não encontrado na biblioteca.");
    const { data: animal, error: erroAnimal } = await supabaseAdmin.from("oricse_animais")
      .select("id,tutor_id").eq("id", data.animalId)
      .eq("clinica_id", data.clinicaId).maybeSingle();
    if (erroAnimal || !animal || animal.tutor_id !== data.tutorId) {
      throw new Error("Paciente e responsável não pertencem ao mesmo cadastro da clínica.");
    }
    const { data: arquivo, error: erroArquivo } = await supabaseAdmin.from("drive_arquivos")
      .select("id,clinica_id,entidade_tipo,entidade_id,categoria,mime_type,visibilidade,enviado_por,metadata")
      .eq("id", data.registroId).eq("clinica_id", data.clinicaId).maybeSingle();
    if (erroArquivo || !arquivo || arquivo.entidade_tipo !== "animal" ||
        arquivo.entidade_id !== data.animalId || arquivo.categoria !== "documentos" ||
        arquivo.mime_type !== "application/pdf" || arquivo.visibilidade !== "interno" ||
        arquivo.enviado_por !== usuarioId) {
      throw new Error("O PDF enviado não pertence a este animal ou não está em armazenamento privado.");
    }
    const metadata = arquivo.metadata && typeof arquivo.metadata === "object" && !Array.isArray(arquivo.metadata)
      ? arquivo.metadata as Record<string, unknown> : {};
    if (metadata.origem && metadata.origem !== "previa_demonstrativa_termo") {
      throw new Error("Este arquivo já está vinculado a outro fluxo documental.");
    }
    if (metadata.origem === "previa_demonstrativa_termo" &&
        metadata.codigoTermo !== data.tipoTermo) {
      throw new Error("Este PDF pertence a outro modelo de termo.");
    }

    const { data: existente, error: erroExistente } = await supabaseAdmin.from("oricse_portal_documentos")
      .select("id,animal_id,tipo").eq("clinica_id", data.clinicaId)
      .eq("drive_arquivo_id", data.registroId).maybeSingle();
    if (erroExistente) throw new Error("Não foi possível conferir o histórico do documento.");
    if (existente) {
      if (existente.animal_id !== data.animalId || existente.tipo !== "Termo - Prévia demonstrativa") {
        throw new Error("Este PDF já está associado a outro documento.");
      }
      return { salvo: true, documentoId: existente.id, visivelTutor: false };
    }

    const { error: erroMetadados } = await supabaseAdmin.from("drive_arquivos")
      .update({
        metadata: {
          ...metadata,
          origem: "previa_demonstrativa_termo",
          codigoTermo: data.tipoTermo,
          modeloId: UUID_MODELOS_TERMO[data.tipoTermo as keyof typeof UUID_MODELOS_TERMO],
          versaoModelo: 0,
          situacao: "minuta_nao_homologada",
          animalId: data.animalId,
          tutorId: data.tutorId,
          salvoPor: usuarioId,
          salvoEm: new Date().toISOString(),
        },
      })
      .eq("id", data.registroId).eq("clinica_id", data.clinicaId);
    if (erroMetadados) throw new Error("Não foi possível identificar a origem da prévia. Nenhum documento foi registrado.");

    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const { data: documento, error: erroDocumento } = await supabaseAdmin.from("oricse_portal_documentos")
      .insert({
        clinica_id: data.clinicaId,
        animal_id: data.animalId,
        drive_arquivo_id: data.registroId,
        titulo: termo.nome,
        tipo: "Termo - Prévia demonstrativa",
        data_documento: hoje,
        observacoes: "Prévia demonstrativa sem validade para assinatura. Modelo aguardando homologação. Arquivo interno da clínica.",
        visivel_tutor: false,
      })
      .select("id").single();
    if (erroDocumento || !documento) {
      // O arquivo privado permanece associado ao mesmo registroId para nova tentativa.
      throw new Error("PDF arquivado, mas não foi possível vinculá-lo à ficha do animal. Tente salvar novamente.");
    }
    return { salvo: true, documentoId: documento.id, visivelTutor: false };
  });
