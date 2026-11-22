import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissaoClinica } from "@/lib/permissao-clinica.server";
import { fonteClinicaElegivel, type RegistroPersistido } from "@/lib/crm-pos-cirurgico";

const input = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
});

function parseProntuario(estado: unknown): unknown[] {
  if (!estado || typeof estado !== "object" || Array.isArray(estado)) return [];
  const bruto = (estado as Record<string, unknown>)["oricse-prontuario-animal-v1"];
  if (bruto === null || bruto === undefined) return [];
  if (typeof bruto !== "string") throw new Error("Formato inesperado do prontuário salvo.");
  let parsed: unknown;
  try { parsed = JSON.parse(bruto); }
  catch { throw new Error("Prontuário persistido contém dados inválidos."); }
  if (!Array.isArray(parsed)) throw new Error("Prontuário persistido precisa ser uma lista.");
  return parsed;
}

/**
 * Lê do estado canônico persistido no PostgreSQL, não da memória do navegador.
 * Nenhuma alteração de banco; serviço de leitura autorizado por clínica/cargo.
 */
export const listarFontesPosCirurgicas = createServerFn({ method: "POST" })
  .validator((valor: unknown) => input.parse(valor))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !auth.user) throw new Error("Sessão expirada.");
    await exigirPermissaoClinica(
      supabaseAdmin, auth.user.id, data.clinicaId,
      ["crm.visualizar", "crm.enviar", "crm.gerenciar"], data.accessToken,
    );

    const { data: estado, error: erroEstado } = await supabaseAdmin
      .from("oricse_dados_modulos").select("dados")
      .eq("clinica_id", data.clinicaId).eq("chave", "estado_sistema").maybeSingle();
    if (erroEstado) throw new Error("Não foi possível consultar o prontuário persistido.");

    const registros = parseProntuario(estado?.dados).filter(
      (item): item is RegistroPersistido =>
        !!item && typeof item === "object" && !Array.isArray(item) &&
        fonteClinicaElegivel(item as RegistroPersistido, data.clinicaId),
    );
    if (!registros.length) return [] as FontePosCirurgica[];
    if (registros.length > 5000) throw new Error("Quantidade de procedimentos exige consulta paginada.");

    const animaisIds = [...new Set(registros.map(r => String(r.animalId)))];
    const { data: animais, error: erroAnimais } = await supabaseAdmin
      .from("oricse_animais").select("id,nome,tutor_id")
      .eq("clinica_id", data.clinicaId).in("id", animaisIds).limit(5000);
    if (erroAnimais) throw new Error("Não foi possível conferir os vínculos dos pacientes.");

    const animaisPorId = new Map((animais || []).map(a => [a.id, a]));
    const tutoresIds = [...new Set((animais || []).map(a => a.tutor_id).filter(Boolean))];
    if (!tutoresIds.length) return [] as FontePosCirurgica[];
    const { data: tutores, error: erroTutores } = await supabaseAdmin
      .from("tutores").select("id,nome,telefone,outro_telefone,email,dados")
      .eq("clinica_id", data.clinicaId).in("id", tutoresIds).limit(5000);
    if (erroTutores) throw new Error("Não foi possível conferir o vínculo dos tutores.");

    const tutorPorId = new Map((tutores || []).map(t => [t.id, t]));
    return registros.flatMap((registro): FontePosCirurgica[] => {
      const animal = animaisPorId.get(String(registro.animalId));
      const tutor = animal ? tutorPorId.get(animal.tutor_id) : null;
      if (!animal || !tutor || tutor.id !== registro.tutorId) return [];

      const opcoes = registro.dados as Record<string, unknown>;
      const dadosTutor = tutor.dados && typeof tutor.dados === "object"
        ? tutor.dados as Record<string, unknown> : {};
      const lembretes = dadosTutor.autorizaLembretes === true;
      const permiteWpp = lembretes && dadosTutor.autorizaWhatsapp === true;
      const permiteEmail = lembretes && dadosTutor.autorizaEmail === true;

      return [{
        id: String(registro.id),
        clinicaId: data.clinicaId,
        animalId: animal.id,
        tutorId: tutor.id,
        animalNome: animal.nome || "Paciente",
        tutorNome: tutor.nome || "Tutor",
        dataProcedimento: String(registro.data),
        dataAlta: typeof opcoes.dataAlta === "string" ? opcoes.dataAlta : null,
        autorNome: typeof registro.autorNome === "string" ? registro.autorNome : "",
        acompanhamentoAprovado: true,
        obitoRegistrado: false,
        telefone: permiteWpp ? String(tutor.telefone || "") : "",
        outroTelefone: permiteWpp ? String(tutor.outro_telefone || "") : "",
        email: permiteEmail ? String(tutor.email || "") : "",
        autorizaLembretes: lembretes,
        autorizaWhatsapp: permiteWpp,
        autorizaEmail: permiteEmail,
      }];
    });
  });
