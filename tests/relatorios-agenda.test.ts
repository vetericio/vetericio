import assert from "node:assert/strict";
import test from "node:test";
import {
  consolidarDadosAgenda,
  relatorioDesfechosAgenda,
  relatorioOcupacaoAgenda,
  relatorioTempoFila,
  type AgendaRelatorio,
  type EventoAgendaRelatorio,
} from "../src/lib/relatorios-agenda.ts";

const dia = "2026-11-27"; // sexta em São Paulo
const periodo = { inicio: dia, fim: dia };
const hora = (hhmm: string) => dia + "T" + hhmm + ":00-03:00";
const agenda: AgendaRelatorio = {
  id: "consulta",
  nome: "Clínica",
  responsavel: "Marta",
  tipo: "Consultório",
  inicio: "08:00:00",
  fim: "12:00:00",
  dias_semana: [5],
  intervalo_min: 30,
  timezone: "America/Sao_Paulo",
};
const evento = (
  id: string,
  inicio: string,
  fim: string,
  outros: Partial<EventoAgendaRelatorio> = {},
): EventoAgendaRelatorio => ({
  id,
  agenda_id: agenda.id,
  inicio: hora(inicio),
  fim: hora(fim),
  estado: "confirmado",
  tipo: "Consulta",
  ...outros,
});

test("ocupação usa grade por profissional, não duplica sobreposição e desconta bloqueio", () => {
  const r = relatorioOcupacaoAgenda(
    [agenda, { ...agenda, id: "tosa", tipo: "Banho e Tosa" }],
    [
      evento("1", "07:50", "08:30"),
      evento("2", "08:15", "09:00"),
      evento("3", "08:45", "09:15", { tipo: "Bloqueio de agenda" }),
      evento("4", "09:30", "10:00", { estado: "cancelado" }),
      evento("5", "10:00", "11:00", { estado: "reservado", pagamento_expira_em: hora("07:30") }),
      evento("6", "11:30", "12:15"),
      evento("7", "10:00", "10:15", { estado: "pendente" }),
      evento("8", "10:30", "10:45", { estado: null }),
    ],
    periodo,
    Date.parse(hora("08:00")),
  );
  assert.deepEqual(r.tabelas[0].linhas, [["Clínica", "Marta", "210", "30", "105", "50%"]]);
  assert.deepEqual(r.tabelas[1].linhas, [["Marta", 1, "210", "30", "105", "50%"]]);
});

test("não cria capacidade antes de criar a agenda, em dias fechados ou com grade inválida", () => {
  const r = relatorioOcupacaoAgenda(
    [
      { ...agenda, created_at: "2026-11-28T04:00:00Z" },
      { ...agenda, id: "domingo", dias_semana: [0] },
      { ...agenda, id: "invalida", timezone: "Invalido" },
    ],
    [],
    periodo,
  );
  assert.deepEqual(
    r.tabelas[0].linhas.map((l) => l.slice(2)),
    [
      ["0", "0", "0", "—"],
      ["0", "0", "0", "—"],
      ["—", "—", "—", "—"],
    ],
  );
  assert.ok(r.notas.some((n) => n.includes("fora dos totais")));
});

test("faltas e remarcações só contam status explícito e reservas expiradas não viram cancelamentos", () => {
  const r = relatorioDesfechosAgenda(
    [agenda],
    [
      evento("1", "08:00", "08:30", { estado: "cancelado" }),
      evento("2", "08:00", "08:30", { estado: "expirado" }),
      evento("3", "08:00", "08:30", { estado: "cancelado", status_clinico: "Não compareceu" }),
      evento("4", "08:00", "08:30", { status_clinico: "Reagendado" }),
      evento("5", "08:00", "08:30", { estado: "cancelado", tipo: "Bloqueio de agenda" }),
      evento("6", "08:00", "08:30"),
      evento("7", "08:00", "08:30", { inicio: "2026-11-27T01:00:00Z" }), // ainda quinta no fuso
    ],
    periodo,
  );
  assert.deepEqual(r.tabelas[0].linhas, [["Clínica", "Marta", 5, 1, 1, "≥ 1", "≥ 1"]]);
  const vazio = relatorioDesfechosAgenda([agenda], [], periodo);
  assert.deepEqual(
    vazio.indicadores.slice(2).map((i) => i.valor),
    ["Sem registro específico", "Sem registro específico"],
  );
});

test("combina atualizações por ID sem escolher versões antigas nem juntar IDs diferentes", () => {
  const d1 = evento("1", "08:00", "08:30", { updated_at: hora("08:00") });
  const p1 = { ...d1, inicio: hora("10:00"), updated_at: hora("09:00") };
  const d2 = evento("2", "08:00", "08:30", { updated_at: hora("10:00") });
  const p2 = { ...d2, inicio: hora("10:00"), updated_at: hora("09:00") };
  const p3 = evento("3", "08:00", "08:30");
  assert.deepEqual(consolidarDadosAgenda([d1, d2], [p1, p2, p3]), [p1, d2, p3]);
  assert.equal(
    consolidarDadosAgenda([d1], [{ ...d1, estado: "cancelado" }])[0].estado,
    "cancelado",
  );
});

test("fila usa a data de chegada e não trata chamada como atendimento", () => {
  const r = relatorioTempoFila(
    [
      { chegada_em: hora("08:00"), chamado_em: hora("08:20"), status: "Chamado" },
      { chegada_em: hora("09:00"), chamado_em: hora("09:40"), status: "Chamado" },
      { chegada_em: hora("09:00"), chamado_em: hora("08:40"), status: "Chamado" },
      { chegada_em: hora("10:30"), chamado_em: null, status: "Aguardando" },
      { chegada_em: hora("10:30"), chamado_em: null, status: "outro" },
      { chegada_em: "2026-11-27T01:00:00Z", chamado_em: null, status: "Aguardando" },
    ],
    periodo,
  );
  assert.deepEqual(r.tabelas[0].linhas, [["27/11/2026", 5, 3, 1, 1, 2, "30", "30", "60%"]]);
  assert.equal(r.indicadores.at(-1)?.valor, "Não rastreada");
  assert.equal(relatorioTempoFila([], periodo).indicadores[3].valor, "—");
});
