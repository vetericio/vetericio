import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  classeDaDose,
  colunaDeHorario,
  programarPlantao,
  turnoDoPainel,
} from "../src/lib/painel-plantao.ts";
import type { Medicacao, Registro } from "../src/lib/ficha.ts";

const agora = Date.parse("2026-11-28T21:05:00Z");
const turno = turnoDoPainel({
  dia: "2026-11-28",
  turno: "diurno",
  iniciadoEm: "2026-11-28T12:00:00Z",
})!;
const m: Medicacao = {
  nome: "Item fictício A",
  dose: "dado ilustrativo",
  duracao: "8h",
  horarioInicial: "10:00",
  programadaEm: "2026-11-28T12:00:00Z",
};
const ficha = (medicacoes: Medicacao[], extras: Partial<Registro> = {}): Registro => ({
  id: "ficha-ficticia",
  animal: "Paciente fictício",
  baia: "Baia 3",
  criadoEm: "2026-11-28T12:00:00Z",
  alimentacao: "",
  comportamento: "",
  fezes: "",
  mucosas: "",
  urina: "",
  vomito: "",
  temperatura: "",
  fc: "",
  fr: "",
  pas: "",
  glicemia: "",
  observacoes: "",
  medicacoes,
  ...extras,
});

test("expande horas explícitas e separa atraso, agora e próximas com horário de Brasília", async () => {
  const p = await programarPlantao([ficha([m])], turno, agora);
  assert.deepEqual(p.pacientes, [
    { id: "ficha-ficticia", nome: "Paciente fictício", baia: "Baia 3" },
  ]);
  assert.deepEqual(
    p.doses.map((d) => classeDaDose(d.horario, agora)),
    ["atrasadas", "agora", "proximas", "proximas", "proximas"],
  );
  assert.equal(p.doses[0].horario, "2026-11-28T13:00:00.000Z");
  assert.equal(colunaDeHorario(p.doses[2].horario), "2026-11-29T02:00");
});

test("não converte aplicações prévias, itens sem programação ou formas ambíguas em tarefas", async () => {
  const p = await programarPlantao(
    [
      ficha([
        m,
        { ...m },
        { ...m, nome: "B", aplicadoEm: new Date(agora).toISOString() },
        { ...m, nome: "C", duracao: "se necessário" },
        { ...m, nome: "D", horarioInicial: "99:99" },
      ]),
      ficha([m], { id: "óbito-exemplo", obito: { hora: "15:00", motivo: "exemplo" } }),
    ],
    turno,
    agora,
  );
  assert.equal(p.doses.length, 0);
  assert.equal(p.semProgramacao, 4);
  assert.equal(p.pacientes.length, 1);
});

test("legado fica visível apenas prospectivamente e nunca é confirmável antes de rever na ficha", async () => {
  const p = await programarPlantao(
    [ficha([{ ...m, programadaEm: undefined, duracao: "8/8h" }])],
    turno,
    agora,
  );
  assert.equal(p.programacoesLegadas, 1);
  assert.ok(p.doses.length);
  assert.ok(p.doses.every((d) => !d.confirmada && Date.parse(d.horario) >= agora));
});

test("uma atualização de dose/quantidade não apaga a identidade de execução no mesmo horário", async () => {
  const original = await programarPlantao([ficha([m])], turno, agora);
  const editada = await programarPlantao(
    [ficha([{ ...m, dose: "descrição revista", quantidade: "quantidade revista" }])],
    turno,
    agora,
  );
  assert.deepEqual(
    original.doses.map((d) => d.chave),
    editada.doses.map((d) => d.chave),
  );
  const conflito = await programarPlantao(
    [ficha([m, { ...m, duracao: "24h", dose: "descrição diferente" }])],
    turno,
    agora,
  );
  assert.ok(conflito.semProgramacao > 0);
  assert.ok(!conflito.doses.some((d) => d.chave === original.doses[0].chave));
});

test("confirmação após o horário inicial não cria atrasos retroativos", async () => {
  const p = await programarPlantao(
    [ficha([{ ...m, programadaEm: "2026-11-28T20:00:00Z" }])],
    turno,
    agora,
  );
  assert.equal(p.doses[0].horario, "2026-11-29T13:00:00.000Z");
  assert.ok(p.doses.every((d) => Date.parse(d.horario) > agora));
  assert.equal(turnoDoPainel({ finalizadoEm: "2026-11-28T20:00:00Z" }), null);
});

test("a escrita é aditiva, separada por clínica/turno e com autor exclusivamente do servidor", () => {
  const mig = readFileSync(
    "supabase/migrations/20261128220000_oricse_painel_plantao_eventos.sql",
    "utf8",
  );
  const endpoint = readFileSync("src/lib/painel-plantao.functions.ts", "utf8");
  assert.match(mig, /primary key \(clinica_id, turno_chave, tipo, chave\)/i);
  assert.match(mig, /create unique index[\s\S]*\(clinica_id, chave\) where tipo = 'dose'/i);
  assert.match(
    mig,
    /revoke all on public\.oricse_painel_plantao_eventos from public, anon, authenticated, service_role/,
  );
  assert.match(
    mig,
    /grant select, insert on public\.oricse_painel_plantao_eventos to service_role/,
  );
  assert.match(endpoint, /auth\.getUser\(accessToken\)/);
  assert.match(endpoint, /autor_id: uid/);
  assert.match(endpoint, /\["internacao\.medicacoes"\]/);
  assert.match(endpoint, /\["internacao\.registrar"\]/);
  assert.doesNotMatch(endpoint, /\.delete\(|\.update\(|\.upsert\(/);
});

test("avisa de histórico legado recente da mesma ficha sem vincular ou liquidar a dose", async () => {
  const dia = "2026-11-28T13:00:00.000Z";
  const legado = { ...m, nome: "ÍTEM FICTÍCIO A", aplicadoEm: dia };
  const antiga = { ...m, aplicadoEm: "2026-11-25T10:00:00Z" };
  const p = await programarPlantao(
    [ficha([m, legado]), ficha([m, antiga], { id: "outra-ficha" })],
    turno,
    agora,
  );
  const atribuicao = p.doses.filter((d) => d.registroId === "ficha-ficticia");
  assert.equal(atribuicao[0]?.horario, dia);
  assert.equal(atribuicao[0]?.confirmada, true);
  assert.equal(atribuicao[0]?.historicoLegadoSemVinculo, true);
  assert.ok(
    p.doses
      .filter((d) => d.registroId === "outra-ficha")
      .every((d) => !d.historicoLegadoSemVinculo),
  );
  assert.equal(p.doses.length, 10);
});

test("a troca de plantão conserva a mesma chave da dose ainda pendente do turno anterior", async () => {
  const pendente = "2026-11-28T13:00:00.000Z";
  const anterior = await programarPlantao([ficha([m])], turno, agora);
  const novo = turnoDoPainel({
    dia: turno.dia,
    turno: "noturno",
    iniciadoEm: "2026-11-28T21:00:00Z",
  })!;
  const proximo = await programarPlantao([ficha([m])], novo, agora);
  const anteriorChave = anterior.doses.find((d) => d.horario === pendente)?.chave;
  assert.ok(anteriorChave);
  assert.equal(proximo.doses.find((d) => d.horario === pendente)?.chave, anteriorChave);
});
