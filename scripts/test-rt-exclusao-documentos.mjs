import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, action, route, download, status] = await Promise.all([
  readFile("supabase/migrations/20261122124015_rt_exclusao_logica_documentos.sql", "utf8"),
  readFile("src/lib/exclusao-documentos-rt.functions.ts", "utf8"),
  readFile("src/routes/animal.tsx", "utf8"),
  readFile("src/lib/portal-document.functions.ts", "utf8"),
  readFile("src/lib/status-termos-paciente.functions.ts", "utf8"),
]);

// O botão não deve autorizar operadores, admins gerais nem recepcionistas.
assert.match(action, /vinculo\.data\?\.papel === "rt"/);
assert.match(action, /z\.literal\("DELETE"\)/);
assert.match(action, /exigirEmissaoDisponivel/);
assert.match(route, /podeExcluirComoRt && \["Termos", "Receitas"\]/);
assert.match(route, /confirmacaoDelete !== "DELETE"/);
assert.match(route, /motivoExclusao\.trim\(\)\.length < 5/);

// A autorização tem segunda camada no PostgreSQL, sem confiar no browser.
assert.match(migration, /u\.papel='rt'/);
assert.match(migration, /current_user <> 'service_role'/);
assert.match(migration, /revoke all on function public\.oricse_arquivar_documento_rt/);
assert.match(migration, /grant execute on function public\.oricse_arquivar_documento_rt/);
assert.match(migration, /to service_role;/);

// Arquivos clínicos preservados e operações rastreáveis.
assert.doesNotMatch(action, /\.delete\(/);
assert.doesNotMatch(migration, /delete from public\.oricse_portal_/i);
assert.match(migration, /create table if not exists public\.oricse_auditoria_exclusoes_clinicas/);
assert.match(migration, /visivel_tutor=false/);
assert.match(migration, /for delete to authenticated using \(false\)/);
assert.match(route, /\.is\("excluido_em", null\)/);
assert.match(status, /\.is\("excluido_em", null\)/);
assert.match(download, /if \(estado\.excluido_em\) throw new Error/);
console.log("OK: DELETE protegido pelo RT no servidor e banco, com retenção, auditoria e ocultação do Portal do Tutor.");
