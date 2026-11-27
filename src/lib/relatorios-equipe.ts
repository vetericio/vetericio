import { dataBR, diaNoFuso, moeda, type DadosRelatorio } from "./relatorios.ts";

export type PeriodoEquipe = { inicio: string; fim: string };
export type ConsultaEquipe = { autor_id: string | null; autor_nome: string | null };
export type ComissaoEquipe = { data: string; valor: number | string };
export type JornadaEquipe = {
  funcionario_id: string;
  data: string;
  modalidade: string;
  estado: string;
  segundos_trabalhados: number | string;
};
type Obj = Record<string, unknown>;
const objeto = (v: unknown): Obj | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const emPeriodo = (dia: string, { inicio, fim }: PeriodoEquipe) =>
  /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia >= inicio && dia <= fim;
const duracao = (s: number) =>
  `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}min`;
const porData = <T>(mapa: Map<string, T>) =>
  [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b));

export function relatorioProdutividadeEquipe(
  consultas: ConsultaEquipe[],
  comissoes: ComissaoEquipe[] | null,
): DadosRelatorio {
  const autores = new Map<string, { nome: string; consultas: number }>();
  let semAutor = 0;
  for (const consulta of consultas) {
    const id = texto(consulta.autor_id);
    if (!id) {
      semAutor++;
      continue;
    }
    const nome = texto(consulta.autor_nome);
    // Um registro legado pode usar o e-mail no campo de exibição.
    const legivel = !nome.includes("@") && nome.length <= 160 ? nome : "";
    const autor = autores.get(id) ?? { nome: "", consultas: 0 };
    if (legivel && !autor.nome) autor.nome = legivel;
    autor.consultas++;
    autores.set(id, autor);
  }
  const dados: DadosRelatorio = {
    indicadores: [
      { rotulo: "Consultas registradas", valor: consultas.length },
      { rotulo: "Autores identificados", valor: autores.size },
      { rotulo: "Escala de equipe", valor: "Não rastreada" },
    ],
    notas: [
      "Produção mede consultas gravadas pelo fluxo do consultório, pelo autor registrado. Não mede tempo, qualidade, produtividade por hora ou autoria compartilhada.",
      "Não há uma escala de pessoal registrada nessa fonte. A grade de agendamento não comprova escala cumprida.",
    ],
    tabelas: [
      {
        titulo: "Consultas por autor",
        colunas: ["Profissional", "Consultas"],
        linhas: [
          ...porData(autores)
            .map(([, a], i): [string, number] => [a.nome || `Profissional ${i + 1}`, a.consultas])
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")),
          ...(semAutor ? [["Sem autor registrado", semAutor]] : []),
        ],
      },
    ],
  };
  if (comissoes === null) return dados;

  const porDia = new Map<string, { quantidade: number; centavos: number | null }>();
  let total: number | null = 0;
  for (const c of comissoes) {
    const valores = porDia.get(c.data) ?? { quantidade: 0, centavos: 0 };
    const n = typeof c.valor === "string" ? (c.valor.trim() ? Number(c.valor) : NaN) : c.valor;
    const centavos = Number.isFinite(n) ? Math.round(n * 100) : NaN;
    if (!Number.isSafeInteger(centavos)) {
      valores.centavos = null;
      total = null;
    } else {
      if (valores.centavos !== null) valores.centavos += centavos;
      if (total !== null) total += centavos;
    }
    valores.quantidade++;
    porDia.set(c.data, valores);
  }
  dados.indicadores.push(
    { rotulo: "Comissões lançadas", valor: comissoes.length },
    { rotulo: "Valor das comissões lançadas", valor: moeda(total) },
  );
  dados.notas.push(
    "Comissões são os lançamentos manuais da seção Jornada, agrupados pela data do lançamento. Não calculam remuneração, regras de comissão, valores a pagar ou pagamentos efetuados.",
  );
  if (total === null)
    dados.notas.push("Há lançamento sem valor válido; o subtotal atingido não é estimado.");
  dados.tabelas.push({
    titulo: "Comissões registradas por data",
    colunas: ["Data", "Lançamentos", "Valor lançado"],
    linhas: porData(porDia).map(([dia, v]) => [dataBR(dia), v.quantidade, moeda(v.centavos)]),
  });
  return dados;
}

type SumarioJornada = {
  encerradas: number;
  ativas: number;
  pausadas: number;
  diarias: number;
  segundos: number;
  faltantes: number;
  outros: number;
};
function totalJornada(): SumarioJornada {
  return {
    encerradas: 0,
    ativas: 0,
    pausadas: 0,
    diarias: 0,
    segundos: 0,
    faltantes: 0,
    outros: 0,
  };
}
function somarJornada(t: SumarioJornada, j: JornadaEquipe) {
  if (j.modalidade === "diaria" && j.estado === "diaria") {
    t.diarias++;
    return;
  }
  if (j.modalidade !== "hora") {
    t.outros++;
    return;
  }
  if (j.estado === "ativa") t.ativas++;
  else if (j.estado === "pausada") t.pausadas++;
  else if (j.estado === "finalizada") t.encerradas++;
  else {
    t.outros++;
    return;
  }
  const segundos =
    typeof j.segundos_trabalhados === "string" && !j.segundos_trabalhados.trim()
      ? NaN
      : Number(j.segundos_trabalhados);
  if (j.segundos_trabalhados == null || !Number.isSafeInteger(segundos) || segundos < 0)
    t.faltantes++;
  else t.segundos += segundos;
}

export function relatorioJornadaEquipe(
  jornadas: JornadaEquipe[],
  periodo: PeriodoEquipe,
): DadosRelatorio {
  const total = totalJornada();
  const dias = new Map<string, SumarioJornada>();
  const pessoas = new Set<string>();
  for (const j of jornadas) {
    if (!emPeriodo(j.data, periodo)) continue;
    if (j.funcionario_id) pessoas.add(j.funcionario_id);
    const dia = dias.get(j.data) ?? totalJornada();
    somarJornada(total, j);
    somarJornada(dia, j);
    dias.set(j.data, dia);
  }
  return {
    indicadores: [
      { rotulo: "Pessoas com registros", valor: pessoas.size },
      {
        rotulo: "Tempo consolidado no ponto",
        valor: total.faltantes ? "Parcial" : duracao(total.segundos),
      },
      { rotulo: "Check-ins de diária", valor: total.diarias },
      { rotulo: "Jornadas abertas", valor: total.ativas + total.pausadas },
      { rotulo: "Saldo de banco de horas", valor: "Não rastreado" },
    ],
    notas: [
      "Horas e diárias são exibidas separadamente. Cada jornada entra pela sua data de início; o sistema não separa as horas à meia-noite.",
      "O tempo mostra somente segundos já gravados. Trechos em andamento ainda não consolidados, intervalos individuais, metas e compensações não são estimados.",
      "O ORICSE mantém registros de jornada, mas não registra meta contratual e créditos/débitos trabalhistas suficientes para calcular um saldo de banco de horas.",
      ...(total.faltantes
        ? [
            `${total.faltantes} registro(s) não têm duração utilizável; os totais de tempo por dia estão sinalizados.`,
          ]
        : []),
    ],
    tabelas: [
      {
        titulo: "Ponto por dia de início",
        colunas: [
          "Data",
          "Horas consolidadas",
          "Encerradas",
          "Ativas",
          "Pausadas",
          "Diárias",
          "Outros registros",
        ],
        linhas: porData(dias).map(([dia, t]) => [
          dataBR(dia),
          `${duracao(t.segundos)}${t.faltantes ? " (parcial)" : ""}`,
          t.encerradas,
          t.ativas,
          t.pausadas,
          t.diarias,
          t.outros,
        ]),
      },
    ],
  };
}

type FontesPlantao = {
  historico: unknown[] | null;
  atual: unknown | null;
  pendencias: unknown[] | null;
};

export function relatorioPlantaoEquipe(
  { historico, atual, pendencias }: FontesPlantao,
  periodo: PeriodoEquipe,
): DadosRelatorio {
  const dias = new Map<
    string,
    {
      total: number;
      diurno: number;
      noturno: number;
      outros: number;
      registros: number;
      comAnamnese: number;
      comAtencao: number;
      pendentes: number;
      semFoto: number;
    }
  >();
  let plantoes = 0;
  let passagens = 0;
  let semFoto = 0;
  let registros = 0;
  for (const raw of historico ?? []) {
    const p = objeto(raw);
    const data = texto(p?.data);
    if (!p || !emPeriodo(data, periodo)) continue;
    const v = dias.get(data) ?? {
      total: 0,
      diurno: 0,
      noturno: 0,
      outros: 0,
      registros: 0,
      comAnamnese: 0,
      comAtencao: 0,
      pendentes: 0,
      semFoto: 0,
    };
    v.total++;
    plantoes++;
    if (p.turno === "diurno") v.diurno++;
    else if (p.turno === "noturno") v.noturno++;
    else v.outros++;
    const nRegistros = array(p.registros).filter((r) => objeto(r)).length;
    v.registros += nRegistros;
    registros += nRegistros;
    if (Array.isArray(p.anamneses)) {
      if (p.anamneses.length) v.comAnamnese++;
      const nota = p.anamneses.some((a) => texto(objeto(a)?.atencao));
      if (nota) {
        passagens++;
        v.comAtencao++;
      }
      for (const a of p.anamneses) {
        v.pendentes += array(objeto(a)?.pendencias).filter(
          (pe) => objeto(pe)?.feito === false,
        ).length;
      }
    } else {
      v.semFoto++;
      semFoto++;
    }
    dias.set(data, v);
  }
  const a = objeto(atual);
  const ativoNoPeriodo =
    a &&
    !a.finalizadoEm &&
    emPeriodo(texto(a.dia), periodo) &&
    (a.turno === "diurno" || a.turno === "noturno");
  const status = { pendente: 0, realizado: 0, cancelado: 0, outro: 0 };
  for (const raw of pendencias ?? []) {
    const p = objeto(raw);
    const data = texto(p?.criadoEm);
    if (!data || !Number.isFinite(Date.parse(data)) || !emPeriodo(diaNoFuso(data), periodo))
      continue;
    const tipo = p?.status;
    if (tipo === "pendente" || tipo === "realizado" || tipo === "cancelado") status[tipo]++;
    else status.outro++;
  }
  const ausente = "Sem histórico disponível";
  return {
    indicadores: [
      { rotulo: "Plantões no histórico", valor: historico === null ? ausente : plantoes },
      { rotulo: "Registros clínicos arquivados", valor: historico === null ? ausente : registros },
      {
        rotulo: "Plantões com alerta para a passagem",
        valor:
          historico === null || (plantoes > 0 && semFoto === plantoes)
            ? ausente
            : semFoto
              ? `${passagens} (parcial)`
              : passagens,
      },
      { rotulo: "Passagens confirmadas", valor: "Não rastreadas" },
      {
        rotulo: "Pendências abertas hoje (criadas no período)",
        valor: pendencias === null ? "Sem registro disponível" : status.pendente,
      },
    ],
    notas: [
      "O histórico conta os plantões arquivados, incluindo importações. Plantões finalizados sem registros clínicos não geram um arquivo nesse fluxo.",
      "O alerta de passagem é o campo de atenção da anamnese arquivada. Não confirma envio, leitura ou aceite pela equipe seguinte.",
      "Pendências do arquivo são a fotografia da anamnese no plantão. O quadro de pendências atuais considera itens ainda existentes, pela data de criação, sem reconstruir mudanças ou exclusões.",
      ...(ativoNoPeriodo
        ? [`Plantão atual: ${a.turno} de ${dataBR(texto(a.dia))}, ainda não arquivado.`]
        : []),
    ],
    tabelas: [
      {
        titulo: "Arquivos de plantão por data",
        colunas: [
          "Data",
          "Registros de plantão",
          "Diurnos",
          "Noturnos",
          "Turno não informado",
          "Registros clínicos",
          "Com anamnese",
          "Com alerta de passagem",
          "Pendências marcadas abertas no arquivo",
          "Sem foto da anamnese",
        ],
        linhas: porData(dias).map(([dia, v]) => [
          dataBR(dia),
          v.total,
          v.diurno,
          v.noturno,
          v.outros,
          v.registros,
          ...[v.comAnamnese, v.comAtencao, v.pendentes].map((n) =>
            v.semFoto === v.total ? "—" : v.semFoto ? `${n} (parcial)` : n,
          ),
          v.semFoto,
        ]),
      },
      {
        titulo: "Estado atual das pendências criadas no período",
        colunas: ["Abertas", "Realizadas", "Canceladas", "Outro estado"],
        linhas:
          pendencias === null
            ? []
            : [[status.pendente, status.realizado, status.cancelado, status.outro]],
      },
    ],
  };
}
