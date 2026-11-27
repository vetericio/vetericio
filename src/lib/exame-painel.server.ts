import { isDeepStrictEqual } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { contaDemoAlvorada } from "./demo-alvorada";
import { exigirPermissaoClinica } from "./permissao-clinica.server";
import {
  criarLinhasLab,
  especieLaboratorial,
  normalizarLaboratorio,
  unidadeComparavel,
  type EspecieLab,
  type ExameLab,
  type LinhaLab,
  type ReferenciaLab,
} from "./exame-painel";

// O schema da migração é mais novo que os tipos gerados. Restringir o cliente
// sem schema somente às duas tabelas novas; vínculos usam o cliente tipado.
const lab = () => supabaseAdmin as unknown as SupabaseClient;
type Acesso = { accessToken: string; clinicaId: string; animalId: string };
type Registro = {
  id: string;
  consulta_id: string | null;
  painel: ExameLab["painel"];
  especie: EspecieLab;
  realizado_em: string;
  hora_exame: string;
  laboratorio: string;
  autor_nome: string;
  observacoes: string;
  resultados: LinhaLab[];
  drive_arquivo_id: string | null;
};
type Gravacao = Acesso &
  Pick<
    ExameLab,
    "id" | "painel" | "data" | "hora" | "laboratorio" | "observacoes" | "resultados" | "temPdf"
  > & { consultaId?: string | null };
type ConsultaReferencia = Acesso & Pick<ExameLab, "laboratorio" | "painel">;
const TABELA = "oricse_exames_laboratoriais";
const REF = "oricse_referencias_laboratoriais";
const CAMPOS =
  "id,consulta_id,painel,especie,realizado_em,hora_exame,laboratorio,autor_nome,observacoes,resultados,drive_arquivo_id";
const PERMISSAO = "consultorio.atendimentos";

async function autorizar(a: Acesso, escrita = false, configurar = false) {
  const sessao = await supabaseAdmin.auth.getUser(a.accessToken);
  const user = sessao.data.user;
  if (sessao.error || !user) throw new Error("Sessão inválida ou expirada.");
  await exigirPermissaoClinica(supabaseAdmin, user.id, a.clinicaId, [PERMISSAO], a.accessToken);
  const demo = contaDemoAlvorada(user);
  if (escrita && demo)
    throw new Error("A demonstração não permite registrar resultados laboratoriais.");
  if (configurar)
    await exigirPermissaoClinica(
      supabaseAdmin,
      user.id,
      a.clinicaId,
      ["administracao.configuracoes"],
      a.accessToken,
    );
  const animal = await supabaseAdmin
    .from("oricse_animais")
    .select("id,especie")
    .eq("id", a.animalId)
    .eq("clinica_id", a.clinicaId)
    .maybeSingle();
  if (animal.error || !animal.data) throw new Error("Animal não encontrado nesta clínica.");
  return { userId: user.id, especie: especieLaboratorial(animal.data.especie), demo };
}

async function nomeAutor(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("oricse_pessoas")
    .select("nome_completo")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível identificar o autor do resultado.");
  if (data?.nome_completo.trim()) return data.nome_completo.trim();
  const conta = await supabaseAdmin
    .from("app_users")
    .select("username")
    .eq("user_id", userId)
    .maybeSingle();
  const nome = conta.data?.username?.trim() || "";
  if (conta.error) throw new Error("Não foi possível identificar o autor do resultado.");
  return nome && !nome.includes("@") ? nome.slice(0, 180) : "Profissional sem nome no perfil";
}
const formatar = (r: Registro): ExameLab => ({
  id: r.id,
  consultaId: r.consulta_id,
  painel: r.painel,
  especie: r.especie,
  data: r.realizado_em,
  hora: r.hora_exame.slice(0, 5),
  laboratorio: r.laboratorio,
  autor: r.autor_nome,
  observacoes: r.observacoes,
  resultados: r.resultados,
  temPdf: !!r.drive_arquivo_id,
});

export async function listarExamesLabServidor(a: Acesso) {
  const contexto = await autorizar(a);
  const [exames, labs, autor] = await Promise.all([
    (async () => {
      const resultado: ExameLab[] = [];
      for (let de = 0; de < 5000; de += 250) {
        const { data, error } = await lab()
          .from(TABELA)
          .select(CAMPOS)
          .eq("clinica_id", a.clinicaId)
          .eq("animal_id", a.animalId)
          .order("realizado_em", { ascending: false })
          .order("hora_exame", { ascending: false })
          .order("id")
          .range(de, de + 249)
          .returns<Registro[]>();
        if (error || !data) throw new Error("Não foi possível carregar o histórico laboratorial.");
        resultado.push(...data.map(formatar));
        if (data.length < 250) return resultado;
      }
      throw new Error(
        "O histórico excede o limite da consulta. Solicite uma extração à administração.",
      );
    })(),
    lab()
      .from(REF)
      .select("laboratorio")
      .eq("clinica_id", a.clinicaId)
      .eq("especie", contexto.especie)
      .order("laboratorio")
      .limit(250)
      .returns<{ laboratorio: string }[]>(),
    nomeAutor(contexto.userId),
  ]);
  if (labs.error) throw new Error("Não foi possível carregar os laboratórios cadastrados.");
  return {
    exames,
    laboratorios: [...new Set((labs.data || []).map((l) => l.laboratorio))],
    especie: contexto.especie,
    autor,
    demo: contexto.demo,
  };
}

export async function listarReferenciasLabServidor(a: ConsultaReferencia) {
  const { especie } = await autorizar(a);
  if (especie === "Outra")
    return { especie, referencias: [] as ReferenciaLab[], cadastrada: false };
  const { data, error } = await lab()
    .from(REF)
    .select("referencias")
    .eq("clinica_id", a.clinicaId)
    .eq("laboratorio_chave", normalizarLaboratorio(a.laboratorio))
    .eq("especie", especie)
    .eq("painel", a.painel)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar as referências deste laboratório.");
  return { especie, referencias: (data?.referencias ?? []) as ReferenciaLab[], cadastrada: !!data };
}

export async function salvarReferenciasLabServidor(
  a: ConsultaReferencia & { referencias: ReferenciaLab[] },
) {
  const { especie, userId } = await autorizar(a, true, true);
  if (especie === "Outra")
    throw new Error("Para esta espécie, registre a referência diretamente no resultado.");
  const parametros = criarLinhasLab(a.painel);
  const referencias = a.referencias.filter((r) =>
    parametros.some((p) => r.parametroId === p.parametroId),
  );
  if (!referencias.length)
    throw new Error("O painel precisa ter parâmetros padronizados para guardar referências.");
  if (
    new Set(referencias.map((r) => JSON.stringify([r.parametroId, unidadeComparavel(r.unidade)])))
      .size !== referencias.length
  )
    throw new Error("Confira referências duplicadas.");
  const { error } = await lab()
    .from(REF)
    .upsert(
      {
        clinica_id: a.clinicaId,
        laboratorio_chave: normalizarLaboratorio(a.laboratorio),
        laboratorio: a.laboratorio,
        especie,
        painel: a.painel,
        referencias,
        atualizado_por: userId,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "clinica_id,laboratorio_chave,especie,painel" },
    );
  if (error) throw new Error("Não foi possível salvar as referências para este laboratório.");
  return { ok: true };
}

export async function salvarExameLabServidor(a: Gravacao): Promise<ExameLab> {
  const { userId, especie } = await autorizar(a, true);
  const parametros = criarLinhasLab(a.painel);
  const resultados = a.resultados.map((r) => {
    const p = parametros.find((parametro) => parametro.parametroId === r.parametroId);
    if (p) return { ...r, nome: p.nome };
    if (!r.parametroId.startsWith("personalizado-"))
      throw new Error("Há um parâmetro não reconhecido neste painel.");
    return r;
  });
  if (a.consultaId) {
    const { data, error } = await supabaseAdmin
      .from("oricse_animal_registros_extra")
      .select("id")
      .eq("clinica_id", a.clinicaId)
      .eq("animal_id", a.animalId)
      .eq("id", a.consultaId)
      .eq("tipo", "Registros clínicos")
      .eq("titulo", "Consulta")
      .not("dados_atendimento", "is", null)
      .maybeSingle();
    if (error || !data) throw new Error("A consulta não pertence a esta ficha.");
  }
  if (a.temPdf) {
    const anexo = await supabaseAdmin
      .from("drive_arquivos")
      .select("id")
      .eq("id", a.id)
      .eq("clinica_id", a.clinicaId)
      .eq("entidade_tipo", "animal")
      .eq("entidade_id", a.animalId)
      .eq("enviado_por", userId)
      .eq("categoria", "exames")
      .eq("mime_type", "application/pdf")
      .maybeSingle();
    if (anexo.error || !anexo.data)
      throw new Error("O PDF não está vinculado a este exame e paciente.");
  }
  const gravacao = {
    id: a.id,
    clinica_id: a.clinicaId,
    animal_id: a.animalId,
    consulta_id: a.consultaId || null,
    painel: a.painel,
    especie,
    realizado_em: a.data,
    hora_exame: a.hora,
    laboratorio: a.laboratorio,
    autor_id: userId,
    autor_nome: await nomeAutor(userId),
    observacoes: a.observacoes,
    resultados,
    drive_arquivo_id: a.temPdf ? a.id : null,
  };
  const { data, error } = await lab()
    .from(TABELA)
    .insert(gravacao)
    .select(CAMPOS)
    .single()
    .returns<Registro>();
  if (data && !error) return formatar(data);
  if (error?.code === "23505") {
    const existente = await lab()
      .from(TABELA)
      .select(CAMPOS)
      .eq("id", a.id)
      .eq("clinica_id", a.clinicaId)
      .eq("animal_id", a.animalId)
      .eq("autor_id", userId)
      .maybeSingle()
      .returns<Registro>();
    if (!existente.error && existente.data) {
      const anterior = formatar(existente.data);
      const atual = {
        consultaId: a.consultaId || null,
        painel: a.painel,
        data: a.data,
        hora: a.hora,
        laboratorio: a.laboratorio,
        observacoes: a.observacoes,
        resultados,
        temPdf: a.temPdf,
      };
      const { id: _, especie: __, autor: ___, ...conteudoAnterior } = anterior;
      if (isDeepStrictEqual(conteudoAnterior, atual)) return anterior;
      throw new Error(
        "Esta tentativa já registrou outro conteúdo. Confira o histórico e inicie um novo registro.",
      );
    }
  }
  throw new Error("Não foi possível registrar o resultado laboratorial.");
}
