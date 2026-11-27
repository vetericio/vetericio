import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const codigo = fs.readFileSync(
  new URL("../src/lib/relatorios-agenda.server.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(codigo, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const deps = Symbol.for("oricse.tests.relatoriosAgenda.fontes");
const programa =
  outputText
    .replace(/^import .+ from "@\/.+";$/gm, "")
    .replace(
      'from "./relatorios";',
      `from ${JSON.stringify(new URL("../src/lib/relatorios.ts", import.meta.url).href)};`,
    )
    .replace(
      'from "./relatorios-agenda";',
      `from ${JSON.stringify(new URL("../src/lib/relatorios-agenda.ts", import.meta.url).href)};`,
    ) +
  `
const fontes = () => globalThis[Symbol.for("oricse.tests.relatoriosAgenda.fontes")];
const clienteSupabaseUsuario = (...args) => fontes().clienteSupabaseUsuario(...args);
const executarDriveDbInterno = (...args) => fontes().executarDriveDbInterno(...args);
const supabaseAdmin = { from: (...args) => fontes().supabaseAdmin.from(...args) };
`;
const { gerarRelatorioAgenda } = await import(
  `data:text/javascript;base64,${Buffer.from(programa).toString("base64")}`
);

const clinicaId = "clinica-piloto";
const accessToken = "sessao-de-teste";
const inicio = "2026-11-27";
const args = { accessToken, clinicaId, inicio, fim: inicio };
const horario = (dia, hora) => `2026-11-${dia}T${hora}:00Z`;
const id = "d0df2fb6-d39e-4c34-ab9a-fdbb86b774ec";
const agenda = {
  id: "agenda",
  nome: "Agenda 1",
  inicio: "08:00",
  fim: "10:00",
  dias_semana: [5],
  intervalo_min: 30,
  timezone: "America/Sao_Paulo",
};
const versaoAnterior = {
  id,
  agenda_id: agenda.id,
  tipo: "Consulta",
  inicio: horario(27, "11:30"),
  fim: horario(27, "12:00"),
  estado: "cancelado",
  updated_at: horario(26, "11:00"),
};
const versaoAtual = {
  ...versaoAnterior,
  inicio: "2026-12-15T11:30:00Z",
  fim: "2026-12-15T12:00:00Z",
  updated_at: horario(27, "12:00"),
};

test("relatórios consultam somente a clínica selecionada e corrigem versões com horário movido para fora da janela", async () => {
  let leuVersaoPg = false;
  const banco = (tabela, operar) => ({
    from(t) {
      assert.equal(t, tabela);
      const filtros = [];
      let colunas;
      const ler = async () => {
        assert.deepEqual(filtros[0], ["eq", "clinica_id", clinicaId]);
        return { data: operar(filtros, colunas), error: null };
      };
      const q = {
        select(campos) {
          colunas = campos;
          return q;
        },
        order() {
          return q;
        },
        range: () => q,
        overrideTypes: () => q,
        then(ok, erro) {
          return ler().then(ok, erro);
        },
      };
      for (const op of ["eq", "gte", "gt", "lt", "in"]) {
        q[op] = (...valores) => {
          filtros.push([op, ...valores]);
          return q;
        };
      }
      return q;
    },
  });
  globalThis[deps] = {
    supabaseAdmin: banco("oricse_fila_espera", (_filtros, colunas) => {
      assert.equal(colunas, "chegada_em,chamado_em,status");
      return [
        { chegada_em: horario(27, "11:00"), chamado_em: horario(27, "11:15"), status: "Chamado" },
      ];
    }),
    clienteSupabaseUsuario(token) {
      assert.equal(token, accessToken);
      return {
        from(t) {
          if (t === "oricse_agendas_online") return banco(t, () => [agenda]).from(t);
          assert.equal(t, "oricse_agendamentos_online");
          return banco(t, (filtros, colunas) => {
            assert.match(colunas, /status_clinico:dados->>status_clinico/);
            const outraVersao = filtros.find(([op]) => op === "in");
            if (!outraVersao) return [];
            assert.deepEqual(outraVersao, ["in", "id", [id]]);
            leuVersaoPg = true;
            return [versaoAtual];
          }).from(t);
        },
      };
    },
    async executarDriveDbInterno(q) {
      assert.equal(q.accessToken, accessToken);
      assert.equal(q.operation, "select");
      assert.deepEqual(q.filters[0], { kind: "eq", column: "clinica_id", value: clinicaId });
      assert.ok(["oricse_agendas_online", "oricse_agendamentos_online"].includes(q.table));
      return { data: q.table === "oricse_agendas_online" ? [] : [versaoAnterior], error: null };
    },
  };
  try {
    const r09 = await gerarRelatorioAgenda({ ...args, codigo: "09" });
    assert.equal(leuVersaoPg, true);
    assert.equal(r09.indicadores[1].valor, 0);
    const r08 = await gerarRelatorioAgenda({ ...args, codigo: "08" });
    assert.equal(r08.indicadores[1].valor, "120");
    const r10 = await gerarRelatorioAgenda({ ...args, codigo: "10" });
    assert.equal(r10.indicadores[3].valor, "15");
    assert.equal(r10.indicadores[5].valor, "Não rastreada");
  } finally {
    delete globalThis[deps];
  }
});
