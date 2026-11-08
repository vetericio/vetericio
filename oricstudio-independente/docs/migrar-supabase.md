# Migrar do Lovable Cloud para Supabase próprio + Cloudflare

Por que: no Lovable Cloud o banco é do Lovable. Quando os créditos Cloud acabam, ele pausa e o Gestor inteiro sai do ar (login, fila, métricas, conector), sem painel para resolver. Aqui o banco passa a ser um projeto Supabase **seu** e o site passa a rodar na Cloudflare, os dois no plano gratuito.

O que se perde: os dados do Lovable Cloud pausado não podem ser exportados. Você recomeça com banco vazio: cria o administrador, reconecta o Instagram e o conector do Claude.

Regra de segurança: senhas e chaves secretas você digita só nas telas oficiais (Supabase, Cloudflare, Meta). Nunca em conversas, mensagens ou arquivos. O endereço do projeto e a chave **publicável** do Supabase são públicos (vão dentro do site) e podem ser compartilhados.

Chamaremos o endereço final do site de **SEU_SITE**, por exemplo `https://gestor-insta.SEU-SUBDOMINIO.workers.dev` (sem barra no final).

## 1. Criar o projeto no Supabase

1. Crie a conta em **supabase.com** (pode entrar com o GitHub).
2. **New project**: nome `gestor-instagram`, uma senha forte para o banco (guarde no gerenciador de senhas), região **South America (São Paulo)**, plano **Free**.
3. Quando o projeto terminar de subir: **SQL Editor → New query**, cole o arquivo `supabase/instalacao.sql` inteiro e clique em **Run**. Deve terminar em "Success".
4. Conferência, numa nova query:
   ```sql
   select jobname, schedule, active from cron.job order by jobname;
   ```
   Devem aparecer 4 jobs: `coleta-metricas`, `fila-publicacao`, `relatorios`, `verificacao-conexoes`.
5. **Project Settings → API Keys** (ou botão **Connect**): anote o **Project URL** (`https://xxxx.supabase.co`) e a **Publishable key** (`sb_publishable_...`). Esses dois são públicos: passe para quem está fazendo a migração, para atualizar o `.env` do código.

## 2. Atualizar o código (quem mantém o código faz)

Com o Project URL e a publishable key:
- `.env`: `SUPABASE_URL`, `VITE_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` e `VITE_SUPABASE_PROJECT_ID` com os valores novos.
- `supabase/config.toml`: `project_id` novo.
- Commit e push na `main`.

## 3. Publicar na Cloudflare

1. Crie a conta em **dash.cloudflare.com** (Free). Na primeira vez em **Workers & Pages**, ela pede um subdomínio `workers.dev`; escolha um curto.
2. **Workers & Pages → Create → Import a repository** → conecte o GitHub e escolha `vetericio/gestor-insta-vetericio`.
3. Configuração do projeto:
   - **Project name**: `gestor-insta`
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy --config .output/server/wrangler.json --name gestor-insta`
   - **Root directory**: em branco
4. **Create and deploy**. O primeiro deploy sobe o site, mas ele só funciona depois das variáveis abaixo.
5. No Worker `gestor-insta` → **Settings → Variables and Secrets** → **Add**, tipo **Secret** em todas:

   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | Project URL do passo 1.5 |
   | `SUPABASE_PUBLISHABLE_KEY` | Publishable key do passo 1.5 |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **Secret key** (`sb_secret_...`). Dá acesso total ao banco: só aqui. |
   | `META_APP_ID` | ID do app na Meta |
   | `META_APP_SECRET` | Meta → Configurações do app → Básico → Chave secreta (Mostrar) |
   | `META_LOGIN_CONFIG_ID` | ID da configuração do Login do Facebook para Empresas |
   | `APP_BASE_URL` | SEU_SITE |
   | `TOKEN_ENCRYPTION_KEY` | nova, gerada como abaixo |

   Para gerar a `TOKEN_ENCRYPTION_KEY`, no PowerShell:
   ```powershell
   $b = New-Object byte[] 32
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
   [Convert]::ToBase64String($b)
   ```
   Cole direto no campo. Não salve em arquivo.

   Use sempre **Secret** (não "Text"): o deploy automático apaga variáveis de texto que não estão no código, mas mantém os secrets.
6. **Deployments → Retry deployment** (ou faça qualquer push) para o site subir já com as variáveis.

Conferência: `SEU_SITE/login` abre a tela de entrada.

## 4. Ligar o banco ao site

No Supabase:
1. **SQL Editor**, uma query com o endereço do site (troque pelo seu, sem barra no final):
   ```sql
   select vault.create_secret('https://gestor-insta.SEU-SUBDOMINIO.workers.dev', 'site_url', 'Endereço do site chamado pelos jobs');
   ```
   Se errar o endereço: `select vault.update_secret((select id from vault.secrets where name = 'site_url'), 'https://endereco-certo');`
2. **Authentication → URL Configuration**:
   - **Site URL**: SEU_SITE
   - **Redirect URLs**: `SEU_SITE/**`

Conferência dos jobs (depois de 2 minutos):
```sql
select status_code, content::text from net._http_response order by created desc limit 3;
```
Deve mostrar `200`. Um `401` indica token errado; um erro de conexão indica `site_url` errado.

## 5. Atualizar o app da Meta

Em **developers.facebook.com** → o app do Gestor:
- **Login do Facebook para Empresas → Configurações → URIs de redirecionamento OAuth válidos**: `SEU_SITE/api/public/meta-oauth-callback`
- **Configurações do app → Básico**: domínio do app (sem `https://`), `SEU_SITE/privacidade`, `SEU_SITE/termos` e `SEU_SITE/api/public/meta-data-deletion`.
- Salvar.

## 6. Recomeçar no Gestor

1. `SEU_SITE/configuracao-inicial`: crie o administrador (e-mail e senha com 10+ caracteres).
2. **Contas conectadas → Conectar com Facebook** e marque o Instagram. Ligue **Gerenciar esta conta**.
3. Preencha o **Perfil da marca** e escolha o modo **Assistido** em Configurações.
4. Conector do Claude/ChatGPT: remova o conector antigo e adicione de novo com `SEU_SITE/api/public/mcp`.
5. Teste o **Esqueci minha senha** na tela de login.

## Depois da migração

- **Lovable**: o projeto no Lovable continua ligado ao Lovable Cloud antigo. Pode seguir editando por lá, mas **não publique pelo Lovable** e confira se ele não trocou o `.env` de volta. O site oficial passa a ser o da Cloudflare, que publica sozinho a cada push na `main`.
- **E-mails**: o Supabase gratuito envia poucos e-mails de autenticação por hora. Para uso de uma pessoa é suficiente.
- **Pausa por inatividade**: o Supabase gratuito pausa projetos sem uso por 7 dias. Os jobs rodam a cada minuto e mantêm o projeto em uso; se mesmo assim pausar, ele avisa por e-mail e basta clicar em **Restore** no painel.
