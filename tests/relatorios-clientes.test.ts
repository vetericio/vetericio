import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  inicioCivilClientes,
  inicioInatividade,
  relatorioEstoque,
} from "../src/lib/relatorios-clientes.ts";
import {
  consultarRelatorioClientes,
  gerarRelatorioClientes,
} from "../src/lib/relatorios-clientes.server.ts";

const periodo = { clinicaId: "piloto", inicio: "2026-11-26", fim: "2026-11-27" };
const agora = Date.parse("2026-11-30T12:00:00.000Z");

function responder(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json" },
  });
}
function clienteSimulado(fixtures: (url: URL, metodo: string) => Response | Promise<Response>) {
  const visitas: URL[] = [];
  const banco = createClient("https://fixture.invalid", "fixture", {
    global: {
      fetch: async (req, opcoes) => {
        const url = new URL(String(req));
        const metodo = opcoes?.method ?? "GET";
        visitas.push(url);
        assert.equal(
          url.searchParams.get("clinica_id"),
          "eq.piloto",
          "toda leitura isola a clínica",
        );
        assert.doesNotMatch(
          url.searchParams.get("select") || "",
          /\*|cpf|telefone|email|usuario|auth_user_id|detalhe|observac/,
        );
        return fixtures(url, metodo);
      },
    },
  });
  return { banco, visitas };
}
const nome = (url: URL) => url.pathname.split("/").at(-1);

test("limites civis exclusivos, incluindo horário de verão histórico", () => {
  assert.equal(inicioCivilClientes("2018-11-04"), "2018-11-04T03:00:00.000Z");
  assert.equal(inicioCivilClientes("2018-11-05"), "2018-11-05T02:00:00.000Z");
  assert.equal(inicioCivilClientes("2026-11-27"), "2026-11-27T03:00:00.000Z");
});

test("estoque separa saldo desconhecido de zero, sugere apenas o mínimo e não inventa perdas", () => {
  const p = {
    id: "1",
    nome: "Areia",
    categoria: "Higiene",
    estoque_atual: 0,
    estoque_minimo: 2.5,
    venda_por_peso: true,
  };
  const r = relatorioEstoque(
    [
      p,
      { ...p, id: "2", nome: "Ração", estoque_atual: null },
      { ...p, id: "3", nome: "Sabonete", estoque_atual: 0.5, estoque_minimo: 0.5 },
      { ...p, id: "4", nome: "Escova", estoque_minimo: null },
    ],
    [
      { item_id: "1", item_nome: "Nome antigo", tipo: "entrada", quantidade: 0.1 },
      { item_id: "1", item_nome: "Nome antigo", tipo: "entrada", quantidade: 0.2 },
      { item_id: "1", item_nome: "Nome antigo", tipo: "saida", quantidade: 0.3 },
      { item_id: null, item_nome: "Areia", tipo: "saida", quantidade: 7 },
    ],
  );
  assert.deepEqual(
    r.indicadores.map((i) => i.valor),
    [4, 2, 1, 4],
  );
  assert.deepEqual(r.tabelas[1].linhas, [
    ["Areia", 0, 2.5, 2.5],
    ["Sabonete", 0.5, 0.5, 0],
  ]);
  assert.deepEqual(r.tabelas[2].linhas, [
    ["Areia", "Produto ativo", "0,3", "0,3", 3],
    ["Areia", "Sem vínculo", "0", "7", 1],
  ]);
  assert.match(r.notas.join(" "), /lotes ou vencimentos/);
});

test("estoque usa auditoria e projeta somente as colunas necessárias; pagina além de 500", async () => {
  const { banco, visitas } = clienteSimulado((url) => {
    if (nome(url) === "oricse_catalogo_itens") {
      assert.equal(url.searchParams.get("tipo"), "eq.produto");
      assert.equal(url.searchParams.get("ativo"), "eq.true");
      assert.doesNotMatch(url.searchParams.get("select") || "", /valor|preco/);
      return responder([]);
    }
    assert.equal(nome(url), "oricse_historico_estoque");
    assert.deepEqual(url.searchParams.getAll("registrado_em"), [
      "gte.2026-11-26T03:00:00.000Z",
      "lt.2026-11-28T03:00:00.000Z",
    ]);
    const offset = Math.trunc(Number(url.searchParams.get("offset")));
    const item = { item_id: "a", item_nome: "Ração", tipo: "saida", quantidade: 0.25 };
    return responder(Array.from({ length: offset === 0 ? 500 : 1 }, () => item));
  });
  const result = await consultarRelatorioClientes(banco, { codigo: "25", ...periodo }, agora);
  assert.equal(visitas.length, 3);
  assert.equal(result.indicadores[3].valor, 501);
  assert.deepEqual(result.tabelas[2].linhas, [
    ["Ração", "Fora do catálogo ativo", "0", "125,25", 501],
  ]);
});

test("cadastros e recorrência usam somente agenda finalizada e agregados sem PII", async () => {
  const { banco } = clienteSimulado((url) => {
    const old = "2024-11-01T15:00:00Z";
    const novo = "2026-11-27T02:59:59Z";
    if (nome(url) === "tutores")
      return responder([
        { id: "tutor1", created_at: old },
        { id: "tutor2", created_at: old },
        { id: "tutor3", created_at: novo },
      ]);
    if (nome(url) === "oricse_animais")
      return responder([
        { id: "pet1", created_at: old, especie: "cão" },
        { id: "pet2", created_at: old, especie: "texto livre privado" },
        { id: "pet3", created_at: novo, especie: "" },
      ]);
    assert.equal(nome(url), "oricse_agendamentos_online");
    assert.equal(url.searchParams.get("dados->>status_clinico"), "eq.Finalizado");
    assert.equal(url.searchParams.get("select"), "tutor_id,animal_id,inicio");
    assert.deepEqual(url.searchParams.getAll("inicio"), [
      "gte." + inicioCivilClientes(inicioInatividade(periodo.fim)),
      "lt.2026-11-28T03:00:00.000Z",
    ]);
    return responder([
      { tutor_id: "tutor1", animal_id: "pet1", inicio: "2026-11-26T03:00:00Z" },
      { tutor_id: "tutor1", animal_id: "pet1", inicio: "2026-11-27T03:00:00Z" },
      { tutor_id: "tutor2", animal_id: "pet2", inicio: "2026-11-26T02:59:59Z" },
      { tutor_id: "outro", animal_id: "outro", inicio: "2026-11-26T12:00:00Z" },
    ]);
  });
  const r = await consultarRelatorioClientes(banco, { codigo: "26", ...periodo }, agora);
  assert.deepEqual(
    r.indicadores.map((i) => i.valor),
    [1, 1, 1, 0],
  );
  assert.deepEqual(r.tabelas[1].linhas[0], ["Tutores", 3, 1, 1, 0]);
  assert.deepEqual(r.tabelas[1].linhas[1], ["Pacientes", 3, 1, 1, 0]);
  assert.doesNotMatch(JSON.stringify(r), /tutor1|pet1|texto livre privado/);
  assert.match(r.notas.join(" "), /Consultas avulsas/);
});

test("portal mede somente origem portal, contas ativas efetivas e último acesso, sem iniciar login", async () => {
  const { banco, visitas } = clienteSimulado((url, metodo) => {
    const tabela = nome(url);
    if (tabela === "oricse_agendamentos_online") {
      assert.equal(metodo, "GET");
      assert.equal(url.searchParams.get("origem"), "eq.portal_tutor");
      assert.equal(url.searchParams.get("select"), "inicio,estado");
      return responder([
        { inicio: "2026-11-26T12:00:00Z", estado: "confirmado" },
        { inicio: "2026-11-26T13:00:00Z", estado: "cancelado" },
        { inicio: "2026-11-27T11:00:00Z", estado: "__proto__" },
      ]);
    }
    assert.equal(metodo, "HEAD");
    const noPeriodo = url.searchParams.has("ultimo_acesso_em");
    if (tabela === "oricse_portal_tutores") {
      assert.equal(url.searchParams.get("ativo"), "eq.true");
      assert.equal(url.searchParams.get("auth_user_id"), "not.is.null");
      if (noPeriodo)
        assert.deepEqual(url.searchParams.getAll("ultimo_acesso_em"), [
          "gte.2026-11-26T03:00:00.000Z",
          "lt.2026-11-28T03:00:00.000Z",
        ]);
    }
    const total = tabela === "tutores" ? 5 : noPeriodo ? 1 : 2;
    return new Response(null, { headers: { "Content-Range": "*/" + total } });
  });
  const r = await consultarRelatorioClientes(banco, { codigo: "28", ...periodo }, agora);
  assert.equal(visitas.length, 4);
  assert.deepEqual(
    r.indicadores.map((i) => i.valor),
    [3, 2, "40%", 1],
  );
  assert.deepEqual(r.tabelas[1].linhas, [
    ["Cancelado", 1],
    ["Confirmado", 1],
    ["Outro estado", 1],
  ]);
  assert.match(r.notas.join(" "), /Não há avaliações registradas/);
});

test("RLS e demais falhas não viram relatórios com contagens zero; data inválida não consulta banco", async () => {
  const { banco, visitas } = clienteSimulado(() =>
    responder({ message: "denied mock" }, { status: 403 }),
  );
  await assert.rejects(
    consultarRelatorioClientes(banco, { codigo: "25", ...periodo, inicio: "2026-02-30" }),
    /período inválido/,
  );
  assert.equal(visitas.length, 0);
  await assert.rejects(
    consultarRelatorioClientes(banco, { codigo: "25", ...periodo }),
    /Não foi possível consultar/,
  );
});

test("entrada usada pelo dispatcher envia o JWT sem chamar rede", async () => {
  const fetchAnterior = globalThis.fetch;
  const urlAnterior = process.env.ORICSE_SUPABASE_URL;
  process.env.ORICSE_SUPABASE_URL = "https://fixture.invalid";
  const consultas = new Set<string>();
  globalThis.fetch = async (req, init) => {
    const url = new URL(String(req));
    assert.equal(url.hostname, "fixture.invalid");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer token-ficticio");
    consultas.add(nome(url)!);
    return responder([]);
  };
  try {
    const r = await gerarRelatorioClientes({
      codigo: "25",
      ...periodo,
      accessToken: "token-ficticio",
    });
    assert.deepEqual(consultas, new Set(["oricse_catalogo_itens", "oricse_historico_estoque"]));
    assert.equal(r.indicadores[0].valor, 0);
  } finally {
    globalThis.fetch = fetchAnterior;
    if (urlAnterior === undefined) delete process.env.ORICSE_SUPABASE_URL;
    else process.env.ORICSE_SUPABASE_URL = urlAnterior;
  }
});
