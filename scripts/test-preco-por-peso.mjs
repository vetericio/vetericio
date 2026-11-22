import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const arquivo = await build({
  entryPoints:["src/lib/preco-por-peso.ts"],
  platform:"node", format:"esm", bundle:true, write:false, target:"node22",
  tsconfig:"tsconfig.json", logLevel:"silent",
});
const lib = await import("data:text/javascript;base64,"+
  Buffer.from(arquivo.outputFiles[0].text).toString("base64"));
const linhas = [
  {ateKg:10,valor:280},{ateKg:20,valor:320},
  {ateKg:30,valor:380},{ateKg:null,valor:440},
];
assert.equal(lib.validarFaixasPeso(linhas), null);
assert.equal(lib.sugerirFaixaPeso(linhas,0.1),0);
assert.equal(lib.sugerirFaixaPeso(linhas,10),0,"10 kg deve pertencer à primeira faixa");
assert.equal(lib.sugerirFaixaPeso(linhas,10.001),1);
assert.equal(lib.sugerirFaixaPeso(linhas,20),1);
assert.equal(lib.sugerirFaixaPeso(linhas,20.001),2);
assert.equal(lib.sugerirFaixaPeso(linhas,30),2);
assert.equal(lib.sugerirFaixaPeso(linhas,30.001),3);
assert.equal(lib.sugerirFaixaPeso(linhas,90),3);
assert.equal(lib.sugerirFaixaPeso(linhas,0),-1);
assert.equal(lib.sugerirFaixaPeso(linhas,null),-1);
assert.equal(lib.sugerirFaixaPeso(linhas,NaN),-1);
assert.equal(lib.validarFaixasPeso([{ateKg:10,valor:280},{ateKg:9,valor:320},{ateKg:null,valor:440}])!==null,true);
assert.equal(lib.validarFaixasPeso([{ateKg:10,valor:280},{ateKg:20,valor:320}])!==null,true);
assert.equal(lib.validarFaixasPeso([{ateKg:10,valor:280},{ateKg:null,valor:-1}])!==null,true);
assert.equal(lib.faixasValidas([{ateKg:10,valor:280},{ateKg:null,valor:320}]).length,2);
assert.equal(lib.faixasValidas(null).length,0);
assert.equal(lib.tituloFaixa(linhas,0),"Até 10 kg");
assert.match(lib.tituloFaixa(linhas,3),/Acima de 30 kg/);

const [catalogo,consulta,comanda,aprovacao,banco,tipos] = await Promise.all([
  readFile("src/routes/estoque.tsx","utf8"),
  readFile("src/routes/registro-clinico.tsx","utf8"),
  readFile("src/routes/comandas.tsx","utf8"),
  readFile("src/components/AprovarPrecoPorPeso.tsx","utf8"),
  readFile("supabase/migrations/20261122170000_catalogo_servicos_faixas_peso.sql","utf8"),
  readFile("src/lib/comandas.ts","utf8"),
]);
assert.match(catalogo,/Definir preço por faixa de peso do animal/);
assert.match(catalogo,/agruparServicosExistentes/);
assert.match(catalogo,/oricse_agrupar_servicos_peso/);
assert.match(catalogo,/faixas_peso: modal\.tipo === "servico"/);
assert.match(consulta,/AprovarPrecoPorPeso/);
assert.match(consulta,/precoPorPeso: item\.precoPorPeso/);
assert.match(consulta,/itensSemPreco=itensComanda\.filter/);
assert.match(comanda,/servicoComFaixas && \(!precoPesoAprovado/);
assert.match(comanda,/precoPorPeso: precoPesoAprovado/);
assert.match(comanda,/\.select\("id,nome,tutor_id,especie,peso_kg,dados"\)/);
assert.match(aprovacao,/Aprovar valor/);
assert.match(aprovacao,/aprovadoPor, aprovadoEm: new Date/);
assert.match(aprovacao,/motivo\.trim\(\)\.length < 5/);
assert.match(tipos,/precoPorPeso\?:/);
assert.match(banco,/create or replace function public\.oricse_agrupar_servicos_peso/);
assert.match(banco,/security invoker/);
assert.match(banco,/public\.oricse_usuario_pode_permissao\(p_clinica, 'estoque.catalogo.gerenciar'\)/);
assert.match(banco,/where clinica_id=p_clinica and tipo='servico' and ativo=true/);
assert.match(banco,/update public\.oricse_catalogo_itens set ativo=false/);
assert.doesNotMatch(banco,/delete from public\.oricse_catalogo_itens/i);
console.log("OK: limites inclusivos, preço sugerido, aprovação, auditoria e conversão sem apagar serviços antigos.");
