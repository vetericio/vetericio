import { clienteSupabaseUsuario } from "./permissao-clinica.server.ts";
import { periodoValido, somarDias, type DadosRelatorio } from "./relatorios.ts";
import {
  diaClientes,
  inicioCivilClientes,
  inicioInatividade,
  relatorioCadastros,
  relatorioEstoque,
  relatorioPortal,
  type AgendamentoPortalRelatorio,
  type ConsultaAgendaRelatorio,
  type MovimentoRelatorio,
  type PacienteRelatorio,
  type PeriodoClientes,
  type ProdutoRelatorio,
  type TutorRelatorio,
} from "./relatorios-clientes.ts";

type EntradaRelatorioClientes = PeriodoClientes & {
  accessToken: string;
  clinicaId: string;
  codigo: "25" | "26" | "28";
};
type Banco = Pick<ReturnType<typeof clienteSupabaseUsuario>, "from">;
const erroConsulta = "Não foi possível consultar os registros do relatório.";

async function paginar<T>(
  ler: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const pagina = 500;
  const registros: T[] = [];
  for (let de = 0; de <= 20_000; de += pagina) {
    const { data, error } = await ler(de, de + pagina - 1);
    if (error || !data) throw new Error(erroConsulta);
    if (de === 20_000 && data.length) {
      throw new Error("O volume de registros excede o limite deste relatório.");
    }
    registros.push(...data);
    if (data.length < pagina) return registros;
  }
  return registros;
}

async function contagem(
  consulta: PromiseLike<{ error: unknown; count: number | null }>,
): Promise<number> {
  const { count, error } = await consulta;
  if (error || count === null) throw new Error(erroConsulta);
  return count;
}

// O dispatcher confere sessão, clínica piloto e todas as permissões de origem.
// Não usa service_role: o JWT do funcionário mantém o RLS em todas as leituras.
export async function gerarRelatorioClientes(
  input: EntradaRelatorioClientes,
): Promise<DadosRelatorio> {
  return consultarRelatorioClientes(clienteSupabaseUsuario(input.accessToken), input);
}

export async function consultarRelatorioClientes(
  banco: Banco,
  { clinicaId, codigo, inicio, fim }: Omit<EntradaRelatorioClientes, "accessToken">,
  agora = Date.now(),
): Promise<DadosRelatorio> {
  if (!clinicaId || !periodoValido(inicio, fim)) throw new Error("Clínica ou período inválido.");
  const inicioIso = inicioCivilClientes(inicio);
  const fimIso = inicioCivilClientes(somarDias(fim, 1));

  if (codigo === "25") {
    const [produtos, movimentos] = await Promise.all([
      paginar<ProdutoRelatorio>((de, ate) =>
        banco
          .from("oricse_catalogo_itens")
          .select("id,nome,categoria,estoque_atual,estoque_minimo,venda_por_peso")
          .eq("clinica_id", clinicaId)
          .eq("tipo", "produto")
          .eq("ativo", true)
          .order("nome")
          .order("id")
          .range(de, ate),
      ),
      paginar<MovimentoRelatorio>((de, ate) =>
        banco
          .from("oricse_historico_estoque")
          .select("item_id,item_nome,tipo,quantidade")
          .eq("clinica_id", clinicaId)
          .gte("registrado_em", inicioIso)
          .lt("registrado_em", fimIso)
          .order("registrado_em")
          .order("id")
          .range(de, ate),
      ),
    ]);
    return relatorioEstoque(produtos, movimentos);
  }

  if (codigo === "26") {
    const hoje = diaClientes(agora);
    const referencia = fim < hoje ? fim : hoje;
    const fimReferencia = inicioCivilClientes(somarDias(referencia, 1));
    const corte = inicioInatividade(referencia);
    const inicioConsulta = inicioCivilClientes(inicio < corte ? inicio : corte);
    const [tutores, pacientes, agenda] = await Promise.all([
      paginar<TutorRelatorio>((de, ate) =>
        banco
          .from("tutores")
          .select("id,created_at")
          .eq("clinica_id", clinicaId)
          .lt("created_at", fimReferencia)
          .order("id")
          .range(de, ate),
      ),
      paginar<PacienteRelatorio>((de, ate) =>
        banco
          .from("oricse_animais")
          .select("id,created_at,especie")
          .eq("clinica_id", clinicaId)
          .lt("created_at", fimReferencia)
          .order("id")
          .range(de, ate),
      ),
      paginar<ConsultaAgendaRelatorio>((de, ate) =>
        banco
          .from("oricse_agendamentos_online")
          .select("tutor_id,animal_id,inicio")
          .eq("clinica_id", clinicaId)
          .eq("dados->>status_clinico", "Finalizado")
          .gte("inicio", inicioConsulta)
          .lt("inicio", fimReferencia)
          .order("inicio")
          .order("id")
          .range(de, ate),
      ),
    ]);
    return relatorioCadastros({ inicio, fim }, referencia, tutores, pacientes, agenda);
  }

  if (codigo === "28") {
    const consultaContasAtivas = () =>
      banco
        .from("oricse_portal_tutores")
        .select("id", { count: "exact", head: true })
        .eq("clinica_id", clinicaId)
        .eq("ativo", true)
        .not("auth_user_id", "is", null);
    const [agendamentos, tutores, ativas, ultimoAcessoNoPeriodo] = await Promise.all([
      paginar<AgendamentoPortalRelatorio>((de, ate) =>
        banco
          .from("oricse_agendamentos_online")
          .select("inicio,estado")
          .eq("clinica_id", clinicaId)
          .eq("origem", "portal_tutor")
          .gte("inicio", inicioIso)
          .lt("inicio", fimIso)
          .order("inicio")
          .order("id")
          .range(de, ate),
      ),
      contagem(
        banco
          .from("tutores")
          .select("id", { count: "exact", head: true })
          .eq("clinica_id", clinicaId),
      ),
      contagem(consultaContasAtivas()),
      contagem(
        consultaContasAtivas().gte("ultimo_acesso_em", inicioIso).lt("ultimo_acesso_em", fimIso),
      ),
    ]);
    return relatorioPortal(agendamentos, { tutores, ativas, ultimoAcessoNoPeriodo });
  }

  throw new Error("Relatório não disponível.");
}
