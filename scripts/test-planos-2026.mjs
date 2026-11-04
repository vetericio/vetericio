import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("src/lib/beneficios-oricse.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, strict: true },
}).outputText;
const { BENEFICIOS_ORICSE, NIVEIS_PLANOS, permitidoNoNivel } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);

assert.equal(BENEFICIOS_ORICSE.length, 98, "catálogo deve conter 98 benefícios");
assert.equal(new Set(BENEFICIOS_ORICSE.map((b) => b.codigo)).size, 98, "códigos únicos");
assert.equal(NIVEIS_PLANOS.length, 4, "quatro planos");
assert.deepEqual(NIVEIS_PLANOS, ["solo-2026","essencial-2026","profissional-2026","master-2026"]);
for (const b of BENEFICIOS_ORICSE) {
  for (let nivel=0; nivel<4; nivel++) {
    assert.equal(permitidoNoNivel(b.codigo,nivel),nivel>=b.nivelMinimo,
      `benefício ${b.codigo} deve respeitar o nível mínimo`);
  }
}
assert.equal(BENEFICIOS_ORICSE[0].nome,"Painel inicial e resumo do dia");
assert(BENEFICIOS_ORICSE.some((b)=>b.nome.includes("Banco de horas") && b.nivelMinimo===2));
assert(BENEFICIOS_ORICSE.some((b)=>b.nome.includes("Movimentações e ajustes") && b.nivelMinimo===2));
assert(BENEFICIOS_ORICSE.some((b)=>b.nome.includes("Painel de internação") && b.nivelMinimo===2));
assert(BENEFICIOS_ORICSE.some((b)=>b.nome.includes("CRM com campanhas") && b.nivelMinimo===3));
const admin = readFileSync("src/routes/admin-planos.tsx","utf8");
const planos = readFileSync("src/routes/planos.tsx","utf8");
const checkout = readFileSync("src/routes/contratar.tsx","utf8");
assert(admin.includes("BENEFICIOS_ORICSE"),"Admin importa catálogo");
assert(admin.includes("alterarFuncionalidade"),"Admin permite controlar recursos");
assert(admin.includes("mudarExcecao"),"Admin permite exceções individuais por clínica");
assert(planos.includes("Comparar todos os 98 benefícios"),"Vitrine compara todos os recursos");
for (const plano of NIVEIS_PLANOS) assert(checkout.includes(plano),"Checkout suporta "+plano);
console.log("Verificados 98 benefícios, cascata dos 4 planos, permissões no Admin, comparação e checkout.");
