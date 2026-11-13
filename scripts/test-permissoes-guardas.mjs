import assert from "node:assert/strict";
import fs from "node:fs";

// Regressão estática dos pontos de entrada de permissões do proxy Drive.
// Complementa (não substitui) os testes autenticados entre clínicas.
const src = fs.readFileSync("src/lib/drive-rpc.ts", "utf8");
const between = (start, end) => {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Bloco não encontrado: ${start}`);
  return src.slice(a, b);
};
const manager = between("async function canManagePermissions(", "async function effectivePermissions(");
assert.match(manager, /\["responsavel", "admin_clinica", "rt"\]/);
assert.match(manager, /effectivePermissions\(clinicaId\)/);
assert.match(manager, /codigo === "administracao\.permissoes" && p\.permitido/);

const set = between('case "oricse_definir_permissao_usuario":', 'case "oricse_restaurar_permissao_usuario":');
assert.match(set, /canManagePermissions\(cid\)/);
assert.match(set, /clinica_usuarios/);
assert.match(set, /eq\("ativo", true\)/);
assert.match(set, /fromDrive\("oricse_permissoes"\)/);
assert.match(set, /matrizEfetiva\(cid\)/);
assert.match(set, /permite\("acao\." \+ codigo\)/);
assert.match(set, /catalogo\.funcionalidade_codigo/);

const reset = between('case "oricse_restaurar_permissao_usuario":', 'case "oricse_movimentar_estoque":');
assert.match(reset, /canManagePermissions\(cid\)/);
assert.match(reset, /clinica_usuarios/);
assert.match(reset, /eq\("ativo", true\)/);
assert.match(reset, /fromDrive\("oricse_permissoes"\)/);
assert.match(reset, /eq\("clinica_id", cid\)/);
console.log("Guardas estruturais de plano, cargo e vínculo verificadas.");
