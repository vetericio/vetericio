import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executarDriveDbInterno } from "@/lib/drive-db.functions";
import type { DadosRelatorio } from "./relatorios.ts";
import {
  relatorioJornadaEquipe,
  relatorioPlantaoEquipe,
  relatorioProdutividadeEquipe,
  type ComissaoEquipe,
  type ConsultaEquipe,
  type JornadaEquipe,
  type PeriodoEquipe,
} from "./relatorios-equipe.ts";

type EntradaEquipe = PeriodoEquipe & {
  accessToken: string;
  clinicaId: string;
  codigo: "13" | "14" | "18";
  podeVerFinanceiro: boolean;
};
type EstadoPlantao = { historico: string | null; atual: string | null; pendencias: string | null };
const maxRegistros = 20_000;
const muitos = () => new Error("Muitos registros. Reduza o período para consultar este relatório.");
const erroFonte = () => new Error("Não foi possível consultar os registros do relatório.");

async function paginasEquipe<T>(
  ler: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const itens: T[] = [];
  for (let i = 0; i <= maxRegistros; i += 500) {
    const { data, error } = await ler(i, i + 499);
    if (error || !data) throw erroFonte();
    itens.push(...data);
    if (itens.length > maxRegistros) throw muitos();
    if (data.length < 500) return itens;
  }
  throw muitos();
}

function lerChave(valor: string | null | undefined): unknown {
  if (valor == null) return null;
  try {
    return JSON.parse(valor);
  } catch {
    return null;
  }
}

async function lerEquipeDrive<T>(
  { accessToken, clinicaId, inicio, fim }: EntradaEquipe,
  table: "oricse_pagamento_lancamentos" | "oricse_jornada_registros",
  columns: string,
  somenteComissao = false,
) {
  const resposta = await executarDriveDbInterno({
    accessToken,
    table,
    operation: "select",
    columns,
    filters: [
      { kind: "eq", column: "clinica_id", value: clinicaId },
      { kind: "gte", column: "data", value: inicio },
      { kind: "lte", column: "data", value: fim },
      ...(somenteComissao ? [{ kind: "eq", column: "tipo", value: "comissao" }] : []),
    ],
    order: [{ column: "id", ascending: true }],
    range: [0, maxRegistros],
    single: "none",
    head: false,
    count: null,
  });
  if (resposta.error || !Array.isArray(resposta.data)) throw erroFonte();
  if (resposta.data.length > maxRegistros) throw muitos();
  return resposta.data as T[];
}

/**
 * Exclusivamente após o dispatcher validar o piloto, sessão, vínculo e os
 * gates do relatório: 13 consultorio.atendimentos (financeiro só com
 * equipe.pagamentos.visualizar), 14 equipe.pagamentos.visualizar, 18
 * internacao.plantoes E internacao.registrar. Toda fonte é lida por clínica;
 * serviços internos PostgreSQL não dependem de exposição de tabela ao cliente.
 */
export async function gerarRelatorioEquipe(input: EntradaEquipe): Promise<DadosRelatorio> {
  const { codigo, clinicaId, inicio, fim, podeVerFinanceiro } = input;
  const periodo = { inicio, fim };

  if (codigo === "13") {
    const [consultas, comissoes] = await Promise.all([
      paginasEquipe<ConsultaEquipe>((de, ate) =>
        supabaseAdmin
          .from("oricse_animal_registros_extra")
          .select("autor_id:dados_atendimento->>autorId,autor_nome:dados_atendimento->>autorNome")
          .eq("clinica_id", clinicaId)
          .eq("tipo", "Registros clínicos")
          .eq("titulo", "Consulta")
          .not("dados_atendimento->>consulta", "is", null)
          .gte("data", inicio)
          .lte("data", fim)
          .order("id")
          .range(de, ate)
          .overrideTypes<ConsultaEquipe[], { merge: false }>(),
      ),
      // A tela Jornada grava os lançamentos manuais através da camada Drive.
      // Sem acesso financeiro, não consultar nem exibir comissões.
      podeVerFinanceiro
        ? lerEquipeDrive<ComissaoEquipe>(input, "oricse_pagamento_lancamentos", "data,valor", true)
        : Promise.resolve(null),
    ]);
    return relatorioProdutividadeEquipe(consultas, comissoes);
  }

  if (codigo === "14") {
    // Check-in, pausas e finalização da rota Minha Atividade usam o
    // createDriveRpc/registrar_atividade e persistem na camada Drive.
    // A projeção nunca lê valor_unitario ou a remuneração configurada.
    const jornada = await lerEquipeDrive<JornadaEquipe>(
      input,
      "oricse_jornada_registros",
      "funcionario_id,data,modalidade,estado,segundos_trabalhados",
    );
    return relatorioJornadaEquipe(jornada, periodo);
  }

  // O estado principal das telas Plantões/Pendências é PostgreSQL
  // (oricse-storage.functions.ts). A projeção não lê o restante da clínica.
  // Cada chave armazena um JSON serializado como string. Nenhum texto clínico,
  // identificação de paciente ou item clínico é devolvido ao navegador.
  const { data, error } = await supabaseAdmin
    .from("oricse_dados_modulos")
    .select(
      'historico:dados->>"veterico-plantoes-v1",atual:dados->>"veterico-plantao-v1",pendencias:dados->>"veterico-pendencias-v1"',
    )
    .eq("clinica_id", clinicaId)
    .eq("chave", "estado_sistema")
    .maybeSingle()
    .overrideTypes<EstadoPlantao | null, { merge: false }>();
  if (error) throw erroFonte();
  const historico = lerChave(data?.historico);
  const pendencias = lerChave(data?.pendencias);
  return relatorioPlantaoEquipe(
    {
      historico: Array.isArray(historico) ? historico : null,
      atual: lerChave(data?.atual),
      pendencias: Array.isArray(pendencias) ? pendencias : null,
    },
    periodo,
  );
}
