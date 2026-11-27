import { dataBR, FUSO_RELATORIOS, somarDias, type DadosRelatorio } from "./relatorios.ts";

export type PeriodoPrevencao = { inicio: string; fim: string };
export type ConsultaPrevencao = { data: string; campo: string | null };
export type ExamePrevencao = { tipo: string; drive_arquivo_id: string | null };
export type VacinaPrevencao = {
  animal_id: string;
  nome: string;
  aplicada_em: string | null;
  reforco_em: string | null;
};

type Aplicacao = { medicamento: string; dia: string };
type Grupos = Map<string, { rotulo: string; total: number }>;
const calendarioClinico = new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO_RELATORIOS });

function obj(valor: unknown): Record<string, unknown> | undefined {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : undefined;
}

function nome(valor: unknown, padrao = "") {
  return typeof valor === "string"
    ? valor.trim().replace(/\s+/g, " ").slice(0, 120) || padrao
    : padrao;
}

function porNome(grupos: Grupos, rotulo: string) {
  const chave = rotulo.toLocaleLowerCase("pt-BR");
  const anterior = grupos.get(chave);
  grupos.set(chave, anterior ? { ...anterior, total: anterior.total + 1 } : { rotulo, total: 1 });
}

function linhasGrupos(grupos: Grupos) {
  return [...grupos.values()]
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, "pt-BR"))
    .map(({ rotulo, total }) => [rotulo, total]);
}

function entre(dia: string | null, { inicio, fim }: PeriodoPrevencao) {
  return !!dia && dia >= inicio && dia <= fim;
}

function consultasComCampo(consultas: ConsultaPrevencao[], periodo: PeriodoPrevencao) {
  return consultas.filter((consulta) => entre(consulta.data, periodo) && !!consulta.campo?.trim());
}

function porDia(registros: { data: string }[]) {
  const grupos = new Map<string, number>();
  for (const { data } of registros) grupos.set(data, (grupos.get(data) ?? 0) + 1);
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, total]) => [dataBR(dia), total]);
}

/** Extrai somente registros de aplicação explícitos, nunca infere dose perdida a partir de um horário. */
export function extrairAplicacoesPrevencao(bruto: unknown): Aplicacao[] {
  if (bruto == null) return [];
  if (typeof bruto !== "string") throw new Error("Formato inválido dos registros de medicação.");
  let registros: unknown;
  try {
    registros = JSON.parse(bruto);
  } catch {
    throw new Error("Não foi possível ler os registros de medicação.");
  }
  if (!Array.isArray(registros)) throw new Error("Formato inválido dos registros de medicação.");

  const aplicacoes: Aplicacao[] = [];
  for (const registro of registros) {
    const medicacoes = obj(registro)?.medicacoes;
    if (!Array.isArray(medicacoes)) continue;
    for (const medicacao of medicacoes) {
      const linha = obj(medicacao);
      const horario = linha?.aplicadoEm;
      if (
        typeof horario !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/i.test(horario) ||
        !Number.isFinite(Date.parse(horario))
      )
        continue;
      const medicamento = [nome(linha?.nomeMenor), nome(linha?.nome)].filter(Boolean).join(" ");
      aplicacoes.push({
        medicamento: medicamento || "Medicação não identificada",
        dia: calendarioClinico.format(new Date(horario)),
      });
    }
  }
  return aplicacoes;
}

export function montarRelatorioMedicacoes(
  consultas: ConsultaPrevencao[],
  aplicacoes: Aplicacao[],
  periodo: PeriodoPrevencao,
): DadosRelatorio {
  const comPrescricao = consultasComCampo(consultas, periodo);
  const ministradas = aplicacoes.filter(({ dia }) => entre(dia, periodo));
  const porMedicamento: Grupos = new Map();
  for (const { medicamento } of ministradas) porNome(porMedicamento, medicamento);
  return {
    indicadores: [
      { rotulo: "Consultas com medicação ou receita indicada", valor: comPrescricao.length },
      { rotulo: "Administrações registradas na internação", valor: ministradas.length },
      { rotulo: "Doses atrasadas", valor: "Sem rastreio" },
      { rotulo: "Doses não realizadas", valor: "Sem rastreio" },
    ],
    notas: [
      "A prescrição é um campo livre do atendimento finalizado: a contagem é por consulta, não por medicamento nem por documento emitido.",
      "A administração conta cada aplicação confirmada com data e hora na ficha de internação. Não inclui uso externo, fichas removidas ou doses não registradas.",
      "Sem vínculo entre dose programada e aplicação ou registro explícito de não realização, não é possível apurar atraso ou omissão.",
    ],
    tabelas: [
      {
        titulo: "Indicações em consultas, por dia",
        colunas: ["Data", "Consultas"],
        linhas: porDia(comPrescricao),
      },
      {
        titulo: "Administrações por medicamento",
        colunas: ["Medicamento", "Administrações"],
        linhas: linhasGrupos(porMedicamento),
      },
    ],
  };
}

export function montarRelatorioExames(
  consultas: ConsultaPrevencao[],
  exames: ExamePrevencao[],
  periodo: PeriodoPrevencao,
): DadosRelatorio {
  const solicitados = consultasComCampo(consultas, periodo);
  const comPdf = exames.filter((exame) => !!exame.drive_arquivo_id);
  const porTipo: Grupos = new Map();
  for (const exame of exames) porNome(porTipo, nome(exame.tipo, "Exame"));
  return {
    indicadores: [
      { rotulo: "Consultas com pedido de exame", valor: solicitados.length },
      { rotulo: "Exames cadastrados na ficha", valor: exames.length },
      { rotulo: "Exames sem PDF na ficha", valor: exames.length - comPdf.length },
      { rotulo: "Laudos pendentes", valor: "Sem rastreio" },
      { rotulo: "Tempo de entrega do laudo", valor: "Sem rastreio" },
    ],
    notas: [
      "A solicitação é um campo livre da consulta finalizada. A contagem é por consulta com pedido, não por exame individual.",
      "Exames cadastrados contam pela data de inclusão na ficha do animal. Ausência de PDF não significa laudo pendente: a ficha pode conter um resultado em texto ou não exigir arquivo.",
      "Não há, nesta fonte, vínculo de pedido com laudo, status de entrega ou data de recebimento para calcular pendências e prazos.",
    ],
    tabelas: [
      {
        titulo: "Pedidos em consultas, por dia",
        colunas: ["Data", "Consultas"],
        linhas: porDia(solicitados),
      },
      {
        titulo: "Exames cadastrados por tipo",
        colunas: ["Tipo", "Cadastros"],
        linhas: linhasGrupos(porTipo),
      },
    ],
  };
}

export function montarRelatorioVacinas(
  historico: VacinaPrevencao[],
  periodo: PeriodoPrevencao,
  hoje: string,
): DadosRelatorio {
  const aplicadas = historico.filter(
    (v) => entre(v.aplicada_em, periodo) && v.aplicada_em! <= hoje,
  );
  const aplicadasPorNome: Grupos = new Map();
  for (const vacina of aplicadas)
    porNome(aplicadasPorNome, nome(vacina.nome, "Vacina não identificada"));

  const atuais = new Map<string, VacinaPrevencao>();
  for (const vacina of historico) {
    if (vacina.aplicada_em && vacina.aplicada_em > hoje) continue;
    const chave = JSON.stringify([
      vacina.animal_id,
      vacina.nome.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR"),
    ]);
    const anterior = atuais.get(chave);
    if (
      !anterior ||
      (vacina.aplicada_em ?? "") > (anterior.aplicada_em ?? "") ||
      (vacina.aplicada_em === anterior.aplicada_em &&
        (vacina.reforco_em ?? "") > (anterior.reforco_em ?? ""))
    ) {
      atuais.set(chave, vacina);
    }
  }

  const horizonte = somarDias(hoje, 30);
  const reforcos = [...atuais.values()].filter((v) => !!v.reforco_em);
  const vencidos = reforcos.filter((v) => v.reforco_em! < hoje);
  const proximos = reforcos.filter((v) => v.reforco_em! >= hoje && v.reforco_em! <= horizonte);
  const vencidasPorNome: Grupos = new Map();
  for (const vacina of vencidos)
    porNome(vencidasPorNome, nome(vacina.nome, "Vacina não identificada"));
  const agenda = new Map<string, Grupos>();
  for (const vacina of proximos) {
    const dia = vacina.reforco_em!;
    const grupo = agenda.get(dia) ?? new Map();
    porNome(grupo, nome(vacina.nome, "Vacina não identificada"));
    agenda.set(dia, grupo);
  }
  return {
    indicadores: [
      { rotulo: "Aplicações registradas no período", valor: aplicadas.length },
      { rotulo: "Reforços vencidos", valor: vencidos.length },
      { rotulo: "Próximas doses (hoje a +30 dias)", valor: proximos.length },
      { rotulo: "Registros atuais sem data de reforço", valor: atuais.size - reforcos.length },
    ],
    notas: [
      `Aplicações seguem o período selecionado. Vencimentos e próximas doses mostram a situação atual em ${dataBR(hoje)}, inclusive o dia de hoje e com fim em ${dataBR(horizonte)}.`,
      "Para cada animal e nome de vacina, o vencimento considera o registro mais recente pela data de aplicação, sem repetir doses substituídas. Variações no nome podem aparecer separadas.",
      "Sem data de reforço, o registro não é classificado como vencido. A data de reforço não é a validade do lote.",
    ],
    tabelas: [
      {
        titulo: "Aplicações por vacina",
        colunas: ["Vacina", "Aplicações"],
        linhas: linhasGrupos(aplicadasPorNome),
      },
      {
        titulo: "Reforços vencidos por vacina",
        colunas: ["Vacina", "Reforços"],
        linhas: linhasGrupos(vencidasPorNome),
      },
      {
        titulo: "Próximos reforços por data",
        colunas: ["Data", "Vacina", "Reforços"],
        linhas: [...agenda.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .flatMap(([dia, grupo]) => linhasGrupos(grupo).map((linha) => [dataBR(dia), ...linha])),
      },
    ],
  };
}
