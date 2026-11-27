import assert from "node:assert/strict";
import test from "node:test";
import { consultarRelatorioGestao } from "../src/lib/relatorios-gestao.server.ts";

const clinicaId = "8807ba30-5fbd-4d74-ade3-b9813f400023";
const outraClinica = "fc5df6dc-91cc-448b-93df-0a0e55e72ec7";
const corrente = "cca81603-cd1e-4d81-930a-d0ec64d413a0";
const alterado = "24939ae6-41ee-4e44-b1b4-62ab584713fe";
const intervalo = {
  accessToken: "fake",
  clinicaId,
  inicio: "2026-11-26",
  fim: "2026-11-26",
};
const dentro = "2026-11-27T02:59:59Z";
const depois = "2026-11-27T03:00:00Z";
const antes = "2026-11-26T02:59:59Z";

type Linha = Record<string, unknown>;
type Leitura = {
  tabela: string;
  papel: "usuario" | "admin" | "drive";
  colunas: string;
  filtros: Array<[string, string, unknown]>;
};

function fontes(
  dados: Record<string, Linha[]> = {},
  permissoes: Record<string, boolean | "erro"> = {},
  dadosDrive: Linha[] = [],
) {
  const leituras: Leitura[] = [];
  function banco(papel: Leitura["papel"]) {
    return {
      rpc(nome: string, params: Linha) {
        assert.equal(params.p_clinica_id, clinicaId);
        const valor = permissoes[String(params.p_codigo ?? nome)];
        return Promise.resolve({
          data: valor === true,
          error: valor === "erro" ? new Error("teste") : null,
        });
      },
      from(tabela: string) {
        return {
          select(colunas: string, opcoes: { count?: string } = {}) {
            const filtros: Leitura["filtros"] = [];
            leituras.push({ tabela, papel, colunas, filtros });
            function ler() {
              return (dados[tabela] || [])
                .filter((l) =>
                  filtros.every(([tipo, col, v]) => {
                    if (tipo === "eq") return l[col] === v;
                    if (tipo === "in") return (v as unknown[]).includes(l[col]);
                    const a = Date.parse(String(l[col]));
                    const b = Date.parse(String(v));
                    return tipo === "gte" ? a >= b : a < b;
                  }),
                )
                .map((l) =>
                  Object.fromEntries(
                    colunas.split(",").map((coluna) => {
                      const alias = coluna.split(":")[0];
                      return [alias, l[alias]];
                    }),
                  ),
                );
            }
            const query = {
              eq(col: string, v: unknown) {
                filtros.push(["eq", col, v]);
                return query;
              },
              gte(col: string, v: unknown) {
                filtros.push(["gte", col, v]);
                return query;
              },
              lt(col: string, v: unknown) {
                filtros.push(["lt", col, v]);
                return query;
              },
              in(col: string, v: unknown) {
                filtros.push(["in", col, v]);
                return query;
              },
              order() {
                return query;
              },
              range(de: number, ate: number) {
                return Promise.resolve({ data: ler().slice(de, ate + 1), error: null });
              },
              maybeSingle() {
                return Promise.resolve({ data: ler()[0] ?? null, error: null });
              },
              then(resolve: (value: unknown) => unknown) {
                const lista = ler();
                return Promise.resolve(
                  resolve({
                    data: lista,
                    error: null,
                    count: opcoes.count === "exact" ? lista.length : null,
                  }),
                );
              },
            };
            return query;
          },
        };
      },
    };
  }
  return {
    mocks: {
      usuario: banco("usuario"),
      admin: banco("admin"),
      async drive(input: {
        table: string;
        columns: string;
        filters: Array<{ kind: string; column: string; value: unknown }>;
      }) {
        leituras.push({
          tabela: input.table,
          papel: "drive",
          colunas: input.columns,
          filtros: input.filters.map(({ kind, column, value }) => [kind, column, value]),
        });
        return {
          data: dadosDrive.filter((l) =>
            input.filters.every((f) => f.kind !== "eq" || l[f.column] === f.value),
          ),
          error: null,
        };
      },
    } as unknown as Parameters<typeof consultarRelatorioGestao>[0],
    leituras,
  };
}

const escopado = (linha: Linha) => ({ clinica_id: clinicaId, ...linha });
const indicador = (r: Awaited<ReturnType<typeof consultarRelatorioGestao>>, rotulo: string) =>
  r.indicadores.find((i) => i.rotulo.startsWith(rotulo))?.valor;

test("27: integra CRM/Drive por ID, usa datas de envio e não confunde entregas com captação", async () => {
  const envio = { tipo: "campanha", status: "enviado", enviado_em: dentro, canal: "whatsapp" };
  const dados = {
    oricse_crm_eventos: [
      escopado({ ...envio, id: corrente, canal: "email" }),
      escopado({ ...envio, id: alterado, status: "pendente" }),
      escopado({ ...envio, id: "proximo-dia", enviado_em: depois }),
      { ...envio, id: "outro-tenant", clinica_id: outraClinica },
    ],
    oricse_crm_campanhas: [escopado({ status: "pronta", canal: "email", created_at: dentro })],
    tutores: [
      escopado({ origem: "Indicação", created_at: dentro }),
      escopado({ origem: "  indicacao ", created_at: dentro }),
      escopado({ origem: "nome privado e telefone", created_at: dentro }),
      escopado({ origem: null, created_at: dentro }),
      escopado({ origem: "Google", created_at: depois }),
    ],
    oricstudio_envios: [
      escopado({ formato: "story", meta_publicacao_confirmada_em: dentro }),
      escopado({ formato: "reels", meta_publicacao_confirmada_em: depois }),
    ],
    clinic_sites: [escopado({ status: "publicado", publicado_em: antes })],
  };
  const drive = [
    escopado({ ...envio, id: corrente }),
    escopado({ ...envio, id: alterado }),
    escopado({ ...envio, id: "drive", tipo: "retorno" }),
    escopado({ ...envio, id: "antigo", enviado_em: antes }),
  ];
  const { mocks, leituras } = fontes(
    dados,
    {
      "recepcao.cadastros.visualizar": true,
      "administracao.site": true,
      oricstudio_pode_acessar: true,
    },
    drive,
  );
  const r = await consultarRelatorioGestao(mocks, { ...intervalo, codigo: "27" });
  assert.equal(indicador(r, "Contatos marcados"), 2);
  assert.equal(indicador(r, "Envios de campanhas"), 1);
  assert.equal(indicador(r, "Tutores cadastrados"), 4);
  assert.equal(indicador(r, "Cadastros com origem"), 3);
  assert.equal(indicador(r, "Publicações do OricStudio"), 1);
  assert.deepEqual(r.tabelas.find((t) => t.titulo.startsWith("Captação"))?.linhas, [
    ["Indicação", 2],
    ["Não informado", 1],
    ["Outra origem", 1],
  ]);
  assert.equal(JSON.stringify(r).includes("nome privado"), false);
  for (const l of leituras)
    assert(l.filtros.some((f) => f.join() === ["eq", "clinica_id", clinicaId].join()));
  assert.deepEqual(leituras.find((l) => l.tabela === "tutores")?.colunas, "origem:dados->>origem");
  assert.deepEqual(leituras.find((l) => l.filtros.some(([f]) => f === "in"))?.filtros.at(-1), [
    "in",
    "id",
    [alterado],
  ]);
  assert(!leituras.some((l) => l.papel === "admin"));
});

test("27: sem permissões de fonte, não consulta site, OricStudio ou tutores", async () => {
  const { mocks, leituras } = fontes();
  const r = await consultarRelatorioGestao(mocks, { ...intervalo, codigo: "27" });
  assert.deepEqual(leituras.map((l) => l.tabela).sort(), [
    "oricse_crm_campanhas",
    "oricse_crm_eventos",
    "oricse_crm_eventos",
  ]);
  assert.equal(indicador(r, "Tutores cadastrados"), undefined);
  assert.equal(indicador(r, "Publicações do OricStudio"), undefined);
  assert.match(r.notas.join(" "), /Não há série de visitas/);
});

test("29: restringe adesão à ligação canônica, não lê contratos globais nem inventa cancelamentos ORICSE", async () => {
  const plano = {
    plano_nome: "Plano teste",
    ciclo: "anual",
    status: "ativada",
    created_at: dentro,
  };
  const { mocks, leituras } = fontes(
    {
      clinicas: [{ id: clinicaId, plano: "Plano teste" }],
      oricse_contratacoes: [
        { clinica_criada_id: clinicaId, ...plano },
        { clinica_criada_id: outraClinica, ...plano },
        { clinica_criada_id: null, ...plano },
      ],
      oricse_assinaturas: [
        escopado({
          plano_codigo: "teste",
          ciclo: "anual",
          status: "cancelada",
          inicio_em: "2026-01-01",
          proximo_vencimento_em: "2027-01-01",
        }),
      ],
      oricstudio_solicitacoes: [
        escopado({ cancelamento_em: dentro }),
        escopado({ cancelamento_em: depois }),
        escopado({ cancelamento_em: null }),
        { clinica_id: outraClinica, cancelamento_em: dentro },
      ],
    },
    { oricse_pode_gerenciar_permissoes: true },
  );
  const r = await consultarRelatorioGestao(mocks, { ...intervalo, codigo: "29" });
  assert.equal(indicador(r, "Contratações ORICSE"), 1);
  assert.equal(indicador(r, "Assinatura ORICSE"), "Cancelada");
  assert.equal(indicador(r, "Contratações do OricStudio"), 1);
  assert.equal(r.tabelas[1]?.linhas[0]?.[3], "Não");
  assert.match(r.notas.join(" "), /nem data confiável de cancelamento/);
  assert.deepEqual(leituras.map((l) => l.tabela).sort(), [
    "clinicas",
    "oricse_assinaturas",
    "oricse_contratacoes",
    "oricstudio_solicitacoes",
  ]);
  assert(!leituras.some((l) => /dados|nome_pessoa|cpf|pagamento|mp_assinatura/.test(l.colunas)));
});

test("30: exige papel de gestão e autorização secundária, e não gera números para logins/exportações", async () => {
  for (const negacao of [false, "erro"] as const) {
    const { mocks, leituras } = fontes({}, { oricse_pode_gerenciar_permissoes: negacao });
    await assert.rejects(consultarRelatorioGestao(mocks, { ...intervalo, codigo: "30" }));
    assert.deepEqual(leituras, []);
  }
  const { mocks, leituras } = fontes(
    {
      oricse_permissoes_usuario: [
        escopado({ permissao_codigo: "crm.visualizar", permitido: true, atualizado_em: dentro }),
        escopado({ permissao_codigo: "crm.visualizar", permitido: false, atualizado_em: dentro }),
        escopado({ permissao_codigo: "crm.visualizar", permitido: false, atualizado_em: antes }),
      ],
      oricse_historico_estoque: [
        escopado({ tipo: "entrada", registrado_em: dentro }),
        escopado({ tipo: "saida", registrado_em: depois }),
      ],
    },
    { oricse_pode_gerenciar_permissoes: true, "estoque.movimentar": true },
    [
      escopado({ permissao_codigo: "crm.visualizar", permitido: true, atualizado_em: dentro }),
      escopado({ permissao_codigo: "crm.visualizar", permitido: true, atualizado_em: depois }),
    ],
  );
  const r = await consultarRelatorioGestao(mocks, { ...intervalo, codigo: "30" });
  assert.equal(indicador(r, "Regras individuais"), 1);
  assert.deepEqual(r.tabelas[0]?.linhas, [["crm.visualizar", "Concedida", 1]]);
  assert.equal(r.tabelas[1]?.linhas.length, 2);
  assert.equal(indicador(r, "Movimentos auditados"), 1);
  assert.match(r.notas.join(" "), /logins, leituras ou exportações/);
  assert.deepEqual(
    leituras.map((l) => [l.tabela, l.colunas]),
    [
      ["oricse_permissoes_usuario", "permissao_codigo,permitido,atualizado_em"],
      ["oricse_permissoes_usuario", "permissao_codigo,permitido"],
      ["oricse_historico_estoque", "tipo"],
    ],
  );
  assert(leituras.every((l) => l.papel !== "admin"));
});

test("rejeita parâmetros inválidos antes de consultar fontes", async () => {
  const { mocks, leituras } = fontes({}, { oricse_pode_gerenciar_permissoes: true });
  for (const input of [
    { ...intervalo, accessToken: "", codigo: "29" as const },
    { ...intervalo, inicio: "2026-02-30", codigo: "27" as const },
    { ...intervalo, clinicaId: "tenant inválido", codigo: "30" as const },
  ])
    await assert.rejects(consultarRelatorioGestao(mocks, input));
  assert.deepEqual(leituras, []);
});
