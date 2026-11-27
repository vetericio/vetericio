import assert from "node:assert/strict";
import test from "node:test";
import {
  acoesAgenda,
  diasDaVisaoAgenda,
  moverVisaoAgenda,
  normalizarBuscaAgenda,
  statusAgenda,
} from "../src/lib/agenda-operacional.ts";

test("grade semanal começa no domingo e mês inclui células da mesma semana", () => {
  assert.deepEqual(diasDaVisaoAgenda("2026-11-27", "dia"), ["2026-11-27"]);
  const semana = diasDaVisaoAgenda("2026-11-27", "semana");
  assert.equal(semana.length, 7);
  assert.equal(semana[0], "2026-11-22");
  assert.equal(semana[6], "2026-11-28");
  const mes = diasDaVisaoAgenda("2026-11-27", "mes");
  assert.equal(mes.length, 35);
  assert.equal(mes[0], "2026-11-01");
  assert.equal(mes.at(-1), "2026-12-05");
  assert.equal(moverVisaoAgenda("2026-01-31", "mes", 1), "2026-02-28");
  assert.equal(moverVisaoAgenda("2026-11-27", "semana", 1), "2026-12-04");
});
test("recepção não abre ações clínicas de visita pendente, cancelada, reservada ou já encerrada", () => {
  assert.equal(statusAgenda("cancelado", "Não compareceu"), "Não compareceu");
  assert.equal(statusAgenda("cancelado", "Agendado"), "Cancelado");
  assert.equal(statusAgenda("confirmado", "Chegou"), "Chegou");
  assert.equal(statusAgenda("solicitado", "Agendado"), "Aguardando aprovação");
  assert.equal(statusAgenda("reservado", "Agendado"), "Reservado");
  const agora = Date.parse("2026-11-27T10:00:00Z");
  assert.equal(acoesAgenda("Agendado", "2026-11-27T12:00:00Z", agora).falta, false);
  assert.equal(acoesAgenda("Agendado", "2026-11-27T10:00:00Z", agora).falta, true);
  assert.equal(acoesAgenda("Chegou", "2026-11-27T10:00:00Z", agora).falta, false);
  assert.equal(acoesAgenda("Reservado", "2026-11-27T10:00:00Z", agora).atender, false);
  assert.equal(normalizarBuscaAgenda("  CÃO  da JoÃna "), "cao  da joana");
});
