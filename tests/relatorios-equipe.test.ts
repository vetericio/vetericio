import assert from "node:assert/strict";
import test from "node:test";
import {
  relatorioJornadaEquipe,
  relatorioPlantaoEquipe,
  relatorioProdutividadeEquipe,
  type JornadaEquipe,
} from "../src/lib/relatorios-equipe.ts";

const dia = "2026-11-27";
const periodo = { inicio: dia, fim: dia };

test("produção conta consultas por id do autor, sem expor e-mail legado", () => {
  const consultas = [
    { autor_id: "a", autor_nome: "Alguém" },
    { autor_id: "a", autor_nome: "Nome desatualizado" },
    { autor_id: "b", autor_nome: "legado@example.com" },
    { autor_id: null, autor_nome: null },
  ];
  const r = relatorioProdutividadeEquipe(consultas, null);
  assert.deepEqual(
    r.indicadores.map((i) => i.valor),
    [4, 2, "Não rastreada"],
  );
  assert.deepEqual(r.tabelas[0].linhas, [
    ["Alguém", 2],
    ["Profissional 2", 1],
    ["Sem autor registrado", 1],
  ]);
  assert.doesNotMatch(JSON.stringify(r), /comiss|@/i);
});

test("comissão lê apenas somas do valor lançado, não calcula regras ou pagamento", () => {
  const r = relatorioProdutividadeEquipe(
    [],
    [
      { data: dia, valor: "30.01" },
      { data: dia, valor: 1.02 },
    ],
  );
  assert.deepEqual(r.tabelas[1].linhas, [["27/11/2026", 2, "R$\u00a031,03"]]);
  const parcial = relatorioProdutividadeEquipe(
    [],
    [
      { data: dia, valor: "" },
      { data: dia, valor: 6 },
    ],
  );
  assert.equal(parcial.indicadores.at(-1)?.valor, "—");
});

test("jornada diferencia horas consolidadas, diárias e jornada em aberto sem estimar banco de horas", () => {
  const base: JornadaEquipe = {
    funcionario_id: "identidade-oculta",
    data: dia,
    modalidade: "hora",
    estado: "finalizada",
    segundos_trabalhados: "3600",
  };
  const r = relatorioJornadaEquipe(
    [
      base,
      { ...base, estado: "pausada", segundos_trabalhados: 1800 },
      { ...base, estado: "ativa", segundos_trabalhados: 0 },
      { ...base, modalidade: "diaria", estado: "diaria", segundos_trabalhados: 360000 },
      { ...base, data: "2026-11-26" },
    ],
    periodo,
  );
  assert.deepEqual(
    r.indicadores.map((i) => i.valor),
    [1, "1h 30min", 1, 2, "Não rastreado"],
  );
  assert.deepEqual(r.tabelas[0].linhas, [["27/11/2026", "1h 30min", 1, 1, 1, 1, 0]]);
  assert.doesNotMatch(JSON.stringify(r), /identidade-oculta/);
  assert.equal(
    relatorioJornadaEquipe([{ ...base, segundos_trabalhados: "" }], periodo).indicadores[1].valor,
    "Parcial",
  );
});

test("plantão separa cobertura de anamnese, pistas de passagem e pendências atuais; nunca devolve texto clínico", () => {
  const r = relatorioPlantaoEquipe(
    {
      historico: [
        {
          data: dia,
          turno: "diurno",
          registros: [{ animal: "PACIENTE_SIGILOSO" }],
          anamneses: [
            {
              atencao: "TEOR_SIGILOSO",
              pendencias: [{ texto: "TEOR_SIGILOSO", feito: false }, { feito: true }],
            },
          ],
        },
        { data: dia, turno: "noturno", registros: [] },
        { data: "2026-11-26", turno: "noturno", registros: [] },
      ],
      atual: { dia, turno: "noturno", veterinario: "PROFISSIONAL_SIGILOSO" },
      pendencias: [
        { criadoEm: "2026-11-28T01:00:00Z", status: "pendente" }, // ainda sexta no Brasil
        { criadoEm: "2026-11-27T01:00:00Z", status: "pendente" },
        { criadoEm: "2026-11-27T23:00:00Z", status: "realizado" },
      ],
    },
    periodo,
  );
  assert.deepEqual(
    r.indicadores.map((i) => i.valor),
    [2, 1, "1 (parcial)", "Não rastreadas", 1],
  );
  assert.deepEqual(r.tabelas[0].linhas, [
    ["27/11/2026", 2, 1, 1, 0, 1, "1 (parcial)", "1 (parcial)", "1 (parcial)", 1],
  ]);
  assert.deepEqual(r.tabelas[1].linhas, [[1, 1, 0, 0]]);
  assert.ok(r.notas.some((n) => n.includes("Plantão atual: noturno")));
  assert.doesNotMatch(JSON.stringify(r), /SIGILOSO/);
  const ausente = relatorioPlantaoEquipe(
    { historico: null, atual: null, pendencias: null },
    periodo,
  );
  assert.equal(ausente.indicadores[0].valor, "Sem histórico disponível");
  assert.equal(ausente.indicadores[4].valor, "Sem registro disponível");
});
