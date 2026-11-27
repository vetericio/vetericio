import { clienteSupabaseUsuario } from "./permissao-clinica.server.ts";
import { limitesDoPeriodoPet } from "./relatorios-pet.ts";
import { diaNoFuso, type DadosRelatorio } from "./relatorios.ts";
import {
  extrairAplicacoesPrevencao,
  montarRelatorioExames,
  montarRelatorioMedicacoes,
  montarRelatorioVacinas,
  type ConsultaPrevencao,
  type ExamePrevencao,
  type PeriodoPrevencao,
  type VacinaPrevencao,
} from "./relatorios-prevencao.ts";

type Entrada = PeriodoPrevencao & {
  accessToken: string;
  clinicaId: string;
  codigo: "19" | "20" | "21";
};

async function paginar<T>(
  ler: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  limite = 20_000,
) {
  const registros: T[] = [];
  const pagina = 500;
  for (let de = 0; de < limite; de += pagina) {
    const { data, error } = await ler(de, de + pagina - 1);
    if (error || !data) throw new Error("Não foi possível consultar os registros deste relatório.");
    registros.push(...data);
    if (data.length < pagina) return registros;
  }
  throw new Error("A consulta excedeu o limite de registros. Não foi gerado um resultado parcial.");
}

// Chamado somente pelo dispatcher, após validação de sessão, piloto e permissões das fontes.
// Tabelas com RLS clínico explícito usam o JWT; a chave administrativa lê somente os campos
// legados estritamente necessários, com clínica ativa e autorização já verificadas.
export async function gerarRelatorioPrevencao({
  accessToken,
  clinicaId,
  codigo,
  inicio,
  fim,
}: Entrada): Promise<DadosRelatorio> {
  const periodo = { inicio, fim };
  const hoje = diaNoFuso(new Date().toISOString());
  const banco = clienteSupabaseUsuario(accessToken);
  if (codigo === "21") {
    // O histórico inclui a aplicação sem reforço para não reativar uma pendência substituída.
    const historico = await paginar<VacinaPrevencao>(
      (de, ate) =>
        banco
          .from("oricse_portal_vacinas")
          .select("animal_id,nome,aplicada_em,reforco_em")
          .eq("clinica_id", clinicaId)
          .or(`aplicada_em.lte.${hoje},aplicada_em.is.null`)
          .order("id")
          .range(de, ate),
      30_000,
    );
    return montarRelatorioVacinas(historico, periodo, hoje);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const campo = codigo === "19" ? "medicacoes" : "examesSolicitados";
  const consultas = () =>
    paginar<ConsultaPrevencao>((de, ate) =>
      supabaseAdmin
        .from("oricse_animal_registros_extra")
        .select(`data,campo:dados_atendimento->consulta->>${campo}`)
        .eq("clinica_id", clinicaId)
        .eq("tipo", "Registros clínicos")
        .eq("titulo", "Consulta")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data")
        .order("id")
        .range(de, ate)
        .overrideTypes<ConsultaPrevencao[], { merge: false }>(),
    );
  if (codigo === "19") {
    const [registros, estado] = await Promise.all([
      consultas(),
      supabaseAdmin
        .from("oricse_dados_modulos")
        .select("registros:dados->>veterico-registros-v1")
        .eq("clinica_id", clinicaId)
        .eq("chave", "estado_sistema")
        .maybeSingle()
        .overrideTypes<{ registros: string | null }, { merge: false }>(),
    ]);
    if (estado.error) throw new Error("Não foi possível consultar as aplicações da internação.");
    return montarRelatorioMedicacoes(
      registros,
      extrairAplicacoesPrevencao(estado.data?.registros),
      periodo,
    );
  }

  const limites = limitesDoPeriodoPet(periodo);
  const [registros, exames] = await Promise.all([
    consultas(),
    paginar<ExamePrevencao>((de, ate) =>
      banco
        .from("oricse_portal_exames")
        .select("tipo,drive_arquivo_id")
        .eq("clinica_id", clinicaId)
        .gte("created_at", limites.inicio)
        .lt("created_at", limites.fim)
        .order("created_at")
        .order("id")
        .range(de, ate),
    ),
  ]);
  return montarRelatorioExames(registros, exames, periodo);
}
