export const CODIGOS_FINANCEIROS = ["01", "02", "03", "04", "05", "06", "07"] as const;
export const CODIGOS_AGENDA = ["08", "09", "10"] as const;
export const CODIGOS_PET = ["11", "12"] as const;
export const CODIGOS_OPERACIONAIS = [...CODIGOS_AGENDA, ...CODIGOS_PET] as const;
export const CODIGOS_EQUIPE = ["13", "14"] as const;
export const CODIGOS_CLINICOS = [
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
] as const;
export const CODIGOS_GESTAO = ["25", "26", "27", "28", "29", "30"] as const;
export const CODIGOS_RELATORIOS = [
  ...CODIGOS_FINANCEIROS,
  ...CODIGOS_OPERACIONAIS,
  ...CODIGOS_EQUIPE,
  ...CODIGOS_CLINICOS,
  ...CODIGOS_GESTAO,
] as const;
export type CodigoRelatorio = (typeof CODIGOS_RELATORIOS)[number];
export const PERMISSAO_RELATORIOS = "caixa.financeiro.visualizar";
export const PERMISSAO_RELATORIOS_EQUIPE = "equipe.pagamentos.visualizar";

// Cada linha é a conjunção das permissões das fontes lidas por aquele relatório.
const requisitos: Record<CodigoRelatorio, readonly string[]> = {
  "01": [PERMISSAO_RELATORIOS],
  "02": [PERMISSAO_RELATORIOS],
  "03": [PERMISSAO_RELATORIOS],
  "04": [PERMISSAO_RELATORIOS],
  "05": [PERMISSAO_RELATORIOS],
  "06": [PERMISSAO_RELATORIOS],
  "07": [PERMISSAO_RELATORIOS],
  "08": ["recepcao.agenda"],
  "09": ["recepcao.agenda"],
  "10": ["recepcao.agenda"],
  "11": ["hotelzinho.visualizar"],
  "12": ["hotelzinho.visualizar"],
  "13": ["consultorio.atendimentos"],
  "14": [PERMISSAO_RELATORIOS_EQUIPE],
  "15": ["consultorio.atendimentos"],
  "16": ["consultorio.atendimentos"],
  "17": ["internacao.registrar"],
  "18": ["internacao.plantoes", "internacao.registrar"],
  "19": ["internacao.medicacoes", "internacao.registrar", "consultorio.atendimentos"],
  "20": ["consultorio.atendimentos"],
  "21": ["consultorio.atendimentos"],
  "22": ["consultorio.receituario"],
  "23": ["estoque.catalogo.visualizar"],
  "24": ["consultorio.atendimentos"],
  "25": ["estoque.catalogo.visualizar"],
  "26": ["recepcao.cadastros.visualizar", "recepcao.agenda"],
  "27": ["crm.visualizar"],
  "28": ["portal_tutor.gerenciar", "recepcao.cadastros.visualizar", "recepcao.agenda"],
  "29": ["administracao.configuracoes"],
  "30": ["administracao.permissoes"],
};
export const PERMISSOES_ROTA_RELATORIOS = [...new Set(Object.values(requisitos).flat())];

export function permissoesDoRelatorio(codigo: CodigoRelatorio): readonly string[] {
  return requisitos[codigo];
}

export const RELATORIOS = [
  "Faturamento",
  "Custos, margem e resultado gerencial",
  "Caixa diário e fechamento por operador",
  "Contas a receber e inadimplência",
  "Contas a pagar e fluxo de caixa",
  "Conciliação, taxas, estornos e repasses",
  "Orçamentos, comandas e conversão",
  "Ocupação e capacidade por agenda e profissional",
  "Faltas, cancelamentos e reagendamentos",
  "Fila, tempo de espera e conversão em atendimento",
  "Banho e tosa: produção, receita e cancelamentos",
  "Hotelzinho: ocupação, diárias, extras e pagamentos",
  "Produtividade, escalas e comissões",
  "Ponto, jornada e banco de horas",
  "Consultas, procedimentos e retornos",
  "Prontuários e retificações",
  "Internação",
  "Plantões e pendências",
  "Medicações",
  "Exames e laudos",
  "Vacinas",
  "Receitas emitidas e guarda documental",
  "Aquisição e movimentação de controlados",
  "Termos, atestados e laudos",
  "Estoque, consumo e reposição",
  "Tutores e pacientes",
  "CRM, campanhas, site e OricStudio",
  "Portal do Tutor",
  "Contratos, planos e assinaturas",
  "Auditoria",
] as const;

export const FUSO_RELATORIOS = "America/Sao_Paulo";

export function diaNoFuso(iso: string, timeZone = FUSO_RELATORIOS) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone }).format(new Date(iso));
}

export function somarDias(dia: string, dias: number) {
  const date = new Date(dia + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}

export function periodoValido(inicio: string, fim: string) {
  const valida = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    s >= "2000-01-01" &&
    s <= "2099-12-31" &&
    Number.isFinite(Date.parse(s)) &&
    somarDias(s, 0) === s;
  return valida(inicio) && valida(fim) && inicio <= fim && fim < somarDias(inicio, 93);
}

export type TabelaRelatorio = {
  titulo: string;
  colunas: string[];
  linhas: (string | number)[][];
  /** Índices da tabela antes de filtro/paginação; identificadores, nunca URLs de arquivo. */
  pdfReceitas?: { linha: number; documentoId: string }[];
};
function textoBuscaRelatorio(valor: string | number) {
  return String(valor)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

/** Preserva o índice original para que download e filtros apontem para a mesma receita. */
export function filtrarLinhasRelatorio(tabela: TabelaRelatorio, busca: string) {
  const termos = textoBuscaRelatorio(busca).trim().split(/\s+/).filter(Boolean);
  return tabela.linhas
    .map((celulas, linha) => ({ celulas, linha }))
    .filter(({ celulas }) => {
      if (!termos.length) return true;
      const texto = celulas.map(textoBuscaRelatorio).join(" ");
      return termos.every((termo) => texto.includes(termo));
    });
}

export type DadosRelatorio = {
  indicadores: { rotulo: string; valor: string | number }[];
  notas: string[];
  tabelas: TabelaRelatorio[];
};

const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const moeda = (centavos: number | null) =>
  centavos === null ? "—" : fmtMoeda.format(centavos / 100);
export const dataBR = (date: string | null) => (date ? date.split("-").reverse().join("/") : "—");
export const soma = <T>(linhas: T[], valor: (linha: T) => number) =>
  linhas.reduce((t, linha) => t + valor(linha), 0);

export type LancamentoRelatorio = {
  id: string;
  setor: string;
  descricao: string;
  forma_pagamento: string;
  tipo: "entrada" | "saida";
  status: "pago" | "pendente" | "cancelado";
  valor_centavos: number;
  data_competencia: string | null;
  registrado_em: string;
  origem_tipo: string;
  origem_id: string;
};
export const competencia = (l: LancamentoRelatorio) =>
  l.data_competencia || diaNoFuso(l.registrado_em);

export function gruposMonetarios<T>(linhas: T[], chave: (l: T) => string, valor: (l: T) => number) {
  const grupos = new Map<string, { nome: string; registros: number; centavos: number }>();
  for (const l of linhas) {
    const nome = chave(l).trim() || "Não informado";
    const anterior = grupos.get(nome) ?? { nome, registros: 0, centavos: 0 };
    anterior.registros++;
    anterior.centavos += valor(l);
    grupos.set(nome, anterior);
  }
  return [...grupos.values()].sort(
    (a, b) => b.centavos - a.centavos || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

export function resumirCaixa(linhas: LancamentoRelatorio[], estornosCentavos: number) {
  const entradas = soma(
    linhas.filter((l) => l.status === "pago" && l.tipo === "entrada"),
    (l) => l.valor_centavos,
  );
  const saidas = soma(
    linhas.filter((l) => l.status === "pago" && l.tipo === "saida"),
    (l) => l.valor_centavos,
  );
  return {
    entradas,
    saidas,
    estornos: estornosCentavos,
    movimentacaoLiquida: entradas - saidas - estornosCentavos,
  };
}

export function fluxoRegistrado(
  linhas: LancamentoRelatorio[],
  baixas: Map<string, string>,
  estornos: { dia: string; valor_centavos: number }[],
  inicio: string,
  fim: string,
) {
  const dias = new Map<
    string,
    { entradas: number; saidas: number; aReceber: number; aPagar: number; estornos: number }
  >();
  function linha(dia: string) {
    const anterior = dias.get(dia);
    if (anterior) return anterior;
    const nova = { entradas: 0, saidas: 0, aReceber: 0, aPagar: 0, estornos: 0 };
    dias.set(dia, nova);
    return nova;
  }
  for (const l of linhas) {
    if (l.status === "cancelado") continue;
    const dia =
      l.status === "pago" ? (baixas.get(l.id) ?? diaNoFuso(l.registrado_em)) : competencia(l);
    if (dia < inicio || dia > fim) continue;
    const d = linha(dia);
    if (l.status === "pago") {
      if (l.tipo === "entrada") d.entradas += l.valor_centavos;
      else d.saidas += l.valor_centavos;
    } else if (l.tipo === "entrada") d.aReceber += l.valor_centavos;
    else d.aPagar += l.valor_centavos;
  }
  for (const e of estornos) {
    if (e.dia >= inicio && e.dia <= fim) linha(e.dia).estornos += e.valor_centavos;
  }
  return [...dias.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, d]) => ({
      dia,
      ...d,
      efetivo: d.entradas - d.saidas - d.estornos,
      projetado: d.entradas - d.saidas - d.estornos + d.aReceber - d.aPagar,
    }));
}

export function situacaoRecebivel(vencimento: string | null, hoje: string) {
  if (!vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) return "Sem vencimento registrado";
  return vencimento < hoje ? "Vencido" : vencimento === hoje ? "Vence hoje" : "A vencer";
}
