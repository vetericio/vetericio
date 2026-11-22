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
3. Motor determinístico produz tarefas D+1, D+3, D+7 e D+10, ou primeiro dia configurado. Referência é a data de alta quando preenchida.
4. Rejeita registros rascunho/cancelados, clínicos sem vínculo completo e inconsistências de data. Geração deduplicada por ID do registro e etapa.
5. O CRM não pode criar tarefas pós-cirúrgicas só porque há cirurgia agendada.
6. Rascunho de mensagem por etapa, editável antes de abrir WhatsApp; a abertura valida consentimento atual por clínica e tutor. Nenhuma mensagem é enviada automaticamente.
7. Sinais preocupantes são assunto para avaliação veterinária humana, não para conduta clínica automática.

**Limite da versão de teste:** o conector de prontuário legado usa `oricseStorage`. Antes de produção, substituir/validar a leitura por fonte clínica canônica no servidor, conferir cada clínica com sessões reais, revisar histórico e auditar consultas/RLS para garantir que a geração funciona mesmo sem o navegador ter registros locais. A fila não deve atrasar a abertura da Central (meta de até 3 segundos aferida em sessão real). Não habilitar jornadas automáticas até essas verificações.

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

**Nenhuma etapa seguinte foi implementada ou publicada nesta preparação.**
