import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const tsSource = readFileSync("src/lib/cota-animais.ts", "utf8");
const transpiled = ts.transpileModule(tsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, strict: true },
}).outputText;
const { avaliarLimiteAnimais } = await import(
  "data:text/javascript;base64," + Buffer.from(transpiled).toString("base64")
);

assert.equal(avaliarLimiteAnimais(null, ["a"], ["b"]).permitido, true, "ilimitado");
assert.equal(avaliarLimiteAnimais(50, ["a"], ["b"]).permitido, true, "cabe no limite");
assert.equal(avaliarLimiteAnimais(2, ["a", "b"], ["c"]).permitido, false, "bloqueia quando cheio");
assert.equal(avaliarLimiteAnimais(2, ["a", "b", "c"], ["c"]).permitido, true, "permite editar acima da cota");
assert.equal(avaliarLimiteAnimais(1, ["a"], ["a"]).novos, 0, "não conta duplicado");
assert.equal(avaliarLimiteAnimais(2, ["a"], ["b", "b", "a"]).aposCadastro, 2, "não duplica IDs");
assert.equal(avaliarLimiteAnimais(2, ["a"], ["b", "c"]).permitido, false, "lote ultrapassa o limite");
assert.equal(avaliarLimiteAnimais(1, ["a", "b"], []).permitido, true, "redução do plano não exclui registros");
console.log("8 testes de limites coletivos de animais passaram.");
