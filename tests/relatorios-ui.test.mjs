import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const chave = Symbol.for("oricse.tests.relatorios.ui");
const modulo = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const url = (p) => new URL(p, import.meta.url).href;
const trocas = new Map([
  [
    "@tanstack/react-router",
    modulo("export const createFileRoute=()=>opts=>opts; export const Link=()=>null;"),
  ],
  [
    "@/hooks/usePermissoes",
    modulo("export const usePermissoes=()=>globalThis[Symbol.for('oricse.tests.relatorios.ui')];"),
  ],
  ["@/integrations/supabase/client", modulo("export const supabase={};")],
  [
    "@/lib/relatorios.functions",
    modulo(
      "export const consultarRelatorio=()=>{throw new Error('A tela não deve buscar dados antes de Consultar.')};",
    ),
  ],
  [
    "@/lib/orcamentos-relatorio.functions",
    modulo(
      "export const vincularOrcamentoRelatorio=()=>{throw new Error('A renderização inicial não deve gravar dados.')};",
    ),
  ],
  ["@/lib/portal-document.functions", modulo("export const baixarDocumentoPortal=()=>null;")],
  ["@/lib/relatorios-acesso", url("../src/lib/relatorios-acesso.ts")],
  ["@/lib/relatorios", url("../src/lib/relatorios.ts")],
  ["react", import.meta.resolve("react")],
  ["react/jsx-runtime", import.meta.resolve("react/jsx-runtime")],
  ["lucide-react", import.meta.resolve("lucide-react")],
]);
const codigo = fs.readFileSync(new URL("../src/routes/relatorios.tsx", import.meta.url), "utf8");
let { outputText } = ts.transpileModule(codigo, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
});
for (const [origem, destino] of trocas) {
  outputText = outputText.replaceAll(`from "${origem}"`, `from "${destino}"`);
}
const { Route } = await import(modulo(outputText));

function simular(clinicaSlug, permissoes) {
  globalThis[chave] = {
    clinicaId: "clinica-teste",
    clinicaNome: "Clínica teste",
    clinicaSlug,
    carregando: false,
    pode: (p) => permissoes.includes(p),
  };
  try {
    return renderToStaticMarkup(createElement(Route.component));
  } finally {
    delete globalThis[chave];
  }
}

test("Outra clínica não renderiza os painéis, mesmo com os três acessos de origem", () => {
  const html = simular("outra-clinica-teste", [
    "caixa.financeiro.visualizar",
    "recepcao.agenda",
    "hotelzinho.visualizar",
  ]);
  assert.match(html, /somente para a Veterício/);
  assert.doesNotMatch(html, /Tipos de relatórios|<form/);
});

test("A recepção da Veterício vê o primeiro relatório operacional sem liberar relatórios financeiros", () => {
  const html = simular("vetericio", ["recepcao.agenda"]);
  assert.match(html, /Operacionais/);
  assert.match(html, /aria-pressed="true"[^>]*>08/);
  assert.match(html, /09 · Faltas/);
  assert.match(html, /10 · Fila/);
  assert.doesNotMatch(html, /01 · Faturamento|11 · Banho e tosa/);
});

test("Hotel e banho e tosa aparecem para o acesso operacional, sem abas financeiras", () => {
  const html = simular("vetericio", ["hotelzinho.visualizar"]);
  assert.match(html, /aria-pressed="true"[^>]*>11/);
  assert.match(html, /12 · Hotelzinho/);
  assert.doesNotMatch(html, /07 · Orçamentos|08 · Ocupação/);
});

test("Relatórios com duas permissões não aparecem para quem possui apenas uma", () => {
  const parcial = simular("vetericio", ["internacao.plantoes", "hotelzinho.visualizar"]);
  assert.doesNotMatch(parcial, /18 · Plantões/);
  const completo = simular("vetericio", ["internacao.plantoes", "internacao.registrar"]);
  assert.match(completo, /18 · Plantões/);
});
