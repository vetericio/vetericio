import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const [schema, server, panel, consulta, animal, crm, campanhas, navegacao, menu] = await Promise.all([
  readFile("supabase/migrations/20261122142015_crm_retornos_clinicos.sql","utf8"),
  readFile("src/lib/crm-retornos.functions.ts","utf8"),
  readFile("src/components/CrmRetornosPanel.tsx","utf8"),
  readFile("src/routes/registro-clinico.tsx","utf8"),
  readFile("src/routes/animal.tsx","utf8"),
  readFile("src/routes/crm.tsx","utf8"),
  readFile("src/components/Crm360Panel.tsx","utf8"),
  readFile("src/lib/navegacao.ts","utf8"),
  readFile("src/components/MenuLateral.tsx","utf8"),
]);
assert.match(schema,/enable row level security/);
assert.match(schema,/revoke all on public\.oricse_crm_retornos from public, anon, authenticated/);
assert.match(schema,/grant select, insert, update on public\.oricse_crm_retornos to service_role/);
assert.match(schema,/clinica_id uuid not null/);
assert.match(schema,/unique index if not exists oricse_crm_retorno_origem_unica/);
assert.match(schema,/retorno_em date/);
assert.match(server,/exigirPermissaoClinica\(supabaseAdmin, auth\.user\.id, clinicaId/);
assert.match(server,/\.eq\("clinica_id", data\.clinicaId\)/);
assert.match(server,/\.eq\("animal_id", data\.animalId\)/);
assert.match(server,/\.eq\("titulo","Consulta"\)/);
assert.match(server,/obterTodasLinhas\(admin, "oricse_portal_vacinas"/);
assert.match(server,/obterTodasLinhas\(admin, "oricse_portal_vermifugos"/);
assert.match(server,/obterTodasLinhas\(admin, "oricse_portal_exames"/);
assert.match(server,/ignoreDuplicates: true/);
assert.doesNotMatch(server, /wa\.me|sendMail|sendWhatsapp|\.delete\(/);
assert.match(consulta,/retornoEm: string/);
assert.match(consulta,/registrarRetornoClinico/);
assert.match(consulta,/origemId: registroId\.current/);
assert.match(animal,/retorno_em: retornoExameEm \|\| null/);
assert.match(crm,/CrmRetornosPanel/);
assert.match(crm,/visao === "retornos"/);
assert.match(crm,/visao === "campanhas"/);
assert.match(navegacao,/CRM_EM_PREPARACAO = false/);
assert.match(menu,/Retornos, cuidados e campanhas/);
assert.match(panel,/Contatei o tutor/);
assert.match(panel,/Confirmado/);
assert.match(panel,/Reagendar/);
assert.match(panel,/p\.tutor_id/);
assert.match(campanhas,/tutor\.autoriza_marketing !== true/);
assert.match(campanhas,/WhatsApp cadastrado: \{totaisWhatsApp\.cadastrados\}/);
assert.match(campanhas,/WhatsApp autorizado para campanhas: \{totaisWhatsApp\.autorizadosCampanhas\}/);
assert.match(campanhas,/Nenhum tutor atende a este filtro de campanha/);
assert.match(campanhas,/Com WhatsApp|WhatsApp para campanhas/);
assert.match(campanhas,/revisandoCampanha/);
assert.match(campanhas,/Campanha em três passos|Escolha uma campanha pronta/);
assert.match(schema,/lower\(coalesce\(v_tutor\.dados->>'autorizaMarketing','false'\)\) <> 'true'/);
assert.match(schema,/and clinica_id=v_campanha\.clinica_id/);
assert.match(schema,/v_tutor\.telefone/);
assert.match(schema,/v_tutor\.email/);
// Regressão de performance: Retornos não depende da fila e sincronização
// de reforços não pode bloquear a primeira leitura.
assert.match(crm,/if \(visao !== "fila"\)/);
assert.match(crm,/lazy\(\(\) => import\("@\/components\/Crm360Panel"\)/);
assert.match(panel,/const \[resposta, pets, pais\] = await Promise\.all/);
assert.match(panel,/sincronizar: true/);
assert.match(server,/if \(data\.sincronizar\) await sincronizarReforcos/);
assert.doesNotMatch(server,/^\s{4}await sincronizarReforcos\(admin, data\.clinicaId\);$/m);
console.log("OK: retornos clínicos, consentimento, segurança por clínica e campanhas autoexplicativas.");
