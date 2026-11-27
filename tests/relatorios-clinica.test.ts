import assert from "node:assert/strict";
import test from "node:test";
import {
  projetarInternacao,
  projetarProntuario,
  relatorioConsultasProcedimentos,
  relatorioInternacao,
  relatorioProntuarios,
  type RetornoRelatorio,
} from "../src/lib/relatorios-clinica.ts";
import { gerarRelatorioClinica } from "../src/lib/relatorios-clinica.server.ts";

const periodo = { inicio: "2026-11-26", fim: "2026-11-26" };
const clinicaId = "clinica-selecionada";
const id = (n: number) => `957dc2ab-75fd-4c1c-a7c8-${String(n).padStart(12, "0")}`;
const procedimento = {
  id: id(1),
  clinicaId,
  animalId: "animal",
  data: periodo.inicio,
  subtipo: "Cirurgia / Procedimentos",
  status: "concluido",
  autorId: "veterinaria",
  autorCrmv: "CRMV-UF 01",
  titulo: "Procedimento fictício",
  detalhe: "Conteúdo sigiloso que não é devolvido",
};
const consulta = {
  id: id(2),
  data: periodo.inicio,
  autor_id: "veterinaria",
  autor_crmv: null,
  queixa: "Sinal relatado que não é devolvido",
  conduta: "",
  retorno_em: "2026-11-30",
};
const retorno: RetornoRelatorio = {
  id: id(3),
  origem: "consulta",
  data_prevista: null,
  status: "a_confirmar",
  realizado_em: null,
  created_at: "2026-11-26T15:00:00Z",
};

test("15: mantém períodos distintos para consulta, previsão e realização de retorno no fuso", () => {
  const prontuario = projetarProntuario(
    [
      procedimento,
      procedimento,
      { ...procedimento, id: id(4), clinicaId: "outra-clinica" },
      { ...procedimento, id: id(5), status: "rascunho" },
    ],
    clinicaId,
  );
  const r = relatorioConsultasProcedimentos(
    [consulta],
    prontuario,
    [
      retorno,
      { ...retorno, id: id(6), data_prevista: periodo.fim, status: "cancelado" },
      {
        ...retorno,
        id: id(7),
        data_prevista: "2026-11-25",
        status: "realizado",
        realizado_em: "2026-11-27T02:59:00Z",
      },
      { ...retorno, id: id(8), status: "realizado", realizado_em: "2026-11-27T03:00:00Z" },
      { ...retorno, id: id(9), status: "cancelado", realizado_em: "2026-11-26T15:00:00Z" },
    ],
    periodo,
  );
  assert.deepEqual(
    r.indicadores.map((x) => x.valor),
    [1, 1, 1, 1, 1, 1],
  );
  assert.deepEqual(r.tabelas[0].linhas, [["26/11/2026", 1, 1, 1, 1]]);
});

test("16: identifica campos ausentes e adendos no recorte, mas não expõe o teor clínico", () => {
  const prontuario = projetarProntuario(
    [
      procedimento,
      { ...procedimento, id: id(6), status: "adendo" },
      { ...procedimento, id: id(7), status: "adendo", data: "2026-11-25" },
      { ...procedimento, id: id(8), status: "rascunho" },
      { ...procedimento, id: id(9), detalhe: "" },
      { ...procedimento, id: id(10), clinicaId: undefined },
      { ...procedimento, id: id(11), data: "2026-11-31" },
    ],
    clinicaId,
  );
  const r = relatorioProntuarios([consulta], prontuario, periodo);
  assert.deepEqual(
    r.indicadores.map((x) => x.valor),
    [3, 2, 1, 1, "Não registrado no fluxo atual"],
  );
  assert.deepEqual(
    r.tabelas[2].linhas.map((l) => l[3]),
    ["Adendo", "Rascunho"],
  );
  assert.equal(
    r.tabelas[1].linhas.some((l) => l[2] === consulta.id),
    true,
  );
  assert.doesNotMatch(JSON.stringify(r), /Conteúdo sigiloso|Sinal relatado|CRMV-UF/);
});

test("17: não atribui alta, permanência ou capacidade a uma ficha de painel", () => {
  const registro = {
    id: "a",
    animal: "Paciente sigiloso",
    baia: "Baia A",
    criadoEm: "2026-11-27T02:59:00Z",
  };
  const painel = projetarInternacao(
    [
      registro,
      registro,
      { ...registro, id: "b", baia: " baia a ", criadoEm: null },
      { ...registro, id: "c", obito: { hora: "14:00", motivo: "sigiloso" } },
      { ...registro, id: "d", clinicaId: "outra-clinica" },
    ],
    clinicaId,
  );
  const r = relatorioInternacao(painel, periodo, "2026-11-29");
  assert.deepEqual(
    r.indicadores.map((x) => x.valor),
    [2, 1, 1, 2, "Não registrado no fluxo atual", "Não registrado no fluxo atual"],
  );
  assert.deepEqual(r.tabelas[1].linhas, [["26/11/2026", 2]]);
  assert.deepEqual(r.tabelas[0].linhas[1], ["2 a 3 dias", 1]);
  assert.doesNotMatch(JSON.stringify(r), /sigiloso|Baia A/);
});

test("o adaptador lê somente as fontes e projeções autorizadas da clínica selecionada", async () => {
  const requisicoes: URL[] = [];
  const envAnterior = [process.env.ORICSE_SUPABASE_URL, process.env.ORICSE_SERVICE_ROLE_KEY];
  const fetchAnterior = globalThis.fetch;
  process.env.ORICSE_SUPABASE_URL = "https://nao-fazer-requisicao.example";
  process.env.ORICSE_SERVICE_ROLE_KEY = "sb_secret_ficticio";
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.method, "GET");
    const url = new URL(String(input));
    assert.equal(url.origin, "https://nao-fazer-requisicao.example");
    assert.equal(url.searchParams.get("clinica_id"), `eq.${clinicaId}`);
    requisicoes.push(url);
    const linhas = url.pathname.endsWith("oricse_animal_registros_extra")
      ? [consulta]
      : url.pathname.endsWith("oricse_dados_modulos")
        ? [{ lista: JSON.stringify([procedimento]) }]
        : [];
    return Response.json(linhas);
  };
  try {
    const entrada = { accessToken: "token-ficticio", clinicaId, ...periodo };
    const r15 = await gerarRelatorioClinica({ ...entrada, codigo: "15" });
    assert.equal(r15.indicadores[1].valor, 1);
    const r16 = await gerarRelatorioClinica({ ...entrada, codigo: "16" });
    assert.equal(r16.indicadores[0].valor, 2);
    assert.equal(
      requisicoes.filter((url) => url.pathname.endsWith("oricse_crm_retornos")).length,
      1,
    );
    requisicoes.length = 0;
    await gerarRelatorioClinica({ ...entrada, codigo: "17" });
    assert.equal(requisicoes.length, 1);
    assert.equal(requisicoes[0].searchParams.get("select"), "lista:dados->>veterico-registros-v1");
    assert.equal(requisicoes[0].searchParams.get("chave"), "eq.estado_sistema");
    await assert.rejects(
      gerarRelatorioClinica({ ...entrada, codigo: "15", inicio: "2026-11-99" }),
      /período válido/,
    );
    assert.equal(requisicoes.length, 1);
  } finally {
    globalThis.fetch = fetchAnterior;
    for (const [i, chave] of ["ORICSE_SUPABASE_URL", "ORICSE_SERVICE_ROLE_KEY"].entries()) {
      if (envAnterior[i] === undefined) delete process.env[chave];
      else process.env[chave] = envAnterior[i];
    }
  }
});
