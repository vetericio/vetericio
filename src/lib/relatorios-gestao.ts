import { dataBR, diaNoFuso, type DadosRelatorio, type TabelaRelatorio } from "./relatorios.ts";

export type PeriodoGestao = { inicio: string; fim: string };
export type EnvioCrmGestao = {
  id: string;
  canal: string;
  tipo: string;
  status: string;
  enviado_em: string | null;
};
export type CampanhaGestao = { status: string; canal: string };
export type OrigemTutorGestao = { origem: string | null };
export type SiteGestao = { status: string; publicado_em: string | null };
export type StudioEnvioGestao = { formato: string };
export type ContratacaoGestao = { plano_nome: string; ciclo: string; status: string };
export type AssinaturaGestao = {
  plano_codigo: string;
  ciclo: string;
  status: string;
  inicio_em: string;
  proximo_vencimento_em: string;
};
export type PermissaoGestao = { permissao_codigo: string; permitido: boolean };
export type EstoqueGestao = { tipo: string };
export type StudioRevisaoGestao = { evento: string };

const canaisCrm: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  manual: "Manual",
  portal: "Portal do Tutor",
};
const statusCampanhas: Record<string, string> = {
  rascunho: "Rascunho",
  pronta: "Pronta",
  agendada: "Agendada",
  pausada: "Pausada",
  encerrada: "Encerrada",
};
const origemTutor: Record<string, string> = {
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  email: "E-mail",
  "e-mail": "E-mail",
  indicacao: "Indicação",
  google: "Google",
  instagram: "Instagram",
  facebook: "Facebook",
  "redes sociais": "Redes sociais",
  site: "Site",
  "site da clinica": "Site",
  "portal do tutor": "Portal do Tutor",
  portal_tutor: "Portal do Tutor",
  "passou em frente": "Presencial",
  presencial: "Presencial",
  convenio: "Convênio",
};
const formatosStudio: Record<string, string> = {
  imagem: "Imagem",
  carrossel: "Carrossel",
  reels: "Reels",
  story: "Story",
};
const statusContrato: Record<string, string> = {
  ativada: "Ativada",
  pagamento_aprovado: "Pagamento aprovado",
  teste_aguardando_ativacao: "Teste aguardando ativação",
  isento_aguardando_aprovacao: "Isenção aguardando aprovação",
  em_analise: "Em análise",
  em_configuracao: "Em configuração",
  cancelada: "Cancelada",
  cancelado: "Cancelada",
  pagamento_pendente: "Pagamento pendente",
  aguardando_pagamento: "Aguardando pagamento",
};
const statusAssinatura: Record<string, string> = {
  ativa: "Ativa",
  cancelada: "Cancelada",
  suspensa: "Suspensa",
};
const ciclos: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  bienal: "Bienal",
  teste: "Teste",
};

function rotulo(dicionario: Record<string, string>, chave: string, padrao = "Outro") {
  return Object.hasOwn(dicionario, chave) ? dicionario[chave] : padrao;
}

function agrupar<T>(
  registros: T[],
  titulo: string,
  colunas: string[],
  chaves: (r: T) => string[],
): TabelaRelatorio {
  const grupos = new Map<string, { valores: string[]; total: number }>();
  for (const registro of registros) {
    const valores = chaves(registro);
    const chave = JSON.stringify(valores);
    const grupo = grupos.get(chave) ?? { valores, total: 0 };
    grupo.total++;
    grupos.set(chave, grupo);
  }
  return {
    titulo,
    colunas: [...colunas, "Registros"],
    linhas: [...grupos.values()]
      .sort(
        (a, b) => b.total - a.total || a.valores.join().localeCompare(b.valores.join(), "pt-BR"),
      )
      .map(({ valores, total }) => [...valores, total]),
  };
}

function canalCaptacao({ origem }: OrigemTutorGestao) {
  const chave = origem
    ?.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  // Campo livre: nunca devolve o texto não reconhecido (pode conter nomes e contatos).
  return chave ? rotulo(origemTutor, chave, "Outra origem") : "Não informado";
}

export function noPeriodoGestao(data: string | null, periodo: PeriodoGestao) {
  if (!data || !Number.isFinite(Date.parse(data))) return false;
  const dia = diaNoFuso(data);
  return dia >= periodo.inicio && dia <= periodo.fim;
}

export function envioCrmNoPeriodo(eventos: EnvioCrmGestao[], periodo: PeriodoGestao) {
  return eventos.filter(
    ({ status, enviado_em }) => status === "enviado" && noPeriodoGestao(enviado_em, periodo),
  );
}

export function montarRelatorioRelacionamento(info: {
  envios: EnvioCrmGestao[];
  campanhas: CampanhaGestao[];
  captacao: OrigemTutorGestao[] | null;
  studio: StudioEnvioGestao[] | null;
  site: SiteGestao | null | undefined;
}): DadosRelatorio {
  const { envios, campanhas, captacao, studio, site } = info;
  const resultado: DadosRelatorio = {
    indicadores: [
      { rotulo: "Contatos marcados como enviados", valor: envios.length },
      {
        rotulo: "Envios de campanhas registrados",
        valor: envios.filter((e) => e.tipo === "campanha").length,
      },
      { rotulo: "Campanhas criadas no período", valor: campanhas.length },
    ],
    notas: [
      "O CRM conta os registros marcados como enviados pela equipe, não entregas confirmadas, cliques ou conversões. O canal é o do envio; não é a origem de captação.",
      "O detalhamento de campanhas mostra o estado atual das campanhas criadas no período, por canal configurado.",
      "A origem registrada no cadastro do tutor, quando registrada, não atribui conversão ao site, à campanha nem ao OricStudio. Não há série de visitas, cliques ou leads do site nesta fonte.",
    ],
    tabelas: [
      agrupar(envios, "Envios do CRM por canal", ["Canal", "Tipo"], (e) => [
        rotulo(canaisCrm, e.canal),
        e.tipo === "campanha" ? "Campanha" : "Demais contatos do CRM",
      ]),
      agrupar(campanhas, "Campanhas criadas por canal e estado atual", ["Canal", "Estado"], (c) => [
        rotulo(canaisCrm, c.canal),
        rotulo(statusCampanhas, c.status),
      ]),
    ],
  };
  if (captacao === null) {
    resultado.notas.push("A origem de captação exige acesso aos cadastros da clínica.");
  } else {
    resultado.indicadores.push(
      { rotulo: "Tutores cadastrados no período", valor: captacao.length },
      {
        rotulo: "Cadastros com origem informada",
        valor: captacao.filter((o) => canalCaptacao(o) !== "Não informado").length,
      },
    );
    resultado.tabelas.push(
      agrupar(captacao, "Captação: origem informada no cadastro", ["Canal"], (o) => [
        canalCaptacao(o),
      ]),
    );
  }
  if (studio === null) {
    resultado.notas.push(
      "Indicadores do OricStudio exigem acesso ativo ao módulo na clínica selecionada.",
    );
  } else {
    resultado.indicadores.push({
      rotulo: "Publicações do OricStudio confirmadas pela Meta",
      valor: studio.length,
    });
    resultado.tabelas.push(
      agrupar(studio, "Publicações do OricStudio por formato", ["Formato"], (e) => [
        rotulo(formatosStudio, e.formato),
      ]),
    );
  }
  if (site === undefined) {
    resultado.notas.push("O estado do site exige permissão de administração do site.");
  } else {
    resultado.tabelas.push({
      titulo: "Site da clínica: situação atual (fora do filtro de período)",
      colunas: ["Estado", "Última publicação registrada"],
      linhas: [
        [
          site ? (site.status === "publicado" ? "Publicado" : "Rascunho") : "Sem registro",
          site?.publicado_em ? dataBR(diaNoFuso(site.publicado_em)) : "—",
        ],
      ],
    });
  }
  return resultado;
}

export function montarRelatorioContratacao(
  contratacoes: ContratacaoGestao[],
  assinatura: AssinaturaGestao | null,
  planoAtual: string | null,
  cancelamentosStudio: number | null,
  periodo: PeriodoGestao,
): DadosRelatorio {
  const inicioNoPeriodo =
    !!assinatura && assinatura.inicio_em >= periodo.inicio && assinatura.inicio_em <= periodo.fim;
  const resultado: DadosRelatorio = {
    indicadores: [
      { rotulo: "Contratações ORICSE vinculadas e criadas no período", valor: contratacoes.length },
      { rotulo: "Plano da clínica (atual)", valor: planoAtual || "Não informado" },
      {
        rotulo: "Assinatura ORICSE (estado atual)",
        valor: assinatura ? rotulo(statusAssinatura, assinatura.status) : "Sem registro",
      },
    ],
    notas: [
      "Somente adesões vinculadas à clínica. Documentos do módulo global de contratos não têm vínculo confiável com a clínica e não são consultados.",
      "O período filtra a criação das adesões; plano e assinatura refletem o estado atual, mesmo fora do período. A assinatura ORICSE não tem histórico nem data confiável de cancelamento: o estado cancelado, quando existe, é mostrado como situação atual, não como evento do período.",
      "O relatório não consulta valores, dados de pagamento, documentos, identificadores de cobranças ou dados dos contratantes.",
    ],
    tabelas: [
      agrupar(
        contratacoes,
        "Adesões ORICSE criadas no período, em seu estado atual",
        ["Plano", "Ciclo", "Estado"],
        (c) => [
          c.plano_nome || "Não informado",
          rotulo(ciclos, c.ciclo),
          rotulo(statusContrato, c.status),
        ],
      ),
      {
        titulo: "Assinatura ORICSE registrada (estado atual)",
        colunas: [
          "Código do plano",
          "Ciclo",
          "Início",
          "Começou no período?",
          "Próximo vencimento registrado",
          "Estado",
        ],
        linhas: assinatura
          ? [
              [
                assinatura.plano_codigo,
                rotulo(ciclos, assinatura.ciclo),
                dataBR(assinatura.inicio_em),
                inicioNoPeriodo ? "Sim" : "Não",
                dataBR(assinatura.proximo_vencimento_em),
                rotulo(statusAssinatura, assinatura.status),
              ],
            ]
          : [],
      },
    ],
  };
  if (cancelamentosStudio !== null) {
    resultado.indicadores.push({
      rotulo: "Contratações do OricStudio com cancelamento datado no período",
      valor: cancelamentosStudio,
    });
  } else {
    resultado.notas.push(
      "Os cancelamentos do OricStudio são visíveis apenas aos papéis com acesso a suas contratações.",
    );
  }
  return resultado;
}

export function montarRelatorioAuditoria(
  permissoesEquipe: PermissaoGestao[],
  permissoesBanco: PermissaoGestao[],
  estoque: EstoqueGestao[] | null,
  studio: StudioRevisaoGestao[] | null,
): DadosRelatorio {
  const resultado: DadosRelatorio = {
    indicadores: [
      {
        rotulo: "Regras individuais atuais pela última atualização (painel da equipe)",
        valor: permissoesEquipe.length,
      },
    ],
    notas: [
      "As fontes de permissões mantêm apenas regras individuais atuais. O painel da equipe (Drive) e o PostgreSQL são mostrados separadamente: uma regra pode existir nas duas fontes e os valores não devem ser somados. Não são recuperadas regras removidas, versões anteriores nem identidades dos colaboradores.",
      "Não há, nas fontes verificadas, trilha consolidada da clínica para logins, leituras ou exportações. A ausência dessas contagens não significa que não ocorreram.",
      "Esta cobertura é parcial e não constitui um inventário completo de auditoria da clínica.",
    ],
    tabelas: [
      ...(
        [
          [permissoesEquipe, "Painel da equipe (Drive)"],
          [permissoesBanco, "PostgreSQL"],
        ] as const
      ).map(([regras, fonte]) =>
        agrupar(
          regras,
          "Últimas atualizações de regras individuais: " + fonte,
          ["Código da permissão", "Regra atual"],
          (p) => [p.permissao_codigo, p.permitido ? "Concedida" : "Negada"],
        ),
      ),
    ],
  };
  if (estoque === null) {
    resultado.notas.push(
      "A trilha de movimentos de estoque exige permissão de consulta ou movimentação de estoque.",
    );
  } else {
    resultado.indicadores.push({
      rotulo: "Movimentos auditados de estoque no período",
      valor: estoque.length,
    });
    resultado.tabelas.push(
      agrupar(estoque, "Trilha de estoque por ação", ["Ação"], (e) => [
        e.tipo === "entrada" ? "Entrada" : e.tipo === "saida" ? "Saída" : "Outra",
      ]),
    );
  }
  if (studio === null) {
    resultado.notas.push(
      "As revisões de publicações exigem acesso ativo ao OricStudio na clínica selecionada.",
    );
  } else {
    resultado.indicadores.push({
      rotulo: "Ações auditadas em publicações do OricStudio",
      valor: studio.length,
    });
    resultado.tabelas.push(
      agrupar(studio, "Revisões em publicações do OricStudio", ["Ação"], (e) => [
        rotulo({ criar: "Criação", editar: "Edição", excluir: "Exclusão" }, e.evento),
      ]),
    );
  }
  return resultado;
}
