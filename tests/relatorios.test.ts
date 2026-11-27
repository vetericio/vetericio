import assert from "node:assert/strict";
import test from "node:test";
import {
  CODIGOS_FINANCEIROS,
  competencia,
  fluxoRegistrado,
  gruposMonetarios,
  periodoValido,
  RELATORIOS,
  resumirCaixa,
  situacaoRecebivel,
  type LancamentoRelatorio,
} from "../src/lib/relatorios.ts";

const movimento = (
  id: string,
  tipo: "entrada" | "saida",
  status: LancamentoRelatorio["status"],
  valor_centavos: number,
  campos = {},
): LancamentoRelatorio => ({
  id,
  tipo,
  status,
  valor_centavos,
  setor: "Consultas",
  descricao: "Teste",
  forma_pagamento: "Pix",
  data_competencia: null,
  registrado_em: "2026-11-27T12:00:00Z",
  origem_tipo: "financeiro_manual",
  origem_id: id,
  ...campos,
});

test("catálogo conserva 30 entradas e entrega 01 a 07, na ordem", () => {
  assert.equal(RELATORIOS.length, 30);
  assert.deepEqual(CODIGOS_FINANCEIROS, ["01", "02", "03", "04", "05", "06", "07"]);
});

test("período admite só dias reais e no máximo 93 dias", () => {
  assert.equal(periodoValido("2026-04-01", "2026-07-02"), true);
  assert.equal(periodoValido("2026-04-01", "2026-07-03"), false);
  assert.equal(periodoValido("2026-02-29", "2026-03-01"), false);
  assert.equal(periodoValido("2026-03-02", "2026-03-01"), false);
});

test("competência prevalece e o horário UTC não muda o dia da clínica", () => {
  const x = movimento("1", "entrada", "pago", 100, { registrado_em: "2026-11-28T01:00:00Z" });
  assert.equal(competencia(x), "2026-11-27");
  assert.equal(competencia({ ...x, data_competencia: "2026-10-13" }), "2026-10-13");
  assert.deepEqual(
    gruposMonetarios(
      [x, { ...x, id: "2", setor: " " }],
      (l) => l.setor,
      (l) => l.valor_centavos,
    ),
    [
      { nome: "Consultas", registros: 1, centavos: 100 },
      { nome: "Não informado", registros: 1, centavos: 100 },
    ],
  );
});

test("resultado registrado separa pagos, pendentes, cancelados e estornos", () => {
  assert.deepEqual(
    resumirCaixa(
      [
        movimento("1", "entrada", "pago", 5000),
        movimento("2", "saida", "pago", 2000),
        movimento("3", "entrada", "pendente", 30000),
        movimento("4", "saida", "cancelado", 9900),
      ],
      700,
    ),
    { entradas: 5000, saidas: 2000, estornos: 700, movimentacaoLiquida: 2300 },
  );
});

test("fluxo usa baixa no dia certo, inclui previsão separada e não conta valores fora do período", () => {
  const linhas = [
    movimento("1", "entrada", "pago", 9000, { registrado_em: "2026-10-01T12:00:00Z" }),
    movimento("2", "saida", "pendente", 2000, { data_competencia: "2026-11-28" }),
    movimento("3", "entrada", "pendente", 1200, { data_competencia: "2026-11-28" }),
    movimento("4", "saida", "cancelado", 9999),
    movimento("5", "saida", "pago", 1000, { registrado_em: "2026-11-28T02:00:00Z" }),
  ];
  assert.deepEqual(
    fluxoRegistrado(
      linhas,
      new Map([["1", "2026-11-28"]]),
      [{ dia: "2026-11-28", valor_centavos: 500 }],
      "2026-11-27",
      "2026-11-28",
    ),
    [
      {
        dia: "2026-11-27",
        entradas: 0,
        saidas: 1000,
        aReceber: 0,
        aPagar: 0,
        estornos: 0,
        efetivo: -1000,
        projetado: -1000,
      },
      {
        dia: "2026-11-28",
        entradas: 9000,
        saidas: 0,
        aReceber: 1200,
        aPagar: 2000,
        estornos: 500,
        efetivo: 8500,
        projetado: 7700,
      },
    ],
  );
});

test("falta de vencimento não é inadimplência", () => {
  assert.equal(situacaoRecebivel(null, "2026-11-27"), "Sem vencimento registrado");
  assert.equal(situacaoRecebivel("2026-11-26", "2026-11-27"), "Vencido");
  assert.equal(situacaoRecebivel("2026-11-27", "2026-11-27"), "Vence hoje");
  assert.equal(situacaoRecebivel("2026-11-28", "2026-11-27"), "A vencer");
});
