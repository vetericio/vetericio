import {
  dataBR,
  FUSO_RELATORIOS,
  moeda,
  soma,
  somarDias,
  type DadosRelatorio,
} from "./relatorios.ts";

const DIA_MS = 86_400_000;
const calendarioPet = new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO_RELATORIOS });
const diaNoFuso = (iso: string | number) => calendarioPet.format(new Date(iso));
export type PeriodoPet = { inicio: string; fim: string };
export type BanhoRegistro = {
  id: string;
  servico_nome: string;
  inicio: string;
  status: string;
  profissional: string;
  pronto_em: string | null;
  entregue_em: string | null;
};
export type EstadiaPet = {
  id: string;
  status: string;
  acomodacao_id: string | null;
  chegada_prevista: string;
  saida_prevista: string;
  checkin_em: string | null;
  checkout_em: string | null;
  valor_final_centavos?: number | null;
};
export type AcomodacaoPet = { id: string; nome: string };
export type ExtraPet = {
  categoria: string;
  quantidade?: number;
  valor_unitario_centavos?: number;
};
export type PagamentoPet = {
  registrado_em: string;
  valor_centavos: number;
  forma_pagamento: string;
  agendamento_banho_tosa_id?: string | null;
};
export type EstornoPet = { revisado_em: string; valor_centavos: number };
type FinanceiroPet = { pagamentos: PagamentoPet[]; estornos: EstornoPet[] };

// Primeiro instante dentro do dia civil, sem fixar o UTC-3 histórico.
export function inicioDiaPet(dia: string) {
  const utc = Date.parse(dia + "T00:00:00Z");
  let a = utc - DIA_MS;
  let b = utc + DIA_MS;
  while (b - a > 1) {
    const meio = Math.floor((a + b) / 2);
    if (diaNoFuso(meio) < dia) a = meio;
    else b = meio;
  }
  return b;
}

export function limitesDoPeriodoPet({ inicio, fim }: PeriodoPet) {
  return {
    inicio: new Date(inicioDiaPet(inicio)).toISOString(),
    fim: new Date(inicioDiaPet(somarDias(fim, 1))).toISOString(),
  };
}

function dataNoPeriodo(iso: string | null, periodo: PeriodoPet): boolean {
  if (!iso || !Number.isFinite(Date.parse(iso))) return false;
  const dia = diaNoFuso(iso);
  return dia >= periodo.inicio && dia <= periodo.fim;
}

const statusBanho: Record<string, string> = {
  agendado: "Agendado",
  recebido: "Recebido",
  em_execucao: "Em execução",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function somarFinanceiro(
  dados: DadosRelatorio,
  financeiro: FinanceiroPet | undefined,
  periodo: PeriodoPet,
  modulo: "banho" | "hotel",
) {
  if (!financeiro) {
    dados.notas.push("Valores e pagamentos exigem também a permissão de visualizar o Financeiro.");
    return;
  }

  const pagamentos = financeiro.pagamentos.filter((p) => dataNoPeriodo(p.registrado_em, periodo));
  const estornos = financeiro.estornos.filter((e) => dataNoPeriodo(e.revisado_em, periodo));
  const total = soma(pagamentos, (p) => p.valor_centavos);
  const estornado = soma(estornos, (e) => e.valor_centavos);
  dados.indicadores.push(
    { rotulo: "Recebimentos no caixa", valor: moeda(total) },
    { rotulo: "Estornos confirmados", valor: moeda(estornado) },
    { rotulo: "Recebimentos menos estornos", valor: moeda(total - estornado) },
  );
  dados.tabelas.push({
    titulo:
      modulo === "hotel"
        ? "Pagamentos do setor Hotelzinho no caixa"
        : "Pagamentos do setor Banho e tosa no caixa",
    colunas:
      modulo === "hotel"
        ? ["Data do recebimento", "Forma", "Valor"]
        : ["Data do recebimento", "Forma", "Valor", "Vínculo ao atendimento"],
    linhas: pagamentos.map((p) => {
      const linha = [
        dataBR(diaNoFuso(p.registrado_em)),
        p.forma_pagamento || "Não informada",
        moeda(p.valor_centavos),
      ];
      if (modulo === "banho") linha.push(p.agendamento_banho_tosa_id ? "Vinculado" : "Sem vínculo");
      return linha;
    }),
  });
  dados.notas.push(
    "Recebimentos e estornos entram pela data do caixa e da confirmação do estorno, respectivamente, independentemente da data do serviço.",
  );
  if (modulo === "hotel")
    dados.notas.push(
      "A categoria Hotelzinho do caixa não identifica a estadia. O valor apurado no check-out não confirma pagamento.",
    );
}

export function montarRelatorioBanho(
  periodo: PeriodoPet,
  registros: BanhoRegistro[],
  financeiro?: FinanceiroPet,
): DadosRelatorio {
  const agendamentos = registros.filter((r) => dataNoPeriodo(r.inicio, periodo));
  const cancelamentos = agendamentos.filter((r) => r.status === "cancelado");
  const producao = registros.filter(
    (r) =>
      (r.status === "pronto" || r.status === "entregue") &&
      dataNoPeriodo(r.pronto_em ?? r.entregue_em, periodo),
  );
  const semData = agendamentos.filter(
    (r) => (r.status === "pronto" || r.status === "entregue") && !r.pronto_em && !r.entregue_em,
  );
  const grupos = new Map<
    string,
    { servico: string; profissional: string; agendados: number; feitos: number; cancelados: number }
  >();
  function grupo(r: BanhoRegistro) {
    const servico = r.servico_nome.trim() || "Não informado";
    const profissional = r.profissional.trim() || "Não informado";
    const chave = JSON.stringify([servico, profissional]);
    const conhecido = grupos.get(chave);
    if (conhecido) return conhecido;
    const novo = { servico, profissional, agendados: 0, feitos: 0, cancelados: 0 };
    grupos.set(chave, novo);
    return novo;
  }
  for (const r of agendamentos) grupo(r).agendados++;
  for (const r of producao) grupo(r).feitos++;
  for (const r of cancelamentos) grupo(r).cancelados++;

  const dados: DadosRelatorio = {
    indicadores: [
      { rotulo: "Agendamentos previstos no período", valor: agendamentos.length },
      { rotulo: "Serviços concluídos no período", valor: producao.length },
      { rotulo: "Agendamentos cancelados", valor: cancelamentos.length },
    ],
    notas: [
      "Agendamentos e cancelamentos usam o dia previsto. O sistema registra a situação, mas não a data específica do cancelamento.",
      "Produção usa a data em que o serviço ficou pronto ou, quando ela não existe, a data da entrega registrada.",
    ],
    tabelas: [
      {
        titulo: "Produção e cancelamentos por serviço e profissional",
        colunas: ["Serviço", "Profissional", "Agendados", "Concluídos", "Cancelados"],
        linhas: [...grupos.values()]
          .sort(
            (a, b) =>
              a.servico.localeCompare(b.servico, "pt-BR") ||
              a.profissional.localeCompare(b.profissional, "pt-BR"),
          )
          .map((g) => [g.servico, g.profissional, g.agendados, g.feitos, g.cancelados]),
      },
      {
        titulo: "Agenda registrada no período",
        colunas: ["Data prevista", "Serviço", "Profissional", "Situação atual"],
        linhas: agendamentos.map((r) => [
          dataBR(diaNoFuso(r.inicio)),
          r.servico_nome,
          r.profissional || "Não informado",
          statusBanho[r.status] || "Não informada",
        ]),
      },
    ],
  };
  if (semData.length)
    dados.notas.push(
      `${semData.length} serviço(s) previsto(s) no período aparecem como prontos ou entregues sem data de conclusão; não entram na produção por data.`,
    );
  somarFinanceiro(dados, financeiro, periodo, "banho");
  return dados;
}

export function diariasFechadas(estadia: EstadiaPet) {
  const entrada = Date.parse(estadia.checkin_em || estadia.chegada_prevista);
  const saida = Date.parse(estadia.checkout_em ?? "");
  if (!Number.isFinite(entrada) || !Number.isFinite(saida) || saida < entrada) return null;
  // Mesma regra da tela de check-out do Hotelzinho. Não altera cobrança.
  return Math.max(1, Math.ceil((saida - entrada) / DIA_MS));
}

export function montarRelatorioHotel(
  periodo: PeriodoPet,
  estadias: EstadiaPet[],
  acomodacoes: AcomodacaoPet[],
  extras: ExtraPet[],
  agora: number,
  financeiro?: FinanceiroPet,
): DadosRelatorio {
  const quartos = new Map(acomodacoes.map((a) => [a.id, a.nome]));
  const dadosPorAcomodacao = new Map<string | null, { reais: number; reservas: number }>();
  const intervalos = estadias.map((e) => ({
    acomodacao: e.acomodacao_id,
    entrada: Date.parse(e.checkin_em ?? ""),
    saida: e.status === "hospedado" && !e.checkout_em ? agora : Date.parse(e.checkout_em ?? ""),
    previstoDe: Date.parse(e.chegada_prevista),
    previstoAte: Date.parse(e.saida_prevista),
    status: e.status,
  }));
  const fimExclusivo = somarDias(periodo.fim, 1);
  const linhasOcupacao: (string | number)[][] = [];
  let reaisNoPeriodo = 0;
  let reservasNoPeriodo = 0;
  for (let dia = periodo.inicio; dia < fimExclusivo; dia = somarDias(dia, 1)) {
    const inicio = inicioDiaPet(dia);
    const fim = inicioDiaPet(somarDias(dia, 1));
    let presencia = 0;
    let reservas = 0;
    for (const v of intervalos) {
      const real =
        (v.status === "hospedado" || v.status === "concluida") &&
        v.saida > v.entrada &&
        v.entrada < fim &&
        v.saida > inicio;
      const prevista =
        v.status === "reservada" &&
        v.previstoAte > v.previstoDe &&
        v.previstoDe < fim &&
        v.previstoAte > inicio;
      if (!real && !prevista) continue;
      const o = dadosPorAcomodacao.get(v.acomodacao) ?? { reais: 0, reservas: 0 };
      if (real) {
        presencia++;
        o.reais++;
      }
      if (prevista) {
        reservas++;
        o.reservas++;
      }
      dadosPorAcomodacao.set(v.acomodacao, o);
    }
    linhasOcupacao.push([dataBR(dia), presencia, reservas]);
    reaisNoPeriodo += presencia;
    reservasNoPeriodo += reservas;
  }

  const checkouts = estadias.filter(
    (e) => e.status === "concluida" && dataNoPeriodo(e.checkout_em, periodo),
  );
  const porCheckoutDia = new Map<
    string,
    { checkouts: number; diarias: number; valor: number; semValor: number }
  >();
  let diariasTotal = 0;
  let diariasSemDados = 0;
  const porCategoria = new Map<string, { registros: number; valor: number }>();
  for (const e of checkouts) {
    const dia = diaNoFuso(e.checkout_em!);
    const linha = porCheckoutDia.get(dia) ?? { checkouts: 0, diarias: 0, valor: 0, semValor: 0 };
    const diarias = diariasFechadas(e);
    linha.checkouts++;
    if (diarias === null) diariasSemDados++;
    else {
      linha.diarias += diarias;
      diariasTotal += diarias;
    }
    if (financeiro) {
      if (typeof e.valor_final_centavos === "number") linha.valor += e.valor_final_centavos;
      else linha.semValor++;
    }
    porCheckoutDia.set(dia, linha);
  }
  for (const extra of extras) {
    const categoria = extra.categoria || "Não informada";
    const grupo = porCategoria.get(categoria) ?? { registros: 0, valor: 0 };
    grupo.registros++;
    if (
      financeiro &&
      typeof extra.quantidade === "number" &&
      typeof extra.valor_unitario_centavos === "number"
    )
      grupo.valor += Math.round(extra.quantidade * extra.valor_unitario_centavos);
    porCategoria.set(categoria, grupo);
  }

  const dados: DadosRelatorio = {
    indicadores: [
      { rotulo: "Animais-dia de ocupação", valor: reaisNoPeriodo },
      { rotulo: "Animais-dia reservados sem check-in", valor: reservasNoPeriodo },
      { rotulo: "Check-outs no período", valor: checkouts.length },
      { rotulo: "Diárias dos check-outs", valor: diariasTotal },
      { rotulo: "Extras lançados no período", valor: extras.length },
    ],
    notas: [
      "Um animal-dia conta a presença em qualquer parte do dia, com check-in registrado. Estadias abertas contam até a hora da consulta. Reservas em aberto não contam como ocupação real.",
      "Diárias dos check-outs seguem a regra usada pelo Hotelzinho: mínimo de uma diária, por períodos de até 24 horas. Se faltar check-in, usa-se a chegada prevista só para as diárias, não para ocupação.",
      "Os extras usam a data de lançamento. Os check-outs agrupam o total de cada estadia encerrada e podem incluir extras de outras datas.",
    ],
    tabelas: [
      {
        titulo: "Ocupação dia a dia",
        colunas: ["Data", "Animais presentes", "Reservas sem check-in"],
        linhas: linhasOcupacao,
      },
      {
        titulo: "Ocupação por acomodação",
        colunas: ["Acomodação", "Animais-dia presentes", "Animais-dia reservados"],
        linhas: [...dadosPorAcomodacao.entries()]
          .map(([id, d]): (string | number)[] => [
            id ? quartos.get(id) || "Acomodação não identificada" : "Sem acomodação",
            d.reais,
            d.reservas,
          ])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]), "pt-BR")),
      },
      {
        titulo: "Check-outs e diárias",
        colunas: [
          "Data do check-out",
          "Estadias encerradas",
          "Diárias calculáveis",
          ...(financeiro ? ["Total apurado registrado", "Sem valor apurado"] : []),
        ],
        linhas: [...porCheckoutDia.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dia, d]) => [
            dataBR(dia),
            d.checkouts,
            d.diarias,
            ...(financeiro
              ? [d.checkouts !== d.semValor ? moeda(d.valor) : "Não registrado", d.semValor]
              : []),
          ]),
      },
      {
        titulo: "Extras por categoria",
        colunas: ["Categoria", "Lançamentos", ...(financeiro ? ["Valor lançado"] : [])],
        linhas: [...porCategoria.entries()]
          .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
          .map(([categoria, grupo]) => [
            categoria,
            grupo.registros,
            ...(financeiro ? [moeda(grupo.valor)] : []),
          ]),
      },
    ],
  };
  const semCheckin = estadias.filter(
    (e) =>
      (e.status === "hospedado" || e.status === "concluida") &&
      !e.checkin_em &&
      (dataNoPeriodo(e.chegada_prevista, periodo) || dataNoPeriodo(e.checkout_em, periodo)),
  ).length;
  if (semCheckin)
    dados.notas.push(
      `${semCheckin} registro(s) de estadia sem check-in foram excluídos da ocupação.`,
    );
  if (diariasSemDados)
    dados.notas.push(
      `${diariasSemDados} check-out(s) sem datas suficientes e coerentes para apurar diárias.`,
    );
  somarFinanceiro(dados, financeiro, periodo, "hotel");
  return dados;
}
