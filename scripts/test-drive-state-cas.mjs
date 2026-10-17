import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/lib/drive-cas.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { validarVersaoEstado } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const base = { estoque: JSON.stringify([{ id: "a", quantidade: 10 }]), caixa: JSON.stringify([{ id: "b", valor: 100 }]) };
const primeira = { chave: "estoque", esperado: base.estoque, valor: JSON.stringify([{ id: "a", quantidade: 9 }]) };
validarVersaoEstado(base, [primeira]);
const atualizado = { ...base, estoque: primeira.valor };
assert.throws(() => validarVersaoEstado(atualizado, [{ chave: "estoque", esperado: base.estoque, valor: JSON.stringify([{ id: "a", quantidade: 8 }]) }]),
  (e) => e.code === "DRIVE_CONFLICT" && e.field === "estoque");
// Idempotent retry of the same request is accepted.
validarVersaoEstado(atualizado, [primeira]);
// An independent key still succeeds.
validarVersaoEstado(atualizado, [{ chave: "caixa", esperado: base.caixa, valor: JSON.stringify([{ id: "b", valor: 90 }]) }]);
// If one value is conflicting, the entire batch is rejected before any mutation.
assert.throws(() => validarVersaoEstado(atualizado, [
  { chave: "caixa", esperado: base.caixa, valor: "novo" },
  { chave: "estoque", esperado: base.estoque, valor: "valor que conflita" },
]), /Outros usuários/);
console.log("Drive state CAS: conflict, idempotence and independent keys OK");
