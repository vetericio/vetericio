# ORICSE — Central de Relacionamento | Plano aprovado por etapas

**Situação:** preparação técnica. **Não publicar, não executar migrações e não enviar mensagens sem nova autorização.**

## Ponto de recuperação
- Branch de backup de código: `backup/pre-central-relacionamento-etapas-20261122`
- Base imutável: `242e714985d961b1b46116ca3ad3c677df698cff`
- Branch de desenvolvimento: `feat/central-pos-cirurgico-etapa1-20261122`
- Banco Supabase: **produção não alterada nesta etapa**. Os conectores atuais não oferecem uma operação de backup completo/PITR; solicitar/verificar snapshot completo de arquivos + banco antes da primeira migração ou atualização operacional.
- Reversão de código: não mesclar PR; excluir a branch experimental se rejeitada. Em eventual publicação futura, reverter o merge para a base validada.
- Backups não devem ser confundidos com simples cópias de schema ou branches do GitHub; estes últimos não restauram dados de produção.

## Etapa 1 — Pós-cirúrgico inteligente
**Objetivo:** contatos úteis após procedimento concluído, nunca a partir do agendamento isolado.

**Implementado apenas na branch para teste:**
1. Campo opcional em Registro clínico > Cirurgia / Procedimento: criar acompanhamento na Central, com data de alta opcional.
2. O registro salvo inclui confirmação explícita do acompanhamento, data do procedimento, alta e vínculo com paciente/tutor/clínica.
3. Motor determinístico produz tarefas D+1, D+3, D+7 e D+10. Referência é a data de alta quando preenchida; os intervalos futuros poderão ser configuráveis após a validação clínica.
4. Rejeita registros rascunho/cancelados, clínicos sem vínculo completo e inconsistências de data. Geração deduplicada por ID do registro e etapa.
5. O CRM não pode criar tarefas pós-cirúrgicas só porque há cirurgia agendada.
6. Rascunho de mensagem por etapa, editável antes de abrir WhatsApp; a abertura valida consentimento atual por clínica e tutor. Nenhuma mensagem é enviada automaticamente.
7. Sinais preocupantes são assunto para avaliação veterinária humana, não para conduta clínica automática.

**Integração persistida preparada nesta branch:** o registro clínico é gravado em `oricse_dados_modulos` (chave `estado_sistema` / `oricse-prontuario-animal-v1`) antes de gerar as tarefas. O servidor confere sessão, permissão do cargo, clínica, paciente e tutor e grava os eventos com chaves únicas em `oricse_crm_eventos`. O sistema não envia WhatsApp automaticamente. A rotina antiga de `oricse_crm_processar_clinica_interno`, que confundia agenda com cirurgia realizada, será desativada por migração versionada **somente após backup e autorização de publicação**. As tarefas antigas ficam preservadas, mas pendências automáticas sem prontuário concluído ficam ocultas para evitar contatos equivocados.

**Limite da versão de teste:** ainda faltam testes autenticados com sessões reais de diferentes clínicas, confirmação do backup completo do banco, auditoria da revisão de consentimentos, e medição real da abertura da Central (meta de até 3 segundos). Não habilitar jornadas automáticas em produção até essas verificações.

## Etapa 2 — Recuperação de clientes ausentes
- Referenciar último atendimento realmente concluído no banco, nunca apenas o último agendamento.
- Filtrar 90, 180, 365 dias, parametrizável; excluir óbitos, opt-out e novos agendamentos.
- Limitar recontatos e evitar duplicações. Ação humana com texto editável.

## Etapa 3 — Pesquisa de satisfação
- Após atendimento concluído, tarefa de convite no período configurado.
- Pesquisa com escala 1–5 e comentário opcional via link seguro.
- Notas 1–2 geram alerta interno reservado; excluir casos sensíveis, proteger dados e não disparar mensagens sem intervenção.
- Respostas persistentes isoladas por clínica.

## Etapa 4 — Orçamentos pendentes
- Antes da automação, criar persistência canônica de orçamentos e seus itens/valores/versões, vínculo de tutor opcional e status auditáveis.
- Prazos D+2/D+5 por padrão, sem ultrapassar validade.
- Apenas orçamentos identificados e ainda não aprovados/recusados/cancelados entram na fila.
- Sem cobranças ou vendas automáticas.

## Gates de liberação
- [ ] CI: testes de unidade, regressões CRM, lint, build, TypeScript, dry-run Cloudflare.
- [ ] Backup **completo** de arquivos + banco, com restauração verificada, antes de operações em produção.
- [ ] Testes autenticados multi-clínica (RLS e permissões) e fluxo real, sem mensagens de WhatsApp enviadas.
- [ ] Revisão de consentimentos e confidencialidade clínica.
- [ ] Latência da Central medida no navegador real; meta de até 3 segundos.
- [ ] Aprovação explícita de publicação pelo proprietário do ORICSE.

## Migração preparada, NÃO aplicada
- `supabase/migrations/20261122213000_crm_pos_cirurgico_somente_prontuario_concluido.sql`
- Preserva a função anterior no Git e remove exclusivamente a geração de pós-cirúrgico a partir de agendamentos.
- **Não executar** antes de snapshot consistente/restaurável do banco e confirmação de publicação.
- O procedimento pode criar tarefas imediatamente após o salvamento confirmado, mas só na versão de desenvolvimento. A aplicação da migração deve ser coordenada com a publicação para não manter geradores conflitantes.
- Rollback SQL: restaurar a definição anterior de `oricse_crm_processar_clinica_interno(uuid)` a partir do histórico versionado após análise. Nunca apagar registros criados em teste sem revisar IDs e vínculos.

**Nenhuma etapa seguinte foi implementada ou publicada nesta preparação.**
