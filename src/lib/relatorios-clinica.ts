import { dataBR, diaNoFuso, type DadosRelatorio } from "./relatorios";

type Periodo = { inicio: string; fim: string };
export type ConsultaRelatorio = {
  id: string;
  data: string;
  autor_id?: string | null;
  autor_crmv?: string | null;
  queixa?: string | null;
  conduta?: string | null;
  retorno_em?: string | null;
};
export type RetornoRelatorio = {
  id: string;
  origem: string;
  data_prevista: string | null;
  status: string;
  realizado_em: string | null;
  created_at: string;
};
type RegistroClinico = {
  id: string;
  data: string;
  subtipo: "Consulta" | "Cirurgia / Procedimentos" | "Não identificado";
  status: "concluido" | "adendo" | "rascunho" | "não identificado";
  temAutor: boolean;
  temCrmv: boolean;
  temTitulo: boolean;
  temDetalhe: boolean;
};
type RegistroInternacao = { id: string; dia: string | null; baia: string | null; obito: boolean };

const idValido = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const naoMedido = "Não registrado no fluxo atual";
const objeto = (dado: unknown): Record<string, unknown> =>
  dado !== null && typeof dado === "object" && !Array.isArray(dado)
    ? (dado as Record<string, unknown>)
    : {};
const texto = (dado: unknown) => (typeof dado === "string" ? dado.trim() : "");
const diaCalendario = (dado: unknown) => {
  if (typeof dado !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dado)) return null;
  const ms = Date.parse(dado + "T00:00:00Z");
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === dado ? dado : null;
};
const diaInstante = (dado: unknown) =>
  typeof dado === "string" && /^\d{4}-\d{2}-\d{2}T/.test(dado) && Number.isFinite(Date.parse(dado))
    ? diaNoFuso(dado)
    : null;
const dentro = (dado: string | null, p: Periodo): dado is string =>
  Boolean(dado && dado >= p.inicio && dado <= p.fim);
const rotular = (r: string) => r.replaceAll("_", " ");
const incrementar = (mapa: Map<string, number>, chave: string) =>
  mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
const ordenados = <T>(mapa: Map<string, T>) =>
  [...mapa].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));

export function projetarProntuario(lista: unknown[], clinicaId: string): RegistroClinico[] {
  const registros = new Map<string, RegistroClinico>();
  for (const item of lista) {
    const r = objeto(item);
    const id = texto(r.id);
    const data = diaCalendario(r.data);
    // O estado é da clínica; registros antigos podem ainda trazer um escopo próprio.
    // Na falta dele, não assumir que a entrada antiga pertence à clínica selecionada.
    if (
      !idValido.test(id) ||
      !data ||
      !texto(r.animalId) ||
      r.clinicaId !== clinicaId ||
      registros.has(id)
    )
      continue;
    registros.set(id, {
      id,
      data,
      subtipo:
        r.subtipo === "Consulta" || r.subtipo === "Cirurgia / Procedimentos"
          ? r.subtipo
          : "Não identificado",
      status:
        r.status === "concluido" || r.status === "adendo" || r.status === "rascunho"
          ? r.status
          : "não identificado",
      temAutor: Boolean(texto(r.autorId)),
      temCrmv: Boolean(texto(r.autorCrmv)),
      temTitulo: Boolean(texto(r.titulo)),
      temDetalhe: Boolean(texto(r.detalhe)),
    });
  }
  return [...registros.values()];
}

export function projetarInternacao(lista: unknown[], clinicaId: string): RegistroInternacao[] {
  const registros = new Map<string, RegistroInternacao>();
  for (const item of lista) {
    const r = objeto(item);
    const id = texto(r.id);
    if (
      !id ||
      !texto(r.animal) ||
      (r.clinicaId != null && r.clinicaId !== clinicaId) ||
      registros.has(id)
    )
      continue;
    const baia = texto(r.baia);
    registros.set(id, {
      id,
      dia: diaInstante(r.criadoEm),
      baia: baia || null,
      obito: Boolean(texto(objeto(r.obito).hora)),
    });
  }
  return [...registros.values()];
}

export function relatorioConsultasProcedimentos(
  consultas: ConsultaRelatorio[],
  prontuario: RegistroClinico[],
  retornos: RetornoRelatorio[],
  periodo: Periodo,
): DadosRelatorio {
  const consultasNoPeriodo = consultas.filter((r) => dentro(r.data, periodo));
  const consultasIds = new Set(consultasNoPeriodo.map((r) => r.id));
  const procedimentos = prontuario.filter(
    (r) =>
      r.subtipo === "Cirurgia / Procedimentos" &&
      r.status === "concluido" &&
      dentro(r.data, periodo) &&
      !consultasIds.has(r.id),
  );

  const atividade = new Map<
    string,
    { consultas: number; procedimentos: number; previstos: number; realizados: number }
  >();
  function dia(data: string) {
    const atual = atividade.get(data) ?? {
      consultas: 0,
      procedimentos: 0,
      previstos: 0,
      realizados: 0,
    };
    atividade.set(data, atual);
    return atual;
  }
  for (const r of consultasNoPeriodo) dia(r.data).consultas++;
  for (const r of procedimentos) dia(r.data).procedimentos++;

  const porOrigem = new Map<string, { previstos: number; realizados: number; aMarcar: number }>();
  const porStatus = new Map<string, number>();
  let previstos = 0;
  let realizados = 0;
  let aMarcar = 0;
  for (const r of retornos) {
    const diaPrevisto = diaCalendario(r.data_prevista);
    const concluido = r.status === "realizado" && dentro(diaInstante(r.realizado_em), periodo);
    const noPeriodo = dentro(diaPrevisto, periodo);
    const semData =
      !r.data_prevista &&
      !["realizado", "cancelado"].includes(r.status) &&
      dentro(diaInstante(r.created_at), periodo);
    if (!concluido && !noPeriodo && !semData) continue;
    const origem =
      {
        consulta: "Consulta",
        cirurgia: "Cirurgia",
        vacina: "Vacina",
        vermifugo: "Vermífugo",
        exame: "Exame",
        medicacao: "Medicação",
        manual: "Manual",
      }[r.origem] ?? "Outro";
    const grupo = porOrigem.get(origem) ?? { previstos: 0, realizados: 0, aMarcar: 0 };
    if (noPeriodo) {
      grupo.previstos++;
      previstos++;
      dia(diaPrevisto).previstos++;
      incrementar(porStatus, r.status);
    }
    if (concluido) {
      grupo.realizados++;
      realizados++;
      const diaRealizacao = diaInstante(r.realizado_em);
      if (diaRealizacao) dia(diaRealizacao).realizados++;
    }
    if (semData) {
      grupo.aMarcar++;
      aMarcar++;
    }
    porOrigem.set(origem, grupo);
  }

  return {
    indicadores: [
      { rotulo: "Consultas finalizadas", valor: consultasNoPeriodo.length },
      { rotulo: "Cirurgias e procedimentos concluídos", valor: procedimentos.length },
      {
        rotulo: "Consultas com data de retorno indicada",
        valor: consultasNoPeriodo.filter((r) => diaCalendario(r.retorno_em)).length,
      },
      { rotulo: "Retornos com data prevista no período", valor: previstos },
      { rotulo: "Retornos realizados no período", valor: realizados },
      { rotulo: "Retornos sem data, criados no período e ainda abertos", valor: aMarcar },
    ],
    notas: [
      "Consultas e procedimentos seguem a data clínica. Consultas vêm do fluxo de conclusão e procedimentos dos prontuários com tipo e conclusão explícitos.",
      "A previsão usa a data atualmente registrada no CRM e inclui retornos posteriormente cancelados; a realização usa a data registrada e exige status realizado. As duas contagens não são uma taxa de conversão.",
      "Uma data indicada no prontuário não comprova inscrição no CRM nem comparecimento.",
    ],
    tabelas: [
      {
        titulo: "Atividade por data",
        colunas: [
          "Data",
          "Consultas",
          "Procedimentos",
          "Retornos previstos",
          "Retornos realizados",
        ],
        linhas: ordenados(atividade).map(([data, r]) => [
          dataBR(data),
          r.consultas,
          r.procedimentos,
          r.previstos,
          r.realizados,
        ]),
      },
      {
        titulo: "Retornos por origem",
        colunas: ["Origem", "Previstos", "Realizados", "A marcar"],
        linhas: ordenados(porOrigem).map(([origem, r]) => [
          origem,
          r.previstos,
          r.realizados,
          r.aMarcar,
        ]),
      },
      {
        titulo: "Status atual dos retornos com data prevista no período",
        colunas: ["Status", "Retornos"],
        linhas: ordenados(porStatus).map(([status, total]) => [
          status === "a_confirmar" ? "A confirmar" : rotular(status),
          total,
        ]),
      },
    ],
  };
}

export function relatorioProntuarios(
  consultas: ConsultaRelatorio[],
  prontuario: RegistroClinico[],
  periodo: Periodo,
): DadosRelatorio {
  const pg = consultas.filter((r) => dentro(r.data, periodo));
  const idsCanonicos = new Set(pg.map((r) => r.id));
  const legado = prontuario.filter((r) => dentro(r.data, periodo) && !idsCanonicos.has(r.id));
  const adendos = legado.filter((r) => r.status === "adendo");
  const rascunhos = legado.filter((r) => r.status === "rascunho");
  const concluidos = legado.filter((r) => r.status === "concluido");
  const ocorrencias = [
    ...pg.map((r) => ({
      id: r.id,
      dia: r.data,
      tipo: "Consulta",
      sinais: [
        !texto(r.autor_id) && "Autor não identificado",
        !texto(r.autor_crmv) && "CRMV não informado",
        !texto(r.queixa) && "Queixa não informada",
        !texto(r.conduta) && "Conduta não informada",
      ],
    })),
    ...concluidos.map((r) => ({
      id: r.id,
      dia: r.data,
      tipo: r.subtipo,
      sinais: [
        !r.temAutor && "Autor não identificado",
        !r.temCrmv && "CRMV não informado",
        !r.temTitulo && "Título não informado",
        !r.temDetalhe && "Detalhe não informado",
      ],
    })),
  ].map((r) => ({ ...r, sinais: r.sinais.filter((s): s is string => typeof s === "string") }));
  const pendentes = ocorrencias.filter((r) => r.sinais.length > 0);
  const porSinal = new Map<string, number>();
  for (const r of pendentes) for (const s of r.sinais) incrementar(porSinal, s);

  return {
    indicadores: [
      { rotulo: "Registros concluídos avaliados", valor: ocorrencias.length },
      { rotulo: "Registros com campos a revisar", valor: pendentes.length },
      { rotulo: "Rascunhos com data no prontuário", valor: rascunhos.length },
      { rotulo: "Adendos sinalizados no prontuário", valor: adendos.length },
      { rotulo: "Solicitações de cópia de prontuário", valor: naoMedido },
    ],
    notas: [
      "Triagem de preenchimento, sem avaliação de conteúdo ou conclusão sobre conformidade. Um registro pode ter mais de um campo a revisar.",
      "Só entram registros concluídos identificáveis. Rascunhos de consulta sem data própria não entram; adendos são apenas registros com marcação explícita, não um histórico integral de retificações.",
      "O cadastro genérico de pedidos de acesso a dados não identifica especificamente solicitações de cópia de prontuário. Elas não são contabilizadas por aproximação.",
      ...(pendentes.length > 500
        ? [
            "A lista detalhada mostra os 500 registros mais recentes; os totais incluem todos os registros da seleção.",
          ]
        : []),
    ],
    tabelas: [
      {
        titulo: "Campos a revisar",
        colunas: ["Campo", "Registros"],
        linhas: ordenados(porSinal),
      },
      {
        titulo: "Registros concluídos a revisar",
        colunas: ["Data clínica", "Tipo", "ID do registro", "Campos"],
        linhas: pendentes
          .sort((a, b) => b.dia.localeCompare(a.dia) || a.id.localeCompare(b.id))
          .slice(0, 500)
          .map((r) => [dataBR(r.dia), r.tipo, r.id, r.sinais.join("; ")]),
      },
      {
        titulo: "Adendos e rascunhos com data",
        colunas: ["Data clínica", "Tipo", "ID do registro", "Situação"],
        linhas: [...adendos, ...rascunhos]
          .sort((a, b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id))
          .slice(0, 500)
          .map((r) => [
            dataBR(r.data),
            r.subtipo,
            r.id,
            r.status === "adendo" ? "Adendo" : "Rascunho",
          ]),
      },
    ],
  };
}

function diasEntre(inicio: string, fim: string) {
  return Math.floor((Date.parse(fim) - Date.parse(inicio)) / 86400000);
}

export function relatorioInternacao(
  registros: RegistroInternacao[],
  periodo: Periodo,
  hoje: string,
): DadosRelatorio {
  const atuais = registros.filter((r) => !r.obito);
  const baias = new Set(atuais.flatMap((r) => (r.baia ? [r.baia.toLocaleLowerCase("pt-BR")] : [])));
  const registrosNoPeriodo = registros.filter((r) => dentro(r.dia, periodo));
  const porData = new Map<string, number>();
  for (const r of registrosNoPeriodo) if (r.dia) incrementar(porData, r.dia);
  const faixas = {
    "0 a 1 dia": 0,
    "2 a 3 dias": 0,
    "4 a 7 dias": 0,
    "8 dias ou mais": 0,
    "Sem data válida": 0,
  };
  for (const r of atuais) {
    const dias = r.dia ? diasEntre(r.dia, hoje) : -1;
    faixas[
      dias < 0
        ? "Sem data válida"
        : dias < 2
          ? "0 a 1 dia"
          : dias < 4
            ? "2 a 3 dias"
            : dias < 8
              ? "4 a 7 dias"
              : "8 dias ou mais"
    ]++;
  }
  return {
    indicadores: [
      { rotulo: "Fichas sem óbito marcado no painel atual", valor: atuais.length },
      { rotulo: "Baias distintas nas fichas atuais", valor: baias.size },
      {
        rotulo: "Óbitos marcados no painel atual (sem data de saída)",
        valor: registros.length - atuais.length,
      },
      { rotulo: "Fichas ainda no painel, criadas no período", valor: registrosNoPeriodo.length },
      { rotulo: "Taxa de ocupação e permanência hospitalar", valor: naoMedido },
      { rotulo: "Altas e outros desfechos no período", valor: naoMedido },
    ],
    notas: [
      `Retrato do painel em ${dataBR(hoje)}, mesmo quando o período selecionado for anterior. Baia informada não comprova capacidade instalada nem ocupação física.`,
      "A idade da ficha conta dias corridos desde a criação do registro, não desde uma admissão validada. As fichas removidas não fazem parte deste painel.",
      "O fluxo não registra capacidade, eventos de admissão/alta, nem a data completa do óbito. Não é possível reconstruir ocupação, permanência, altas ou óbitos históricos a partir dessas fichas.",
    ],
    tabelas: [
      {
        titulo: "Idade das fichas atuais sem óbito marcado",
        colunas: ["Desde a criação da ficha", "Fichas"],
        linhas: Object.entries(faixas),
      },
      {
        titulo: "Fichas criadas no período e ainda presentes no painel",
        colunas: ["Data de criação", "Fichas"],
        linhas: ordenados(porData).map(([data, total]) => [dataBR(data), total]),
      },
    ],
  };
}
