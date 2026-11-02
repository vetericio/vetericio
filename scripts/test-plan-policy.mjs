import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const fonte = fs.readFileSync("src/lib/plan-policy.ts", "utf8");
const js = ts.transpileModule(fonte, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, strict: true,
}}).outputText;
const { recursoLiberado, permissaoEfetiva } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);

const C = (overrides = {}) => ({
  statusClinica: "ativa",
  planoAtivo: true,
  planoId: "p1",
  codigoPlano: "plus",
  clinicaId: "c1",
  regras: [
    { plano_id: "p1", funcionalidade_codigo: "estoque.catalogo", permitido: true },
    { plano_id: "p1", funcionalidade_codigo: "acao.estoque.catalogo.gerenciar", permitido: true },
  ],
  excecoes: [],
  legados: [],
  acoesLegadas: new Set(["recepcao.agenda"]),
  agora: Date.parse("2026-11-01T12:00:00.000Z"),
  ...overrides,
});
const P = (overrides = {}) => ({
  codigo: "estoque.catalogo.gerenciar",
  modulo: "estoque.catalogo",
  contexto: C(),
  permitidoCargo: true,
  ...overrides,
});

assert.equal(permissaoEfetiva(P()), true, "módulo, ação e cargo liberados");
assert.equal(permissaoEfetiva(P({ permitidoCargo: false })), false, "cargo bloqueia mesmo com plano liberado");
assert.equal(permissaoEfetiva(P({ excecaoUsuario: false })), false, "bloqueio individual prevalece");
assert.equal(permissaoEfetiva(P({ contexto: C({ regras: [
  { plano_id: "p1", funcionalidade_codigo: "estoque.catalogo", permitido: false },
  { plano_id: "p1", funcionalidade_codigo: "acao.estoque.catalogo.gerenciar", permitido: true },
] }) })), false, "ação não ultrapassa bloqueio do módulo");
assert.equal(permissaoEfetiva(P({ contexto: C({ regras: [
  { plano_id: "p1", funcionalidade_codigo: "estoque.catalogo", permitido: true },
  { plano_id: "p1", funcionalidade_codigo: "acao.estoque.catalogo.gerenciar", permitido: false },
] }), excecaoUsuario: true })), false, "permissão individual não ultrapassa bloqueio do plano");
assert.equal(recursoLiberado("acao.desconhecida", C()), false, "ação nova nasce bloqueada");
assert.equal(recursoLiberado("acao.recepcao.agenda", C()), true, "ação legada não classificada mantém compatibilidade");
assert.equal(recursoLiberado("estoque.catalogo", C({ statusClinica: "bloqueada" })), false, "clínica bloqueada");
assert.equal(recursoLiberado("estoque.catalogo", C({ planoAtivo: false })), false, "plano inativo");
assert.equal(recursoLiberado("estoque.catalogo", C({ excecoes: [
  { clinica_id: "c1", funcionalidade_codigo: "estoque.catalogo", permitido: false },
] })), false, "exceção de clínica bloqueia");
assert.equal(recursoLiberado("estoque.catalogo", C({ excecoes: [
  { clinica_id: "c2", funcionalidade_codigo: "estoque.catalogo", permitido: false },
] })), true, "exceção de outra clínica não vaza");
assert.equal(recursoLiberado("estoque.catalogo", C({ excecoes: [
  { clinica_id: "c1", funcionalidade_codigo: "estoque.catalogo", permitido: false, expira_em: "2026-10-01T00:00:00Z" },
] })), true, "exceção expirada ignorada");
assert.equal(recursoLiberado("estoque.catalogo", C({ regras: [
  { plano_id: "p2", funcionalidade_codigo: "estoque.catalogo", permitido: false },
] })), false, "plano diferente não concede autorização");
console.log("13 testes da política de planos e cargos passaram.");
