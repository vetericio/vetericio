import { exigirClinicaNoPilotoRelatorios } from "./relatorios-acesso";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { clienteSupabaseUsuario, exigirPermissaoClinica } from "@/lib/permissao-clinica.server";
import {
  competencia,
  dataBR,
  diaNoFuso,
  fluxoRegistrado,
  gruposMonetarios,
  moeda,
  PERMISSAO_RELATORIOS,
  resumirCaixa,
  situacaoRecebivel,
  soma,
  somarDias,
  type CodigoRelatorio,
  type DadosRelatorio,
  type LancamentoRelatorio,
} from "./relatorios";

type EntradaRelatorio = {
  accessToken: string;
  clinicaId: string;
  codigo: CodigoRelatorio;
  inicio: string;
  fim: string;
};
type Turno = {
  id: string;
  aberto_nome: string | null;
  aberto_em: string;
  fechado_nome: string | null;
  fechado_em: string | null;
  status: string;
  fundo_centavos: number;
  esperado_centavos: number | null;
  contado_centavos: number | null;
  divergencia_centavos: number | null;
};
type Comanda = {
  id: string;
  numero: number;
  aberta_em: string;
  finalizada_em: string | null;
  status: string;
  origem: string;
  total: number;
  total_pago: number;
  saldo: number;
  atendimento_registro_id: string | null;
};
type Estorno = {
  id: string;
  lancamento_id: string;
  valor_centavos: number;
  status: string;
  solicitado_em: string;
  revisado_em: string | null;
};
type Baixa = {
  id: string;
  lancamento_id: string;
  valor_centavos: number;
  forma_pagamento: string;
  registrado_em: string;
};
type Pagamento = {
  id: string;
  modalidade: string | null;
  status: string;
  recebido_mp_centavos: number | null;
  recebido_oricse_centavos: number | null;
  recebido_clinica_centavos: number | null;
  bruto_centavos: number;
};
type Orcamento = {
  id: string;
  titulo: string;
  valor_centavos: number;
  criado_em: string;
  validade_em: string;
  venda_id: string | null;
};
type ItensPDV = {
  venda_id: string;
  item_id: string;
  nome_snapshot: string;
  quantidade: number;
  subtotal_centavos: number;
};
type Atendimento = { id: string; autor: string | null };

async function paginar<T>(
  consultar: (
    de: number,
    ate: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
) {
  const resultado: T[] = [];
  for (let offset = 0; offset < 20_000; offset += 500) {
    const { data, error } = await consultar(offset, offset + 499);
    if (error || !data) throw new Error("Não foi possível consultar os registros do relatório.");
    resultado.push(...data);
    if (data.length < 500) return resultado;
  }
  throw new Error("Muitos registros. Reduza o período do relatório.");
}

async function emLotes<T>(ids: string[], consultar: (ids: string[]) => Promise<T[]>) {
  const unicos = [...new Set(ids)];
  const linhas: T[] = [];
  for (let i = 0; i < unicos.length; i += 150)
    linhas.push(...(await consultar(unicos.slice(i, i + 150))));
  return linhas;
}

const centavos = (reais: number) => Math.round(Number(reais) * 100);
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const hora = (iso: string | null) => (iso ? dataHora.format(new Date(iso)) : "—");
const colunasLancamento =
  "id,setor,descricao,forma_pagamento,tipo,status,valor_centavos,data_competencia,registrado_em,origem_tipo,origem_id";
const colunasComanda =
  "id,numero,aberta_em,finalizada_em,status,origem,total,total_pago,saldo,atendimento_registro_id";

export async function gerarRelatorio({
  accessToken,
  clinicaId,
  codigo,
  inicio,
  fim,
}: EntradaRelatorio): Promise<DadosRelatorio> {
  const { data: auth, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !auth.user) throw new Error("Sessão inválida. Entre novamente.");
  await exigirPermissaoClinica(
    supabaseAdmin,
    auth.user.id,
    clinicaId,
    [PERMISSAO_RELATORIOS],
    accessToken,
  );

  await exigirClinicaNoPilotoRelatorios(supabaseAdmin, clinicaId, auth.user.id);

  const banco = clienteSupabaseUsuario(accessToken);
  const margemInicio = somarDias(inicio, -1) + "T00:00:00Z";
  const margemFim = somarDias(fim, 2) + "T00:00:00Z";
  const hoje = diaNoFuso(new Date().toISOString());
  const noPeriodo = (iso: string | null) =>
    !!iso && diaNoFuso(iso) >= inicio && diaNoFuso(iso) <= fim;
  const entre = (s: string) => s >= inicio && s <= fim;
  const competenciaOuRegistro = `and(data_competencia.gte.${inicio},data_competencia.lte.${fim}),and(data_competencia.is.null,registrado_em.gte.${margemInicio},registrado_em.lt.${margemFim})`;
  const periodoTimestamp = (campo: string) =>
    `and(${campo}.gte.${margemInicio},${campo}.lt.${margemFim})`;
  const lancamentos = (filtro: string, tipo?: "entrada" | "saida", status?: "pago" | "pendente") =>
    paginar<LancamentoRelatorio>((de, ate) => {
      let q = banco
        .from("oricse_caixa_lancamentos")
        .select(colunasLancamento)
        .eq("clinica_id", clinicaId)
        .or(filtro);
      if (tipo) q = q.eq("tipo", tipo);
      if (status) q = q.eq("status", status);
      return q.order("id").range(de, ate);
    });
  const estornosPeriodo = () =>
    paginar<Estorno>((de, ate) =>
      banco
        .from("oricse_caixa_estornos")
        .select("id,lancamento_id,valor_centavos,status,solicitado_em,revisado_em")
        .eq("clinica_id", clinicaId)
        .or(`${periodoTimestamp("solicitado_em")},${periodoTimestamp("revisado_em")}`)
        .order("id")
        .range(de, ate),
    );
  const baixasPeriodo = () =>
    paginar<Baixa>((de, ate) =>
      banco
        .from("oricse_caixa_baixas")
        .select("id,lancamento_id,valor_centavos,forma_pagamento,registrado_em")
        .eq("clinica_id", clinicaId)
        .gte("registrado_em", margemInicio)
        .lt("registrado_em", margemFim)
        .order("id")
        .range(de, ate),
    );
  const caixaPorIds = (ids: string[]) =>
    emLotes(ids, (lote) =>
      paginar<LancamentoRelatorio>((de, ate) =>
        banco
          .from("oricse_caixa_lancamentos")
          .select(colunasLancamento)
          .eq("clinica_id", clinicaId)
          .in("id", lote)
          .order("id")
          .range(de, ate),
      ),
    );
  // Dados de comanda somente após matriz financeira, limitados à clínica. O RLS
  // das comandas operacionais, mais estreito, não precisa ser ampliado.
  const comandas = (filtro: string, emAberto = false) =>
    paginar<Comanda>((de, ate) => {
      let q = supabaseAdmin
        .from("oricse_portal_comandas")
        .select(colunasComanda)
        .eq("clinica_id", clinicaId)
        .or(filtro);
      if (emAberto) q = q.eq("status", "Aberta").gt("saldo", 0);
      return q.order("id").range(de, ate);
    });

  if (codigo === "01") {
    const entradas = (await lancamentos(competenciaOuRegistro, "entrada", "pago")).filter((l) =>
      entre(competencia(l)),
    );
    const porSetor = gruposMonetarios(
      entradas,
      (l) => l.setor,
      (l) => l.valor_centavos,
    );
    const pdv = await emLotes(
      entradas.filter((l) => l.origem_tipo === "venda_expressa").map((l) => l.origem_id),
      (ids) =>
        paginar<ItensPDV>((de, ate) =>
          banco
            .from("oricse_vendas_expressas_itens")
            .select("venda_id,item_id,nome_snapshot,quantidade,subtotal_centavos")
            .eq("clinica_id", clinicaId)
            .in("venda_id", ids)
            .order("venda_id")
            .order("item_id")
            .range(de, ate),
        ),
    );
    const consultasComanda = entradas.filter((l) => l.origem_tipo === "comanda_atendimento");
    const porAutor = await emLotes(
      consultasComanda.map((l) => l.id),
      (ids) =>
        paginar<{ id: string; comanda_id: string | null }>((de, ate) =>
          banco
            .from("oricse_caixa_lancamentos")
            .select("id,comanda_id:detalhes->>comanda_id")
            .eq("clinica_id", clinicaId)
            .in("id", ids)
            .order("id")
            .range(de, ate),
        ),
    );
    const vinculos = new Map(porAutor.map((l) => [l.id, l.comanda_id]));
    const com = await emLotes(
      porAutor.flatMap((l) => (l.comanda_id ? [l.comanda_id] : [])),
      (ids) =>
        paginar<{ id: string; atendimento_registro_id: string | null }>((de, ate) =>
          supabaseAdmin
            .from("oricse_portal_comandas")
            .select("id,atendimento_registro_id")
            .eq("clinica_id", clinicaId)
            .in("id", ids)
            .order("id")
            .range(de, ate),
        ),
    );
    const autores = await emLotes(
      com.flatMap((c) => (c.atendimento_registro_id ? [c.atendimento_registro_id] : [])),
      (ids) =>
        paginar<Atendimento>((de, ate) =>
          supabaseAdmin
            .from("oricse_animal_registros_extra")
            .select("id,autor:dados_atendimento->>autorNome")
            .eq("clinica_id", clinicaId)
            .in("id", ids)
            .order("id")
            .range(de, ate),
        ),
    );
    const profissional = new Map(autores.map((a) => [a.id, a.autor]));
    const autorComanda = new Map(
      com.map((c) => [
        c.id,
        c.atendimento_registro_id ? profissional.get(c.atendimento_registro_id) : null,
      ]),
    );
    return {
      indicadores: [
        { rotulo: "Entradas pagas", valor: moeda(soma(entradas, (l) => l.valor_centavos)) },
        { rotulo: "Recebimentos", valor: entradas.length },
      ],
      notas: [
        "Bruto por competência, antes de estornos. A clínica selecionada é o recorte de unidade.",
        "Os recortes de itens do PDV e de profissionais da consulta são subconjuntos do total. O operador do caixa não é tratado como profissional do atendimento.",
      ],
      tabelas: [
        {
          titulo: "Por setor",
          colunas: ["Setor", "Recebimentos", "Valor"],
          linhas: porSetor.map((g) => [g.nome, g.registros, moeda(g.centavos)]),
        },
        {
          titulo: "Produtos e serviços identificados no PDV",
          colunas: ["Item", "Unidades vendidas", "Subtotal"],
          linhas: gruposMonetarios(
            pdv,
            (l) => l.nome_snapshot,
            (l) => l.subtotal_centavos,
          ).map((g) => [
            g.nome,
            soma(
              pdv.filter((i) => i.nome_snapshot === g.nome),
              (i) => i.quantidade,
            ),
            moeda(g.centavos),
          ]),
        },
        {
          titulo: "Comandas de consulta por profissional",
          colunas: ["Profissional", "Recebimentos", "Valor"],
          linhas: gruposMonetarios(
            consultasComanda,
            (l) => autorComanda.get(vinculos.get(l.id) || "") || "Não identificado",
            (l) => l.valor_centavos,
          ).map((g) => [g.nome, g.registros, moeda(g.centavos)]),
        },
      ],
    };
  }

  if (codigo === "02") {
    const [ls, estornos] = await Promise.all([
      lancamentos(competenciaOuRegistro, undefined, "pago"),
      estornosPeriodo(),
    ]);
    const pagos = ls.filter((l) => entre(competencia(l)));
    const confirmado = soma(
      estornos.filter((e) => e.status === "confirmado" && noPeriodo(e.revisado_em)),
      (e) => e.valor_centavos,
    );
    const r = resumirCaixa(pagos, confirmado);
    return {
      indicadores: [
        { rotulo: "Entradas", valor: moeda(r.entradas) },
        { rotulo: "Saídas", valor: moeda(r.saidas) },
        { rotulo: "Estornos confirmados", valor: moeda(r.estornos) },
        { rotulo: "Resultado registrado", valor: moeda(r.movimentacaoLiquida) },
        { rotulo: "Margem por item", valor: "Custo não cadastrado" },
      ],
      notas: [
        "Resumo gerencial dos lançamentos registrados, não DRE nem lucro contábil. O catálogo não registra custo histórico por item; não estimamos margem.",
        "Entradas e saídas por competência. Estornos pela data de confirmação.",
      ],
      tabelas: [
        {
          titulo: "Saídas pagas por categoria",
          colunas: ["Categoria", "Lançamentos", "Valor"],
          linhas: gruposMonetarios(
            pagos.filter((l) => l.tipo === "saida"),
            (l) => l.setor,
            (l) => l.valor_centavos,
          ).map((g) => [g.nome, g.registros, moeda(g.centavos)]),
        },
      ],
    };
  }

  if (codigo === "03") {
    const turnos = (
      await paginar<Turno>((de, ate) =>
        banco
          .from("oricse_caixa_turnos")
          .select(
            "id,aberto_nome,aberto_em,fechado_nome,fechado_em,status,fundo_centavos,esperado_centavos,contado_centavos,divergencia_centavos",
          )
          .eq("clinica_id", clinicaId)
          .or(`${periodoTimestamp("aberto_em")},${periodoTimestamp("fechado_em")}`)
          .order("aberto_em", { ascending: false })
          .order("id")
          .range(de, ate),
      )
    ).filter((t) => noPeriodo(t.aberto_em) || noPeriodo(t.fechado_em));
    return {
      indicadores: [{ rotulo: "Turnos no período", valor: turnos.length }],
      notas: [
        "Inclui turnos abertos ou fechados no período. Os valores são os registrados no fechamento original.",
      ],
      tabelas: [
        {
          titulo: "Turnos",
          colunas: [
            "Aberto em",
            "Aberto por",
            "Fechado em",
            "Fechado por",
            "Situação",
            "Fundo",
            "Esperado",
            "Contado",
            "Diferença",
          ],
          linhas: turnos.map((t) => [
            hora(t.aberto_em),
            t.aberto_nome || "—",
            hora(t.fechado_em),
            t.fechado_nome || "—",
            t.status === "fechado" ? "Fechado" : "Aberto",
            moeda(t.fundo_centavos),
            moeda(t.esperado_centavos),
            moeda(t.contado_centavos),
            moeda(t.divergencia_centavos),
          ]),
        },
      ],
    };
  }

  if (codigo === "04") {
    const [ls, cs] = await Promise.all([
      lancamentos(competenciaOuRegistro, "entrada", "pendente"),
      comandas(periodoTimestamp("aberta_em"), true),
    ]);
    const avulsos = ls.filter(
      (l) => l.origem_tipo === "financeiro_manual" && entre(competencia(l)),
    );
    const abertas = cs.filter((c) => noPeriodo(c.aberta_em));
    const valores = [
      ...avulsos.map((l) => l.valor_centavos),
      ...abertas.map((c) => centavos(c.saldo)),
    ];
    return {
      indicadores: [
        { rotulo: "Saldo em aberto das origens do período", valor: moeda(soma(valores, (x) => x)) },
        { rotulo: "Pendências originadas no período", valor: valores.length },
        { rotulo: "Inadimplência", valor: "Sem vencimentos registrados" },
      ],
      notas: [
        "Mostra o saldo que ainda está aberto hoje das comandas abertas e dos lançamentos com competência no período. Pendências anteriores não entram neste total. Altere a data inicial para incluí-las.",
        "Comandas e entradas manuais são listadas separadamente.",
        "Sem vencimento registrado não classificamos o saldo como atrasado.",
      ],
      tabelas: [
        {
          titulo: "Comandas em aberto",
          colunas: ["Comanda", "Abertura", "Origem", "Saldo", "Situação"],
          linhas: abertas.map((c) => [
            `#${c.numero}`,
            hora(c.aberta_em),
            c.origem,
            moeda(centavos(c.saldo)),
            situacaoRecebivel(null, hoje),
          ]),
        },
        {
          titulo: "Entradas manuais pendentes",
          colunas: ["Descrição", "Competência", "Valor", "Situação"],
          linhas: avulsos.map((l) => [
            l.descricao,
            dataBR(competencia(l)),
            moeda(l.valor_centavos),
            situacaoRecebivel(null, hoje),
          ]),
        },
      ],
    };
  }

  if (codigo === "05") {
    const [ls, bs, es] = await Promise.all([
      lancamentos(`${competenciaOuRegistro},${periodoTimestamp("registrado_em")}`),
      baixasPeriodo(),
      estornosPeriodo(),
    ]);
    // A baixa pode trazer pagamento de competência anterior. Consulte também
    // baixas de todos os candidatos para não tratar a data original como liquidação.
    const movimentos = new Map(
      [...ls, ...(await caixaPorIds(bs.map((b) => b.lancamento_id)))].map((l) => [l.id, l]),
    );
    const baixas = await emLotes([...movimentos.keys()], (ids) =>
      paginar<Baixa>((de, ate) =>
        banco
          .from("oricse_caixa_baixas")
          .select("id,lancamento_id,valor_centavos,forma_pagamento,registrado_em")
          .eq("clinica_id", clinicaId)
          .in("lancamento_id", ids)
          .order("id")
          .range(de, ate),
      ),
    );
    const fluxos = fluxoRegistrado(
      [...movimentos.values()],
      new Map(baixas.map((b) => [b.lancamento_id, diaNoFuso(b.registrado_em)])),
      es.flatMap((e) =>
        e.status === "confirmado" && e.revisado_em
          ? [{ dia: diaNoFuso(e.revisado_em), valor_centavos: e.valor_centavos }]
          : [],
      ),
      inicio,
      fim,
    );
    const aPagar = ls.filter(
      (l) => l.tipo === "saida" && l.status === "pendente" && entre(competencia(l)),
    );
    return {
      indicadores: [
        { rotulo: "Saídas pendentes", valor: moeda(soma(aPagar, (l) => l.valor_centavos)) },
        { rotulo: "Movimentação efetiva", valor: moeda(soma(fluxos, (d) => d.efetivo)) },
        { rotulo: "Movimentação projetada", valor: moeda(soma(fluxos, (d) => d.projetado)) },
      ],
      notas: [
        "Projeção só dos lançamentos do caixa, sem saldo bancário ou previsão de receitas não registradas.",
        "Pagos usam a data da baixa (ou registro); pendentes usam a competência informada, que não é vencimento.",
      ],
      tabelas: [
        {
          titulo: "Fluxo por dia",
          colunas: [
            "Dia",
            "Entradas pagas",
            "Saídas pagas",
            "Estornos",
            "Entradas previstas",
            "Saídas previstas",
            "Movimento projetado",
          ],
          linhas: fluxos.map((d) => [
            dataBR(d.dia),
            moeda(d.entradas),
            moeda(d.saidas),
            moeda(d.estornos),
            moeda(d.aReceber),
            moeda(d.aPagar),
            moeda(d.projetado),
          ]),
        },
        {
          titulo: "Saídas pendentes",
          colunas: ["Competência", "Descrição", "Setor", "Valor"],
          linhas: aPagar.map((l) => [
            dataBR(competencia(l)),
            l.descricao,
            l.setor,
            moeda(l.valor_centavos),
          ]),
        },
      ],
    };
  }

  if (codigo === "06") {
    const [entradas, bs, es] = await Promise.all([
      lancamentos(periodoTimestamp("registrado_em"), "entrada", "pago"),
      baixasPeriodo(),
      estornosPeriodo(),
    ]);
    const portal = entradas.filter(
      (l) => l.origem_tipo === "pagamento_portal" && noPeriodo(l.registrado_em),
    );
    const pagamentos = await emLotes(
      portal.map((l) => l.origem_id),
      (ids) =>
        paginar<Pagamento>((de, ate) =>
          supabaseAdmin
            .from("oricse_pagamentos")
            .select(
              "id,modalidade,status,recebido_mp_centavos,recebido_oricse_centavos,recebido_clinica_centavos,bruto_centavos",
            )
            .eq("clinica_id", clinicaId)
            .in("id", ids)
            .order("id")
            .range(de, ate),
        ),
    );
    const porId = new Map(pagamentos.map((p) => [p.id, p]));
    const estornos = es.filter((e) => noPeriodo(e.solicitado_em) || noPeriodo(e.revisado_em));
    const baixas = bs.filter((b) => noPeriodo(b.registrado_em));
    const divergencias = portal.filter((l) => {
      const p = porId.get(l.origem_id);
      return !p || p.bruto_centavos !== l.valor_centavos;
    });
    return {
      indicadores: [
        { rotulo: "Pagamentos do portal", valor: portal.length },
        { rotulo: "Diferenças entre caixa e portal", valor: divergencias.length },
        { rotulo: "Estornos exibidos", valor: estornos.length },
        { rotulo: "Baixas", valor: baixas.length },
      ],
      notas: [
        "Conciliação interna por identificador; não confirma repasse em extrato bancário. Taxas e valores da clínica são os gravados no pagamento, sem recalcular.",
        "Valores não informados ficam em branco; estornos são apresentados separadamente dos pagamentos.",
      ],
      tabelas: [
        {
          titulo: "Caixa × pagamento do portal",
          colunas: [
            "Registro",
            "Modalidade",
            "Caixa",
            "Bruto portal",
            "Taxa provedor",
            "Taxa ORICSE",
            "Clínica",
            "Estado portal",
            "Conferência",
          ],
          linhas: portal.map((l) => {
            const p = porId.get(l.origem_id);
            return [
              hora(l.registrado_em),
              p?.modalidade || "—",
              moeda(l.valor_centavos),
              moeda(p?.bruto_centavos ?? null),
              moeda(p?.recebido_mp_centavos ?? null),
              moeda(p?.recebido_oricse_centavos ?? null),
              moeda(p?.recebido_clinica_centavos ?? null),
              p?.status || "Sem pagamento vinculado",
              p && p.bruto_centavos === l.valor_centavos ? "Bruto confere" : "Revisar",
            ];
          }),
        },
        {
          titulo: "Baixas no período",
          colunas: ["Data", "Lançamento", "Forma", "Valor"],
          linhas: baixas.map((b) => [
            hora(b.registrado_em),
            b.lancamento_id,
            b.forma_pagamento,
            moeda(b.valor_centavos),
          ]),
        },
        {
          titulo: "Estornos no período",
          colunas: ["Solicitado em", "Revisado em", "Lançamento", "Status", "Valor"],
          linhas: estornos.map((e) => [
            hora(e.solicitado_em),
            hora(e.revisado_em),
            e.lancamento_id,
            e.status,
            moeda(e.valor_centavos),
          ]),
        },
      ],
    };
  }

  const [cs, os, vendas] = await Promise.all([
    comandas(`${periodoTimestamp("aberta_em")},${periodoTimestamp("finalizada_em")}`),
    paginar<Orcamento>((de, ate) =>
      supabaseAdmin
        .from("oricse_relatorio_orcamentos")
        .select("id,titulo,valor_centavos,criado_em,validade_em,venda_id")
        .eq("clinica_id", clinicaId)
        .gte("criado_em", margemInicio)
        .lt("criado_em", margemFim)
        .order("id")
        .range(de, ate),
    ),
    paginar<{ id: string; registrada_em: string; valor_centavos: number }>((de, ate) =>
      banco
        .from("oricse_vendas_expressas")
        .select("id,registrada_em,valor_centavos")
        .eq("clinica_id", clinicaId)
        .gte("registrada_em", margemInicio)
        .lt("registrada_em", margemFim)
        .order("id")
        .range(de, ate),
    ),
  ]);
  const orcamentos = os.filter((o) => noPeriodo(o.criado_em));
  const convertido = orcamentos.filter((o) => o.venda_id).length;
  const csPeriodo = cs.filter((c) => noPeriodo(c.aberta_em) || noPeriodo(c.finalizada_em));
  return {
    indicadores: [
      { rotulo: "Orçamentos registrados", valor: orcamentos.length },
      { rotulo: "Orçamentos vinculados a venda", valor: convertido },
      {
        rotulo: "Conversão até hoje dos orçamentos do período",
        valor: orcamentos.length
          ? (convertido / orcamentos.length).toLocaleString("pt-BR", {
              style: "percent",
              maximumFractionDigits: 1,
            })
          : "Sem base",
      },
      { rotulo: "Comandas no período", valor: csPeriodo.length },
    ],
    notas: [
      "Use Registrar para acompanhamento na tela de orçamento. Baixar, imprimir ou enviar o PDF sem registrar não entra na contagem.",
      "A taxa considera as vendas vinculadas até hoje aos orçamentos registrados no período, mesmo que a venda ocorra depois da data final. A tabela de vendas usa a data da venda.",
    ],
    tabelas: [
      {
        titulo: "Orçamentos emitidos no período",
        colunas: ["Código", "Emitido em", "Referência", "Validade", "Valor", "Venda vinculada"],
        linhas: orcamentos.map((o) => [
          o.id,
          hora(o.criado_em),
          o.titulo,
          dataBR(o.validade_em),
          moeda(o.valor_centavos),
          o.venda_id || "Não vinculada",
        ]),
      },
      {
        titulo: "Vendas Expressas no período",
        colunas: ["Código da venda", "Registro", "Valor"],
        linhas: vendas
          .filter((v) => noPeriodo(v.registrada_em))
          .map((v) => [v.id, hora(v.registrada_em), moeda(v.valor_centavos)]),
      },
      {
        titulo: "Comandas abertas ou fechadas no período",
        colunas: [
          "Comanda",
          "Origem",
          "Abertura",
          "Fechamento",
          "Situação",
          "Total",
          "Pago",
          "Saldo",
        ],
        linhas: csPeriodo.map((c) => [
          `#${c.numero}`,
          c.origem,
          hora(c.aberta_em),
          hora(c.finalizada_em),
          c.status,
          moeda(centavos(c.total)),
          moeda(centavos(c.total_pago)),
          moeda(centavos(c.saldo)),
        ]),
      },
    ],
  };
}
