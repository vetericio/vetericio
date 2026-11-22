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
assert.match(menu,/Retornos, lembretes e campanhas/);
assert.match(menu,/Central de Relacionamento/);
const [tutoresTela, migracaoLiberacao, seed] = await Promise.all([
  readFile("src/routes/tutores.tsx","utf8"),
  readFile("supabase/migrations/20261122201000_central_relacionamento_todas_clinicas.sql","utf8"),
  readFile("src/lib/drive-seed.ts","utf8"),
]);
assert.match(tutoresTela,/autorizaMarketing: true/);
assert.match(tutoresTela,/checked=\{form\.autorizaMarketing === true\}/);
assert.match(tutoresTela,/Desmarque se o tutor não autorizou/);
assert.match(migracaoLiberacao,/update public\.oricse_plano_funcionalidades/);
assert.match(migracaoLiberacao,/funcionalidade_codigo='crm\.inteligente'/);
assert.match(migracaoLiberacao,/where clinica_id=\(select id from public\.clinicas where slug='vetericio'\)/);
assert.doesNotMatch(migracaoLiberacao,/p_codigo !~/);
assert.match(seed,/const BASE_2026 = \[[^\]]*"crm\.inteligente"\]/);

assert.doesNotMatch(menu,/crmLiberadoParaClinica/);
assert.doesNotMatch(crm,/crmLiberadoParaClinica/);
assert.match(crm,/>Central de Relacionamento<\/h1>/);
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
const etapaPos = await readFile("src/lib/crm-pos-cirurgico.ts","utf8");
const registroClinico = await readFile("src/routes/registro-clinico.tsx","utf8");
// Pós-cirúrgico não pode surgir de um simples agendamento.
assert.doesNotMatch(crm,/if \(cfg\.gerar_pos_cirurgico && \/cirurg/);
assert.match(etapaPos,/registro\.status !== "concluido"/);
assert.match(etapaPos,/acompanhamentoCrm === true/);
assert.match(crm,/gerarTarefasPosCirurgicas/);
assert.match(crm,/chave_dedupe: etapa\.chaveDedupe/);
const fontesBackend = await readFile("src/lib/crm-pos-cirurgico.functions.ts","utf8");
const migracaoPos = await readFile("supabase/migrations/20261122213000_crm_pos_cirurgico_somente_prontuario_concluido.sql","utf8");
assert.match(crm,/listarFontesPosCirurgicas/);
assert.match(crm,/fontesCirurgicasPromessa/);
assert.match(crm,/evento\.tipo === "pos_cirurgico" && evento\.origem === "automatico"/);
assert.match(fontesBackend,/from\("oricse_dados_modulos"\)/);
assert.match(fontesBackend,/\.eq\("clinica_id", data\.clinicaId\)/);
assert.match(fontesBackend,/exigirPermissaoClinica/);
assert.match(fontesBackend,/fonteClinicaElegivel/);
assert.match(fontesBackend,/criarJornadaPosCirurgica/);
assert.match(fontesBackend,/ignoreDuplicates: true/);
assert.match(fontesBackend,/tutor\.id !== registro\.tutorId/);
assert.match(registroClinico,/criarJornadaPosCirurgica/);
assert.match(registroClinico,/await descarregarOricseStorage\(\)/);
assert.match(migracaoPos,/if v_cfg\.gerar_agendamentos then/);
assert.doesNotMatch(migracaoPos,/gerar_pos_cirurgico and v_servico/);
assert.doesNotMatch(fontesBackend,/window\.open|wa\.me|sendWhatsapp/);
assert.match(crm,/setEditorPosCirurgico/);
assert.match(fontesBackend,/autorizacoes\.autorizaWhatsapp !== true \|\| autorizacoes\.autorizaLembretes !== true/);
assert.match(fontesBackend,/obterWhatsappPosCirurgico/);
assert.match(fontesBackend,/\["crm\.enviar", "crm\.gerenciar"\]/);
assert.match(fontesBackend,/\.eq\("id", data\.eventoId\)/);
assert.match(fontesBackend,/\.eq\("clinica_id", data\.clinicaId\)/);
assert.match(crm,/obterWhatsappPosCirurgico/);
assert.doesNotMatch(crm,/\.from\("tutores"\)[\s\S]*?const { numero }/);
assert.match(registroClinico,/checked=\{acompanharPosCirurgico\}/);
assert.match(registroClinico,/status:"concluido"/);
assert.match(etapaPos,/DIAS_POS_CIRURGICO_PADRAO = \[1, 3, 7, 10\]/);
await import("./test-crm-pos-cirurgico.mjs");
console.log("OK: retornos clínicos, consentimento, segurança por clínica e campanhas autoexplicativas.");
