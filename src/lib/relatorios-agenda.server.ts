import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { clienteSupabaseUsuario } from "@/lib/permissao-clinica.server";
import { executarDriveDbInterno } from "@/lib/drive-db.functions";
import { somarDias, type DadosRelatorio } from "./relatorios";
import {
  consolidarDadosAgenda,
  relatorioDesfechosAgenda,
  relatorioOcupacaoAgenda,
  relatorioTempoFila,
  type AgendaRelatorio,
  type EntradaFilaRelatorio,
  type EventoAgendaRelatorio,
} from "./relatorios-agenda";

type EntradaRelatorio = {
  accessToken: string;
  clinicaId: string;
  codigo: "08" | "09" | "10";
  inicio: string;
  fim: string;
};

const maxRegistros = 20_000;
const tamanhoPagina = 500;
const colunasAgenda =
  "id,nome,responsavel,tipo,inicio,fim,dias_semana,intervalo_min,timezone,created_at,updated_at";
const colunasEvento = "id,agenda_id,inicio,fim,estado,tipo,pagamento_expira_em,updated_at";
const erroPeriodo = () => new Error("Há muitos registros. Consulte um período menor.");

async function paginar<T>(
  ler: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const itens: T[] = [];
  for (let de = 0; de <= maxRegistros; de += tamanhoPagina) {
    const { data, error } = await ler(de, de + tamanhoPagina - 1);
    if (error || !data) throw new Error("Não foi possível consultar as fontes de agenda e fila.");
    itens.push(...data);
    if (itens.length > maxRegistros) throw erroPeriodo();
    if (data.length < tamanhoPagina) return itens;
  }
  throw erroPeriodo();
}

type Filtro =
  | { kind: "gt" | "lt"; column: "fim" | "inicio"; value: string }
  | { kind: "in"; column: "id"; value: string[] };

async function lerDrive<T>(
  { accessToken, clinicaId }: EntradaRelatorio,
  table: "oricse_agendas_online" | "oricse_agendamentos_online",
  columns: string,
  filtros: Filtro[] = [],
) {
  // Uma chamada: a leitura do Drive já materializa internamente o journal.
  const resultado = await executarDriveDbInterno({
    accessToken,
    table,
    columns,
    operation: "select",
    filters: [{ kind: "eq", column: "clinica_id", value: clinicaId }, ...filtros],
    order: [{ column: "id", ascending: true }],
    range: [0, maxRegistros],
    single: "none",
    head: false,
    count: null,
  });
  if (resultado.error || !Array.isArray(resultado.data))
    throw new Error("Não foi possível consultar a agenda da recepção.");
  if (resultado.data.length > maxRegistros) throw erroPeriodo();
  return resultado.data as T[];
}

type EventoDrive = EventoAgendaRelatorio & {
  dados?: { status_clinico?: unknown; reagendado_em?: unknown } | null;
};

const converterDrive = ({ dados, ...evento }: EventoDrive): EventoAgendaRelatorio => ({
  ...evento,
  status_clinico: typeof dados?.status_clinico === "string" ? dados.status_clinico : null,
  reagendado_em: typeof dados?.reagendado_em === "string" ? dados.reagendado_em : null,
});

const uuidReal = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
function idsAusentes<T extends { id: string }>(referencia: T[], destino: T[]) {
  const presentes = new Set(destino.map((e) => e.id));
  return [...new Set(referencia.map((e) => e.id).filter((id) => id && !presentes.has(id)))];
}

/**
 * Exclusivamente após os controles compartilhados do endpoint de relatórios:
 * autenticação, vínculo ativo, clínica-piloto e permissão recepcao.agenda.
 * As leituras mantêm o escopo de clínica inclusive no armazenamento legado.
 */
export async function gerarRelatorioAgenda(entrada: EntradaRelatorio): Promise<DadosRelatorio> {
  const { accessToken, clinicaId, codigo, inicio, fim } = entrada;
  const periodo = { inicio, fim };
  // Mantém eventos que cruzam o início do período e amplia o filtro de
  // transporte para permitir que o cálculo recorte pelo fuso de cada agenda.
  const margemInicio = somarDias(inicio, -2) + "T00:00:00Z";
  const margemFim = somarDias(fim, 3) + "T00:00:00Z";

  if (codigo === "10") {
    // 20261106111649: a tabela interna da fila não permite SELECT para
    // authenticated. O RPC da tela carrega também tutores/animais; leia aqui
    // somente os três campos de métrica, após o gate do endpoint chamador.
    const fila = await paginar<EntradaFilaRelatorio>((de, ate) =>
      supabaseAdmin
        .from("oricse_fila_espera")
        .select("chegada_em,chamado_em,status")
        .eq("clinica_id", clinicaId)
        .gte("chegada_em", margemInicio)
        .lt("chegada_em", margemFim)
        .order("id")
        .range(de, ate),
    );
    return relatorioTempoFila(fila, periodo);
  }

  // A tela da recepção tem atualizações no Drive; configurações e fluxos
  // canônicos também persistem em PostgreSQL. Consolida somente por ID:
  // registros diferentes não são inferidos ou agrupados por paciente/hora.
  const banco = clienteSupabaseUsuario(accessToken);
  const consultaEventos = () =>
    banco
      .from("oricse_agendamentos_online")
      .select(
        `${colunasEvento},status_clinico:dados->>status_clinico,reagendado_em:dados->>reagendado_em`,
      )
      .eq("clinica_id", clinicaId);
  const [agendasDrive, agendasPg, eventosDrive, eventosPg] = await Promise.all([
    lerDrive<AgendaRelatorio>(entrada, "oricse_agendas_online", colunasAgenda),
    paginar<AgendaRelatorio>((de, ate) =>
      banco
        .from("oricse_agendas_online")
        .select(colunasAgenda)
        .eq("clinica_id", clinicaId)
        .order("id")
        .range(de, ate),
    ),
    lerDrive<EventoDrive>(entrada, "oricse_agendamentos_online", colunasEvento + ",dados", [
      { kind: "lt", column: "inicio", value: margemFim },
      { kind: "gt", column: "fim", value: margemInicio },
    ]),
    paginar<EventoAgendaRelatorio>((de, ate) =>
      consultaEventos()
        .lt("inicio", margemFim)
        .gt("fim", margemInicio)
        .order("id")
        .range(de, ate)
        .overrideTypes<EventoAgendaRelatorio[], { merge: false }>(),
    ),
  ]);

  // Uma edição pode ter movido a versão mais recente para fora da janela.
  // Verificar seus IDs no outro armazenamento evita ressuscitar o horário antigo.
  const faltamNoDrive = idsAusentes(eventosPg, eventosDrive);
  const faltamNoPg = idsAusentes(eventosDrive, eventosPg).filter((id) => uuidReal.test(id));
  if (faltamNoPg.length > 5_000) throw erroPeriodo();
  const [versoesDrive, versoesPg] = await Promise.all([
    faltamNoDrive.length
      ? lerDrive<EventoDrive>(entrada, "oricse_agendamentos_online", colunasEvento + ",dados", [
          { kind: "in", column: "id", value: faltamNoDrive },
        ])
      : Promise.resolve([]),
    (async () => {
      const lista: EventoAgendaRelatorio[] = [];
      for (let i = 0; i < faltamNoPg.length; i += 100) {
        const { data, error } = await consultaEventos()
          .in("id", faltamNoPg.slice(i, i + 100))
          .overrideTypes<EventoAgendaRelatorio[], { merge: false }>();
        if (error || !data) throw new Error("Não foi possível conferir o histórico sincronizado.");
        lista.push(...data);
      }
      return lista;
    })(),
  ]);

  const agendas = consolidarDadosAgenda(agendasDrive, agendasPg);
  const eventos = consolidarDadosAgenda([...eventosDrive, ...versoesDrive].map(converterDrive), [
    ...eventosPg,
    ...versoesPg,
  ]);
  return codigo === "08"
    ? relatorioOcupacaoAgenda(agendas, eventos, periodo)
    : relatorioDesfechosAgenda(agendas, eventos, periodo);
}
