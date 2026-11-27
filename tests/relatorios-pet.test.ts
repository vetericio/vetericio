import assert from "node:assert/strict";
import test from "node:test";
import {
  limitesDoPeriodoPet,
  montarRelatorioBanho,
  montarRelatorioHotel,
  type BanhoRegistro,
  type EstadiaPet,
} from "../src/lib/relatorios-pet.ts";
import { consultarRelatorioPet } from "../src/lib/relatorios-pet.server.ts";

const periodo = { inicio: "2026-11-26", fim: "2026-11-26" };
const agora = Date.parse("2026-11-26T18:00:00Z");
const banho: BanhoRegistro = {
  id: "a",
  servico_nome: "Tosa",
  profissional: "Profissional",
  inicio: "2026-11-26T11:00:00Z",
  status: "pronto",
  pronto_em: "2026-11-26T12:00:00Z",
  entregue_em: null,
};
const estadia: EstadiaPet = {
  id: "a",
  status: "concluida",
  acomodacao_id: "quarto-01",
  chegada_prevista: "2026-11-25T12:00:00Z",
  saida_prevista: "2026-11-26T12:00:00Z",
  checkin_em: "2026-11-25T12:00:00Z",
  checkout_em: "2026-11-26T14:00:00Z",
  valor_final_centavos: 4000,
};

test("janela civil de São Paulo é exclusiva no fim e respeita o horário de verão histórico", () => {
  assert.deepEqual(limitesDoPeriodoPet(periodo), {
    inicio: "2026-11-26T03:00:00.000Z",
    fim: "2026-11-27T03:00:00.000Z",
  });
  assert.deepEqual(limitesDoPeriodoPet({ inicio: "2018-11-04", fim: "2018-11-04" }), {
    inicio: "2018-11-04T03:00:00.000Z",
    fim: "2018-11-05T02:00:00.000Z",
  });
});

test("produção do banho é por conclusão; cancelados são por previsão e legado sem data é explícito", () => {
  const linhas = [
    banho,
    { ...banho, id: "b", status: "cancelado", pronto_em: null },
    {
      ...banho,
      id: "c",
      status: "entregue",
      inicio: "2026-11-25T10:00:00Z",
      pronto_em: null,
      entregue_em: "2026-11-26T13:00:00Z",
    },
    { ...banho, id: "d", status: "entregue", pronto_em: null },
    { ...banho, id: "e", inicio: "2026-11-27T03:00:00Z", pronto_em: "2026-11-27T04:00:00Z" },
    { ...banho, id: "f", status: "entregue", entregue_em: "2026-11-26T17:00:00Z" },
  ];
  const r = montarRelatorioBanho(periodo, linhas);
  assert.deepEqual(
    r.indicadores.map((i) => i.valor),
    [4, 3, 1],
  );
  assert.deepEqual(r.tabelas[0].linhas, [["Tosa", "Profissional", 4, 3, 1]]);
  assert.match(r.notas.join(" "), /sem data de conclusão/);
});

test("banho usa recebimentos por data de caixa e estornos confirmados separadamente", () => {
  const r = montarRelatorioBanho(periodo, [], {
    pagamentos: [
      { registrado_em: "2026-11-27T02:59:59Z", valor_centavos: 5000, forma_pagamento: "Pix" },
      { registrado_em: "2026-11-27T03:00:00Z", valor_centavos: 20000, forma_pagamento: "Pix" },
    ],
    estornos: [{ revisado_em: "2026-11-26T20:31:00Z", valor_centavos: 1000 }],
  });
  assert.deepEqual(
    r.indicadores.slice(3).map((i) => i.valor),
    ["R$ 50,00", "R$ 10,00", "R$ 40,00"],
  );
  assert.equal(r.tabelas[2].linhas[0][3], "Sem vínculo");
});

test("hotel separa presença de reservas, não inventa check-in e não cobra diárias pela ocupação", () => {
  const r = montarRelatorioHotel(
    periodo,
    [
      estadia,
      { ...estadia, id: "b", status: "reservada", checkin_em: null, checkout_em: null },
      { ...estadia, id: "c", status: "cancelada", checkin_em: null, checkout_em: null },
      {
        ...estadia,
        id: "d",
        status: "hospedado",
        checkin_em: "2026-11-26T15:00:00Z",
        checkout_em: null,
      },
      { ...estadia, id: "e", checkin_em: null },
      { ...estadia, id: "f", checkout_em: "2026-11-26T03:00:00Z" },
    ],
    [{ id: "quarto-01", nome: "Acomodação 1" }],
    [{ categoria: "Ração" }],
    agora,
  );
  assert.deepEqual(
    r.indicadores.map((i) => i.valor),
    [2, 1, 3, 5, 1],
  );
  assert.deepEqual(r.tabelas[0].linhas, [["26/11/2026", 2, 1]]);
  assert.deepEqual(r.tabelas[1].linhas, [["Acomodação 1", 2, 1]]);
  assert.match(r.notas.join(" "), /sem check-in foram excluídos/);
  assert.doesNotMatch(JSON.stringify(r), /40,00|apurado registrado/);
});

test("hotel não trata o total de check-out como caixa, soma extras em centavos e não substitui valor ausente", () => {
  const r = montarRelatorioHotel(
    periodo,
    [estadia, { ...estadia, id: "b", valor_final_centavos: null }],
    [],
    [{ categoria: "Ração", quantidade: 0.5, valor_unitario_centavos: 1199 }],
    agora,
    {
      pagamentos: [
        {
          registrado_em: "2026-11-26T16:00:00Z",
          valor_centavos: 2500,
          forma_pagamento: "Dinheiro",
        },
      ],
      estornos: [],
    },
  );
  assert.deepEqual(r.tabelas[2].linhas, [["26/11/2026", 2, 4, "R$ 40,00", 1]]);
  assert.deepEqual(r.tabelas[3].linhas, [["Ração", 1, "R$ 6,00"]]);
  assert.equal(r.tabelas[4].linhas[0][2], "R$ 25,00");
  assert.match(r.notas.join(" "), /não identifica a estadia/);
});

const tipada = <T>(resposta: T) => {
  const promessa = Promise.resolve(resposta);
  return Object.assign(promessa, { overrideTypes: () => promessa });
};

type Chamada = { tabela: string; filtros: unknown[][]; campos: string };
function bancoDeTeste(falharEm?: string, primeiraPaginaCheia = false) {
  const chamadas: Chamada[] = [];
  const banco = {
    from(tabela: string) {
      const chamada: Chamada = { tabela, filtros: [], campos: "" };
      chamadas.push(chamada);
      const b = {
        select(campos: string) {
          chamada.campos = campos;
          return b;
        },
        eq(...args: unknown[]) {
          chamada.filtros.push(["eq", ...args]);
          return b;
        },
        in(...args: unknown[]) {
          chamada.filtros.push(["in", ...args]);
          return b;
        },
        gte(...args: unknown[]) {
          chamada.filtros.push(["gte", ...args]);
          return b;
        },
        lt(...args: unknown[]) {
          chamada.filtros.push(["lt", ...args]);
          return b;
        },
        or(...args: unknown[]) {
          chamada.filtros.push(["or", ...args]);
          return b;
        },
        order(...args: unknown[]) {
          chamada.filtros.push(["order", ...args]);
          return b;
        },
        range(de: number, ate: number) {
          chamada.filtros.push(["range", de, ate]);
          if (tabela === falharEm) return tipada({ data: null, error: { message: "falha" } });
          if (primeiraPaginaCheia && tabela === "oricse_banho_tosa_agendamentos" && !de)
            return tipada({
              data: Array.from({ length: 500 }, (_, i) => ({ ...banho, id: String(i) })),
              error: null,
            });
          return tipada({ data: [], error: null });
        },
      };
      return b;
    },
  } as unknown as Parameters<typeof consultarRelatorioPet>[0];
  return { banco, chamadas };
}

const args = { ...periodo, clinicaId: "uma-clinica" };
test("relatórios operacionais não leem caixa, estornos ou colunas de valores", async () => {
  const { banco, chamadas } = bancoDeTeste();
  const banho = await consultarRelatorioPet(
    banco,
    { ...args, codigo: "11", podeVerFinanceiro: false },
    agora,
  );
  const hotel = await consultarRelatorioPet(
    banco,
    { ...args, codigo: "12", podeVerFinanceiro: false },
    agora,
  );
  assert.equal(chamadas.length, 4);
  assert.equal(chamadas.filter((c) => c.tabela.includes("caixa")).length, 0);
  assert.ok(
    chamadas.every((c) => !c.campos.includes("centavos") && !c.campos.includes("pagamento")),
  );
  assert.ok(
    chamadas.every((c) => c.filtros.some((f) => f[1] === "clinica_id" && f[2] === args.clinicaId)),
  );
  assert.match(banho.notas.at(-1)!, /permissão de visualizar o Financeiro/);
  assert.match(hotel.notas.at(-1)!, /permissão de visualizar o Financeiro/);
});

test("consultas financeiras são das categorias e clínicas corretas e não silenciam erro de RLS", async () => {
  const { banco, chamadas } = bancoDeTeste();
  await consultarRelatorioPet(banco, { ...args, codigo: "12", podeVerFinanceiro: true }, agora);
  const estorno = chamadas.find((c) => c.tabela === "oricse_caixa_estornos")!;
  assert.ok(estorno.filtros.some((f) => f[1] === "origem.clinica_id" && f[2] === args.clinicaId));
  assert.ok(
    estorno.filtros.some((f) => f[1] === "origem.setor" && (f[2] as string[])[0] === "Hotelzinho"),
  );
  assert.ok(estorno.filtros.some((f) => f[1] === "status" && f[2] === "confirmado"));
  assert.ok(
    chamadas.every((c) => c.filtros.some((f) => f[1] === "clinica_id" && f[2] === args.clinicaId)),
  );
  await assert.rejects(
    consultarRelatorioPet(
      bancoDeTeste("oricse_caixa_lancamentos").banco,
      { ...args, codigo: "11", podeVerFinanceiro: true },
      agora,
    ),
    /Não foi possível consultar/,
  );
});

test("paginação do módulo não limita o relatório à primeira página", async () => {
  const { banco, chamadas } = bancoDeTeste(undefined, true);
  const r = await consultarRelatorioPet(
    banco,
    { ...args, codigo: "11", podeVerFinanceiro: false },
    agora,
  );
  assert.equal(r.indicadores[0].valor, 500);
  assert.equal(chamadas.length, 2);
  assert.deepEqual(chamadas[1].filtros.at(-1), ["range", 500, 999]);
});
