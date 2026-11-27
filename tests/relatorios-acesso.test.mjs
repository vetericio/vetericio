import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const urlLib = new URL("../src/lib/relatorios.ts", import.meta.url).href;
const codigo = fs.readFileSync(new URL("../src/lib/relatorios.server.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(codigo, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const chave = Symbol.for("oricse.tests.relatorios.deps");
const programa = outputText
  .replace('import { supabaseAdmin } from "@/integrations/supabase/client.server";', "")
  .replace(
    'import { clienteSupabaseUsuario, exigirPermissaoClinica } from "@/lib/permissao-clinica.server";',
    "",
  )
  .replace('from "./relatorios";', `from ${JSON.stringify(urlLib)};`)
  .replace(
    "    const { data: auth, error }",
    '    const { supabaseAdmin, clienteSupabaseUsuario, exigirPermissaoClinica } = globalThis[Symbol.for("oricse.tests.relatorios.deps")];\n    const { data: auth, error }',
  );
const { gerarRelatorio } = await import(
  `data:text/javascript;base64,${Buffer.from(programa).toString("base64")}`
);
const params = {
  accessToken: "jwt-ficticio",
  clinicaId: "clinica-a",
  inicio: "2026-11-27",
  fim: "2026-11-27",
  codigo: "01",
};

test("relatórios não iniciam consulta sem autenticação, vínculo e permissão do módulo", async () => {
  let consultas = 0;
  let autorizado = false;
  let autenticado = false;
  globalThis[chave] = {
    supabaseAdmin: {
      auth: { getUser: async () => ({ data: { user: autenticado ? { id: "vet-a" } : null } }) },
    },
    async exigirPermissaoClinica(_admin, usuario, clinica, permissoes, jwt) {
      assert.equal(usuario, "vet-a");
      assert.equal(jwt, params.accessToken);
      if (
        !autorizado ||
        clinica !== "clinica-a" ||
        permissoes[0] !== "caixa.financeiro.visualizar"
      ) {
        throw new Error("Seu cargo ou plano não autoriza esta operação.");
      }
    },
    clienteSupabaseUsuario() {
      consultas++;
      const filtros = [];
      const query = {
        select: () => query,
        eq: (coluna, valor) => {
          filtros.push([coluna, valor]);
          return query;
        },
        or: () => query,
        order: () => query,
        range: async () => {
          assert.deepEqual(filtros, [
            ["clinica_id", "clinica-a"],
            ["tipo", "entrada"],
            ["status", "pago"],
          ]);
          return {
            data: [
              {
                id: "mov-a",
                setor: "Consultas",
                valor_centavos: 5000,
                data_competencia: params.inicio,
                registrado_em: "2026-11-27T12:00:00Z",
              },
            ],
            error: null,
          };
        },
      };
      return {
        from: (tabela) => {
          assert.equal(tabela, "oricse_caixa_lancamentos");
          return query;
        },
      };
    },
  };
  try {
    await assert.rejects(gerarRelatorio(params), /Sessão inválida/);
    autenticado = true;
    await assert.rejects(gerarRelatorio(params), /não autoriza/);
    autorizado = true;

    await assert.rejects(gerarRelatorio({ ...params, clinicaId: "clinica-b" }), /não autoriza/);
    assert.equal(consultas, 0);
    const relat = await gerarRelatorio(params);
    assert.equal(relat.indicadores[1].valor, 1);
    assert.equal(relat.tabelas[0].linhas[0][0], "Consultas");
    assert.equal(consultas, 1);
  } finally {
    delete globalThis[chave];
  }
});
