import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const modulos = {
  "./relatorios": new URL("../src/lib/relatorios.ts", import.meta.url).href,
  "./relatorios-documentos": new URL("../src/lib/relatorios-documentos.ts", import.meta.url).href,
};

const { outputText } = ts.transpileModule(
  fs.readFileSync(new URL("../src/lib/relatorios-documentos.server.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
);
let programa = outputText
  .replace(
    'import { supabaseAdmin } from "@/integrations/supabase/client.server";',
    "const supabaseAdmin = { from: source('servico') };",
  )
  .replace(
    'import { clienteSupabaseUsuario } from "@/lib/permissao-clinica.server";',
    "const clienteSupabaseUsuario = (token) => ({ from: source(token) });",
  );
for (const [id, url] of Object.entries(modulos))
  programa = programa.replace(JSON.stringify(id), JSON.stringify(url));
programa +=
  "\n function source(principal) { return (table) => globalThis[Symbol.for('oricse.tests.relatorios.documentos')](principal, table); }";
const { gerarRelatorioDocumentos } = await import(
  `data:text/javascript;base64,${Buffer.from(programa).toString("base64")}`
);

function bancoFicticio(t, tabelas) {
  const consultas = [];
  const chave = Symbol.for("oricse.tests.relatorios.documentos");
  globalThis[chave] = (principal, tabela) => {
    const operacoes = [];
    const q = Object.fromEntries(
      ["select", "eq", "in", "is", "not", "gte", "lte", "lt", "order", "range", "limit"].map(
        (metodo) => [
          metodo,
          (...args) => {
            operacoes.push([metodo, ...args]);
            return q;
          },
        ],
      ),
    );
    q.then = (resolve, reject) => {
      consultas.push({ principal, tabela, operacoes });
      const registros = tabelas[tabela];
      if (registros instanceof Error)
        return Promise.resolve({ data: null, error: registros }).then(resolve, reject);
      assert.ok(registros, `acesso inesperado: ${tabela}`);
      const filtradas = registros
        .filter((linha) =>
          operacoes.every(([metodo, col, val, extra]) => {
            if (metodo === "eq" || metodo === "is") return linha[col] === val;
            if (metodo === "in") return val.includes(linha[col]);
            if (metodo === "gte") return linha[col] !== null && linha[col] >= val;
            if (metodo === "lte") return linha[col] !== null && linha[col] <= val;
            if (metodo === "lt") return linha[col] < val;
            if (metodo === "not" && val === "is") return linha[col] !== extra;
            return true;
          }),
        )
        .sort((a, b) => {
          for (const [, col, { ascending = true } = {}] of operacoes.filter(
            ([m]) => m === "order",
          )) {
            if (a[col] !== b[col]) return (a[col] > b[col] ? 1 : -1) * (ascending ? 1 : -1);
          }
          return 0;
        });
      const intervalo = operacoes.find(([m]) => m === "range");
      return Promise.resolve({
        data: intervalo ? filtradas.slice(intervalo[1], intervalo[2] + 1) : filtradas,
        error: null,
      }).then(resolve, reject);
    };
    return q;
  };
  t.after(() => {
    delete globalThis[chave];
  });
  return consultas;
}

const entrada = {
  accessToken: "jwt-ficticio",
  clinicaId: "clinica",
  inicio: "2026-01-01",
  fim: "2026-01-10",
};

test("22 consulta fonte com JWT e enriquece apenas vínculos de receitas selecionadas da clínica", async (t) => {
  const r = {
    id: "receita",
    clinica_id: "clinica",
    animal_id: "pet",
    tutor_id: "tutor",
    drive_arquivo_id: "receita",
    emitida_em: "2026-01-05",
    numero: null,
    titulo: "Receita",
    tipo: "normal",
    resumo: "Med A",
    visivel_tutor: false,
    prescritor_nome: null,
    prescritor_crmv: null,
    excluido_em: null,
  };
  const consulta = {
    id: "consulta",
    clinica_id: "clinica",
    animal_id: "pet",
    data: "2026-02-08",
    tipo: "Registros clínicos",
    titulo: "Consulta",
    dados_atendimento: { consulta: {} },
  };
  const consultas = bancoFicticio(t, {
    oricse_portal_receitas: [
      r,
      { ...r, id: "mismatch", drive_arquivo_id: "receita" },
      { ...r, id: "outro-animal", drive_arquivo_id: "outro-animal" },
      { ...r, id: "outra-categoria", drive_arquivo_id: "outra-categoria" },
      { ...r, id: "outra", clinica_id: "outra", animal_id: "pet-outro", resumo: "Não enviar" },
      {
        ...r,
        id: "apagada",
        animal_id: "pet-excluido",
        excluido_em: "2026-03-09",
        resumo: "Não enviar",
      },
      { ...r, id: "fora", animal_id: "pet-fora", emitida_em: "2026-03-01", resumo: "Não enviar" },
    ],
    oricse_animais: [
      { id: "pet", clinica_id: "outra", nome: "Pet alheio" },
      { id: "pet", clinica_id: "clinica", nome: "Pet autorizado" },
    ],
    tutores: [{ id: "tutor", clinica_id: "clinica", nome: "Tutor autorizado" }],
    drive_arquivos: [
      {
        id: "receita",
        clinica_id: "outra",
        entidade_tipo: "animal",
        mime_type: "application/pdf",
        entidade_id: "pet",
        categoria: "receitas",
        enviado_por: "perfil-outra-clinica",
      },
      {
        id: "receita",
        clinica_id: "clinica",
        entidade_tipo: "animal",
        mime_type: "application/pdf",
        entidade_id: "pet",
        categoria: "receitas",
        enviado_por: "perfil-emissor",
      },
      { id: "outro-animal", clinica_id: "clinica", entidade_tipo: "animal", mime_type: "application/pdf", entidade_id: "outro", categoria: "receitas", enviado_por: "perfil-animal-incorreto" },
      { id: "outra-categoria", clinica_id: "clinica", entidade_tipo: "animal", mime_type: "application/pdf", entidade_id: "pet", categoria: "documentos", enviado_por: "perfil-categoria-incorreta" },
    ],
    oricse_pessoas: [
      { user_id: "perfil-emissor", nome_completo: "Veterinário emissor", crmv: "123", crmv_uf: "mg" },
      { user_id: "perfil-outra-clinica", nome_completo: "Não mostrar", crmv: "999", crmv_uf: "MG" },
    ],
    oricse_animal_registros_extra: [
      consulta,
      { ...consulta, data: "2026-03-07", clinica_id: "outra" },
      { ...consulta, data: "2026-04-18", dados_atendimento: null },
    ],
    clinicas: [{ id: "clinica", nome: "Clínica autorizada" }],
  });
  const relatorio = await gerarRelatorioDocumentos({ ...entrada, codigo: "22" });
  assert.equal(relatorio.tabelas[0].linhas.length, 4);
  const [mismatch, outraCategoria, outroAnimal, emitida] = relatorio.tabelas[0].linhas;
  assert.equal(emitida[5], "Pet autorizado");
  assert.deepEqual(emitida.slice(7, 9), ["Veterinário emissor", "CRMV-MG 123"]);
  for (const linha of [mismatch, outraCategoria, outroAnimal])
    assert.deepEqual(linha.slice(7, 9), ["Não identificado", "—"]);
  assert.equal(emitida[12], "08/02/2026");
  assert.ok(relatorio.tabelas[0].linhas.every((r) => r[13] === "05/01/2031"));
  assert.ok(relatorio.tabelas[0].pdfReceitas.some(({ documentoId }) => documentoId === "receita"));
  assert.doesNotMatch(JSON.stringify(relatorio), /Pet alheio|Não enviar|Não mostrar|perfil-emissor/);
  assert.equal(consultas[0].principal, "jwt-ficticio");
  const consultasPerfil = consultas.filter((r) => r.tabela === "oricse_pessoas");
  assert.equal(consultasPerfil.length, 1);
  assert.deepEqual(consultasPerfil[0].operacoes, [
    ["select", "user_id,nome_completo,crmv,crmv_uf"],
    ["in", "user_id", ["perfil-emissor"]],
  ]);
  for (const { principal, tabela, operacoes } of consultas.slice(1).filter((r) => r.tabela !== "oricse_pessoas")) {
    assert.equal(principal, "servico");
    assert.ok(
      operacoes.some(
        ([metodo, coluna, id]) =>
          metodo === "eq" &&
          id === "clinica" &&
          coluna === (tabela === "clinicas" ? "id" : "clinica_id"),
      ),
    );
    assert.doesNotMatch(JSON.stringify(operacoes), /pet-outro|pet-excluido|pet-fora/);
  }
});

test("23 filtra no dia de São Paulo, não inclui outra clínica nem exagera em erro de leitura", async (t) => {
  const r = {
    id: "1",
    clinica_id: "clinica",
    item_id: null,
    item_nome: "Item",
    tipo: "entrada",
    quantidade: 1,
    estoque_anterior: 0,
    estoque_posterior: 1,
    registrado_em: "2026-01-10T23:00:00Z",
  };
  const consultas = bancoFicticio(t, {
    oricse_historico_estoque: [
      r,
      { ...r, id: "2", registrado_em: "2026-01-01T02:59:59Z" },
      { ...r, id: "3", registrado_em: "2026-01-11T02:59:59Z" },
      { ...r, id: "4", registrado_em: "2026-01-11T03:00:00Z" },
      { ...r, id: "5", clinica_id: "outra" },
    ],
    oricse_portal_documentos: new Error("erro privado da consulta"),
  });
  const relatorio = await gerarRelatorioDocumentos({ ...entrada, codigo: "23" });
  assert.equal(relatorio.tabelas[0].linhas.length, 2);
  assert.ok(relatorio.tabelas[0].linhas.every(([data]) => data === "10/01/2026"));
  assert.equal(consultas.length, 1);
  assert.equal(consultas[0].principal, "jwt-ficticio");
  await assert.rejects(() => gerarRelatorioDocumentos({ ...entrada, codigo: "24" }), {
    message: "Não foi possível consultar os registros do relatório.",
  });
});

test("24 exclui termos de prévia, registros sem data, exclusões lógicas e outras clínicas", async (t) => {
  const r = {
    id: "doc",
    clinica_id: "clinica",
    animal_id: "pet",
    drive_arquivo_id: null,
    titulo: "Termo de internação",
    tipo: "Termo",
    data_documento: "2026-01-02",
    visivel_tutor: false,
    excluido_em: null,
  };
  const consultas = bancoFicticio(t, {
    oricse_portal_documentos: [
      r,
      { ...r, id: "demo", animal_id: "pet-previa", tipo: "Termo - Prévia demonstrativa" },
      { ...r, id: "sem-data", animal_id: "pet-sem-data", data_documento: null },
      { ...r, id: "excluido", animal_id: "pet-excluido", excluido_em: "2026-01-09" },
      { ...r, id: "fora", animal_id: "pet-fora", clinica_id: "outra" },
    ],
    oricse_animais: [{ id: "pet", clinica_id: "clinica", nome: "Paciente" }],
  });
  const relatorio = await gerarRelatorioDocumentos({ ...entrada, codigo: "24" });
  assert.deepEqual(relatorio.tabelas[0].linhas, [
    [
      "02/01/2026",
      "Termo",
      "Termo",
      "Termo de internação",
      "Paciente",
      "Interno",
      "Sem PDF vinculado",
    ],
  ]);
  assert.deepEqual(
    consultas.map((r) => r.tabela),
    ["oricse_portal_documentos", "oricse_animais"],
  );
  assert.ok(
    consultas[1].operacoes.some(
      (r) => r[0] === "in" && r[1] === "id" && r[2].length === 1 && r[2][0] === "pet",
    ),
  );
});
