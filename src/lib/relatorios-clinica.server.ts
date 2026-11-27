import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { diaNoFuso, periodoValido, somarDias, type DadosRelatorio } from "./relatorios";
import {
  projetarInternacao,
  projetarProntuario,
  relatorioConsultasProcedimentos,
  relatorioInternacao,
  relatorioProntuarios,
  type ConsultaRelatorio,
  type RetornoRelatorio,
} from "./relatorios-clinica";

type Entrada = {
  accessToken: string;
  clinicaId: string;
  codigo: "15" | "16" | "17";
  inicio: string;
  fim: string;
};

const tamanhoPagina = 500;
const maxRegistros = 20_000;
async function paginar<T>(
  ler: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const itens: T[] = [];
  for (let de = 0; de <= maxRegistros; de += tamanhoPagina) {
    const { data, error } = await ler(de, de + tamanhoPagina - 1);
    if (error || !data)
      throw new Error("Não foi possível consultar os dados do relatório clínico.");
    itens.push(...data);
    if (itens.length > maxRegistros) break;
    if (data.length < tamanhoPagina) return itens;
  }
  throw new Error("Há muitos registros clínicos. Consulte um período menor.");
}

/** O PostgreSQL contém o estado primário; o Drive recebe somente a cópia assíncrona. */
async function lerListaClinica(
  clinicaId: string,
  chave: "oricse-prontuario-animal-v1" | "veterico-registros-v1",
): Promise<unknown[]> {
  const { data, error } = await supabaseAdmin
    .from("oricse_dados_modulos")
    .select(`lista:dados->>${chave}`)
    .eq("clinica_id", clinicaId)
    .eq("chave", "estado_sistema")
    .maybeSingle()
    .overrideTypes<{ lista: string | null }, { merge: false }>();
  if (error) throw new Error("Não foi possível consultar os registros clínicos persistidos.");
  if (data?.lista == null) return [];
  let lista: unknown;
  try {
    lista = JSON.parse(data.lista);
  } catch {
    throw new Error("Os registros clínicos persistidos estão em formato inválido.");
  }
  if (!Array.isArray(lista))
    throw new Error("Os registros clínicos persistidos estão em formato inválido.");
  return lista;
}

function lerConsultas({ clinicaId, inicio, fim, codigo }: Entrada) {
  const colunas =
    codigo === "15"
      ? "id,data,retorno_em:dados_atendimento->consulta->>retornoEm"
      : "id,data,autor_id:dados_atendimento->>autorId,autor_crmv:dados_atendimento->>autorCrmv,queixa:dados_atendimento->consulta->>queixa,conduta:dados_atendimento->consulta->>conduta";
  return paginar<ConsultaRelatorio>((de, ate) =>
    supabaseAdmin
      .from("oricse_animal_registros_extra")
      .select(colunas)
      .eq("clinica_id", clinicaId)
      .eq("tipo", "Registros clínicos")
      .eq("titulo", "Consulta")
      .not("dados_atendimento", "is", null)
      .gte("data", inicio)
      .lte("data", fim)
      .order("id")
      .range(de, ate)
      .overrideTypes<ConsultaRelatorio[], { merge: false }>(),
  );
}

function lerRetornos({ clinicaId, inicio, fim }: Entrada) {
  // Margem UTC para a consulta; o cálculo verifica a data civil no fuso do relatório.
  const de = somarDias(inicio, -1) + "T00:00:00Z";
  const ate = somarDias(fim, 2) + "T00:00:00Z";
  return paginar<RetornoRelatorio>((primeiro, ultimo) =>
    supabaseAdmin
      .from("oricse_crm_retornos")
      .select("id,origem,data_prevista,status,realizado_em,created_at")
      .eq("clinica_id", clinicaId)
      .or(
        [
          `and(data_prevista.gte.${inicio},data_prevista.lte.${fim})`,
          `and(status.eq.realizado,realizado_em.gte.${de},realizado_em.lt.${ate})`,
          `and(data_prevista.is.null,created_at.gte.${de},created_at.lt.${ate})`,
        ].join(","),
      )
      .order("id")
      .range(primeiro, ultimo)
      .overrideTypes<RetornoRelatorio[], { merge: false }>(),
  );
}

/**
 * Somente após autenticação, clínica-piloto com vínculo e autorização da fonte
 * (15/16: consultorio.atendimentos; 17: internacao.registrar).
 * As tabelas privadas exigem leitura de serviço; nenhuma consulta é global.
 */
export async function gerarRelatorioClinica(entrada: Entrada): Promise<DadosRelatorio> {
  if (!periodoValido(entrada.inicio, entrada.fim)) throw new Error("Selecione um período válido.");
  const { codigo, clinicaId, inicio, fim } = entrada;
  const periodo = { inicio, fim };
  if (codigo === "17") {
    const painel = await lerListaClinica(clinicaId, "veterico-registros-v1");
    return relatorioInternacao(
      projetarInternacao(painel, clinicaId),
      periodo,
      diaNoFuso(new Date().toISOString()),
    );
  }

  const [consultas, legado, retornos] = await Promise.all([
    lerConsultas(entrada),
    lerListaClinica(clinicaId, "oricse-prontuario-animal-v1"),
    codigo === "15" ? lerRetornos(entrada) : Promise.resolve([]),
  ]);
  const prontuario = projetarProntuario(legado, clinicaId);
  return codigo === "15"
    ? relatorioConsultasProcedimentos(consultas, prontuario, retornos, periodo)
    : relatorioProntuarios(consultas, prontuario, periodo);
}
