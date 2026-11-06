# OricStudio na ORICSE — banco, segurança e motor social

## Arquitetura em vigor
- Produto **OricStudio** acessado pela ORICSE em `/oricstudio`, inclusive `?ambiente=plataforma` para a administração central. Não se conecta ao servidor ou banco do **Gestor Instagram 2.0**.
- Identidade/sessão ORICSE: Supabase `app_users`, `clinica_usuarios` e a clínica ativa. O plano do OricStudio usa `oricstudio_licencas` / `oricstudio_solicitacoes`, com Mercado Pago já implementado pela plataforma.
- Tabelas já existentes (sem copiar/danificar dados): `oricstudio_publicacoes`, `oricstudio_sistema_publicacoes`, `oricstudio_meta_contas`, `oricstudio_meta_tokens`, `oricstudio_meta_oauth_states`, `oricstudio_midias`, `oricstudio_sistema_midias`.
- Migration de motor: `20261106150000_oricstudio_motor_multiclinica.sql`; suporta envio idempotente, eventos, métricas, comentários, alertas, regras e relatórios. Coluna `clinica_id` vinculada à clínica; `NULL` significa uso interno da própria ORICSE, autorizado exclusivamente a administrador central. Todos os recursos filhos com `conta_id` passam pela verificação relacional de tenant em trigger, inclusive service_role.
- `20261106154000_oricstudio_fila_carrossel.sql` persiste contêineres do carrossel para tentativas seguras; `20261106154500_oricstudio_claim_envios_sem_duplicidade.sql` impede reexecutar `resultado_desconhecido` e só reserva jobs aprovados.
- RLS: tabelas operacionais com leitura por clínica ativa e licença; escrita via funções de servidor com sessão verificada. O cliente não pode inserir diretamente publicações externas, alterar métricas ou gravar credenciais.
- Áreas do produto preservam a diferença entre **editorial** (planejamento, aprovação) e **publicação efetiva** (fila após conta/mídia selecionadas e aprovação).

## Meta: dois logins independentes
1. **Instagram direto**, padrão: `ORICSTUDIO_IG_APP_ID`, `ORICSTUDIO_IG_APP_SECRET`, `ORICSTUDIO_IG_REDIRECT_URI` = `https://oricse.vetericio.workers.dev/api/oricstudio/instagram/callback`. Usa Instagram Login e `instagram_business_*` (sem Página no Facebook). Necessita app Meta próprio e permissões para contas profissionais de terceiros.
2. **Facebook Login for Business**, alternativo: `ORICSTUDIO_META_CLIENT_ID`, `ORICSTUDIO_META_CLIENT_SECRET`, `ORICSTUDIO_META_CONFIG_ID`, `ORICSTUDIO_META_REDIRECT_URI` = `https://oricse.vetericio.workers.dev/api/oricstudio/meta/callback`. A configuração Meta correta precisa estar ativa.
3. `ORICSTUDIO_META_ENCRYPTION_KEY`: chave AES-256-GCM exclusiva e persistente de 32 bytes em base64 para tokens **das duas modalidades**. Não reutilizar do Gestor 2.0. Nunca armazenar em Git.
4. Em ambos os fluxos, estado OAuth hash de uso único, 10 minutos e ligado a clínica/administrador/provedor. O servidor valida novamente acesso antes de salvar token.

## Publicação
- Fila SQL `oricstudio_envios` (única por publicação + conta), `oricstudio_claim_envios` com `FOR UPDATE SKIP LOCKED` e lease; cada tentativa salva progresso.
- Worker: `POST /api/oricstudio/jobs/publicar`, autorizado exclusivamente por bearer `ORICSTUDIO_CRON_SECRET` exclusivo (mínimo 32 caracteres) e protegido por `ORICSTUDIO_PUBLICACAO_HOMOLOGADA=true`. Sem flag, retorna pausado e não chama a Meta.
- O publicador copia o algoritmo base do Gestor: carrossel item a item, contêiner, verificação de status, publicação, acompanhamento e retries. Antes de `media_publish`, marca tentativa durável; resposta incerta é enviada para revisão, **nunca re-publicada automaticamente**.
- Mídias continuam privadas no Drive. `ORICSTUDIO_MIDIA_SIGNING_KEY` em base64 de 32 bytes assina links temporários para `GET /api/oricstudio/midia`; o endpoint valida assinatura, propriedade do arquivo, tenant, licença, tamanho e MIME antes de servir os bytes. `ORICSTUDIO_PUBLIC_ORIGIN` indica URL pública da ORICSE em HTTPS.
- Não agendar PNG/WebP sem conversão a JPEG ou vídeos em formatos não suportados; a validação rejeita no formulário.

## Métricas, comentários e automações
- Worker `POST /api/oricstudio/jobs/coletar`, mesmo `ORICSTUDIO_CRON_SECRET`, controle por `ORICSTUDIO_COLETA_HOMOLOGADA=true`. Procura só contas ativas com licença; grava seguidores e quantidade de publicações (quando Meta disponibiliza), pesquisa comentários de publicações recentes se o token tiver escopo.
- Dado que a Meta não fornece certos indicadores em todos os perfis, dados ausentes permanecem ausentes, nunca simulados.
- A interface ORICSE lê somente a clínica autorizada; apresenta métricas, comentários, fila, alertas e regras atuais. Conta adicional exige licença e limite de contas do plano.
- A chave `ORICSTUDIO_CRON_SECRET` **não** é a chave do Gestor e **não** pode estar no navegador.

## Checklist necessário para habilitar publicação externa
- [x] SQL de motor aplicado no Supabase ORICSE existente, com RLS e escrita via servidor.
- [x] Correção de fila para não reenviar resultados desconhecidos aplicada.
- [x] Fluxo de Instagram direto e Facebook alternativo escrito no backend.
- [x] Interface ORICSE vinculada a publicações, biblioteca, conta, fila, métricas e alertas.
- [ ] Aprovar/configurar aplicativos Meta, callbacks e escopos para contas de clientes.
- [ ] Configurar secrets no Cloudflare (nenhum segredo em arquivos versionados).
- [ ] Testar manualmente contas profissionais diferentes em **duas clínicas** com licenças válidas, incluindo usuário de clínica A tentando ler/mutar recursos da B.
- [ ] Verificar post real de cada formato em ambiente controlado, renovação/revogação e ausência de duplicação com falhas de rede.
- [ ] Configurar cron próprio no ambiente ORICSE com frequência apropriada: publicar a cada minuto, coletar métricas com limite e horário acordado.
- [ ] Só após aprovação, habilitar flags `ORICSTUDIO_PUBLICACAO_HOMOLOGADA` e `ORICSTUDIO_COLETA_HOMOLOGADA` no servidor.

**Não confundir as verificações SQL e testes de compilação com aprovação da Meta ou postagem real.** Nunca habilitar automaticamente flags sem concluir homologação.

## Status
Migration central aplicada com sucesso e verificação de RLS concluída. O restante está em PR de desenvolvimento; produção da interface OricStudio não é automaticamente atualizada sem merge/deploy. O projeto Gestor Instagram 2.0 original não foi alterado.
