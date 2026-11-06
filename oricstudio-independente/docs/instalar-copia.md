# Instalar uma cópia própria do Gestor

Guia para outra pessoa ter o Gestor de Contas Instagram **dela**, com as contas de Instagram dela. A cópia é totalmente separada: outro site, outro banco, outro app na Meta. Nenhum dado é compartilhado com a instalação original.

Tempo estimado: 1h30 a 2h na primeira vez. Os passos 2 e 4 são técnicos; se você nunca mexeu com SQL ou com o painel de desenvolvedor da Meta, faça com alguém que já fez.

## 0. O que você precisa antes

| Item | Onde | Custo |
|---|---|---|
| Conta no Lovable | lovable.dev | Plano gratuito serve para começar |
| Conta no Facebook (a sua, pessoal) | facebook.com | Grátis |
| Conta de desenvolvedor da Meta | developers.facebook.com (entra com o seu Facebook) | Grátis |
| Instagram **profissional** (Empresa ou Criador de conteúdo) | App do Instagram → Configurações → Tipo de conta | Grátis |
| Uma **Página do Facebook** ligada a esse Instagram | Instagram → Editar perfil → Página | Grátis |
| Conta no Claude (opcional, para usar o agente pelo app) | claude.ai | Conectores personalizados dependem do plano |

Sem Instagram profissional ligado a uma Página, a Meta não libera publicação nem métricas pela API.

Regras de segurança da instalação: ninguém precisa da sua senha do Facebook ou do Instagram, nem de códigos de verificação. Você digita isso só nas telas oficiais da Meta. As chaves secretas ficam só no Lovable (Cloud → Secrets), nunca no código, em mensagens ou em arquivos.

## 1. Copiar o projeto

1. Peça ao dono do Gestor original acesso ao projeto para fazer um **Remix** no Lovable (cópia do código para a sua conta). O remix copia **só o código**: nenhum dado, conta, chave ou mídia vai junto.
2. No seu Lovable, abra a cópia e ative o **Lovable Cloud** (banco de dados) se ele pedir.
3. Escolha um endereço publicado, por exemplo `https://meu-gestor.lovable.app`. Ele será usado em vários passos abaixo; chamaremos de **SEU_SITE** (sem barra no final).
4. Publique uma vez (botão **Publish**) para o endereço existir.

Conferência: abrir `SEU_SITE/login` mostra a tela de entrada do Gestor.

## 2. Criar o banco

No Lovable: **Cloud → Database → SQL editor** (ou peça ao agente do Lovable para executar o SQL). Rode os arquivos da pasta `drizzle/migrations/` **nesta ordem**, um de cada vez:

1. `0000_fundacao_gestor_instagram.sql`
2. `0001_fase2_publicacao.sql` — **antes de rodar**, troque `https://insta-account-compass.lovable.app` pelo **SEU_SITE** (aparece uma vez, dentro de `public.call_job`). Se esquecer, a fila de publicação chamará o site errado.
3. `0002_metricas_comunidade_alertas.sql`
4. `0003_conector_mcp.sql`
5. `0004_agendador_metricas_relatorios.sql`

Conferência (no mesmo editor):

```sql
select jobname, schedule, active from cron.job order by jobname;
```

Devem aparecer 4 jobs ativos: `coleta-metricas`, `fila-publicacao`, `relatorios`, `verificacao-conexoes`.

```sql
select prosrc from pg_proc where proname = 'call_job';
```

Deve mostrar o **SEU_SITE**.

## 3. Ajustar seus dados no código

Peça ao agente do Lovable (ou edite):

- `src/lib/legal.ts`: troque `emailContato` pelo **seu** e-mail de contato e preencha `controlador` (seu nome ou empresa). A Meta exige política de privacidade com contato válido; essas páginas ficam em `SEU_SITE/privacidade`, `/termos` e `/exclusao-de-dados`.
- `CLAUDE.md`: é o manual do agente da instalação original (contas, pastas e regras de outra pessoa). Apague o conteúdo e escreva o seu, ou remova o arquivo.
- `tools/assistente.mjs` (opcional, só se for usar o assistente no computador): defina a variável `GESTOR_URL` com o **SEU_SITE**.

Publique de novo depois de mudar.

## 4. Criar o app na Meta

Em **developers.facebook.com → Meus apps → Criar app**:

1. **Nome**: algo como "Gestor de Redes Sociais" (a Meta não aceita a palavra "Instagram" no nome).
2. **Caso de uso**: *Gerenciar mensagens e conteúdo no Instagram* → configuração da **API com login do Facebook**.
3. **Portfólio empresarial**: escolha o seu (ou crie um). Não precisa ser verificado para uso próprio.
4. Em **Login do Facebook para Empresas → Configurações**:
   - **URIs de redirecionamento OAuth válidos**: `SEU_SITE/api/public/meta-oauth-callback`
5. Em **Login do Facebook para Empresas → Configurações (configurações de login)**, crie uma configuração:
   - tipo de token: **token de acesso do usuário**;
   - permissões: `instagram_basic`, `pages_show_list`, `pages_read_engagement`, `business_management`, `instagram_content_publish`, `instagram_manage_insights`, `instagram_manage_comments`.
   - Anote o **ID da configuração**.
6. Em **Configurações do app → Básico**:
   - **Domínios do app**: o domínio do SEU_SITE (sem `https://`);
   - **URL da Política de Privacidade**: `SEU_SITE/privacidade`;
   - **URL dos Termos de Serviço**: `SEU_SITE/termos`;
   - **URL de instruções de exclusão de dados**: `SEU_SITE/api/public/meta-data-deletion` (opção "URL de retorno de chamada");
   - **Categoria**: Negócio e Páginas;
   - anote o **ID do app** e a **Chave secreta do app** (botão Mostrar; ela pede sua senha do Facebook, digite você mesmo).
7. Deixe o app **em desenvolvimento** (não publique). Como você é administrador do app, consegue conectar as **suas** contas sem análise da Meta. A análise só é necessária para conectar contas de terceiros (veja `docs/app-meta.md`).

## 5. Configurar as chaves no Lovable

No Lovable: **Cloud → Secrets**, crie:

| Nome | Valor |
|---|---|
| `META_APP_ID` | ID do app (passo 4.6) |
| `META_APP_SECRET` | Chave secreta do app (passo 4.6) |
| `META_LOGIN_CONFIG_ID` | ID da configuração de login (passo 4.5) |
| `APP_BASE_URL` | SEU_SITE |
| `TOKEN_ENCRYPTION_KEY` | 32 bytes aleatórios em base64, gerados por você (abaixo) |
| `META_GRAPH_VERSION` | opcional; padrão `v24.0` |

Para gerar a `TOKEN_ENCRYPTION_KEY` no Windows, abra o PowerShell e rode as três linhas:

```powershell
$b = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Convert]::ToBase64String($b)
```

Copie o resultado direto para o secret. Não guarde em arquivo nem envie por mensagem. Gere a sua: nunca reutilize a de outra instalação.

Depois de criar os secrets, **publique de novo** (secrets só valem no site publicado após nova publicação).

## 6. Primeiro acesso e conexão do Instagram

1. Abra `SEU_SITE/configuracao-inicial` e crie o administrador (seu e-mail e uma senha com 10+ caracteres). Essa tela só funciona uma vez.
2. Entre no Gestor → **Contas conectadas** → **Conectar com Facebook**.
3. Na janela da Meta, entre com o seu Facebook, escolha o portfólio e marque as Páginas e contas do Instagram que quer gerenciar. Aceite as permissões.
4. De volta ao Gestor, ligue **Gerenciar esta conta** nas contas que o sistema deve administrar.
5. Em cada conta, abra a página da **marca** e preencha descrição, público, tom de voz, temas proibidos, hashtags e o contato que entra nas respostas a comentários.
6. Em **Configurações**, escolha o **modo de autonomia** (comece em *Assistido*: tudo que o agente agenda espera sua aprovação).

Conferência:
- **Contas conectadas → Verificar todas** mostra as contas ativas e o número de seguidores.
- Em até 1 hora, **Métricas** começa a mostrar dados.
- Crie uma publicação de teste como **rascunho** (não agende ainda) para validar o envio de mídia.

## 7. Conector do Claude (opcional)

No Claude (claude.ai): **Configurações → Conectores → Adicionar conector personalizado**:

- Nome: `Gestor Instagram`
- URL: `SEU_SITE/api/public/mcp`

Clique em **Conectar**, entre com o login do **seu** Gestor e clique em **Autorizar**. A conexão aparece em **Configurações → Conector do Claude**, onde também pode ser revogada. Detalhes em `docs/conector-claude.md`.

## 8. Primeira publicação real

Agende uma publicação simples (uma imagem JPEG na proporção 4:5) para dali a uns 10 minutos e acompanhe em **Agendadas** → **Histórico**. Quando aparecer o link do Instagram, a instalação está completa.

Se falhar, veja **Alertas** e o erro na própria publicação. Causas comuns:

| Sintoma | Causa provável |
|---|---|
| Botão "Conectar com Facebook" desativado | Falta algum secret do passo 5, ou não publicou de novo depois de criar |
| Meta diz "URL bloqueada" | URI de redirecionamento do passo 4.4 diferente do SEU_SITE |
| Nenhuma conta do Instagram encontrada | Instagram não é profissional ou não está ligado à Página marcada |
| Publicação fica parada em "agendado" | `call_job` com endereço errado (passo 2) ou jobs inativos |
| Erro de permissão ao publicar | Permissão faltando na configuração de login (passo 4.5); reconecte depois de corrigir |

## Custos e limites

- O Lovable cobra conforme o plano (banco, armazenamento de mídias e créditos do agente). Mídias de vídeo ocupam espaço: apague as antigas pela tela **Mídias**.
- A Meta limita as publicações pela API (cerca de 100 por conta a cada 24 horas; o sistema consulta a cota real antes de publicar).
- Veja `docs/limitacoes-e-custos.md` para o restante.

## Manutenção

Atualizações do Gestor original **não** chegam sozinhas na cópia. Para receber melhorias, é preciso trazer o código novo e rodar migrações novas da pasta `drizzle/migrations/` que ainda não foram aplicadas. Rotinas de manutenção, rotação de chaves e diagnóstico da fila: `docs/manutencao.md`.
