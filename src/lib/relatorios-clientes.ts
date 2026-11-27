import { dataBR, FUSO_RELATORIOS, somarDias, type DadosRelatorio } from "./relatorios.ts";

export type PeriodoClientes = { inicio: string; fim: string };
const calendario = new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO_RELATORIOS });
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
export const diaClientes = (data: string | number) => calendario.format(new Date(data));

export function inicioCivilClientes(dia: string) {
  const utc = Date.parse(dia + "T00:00:00Z");
  let a = utc - 86_400_000;
  let b = utc + 86_400_000;
  while (b - a > 1) {
    const meio = Math.floor((a + b) / 2);
    if (diaClientes(meio) < dia) a = meio;
    else b = meio;
  }
  return new Date(b).toISOString();
}

export type ProdutoRelatorio = {
  id: string;
  nome: string;
  categoria: string;
  estoque_atual: number | null;
  estoque_minimo: number | null;
  venda_por_peso: boolean;
};
export type MovimentoRelatorio = {
  item_id: string | null;
  item_nome: string;
  tipo: "entrada" | "saida";
  quantidade: number;
};

export function relatorioEstoque(
  produtos: ProdutoRelatorio[],
  movimentos: MovimentoRelatorio[],
): DadosRelatorio {
  const atingeMinimo = (p: ProdutoRelatorio) =>
    p.estoque_atual != null && p.estoque_minimo != null && p.estoque_atual <= p.estoque_minimo;
  const reposicao = produtos.filter(atingeMinimo);
  const semSaldo = produtos.filter((p) => p.estoque_atual == null).length;
  const semMinimo = produtos.filter((p) => p.estoque_minimo == null).length;
  const nomesAtuais = new Map(produtos.map((p) => [p.id, p.nome]));
  type Resumo = {
    nome: string;
    entradas: bigint;
    saidas: bigint;
    registros: number;
    vinculo: string;
  };
  const porItem = new Map<string, Resumo>();
  for (const m of movimentos) {
    const nomeAtual = m.item_id ? nomesAtuais.get(m.item_id) : undefined;
    const chave = m.item_id ? "id:" + m.item_id : "historico:" + m.item_nome;
    const linha = porItem.get(chave) ?? {
      nome: nomeAtual ?? m.item_nome,
      entradas: 0n,
      saidas: 0n,
      registros: 0,
      vinculo: nomeAtual ? "Produto ativo" : m.item_id ? "Fora do catálogo ativo" : "Sem vínculo",
    };
    const quantia = BigInt(Math.round(m.quantidade * 1000));
    if (m.tipo === "entrada") linha.entradas += quantia;
    else linha.saidas += quantia;
    linha.registros++;
    porItem.set(chave, linha);
  }
  const formatar = (milesimos: bigint) => {
    const fracao = (milesimos % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
    return (milesimos / 1000n).toLocaleString("pt-BR") + (fracao ? "," + fracao : "");
  };
  return {
    indicadores: [
      { rotulo: "Produtos ativos", valor: produtos.length },
      { rotulo: "Produtos no mínimo ou abaixo", valor: reposicao.length },
      { rotulo: "Produtos sem saldo informado", valor: semSaldo },
      { rotulo: "Movimentações no período", valor: movimentos.length },
    ],
    notas: [
      "Saldo e mínimo mostram o estoque atual, não a foto do último dia do período. Movimentações usam a data do registro e não incluem operações anteriores ao início do histórico.",
      "As saídas representam todo o volume baixado. A trilha não separa vendas, consumo interno, ajustes ou perdas, nem registra lotes ou vencimentos. Esses dados não foram estimados.",
      `${semMinimo} produto(s) sem mínimo configurado. Produto sem saldo informado não entra no cálculo de reposição. A quantidade indicada apenas completa o mínimo cadastrado.`,
    ],
    tabelas: [
      {
        titulo: "Saldo atual por produto",
        colunas: ["Produto", "Categoria", "Controle", "Saldo atual", "Mínimo"],
        linhas: produtos.map((p) => [
          p.nome,
          p.categoria || "Sem categoria",
          p.venda_por_peso ? "Peso" : "Unidade",
          p.estoque_atual ?? "Não informado",
          p.estoque_minimo ?? "Não definido",
        ]),
      },
      {
        titulo: "Reposição sugerida no estoque atual",
        colunas: ["Produto", "Saldo atual", "Mínimo", "Falta para o mínimo"],
        linhas: reposicao.map((p) => [
          p.nome,
          p.estoque_atual!,
          p.estoque_minimo!,
          Math.round((p.estoque_minimo! - p.estoque_atual!) * 1000) / 1000,
        ]),
      },
      {
        titulo: "Entradas e saídas registradas no período",
        colunas: ["Produto no histórico", "Vínculo", "Entradas", "Saídas", "Movimentações"],
        linhas: [...porItem.values()]
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
          .map((r) => [r.nome, r.vinculo, formatar(r.entradas), formatar(r.saidas), r.registros]),
      },
    ],
  };
}

type Cadastro = { id: string; created_at: string };
export type TutorRelatorio = Cadastro;
export type PacienteRelatorio = Cadastro & { especie: string };
export type ConsultaAgendaRelatorio = {
  tutor_id: string | null;
  animal_id: string | null;
  inicio: string;
};
const DIAS_INATIVIDADE = 180;
export const inicioInatividade = (dataFinal: string) => somarDias(dataFinal, 1 - DIAS_INATIVIDADE);

function especieSegura(texto: string) {
  const normal = texto
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!normal) return "Não informada";
  if (["cao", "cachorro", "canina", "canino"].includes(normal)) return "Caninos";
  if (["gato", "felina", "felino"].includes(normal)) return "Felinos";
  return "Outras espécies";
}

export function relatorioCadastros(
  periodo: PeriodoClientes,
  referencia: string,
  tutores: TutorRelatorio[],
  pacientes: PacienteRelatorio[],
  agenda: ConsultaAgendaRelatorio[],
): DadosRelatorio {
  const corte = inicioInatividade(referencia);
  const dias = new Map<string, [number, number]>();
  const dia = (d: string) => {
    let linha = dias.get(d);
    if (!linha) {
      linha = [0, 0];
      dias.set(d, linha);
    }
    return linha;
  };
  const pertence = (d: string) => d >= periodo.inicio && d <= referencia;
  const especies = new Map<string, number>();
  for (const t of tutores) {
    const d = diaClientes(t.created_at);
    if (pertence(d)) dia(d)[0]++;
  }
  for (const p of pacientes) {
    const d = diaClientes(p.created_at);
    if (pertence(d)) dia(d)[1]++;
    const especie = especieSegura(p.especie);
    especies.set(especie, (especies.get(especie) ?? 0) + 1);
  }
  const frequenciaTutor = new Map<string, number>();
  const frequenciaPaciente = new Map<string, number>();
  const ativos180 = new Set<string>();
  const pacientesAtivos180 = new Set<string>();
  const tutoresIds = new Set(tutores.map((t) => t.id));
  const pacientesIds = new Set(pacientes.map((p) => p.id));
  for (const a of agenda) {
    const d = diaClientes(a.inicio);
    if (d > referencia) continue;
    if (a.tutor_id && tutoresIds.has(a.tutor_id)) {
      if (d >= corte) ativos180.add(a.tutor_id);
      if (pertence(d)) frequenciaTutor.set(a.tutor_id, (frequenciaTutor.get(a.tutor_id) ?? 0) + 1);
    }
    if (a.animal_id && pacientesIds.has(a.animal_id)) {
      if (d >= corte) pacientesAtivos180.add(a.animal_id);
      if (pertence(d))
        frequenciaPaciente.set(a.animal_id, (frequenciaPaciente.get(a.animal_id) ?? 0) + 1);
    }
  }
  const recorrentes = (m: Map<string, number>) => [...m.values()].filter((n) => n >= 2).length;
  const inativos = <T extends Cadastro>(base: T[], ativos: Set<string>) =>
    base.filter((r) => diaClientes(r.created_at) < corte && !ativos.has(r.id)).length;

  return {
    indicadores: [
      { rotulo: "Novos tutores", valor: [...dias.values()].reduce((s, v) => s + v[0], 0) },
      { rotulo: "Novos pacientes", valor: [...dias.values()].reduce((s, v) => s + v[1], 0) },
      { rotulo: "Tutores recorrentes", valor: recorrentes(frequenciaTutor) },
      {
        rotulo: "Tutores sem atendimento na agenda há 180 dias",
        valor: inativos(tutores, ativos180),
      },
    ],
    notas: [
      "Recorrência significa dois ou mais agendamentos finalizados e vinculados no período, pela data marcada. Consultas avulsas sem vínculo com a agenda não entram.",
      `Inatividade significa cadastro anterior aos 180 dias encerrados em ${dataBR(referencia)}, sem agenda finalizada nesse intervalo. Não presume ausência de atendimentos fora dessa fonte nem é uma lista para contatar tutores.`,
      "Totais e espécies consideram cadastros existentes até o fechamento, sem reconstruir registros já excluídos.",
    ],
    tabelas: [
      {
        titulo: "Novos cadastros por dia",
        colunas: ["Data", "Tutores", "Pacientes"],
        linhas: [...dias.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([d, v]) => [dataBR(d), ...v]),
      },
      {
        titulo: "Base de cadastros e frequência na agenda",
        colunas: [
          "Grupo",
          "Cadastrados",
          "Com atendimento no período",
          "Recorrentes",
          "Sem agenda finalizada há 180 dias",
        ],
        linhas: [
          [
            "Tutores",
            tutores.length,
            frequenciaTutor.size,
            recorrentes(frequenciaTutor),
            inativos(tutores, ativos180),
          ],
          [
            "Pacientes",
            pacientes.length,
            frequenciaPaciente.size,
            recorrentes(frequenciaPaciente),
            inativos(pacientes, pacientesAtivos180),
          ],
        ],
      },
      {
        titulo: "Pacientes cadastrados por espécie",
        colunas: ["Espécie", "Pacientes"],
        linhas: [...especies.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")),
      },
    ],
  };
}

export type AgendamentoPortalRelatorio = { inicio: string; estado: string };
type ContasPortal = { tutores: number; ativas: number; ultimoAcessoNoPeriodo: number };
const estadoPortal: Record<string, string> = {
  pendente: "Pendente",
  solicitado: "Solicitado",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  reservado: "Reservado",
  expirado: "Expirado",
  recusado: "Recusado",
};
export function relatorioPortal(
  agendamentos: AgendamentoPortalRelatorio[],
  contas: ContasPortal,
): DadosRelatorio {
  const dias = new Map<string, number>();
  const estados = new Map<string, number>();
  for (const a of agendamentos) {
    const dia = diaClientes(a.inicio);
    dias.set(dia, (dias.get(dia) ?? 0) + 1);
    const estado = Object.hasOwn(estadoPortal, a.estado) ? estadoPortal[a.estado] : "Outro estado";
    estados.set(estado, (estados.get(estado) ?? 0) + 1);
  }
  const adesao = contas.tutores
    ? percentual.format(contas.ativas / contas.tutores)
    : "Sem cadastros";
  return {
    indicadores: [
      { rotulo: "Horários marcados pelo Portal", valor: agendamentos.length },
      { rotulo: "Contas ativas com acesso habilitado", valor: contas.ativas },
      { rotulo: "Cobertura do Portal na base atual", valor: adesao },
      { rotulo: "Contas ativas com último acesso no período", valor: contas.ultimoAcessoNoPeriodo },
    ],
    notas: [
      "Agendamentos consideram a data marcada, a origem Portal do Tutor e o estado atual. Não representam necessariamente comparecimento.",
      "A cobertura compara contas habilitadas (com usuário de autenticação vinculado) ao total de tutores atuais; reservas de nome de usuário sem ativação não contam.",
      "Só o acesso mais recente é armazenado. A métrica não mede sessões, visitas anteriores sobrescritas ou novos acessos ao longo do tempo. Não há avaliações registradas no Portal para este relatório.",
    ],
    tabelas: [
      {
        titulo: "Horários do Portal por data agendada",
        colunas: ["Data", "Registros"],
        linhas: [...dias.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([d, n]) => [dataBR(d), n]),
      },
      {
        titulo: "Situação atual dos horários marcados pelo Portal",
        colunas: ["Situação", "Registros"],
        linhas: [...estados.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")),
      },
    ],
  };
}
