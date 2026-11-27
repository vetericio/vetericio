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
assert.match(menu,/rotulo: "Início"/);
assert.match(menu,/secaoCrm: "pos-cirurgico"/);
assert.match(menu,/secaoCrm: "ausentes"/);
assert.match(menu,/secaoCrm: "satisfacao"/);
assert.match(menu,/Central de Relacionamento/);
const [tutoresTela, migracaoLiberacao, seed] = await Promise.all([
  readFile("src/routes/tutores.tsx","utf8"),
  readFile("supabase/migrations/20261122201000_central_relacionamento_todas_clinicas.sql","utf8"),
  readFile("src/lib/drive-seed.ts","utf8"),
]);
assert.match(tutoresTela,/autorizaMarketing: false/);
assert.doesNotMatch(tutoresTela,/autorizaMarketing: true/);
assert.match(tutoresTela,/autorizaMarketing: dados\.autorizaMarketing/);
assert.match(tutoresTela,/checked=\{form\.autorizaMarketing === true\}/);
assert.match(tutoresTela,/Marque somente se o tutor autorizou/);
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
assert.match(crm,/if \(!carregaFila\)/);
assert.match(crm,/validateSearch: /);
assert.match(crm,/const visao = secao \?\? "inicio"/);
assert.match(crm,/Escolha o que deseja fazer/);
assert.match(crm,/Todas as opções/);
assert.match(crm,/Retornos e cuidados/);
assert.match(crm,/Fila de mensagens/);
assert.match(crm,/Histórico de contatos/);
assert.match(crm,/Modelos de mensagens/);
assert.match(crm,/Configurações/);
assert.doesNotMatch(crm,/Abas da Central de Relacionamento/);
assert.match(menu,/secaoCrm: "pos-cirurgico"/);
assert.match(menu,/secaoCrm: "ausentes"/);
assert.match(menu,/secaoCrm: "satisfacao"/);
assert.match(crm,/nome: "Pós-cirúrgico"/);
assert.doesNotMatch(crm,/Orçamentos pendentes/);
assert.match(crm,/Pesquisa de satisfação/);
assert.match(crm,/onAbrirFila=\{\(\) => abrirSecao\("fila"\)\}/);
assert.match(crm,/carregaFila && \(carregando \?/);
assert.doesNotMatch(crm,/Seções da Central de Relacionamento/);
assert.doesNotMatch(crm,/const \[visao, setVisao\]/);
assert.doesNotMatch(crm,/const \[aba, setAba\]/);
assert.match(crm,/lazy\(\(\) => import\("@\/components\/Crm360Panel"\)/);
assert.match(panel,/const \[resposta, pets, pais\] = await Promise\.all/);
assert.match(panel,/sincronizar: true/);
assert.match(server,/if \(data\.sincronizar\) await sincronizarReforcos/);
assert.doesNotMatch(server,/^\s{4}await sincronizarReforcos\(admin, data\.clinicaId\);$/m);
const [journeys,journeyPanel,postSource,postFunctions,clin,avaliacao,root] = await Promise.all([
  readFile("src/lib/crm-jornadas.functions.ts","utf8"),
  readFile("src/components/CrmJornadaPanel.tsx","utf8"),
  readFile("src/lib/crm-pos-cirurgico.ts","utf8"),
  readFile("src/lib/crm-pos-cirurgico.functions.ts","utf8"),
  readFile("src/routes/registro-clinico.tsx","utf8"),
  readFile("src/routes/avaliar-atendimento.tsx","utf8"),
  readFile("src/routes/__root.tsx","utf8"),
]);
assert.match(crm,/CrmJornadaPanel/);
assert.match(crm,/visao === "pos-cirurgico"/);
assert.match(crm,/visao === "ausentes"/);
assert.match(crm,/visao === "satisfacao"/);
assert.match(crm,/gerar_pos_cirurgico: false/);
assert.doesNotMatch(crm,/if \(cfg\.gerar_pos_cirurgico && \/cirurg/);
assert.doesNotMatch(crm,/if \(cfg\.gerar_inativos\) \{/);
assert.match(crm,/obter.*Jornada|abrirSecao\(evento\.tipo/);
assert.match(clin,/criarJornadaPosCirurgica/);
assert.match(postSource,/DIAS_POS_CIRURGICO_PADRAO = \[1, 3, 7, 10\]/);
assert.match(postFunctions,/fonteClinicaElegivel/);
assert.match(postFunctions,/exigirPermissaoClinica/);
assert.match(postFunctions,/ignoreDuplicates: true/);
assert.match(journeys,/CONCLUIDOS\.has/);
assert.match(journeys,/autorizaMarketing === true/);
assert.match(journeys,/somente_envio_humano:true/);
assert.match(journeys,/pesquisa_token_hash/);
assert.match(journeys,/from\("oricse_animal_registros_extra"\)/);
assert.match(journeys,/\.eq\("clinica_id",d\.clinicaId\)/);
assert.match(journeys,/\.eq\("titulo","Consulta"\)/);
assert.match(journeys,/consultasPersistidas/);
assert.match(journeys,/dias>=0 && dias<=14/);
assert.match(journeys,/destinatariosPesquisa\(dados\)/);
assert.match(journeys,/if\(data\.manual\)/);
assert.match(journeys,/Tutor não cadastrado nesta clínica/);
assert.match(journeys,/autorizaWhatsapp !== true|autorizaWhatsapp!==true/);
assert.match(journeys,/Já existe uma pesquisa para este tutor nos últimos 30 dias/);
assert.match(journeys,/pesquisa_satisfacao:manual:/);
assert.match(journeyPanel,/Enviar pesquisa para qualquer tutor/);
assert.match(journeyPanel,/Buscar tutor ou animal/);
assert.match(journeyPanel,/Selecionar tutor/);
assert.match(journeyPanel,/Preparar pesquisa para este tutor/);
assert.match(journeyPanel,/manual:tipo==="satisfacao"&&manual/);

assert.match(journeys,/pesquisa_expira_em/);
assert.match(journeys,/responderPesquisaSatisfacao/);
assert.match(journeys,/exigirPermissaoClinica/);
assert.match(journeys,/getUser\(d\.accessToken\)/);
assert.doesNotMatch(journeys,/sendWhatsapp|\.delete\(/);
assert.match(journeyPanel,/Revisar WhatsApp/);
assert.match(journeyPanel,/Nenhuma mensagem foi enviada/);
assert.match(avaliacao,/Enviar avaliação/);
assert.match(root,/"\/avaliar-atendimento"/);
await import("./test-crm-pos-cirurgico.mjs");
console.log("OK: retornos clínicos, consentimento, segurança por clínica e campanhas autoexplicativas.");
