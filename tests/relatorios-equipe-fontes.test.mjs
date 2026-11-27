import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const codigo = fs.readFileSync(
  new URL("../src/lib/relatorios-equipe.server.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(codigo, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const deps = Symbol.for("oricse.tests.relatoriosEquipe.fontes");
const programa =
  outputText
    .replace(/^import .+ from "@\/.+";$/gm, "")
    .replace(
      'from "./relatorios-equipe.ts";',
      `from ${JSON.stringify(new URL("../src/lib/relatorios-equipe.ts", import.meta.url).href)};`,
    ) +
  `
const fontes = () => globalThis[Symbol.for("oricse.tests.relatoriosEquipe.fontes")];
const executarDriveDbInterno = (...args) => fontes().executarDriveDbInterno(...args);
const supabaseAdmin = { from: (...args) => fontes().supabaseAdmin.from(...args) };
`;
const { gerarRelatorioEquipe } = await import(
  `data:text/javascript;base64,${Buffer.from(programa).toString("base64")}`
);

test("entry point mantém escopo clínico e não lê finanças sem a permissão de equipe", async () => {
  const inicio = "2026-11-27";
  const args = { accessToken: "sessao-ficticia", clinicaId: "clinica-piloto", inicio, fim: inicio };
  const chamadasDrive = [];
  const chamadasPg = [];
  globalThis[deps] = {
    async executarDriveDbInterno(q) {
      assert.equal(q.operation, "select");
      assert.equal(q.accessToken, args.accessToken);
      assert.deepEqual(q.filters.slice(0, 3), [
        { kind: "eq", column: "clinica_id", value: args.clinicaId },
        { kind: "gte", column: "data", value: args.inicio },
        { kind: "lte", column: "data", value: args.fim },
      ]);
      chamadasDrive.push(q);
      return { data: [], error: null };
    },
    supabaseAdmin: {
      from(tabela) {
        const filtros = [];
        const consulta = { tabela, filtros };
        chamadasPg.push(consulta);
        const b = {
          select(colunas) {
            consulta.colunas = colunas;
            return b;
          },
          order: () => b,
          range: () => b,
          maybeSingle: () => b,
          async overrideTypes() {
            assert.deepEqual(filtros[0], ["eq", "clinica_id", args.clinicaId]);
            return {
              error: null,
              data:
                tabela === "oricse_dados_modulos"
                  ? { historico: "[]", atual: null, pendencias: "[]" }
                  : [{ autor_id: "autor", autor_nome: "Autora" }],
            };
          },
        };
        for (const op of ["eq", "gte", "lte", "not"]) {
          b[op] = (...valores) => {
            filtros.push([op, ...valores]);
            return b;
          };
        }
        return b;
      },
    },
  };
  try {
    const prod = await gerarRelatorioEquipe({ ...args, codigo: "13", podeVerFinanceiro: false });
    assert.equal(chamadasDrive.length, 0);
    assert.equal(prod.tabelas[0].linhas[0][1], 1);
    assert.equal(chamadasPg[0].tabela, "oricse_animal_registros_extra");
    assert.ok(chamadasPg[0].filtros.some((f) => f[1] === "dados_atendimento->>consulta"));
    assert.doesNotMatch(chamadasPg[0].colunas, /tutor|animal_id/i);
    await gerarRelatorioEquipe({ ...args, codigo: "13", podeVerFinanceiro: true });
    assert.equal(chamadasDrive[0].table, "oricse_pagamento_lancamentos");
    assert.equal(chamadasDrive[0].columns, "data,valor");
    assert.deepEqual(chamadasDrive[0].filters[3], {
      kind: "eq",
      column: "tipo",
      value: "comissao",
    });
    await gerarRelatorioEquipe({ ...args, codigo: "14", podeVerFinanceiro: true });
    assert.equal(chamadasDrive[1].table, "oricse_jornada_registros");
    assert.doesNotMatch(chamadasDrive[1].columns, /valor/);
    const plantao = await gerarRelatorioEquipe({ ...args, codigo: "18", podeVerFinanceiro: false });
    assert.equal(plantao.indicadores[0].valor, 0);
    assert.equal(chamadasPg[2].tabela, "oricse_dados_modulos");
    assert.deepEqual(chamadasPg[2].filtros[1], ["eq", "chave", "estado_sistema"]);
    assert.match(
      chamadasPg[2].colunas,
      /veterico-plantoes-v1.*veterico-plantao-v1.*veterico-pendencias-v1/,
    );
  } finally {
    delete globalThis[deps];
  }
});
