import { dataBR, diaNoFuso, type DadosRelatorio, type TabelaRelatorio } from "./relatorios";

export type ReceitaRelatorio = {
  id: string;
  animal_id: string;
  tutor_id: string;
  drive_arquivo_id: string | null;
  emitida_em: string;
  numero: string | null;
  titulo: string;
  tipo: string;
  resumo: string | null;
  visivel_tutor: boolean;
  prescritor_nome: string | null;
  prescritor_crmv: string | null;
};

export type DocumentoRelatorio = {
  id: string;
  animal_id: string;
  titulo: string;
  tipo: string;
  data_documento: string | null;
  visivel_tutor: boolean;
  drive_arquivo_id: string | null;
};

export type MovimentoRelatorio = {
  id: string;
  item_id: string | null;
  item_nome: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  estoque_anterior: number;
  estoque_posterior: number;
  registrado_em: string;
};

export function guardaProntuarioEstimada(ultimaConsulta: string | null, emissao: string) {
  // A data da receita por si só não identifica um atendimento. Não usar fallback.
  if (!ultimaConsulta || ultimaConsulta < emissao) return null;
  const [ano, mes, dia] = ultimaConsulta.split("-").map(Number);
  // Se 29/02 não existe no quinto ano, mantém a referência no dia seguinte (01/03).
  return new Date(Date.UTC(ano + 5, mes - 1, dia)).toISOString().slice(0, 10);
}

export function montarRelatorioReceitas({
  receitas,
  animais,
  tutores,
  consultas,
  pdfs,
  clinica,
}: {
  receitas: ReceitaRelatorio[];
  animais: ReadonlyMap<string, string>;
  tutores: ReadonlyMap<string, string>;
  consultas: ReadonlyMap<string, string>;
  pdfs: ReadonlyMap<string, string>;
  clinica: string;
}): DadosRelatorio {
  const pdfReceitas: { linha: number; documentoId: string }[] = [];
  let comReferencia = 0;
  let especiais = 0;
  const linhas = receitas.map((r, linha) => {
    const ultima = consultas.get(r.animal_id) ?? null;
    const guarda = guardaProntuarioEstimada(ultima, r.emitida_em);
    if (guarda) comReferencia++;
    const temPdf = r.drive_arquivo_id !== null && pdfs.get(r.drive_arquivo_id) === r.animal_id;
    if (temPdf) pdfReceitas.push({ linha, documentoId: r.id });
    if (r.tipo === "especial") especiais++;
    const tipo =
      r.tipo === "normal"
        ? "Receita veterinária"
        : r.tipo === "especial"
          ? "Receita de controle especial"
          : r.tipo;
    return [
      dataBR(r.emitida_em),
      r.numero || "—",
      tipo,
      r.titulo,
      r.resumo || "—",
      animais.get(r.animal_id) || "Não identificado",
      tutores.get(r.tutor_id) || "Não identificado",
      r.prescritor_nome || "Não registrado",
      r.prescritor_crmv || "—",
      clinica,
      r.visivel_tutor ? "Prontuário e Portal do Tutor" : "Prontuário interno",
      temPdf ? "PDF vinculado" : "Sem PDF vinculado",
      dataBR(ultima),
      guarda ? dataBR(guarda) : "Sem data de referência suficiente",
    ];
  });
  const tabela: TabelaRelatorio & { pdfReceitas: typeof pdfReceitas } = {
    titulo: "Receitas por paciente, tutor e prescritor",
    colunas: [
      "Emissão",
      "Número",
      "Tipo registrado",
      "Receita",
      "Medicamentos registrados",
      "Paciente",
      "Tutor",
      "Prescritor",
      "CRMV",
      "Clínica",
      "Onde consta",
      "Arquivo",
      "Última consulta registrada",
      "Referência estimada de guarda do prontuário",
    ],
    linhas,
    pdfReceitas,
  };
  return {
    indicadores: [
      { rotulo: "Receitas emitidas", valor: receitas.length },
      { rotulo: "Tipo registrado: controle especial", valor: especiais },
      { rotulo: "Com PDF vinculado", valor: pdfReceitas.length },
      { rotulo: "Sem data de referência suficiente", valor: receitas.length - comReferencia },
    ],
    notas: [
      "O mínimo de 5 anos após o último atendimento é do prontuário (Resolução CFMV 1.321/2020, art. 9º, § 3º). A data aqui é estimada pela última consulta registrada no sistema, inclusive fora do período pesquisado. Um novo atendimento pode alterar a referência.",
      "A estimativa não determina o prazo específico de cada via de receita, não autoriza descarte e não atesta conformidade ou assinatura digital. Um vínculo de PDF não comprova assinatura nem substitui vias exigidas.",
      "Prescritor e CRMV aparecem quando registrados na emissão. Registros históricos sem esses dados não são atribuídos por suposição. Receitas excluídas da ficha pelo RT não aparecem nesta listagem.",
    ],
    tabelas: [tabela],
  };
}

export function montarRelatorioMovimentos(movimentos: MovimentoRelatorio[]): DadosRelatorio {
  const entradas = movimentos.filter((r) => r.tipo === "entrada").length;
  return {
    indicadores: [
      { rotulo: "Aquisições de controlados verificáveis", valor: "Não disponível" },
      { rotulo: "Movimentos com classificação regulatória verificável", valor: "Não disponível" },
      { rotulo: "Entradas gerais de estoque", valor: entradas },
      { rotulo: "Saídas gerais de estoque", valor: movimentos.length - entradas },
    ],
    notas: [
      "O estoque do ORICSE não registra a classificação regulatória dos itens, fornecedor, nota fiscal, lote ou motivo da movimentação nesta trilha. Entrada de estoque não significa compra e saída não significa dispensação.",
      "A tabela abaixo é a trilha operacional geral para conferência. Nenhum item é identificado como controlado e a listagem não substitui livro, documentos fiscais ou controles obrigatórios.",
    ],
    tabelas: [
      {
        titulo: "Movimentações gerais de estoque (sem classificação regulatória)",
        colunas: [
          "Dia",
          "Item registrado",
          "Movimento",
          "Quantidade do item",
          "Saldo anterior",
          "Saldo posterior",
        ],
        linhas: movimentos.map((r) => [
          dataBR(diaNoFuso(r.registrado_em)),
          r.item_nome,
          r.tipo === "entrada" ? "Entrada" : "Saída",
          r.quantidade,
          r.estoque_anterior,
          r.estoque_posterior,
        ]),
      },
    ],
  };
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export function categoriaDocumento(tipo: string, titulo: string) {
  const campos = [normalizar(tipo), normalizar(titulo)];
  if (campos.some((valor) => valor.startsWith("termo - previa demonstrativa"))) return null;
  for (const valor of campos) {
    if (/^termos?\b/.test(valor)) return "Termo";
    if (/^atestados?\b/.test(valor)) return "Atestado";
    if (/^laudos?\b/.test(valor)) return "Laudo";
    if (/^comprovantes?\b|^cartao de vacinacao\b|^carteira de saude\b/.test(valor))
      return "Comprovante";
  }
  return null;
}

export function montarRelatorioDocumentos(
  documentos: DocumentoRelatorio[],
  animais: ReadonlyMap<string, string>,
  pdfs: ReadonlyMap<string, string>,
): DadosRelatorio {
  const linhas: TabelaRelatorio["linhas"] = [];
  const contagens = { Termo: 0, Atestado: 0, Laudo: 0, Comprovante: 0 };
  for (const d of documentos) {
    const categoria = categoriaDocumento(d.tipo, d.titulo);
    if (!categoria) continue;
    contagens[categoria]++;
    linhas.push([
      dataBR(d.data_documento),
      categoria,
      d.tipo,
      d.titulo,
      animais.get(d.animal_id) || "Não identificado",
      d.visivel_tutor ? "Visível ao tutor" : "Interno",
      d.drive_arquivo_id && pdfs.get(d.drive_arquivo_id) === d.animal_id
        ? "PDF vinculado"
        : "Sem PDF vinculado",
    ]);
  }
  return {
    indicadores: [
      { rotulo: "Termos", valor: contagens.Termo },
      { rotulo: "Atestados", valor: contagens.Atestado },
      { rotulo: "Laudos", valor: contagens.Laudo },
      { rotulo: "Comprovantes", valor: contagens.Comprovante },
    ],
    notas: [
      "Inclui termos, atestados, laudos e comprovantes identificados pelo tipo ou título registrado na ficha do paciente. Pré-visualizações, exclusões lógicas, documentos sem data e tipos não identificados ficam fora.",
      "A indicação de PDF se refere ao vínculo no prontuário, não à validação da assinatura. Resultados cadastrados exclusivamente no módulo de exames aparecem no relatório 20.",
    ],
    tabelas: [
      {
        titulo: "Documentos clínicos registrados",
        colunas: [
          "Data do documento",
          "Grupo",
          "Tipo registrado",
          "Título",
          "Paciente",
          "Visibilidade",
          "Arquivo",
        ],
        linhas,
      },
    ],
  };
}
