# OricStudio — código copiado independentemente do Gestor Instagram 2.0

**Status: cópia de desenvolvimento. Build/typecheck/testes automatizados aprovados. Login direto Instagram implementado em código e aguardando credenciais/homologação. NÃO publicada, NÃO conectada à Meta e ainda NÃO substitui a tela `/oricstudio` do ORICSE.**

A base deste diretório é uma **cópia física do código** do repositório privado `vetericio/gestor-insta-vetericio` (branch `main`, snapshot da árvore Git `d1dfd1fd8f8ba4ec1d797ccee481b3d0497ac203`). Não há importação remota, integração de API, compartilhamento de tokens ou sincronização automática de código com o Gestor original. O aplicativo original **não foi modificado**.

## Regra funcional
O Gestor 2.0 é a referência de implementação e comportamento para: autenticação Meta (Facebook Login for Business), descoberta de Páginas/Instagram, publicação com fila e idempotência, agendamento, assistente, métricas, comentários, relatórios, alertas, aprovações e automações. Modificar esses fluxos apenas para comportar isolamento por clínica, marca OricStudio, recursos adicionais aprovados e infraestrutura independente.

## Infraestrutura obrigatoriamente independente
- **Meta:** aplicativo Meta próprio do OricStudio, login/configuração próprios, novo `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`; callback apontando somente à instalação OricStudio.
- **Banco:** projeto Supabase próprio da aplicação copiada, com autenticação, Storage, RLS, Vault, pg_cron e pg_net próprios. NÃO usar o projeto Supabase da instalação Gestor 2.0. A trava no servidor exige `ORICSTUDIO_INSTANCE_ID=oricstudio` e rejeita o endereço do Gestor.
- **URLs / jobs / arquivos:** endpoint próprio em `APP_BASE_URL`, fila e cron independentes, novos secrets e chave de criptografia, biblioteca própria. Proibido copiar dados, contas, posts, páginas, OAuth states, mídias, tokens, chaves ou segredos do Gestor.
- **Oricse:** planos, licenças, cobrança e administração central continuam no ORICSE; a futura aplicação deve ser adaptada para o multi-tenant e para o OricStudio interno da plataforma. A existência do clone **não** autoriza importar dados dos clientes do ORICSE para um banco separado sem planejamento e testes de autorização.

## Bloqueios antes de ativação
1. Adaptar o código para sessões ORICSE e segregação total por clínica, inclusive consultas de service role, filas, comentários, arquivos, contas, indicadores e relatórios (RLS + checagem de tenant no servidor).
2. Migrar o modelo de dados isolado e parametrizar o SQL `supabase/instalacao.sql`: **NÃO executar a instalação original no banco ORICSE ou no banco do Gestor**, pois ela usa tabelas e jobs de aplicação única.
3. Configurar a Meta para o app novo e comparar o callback com o código de referência; confirmar Login for Business e Páginas/IG sem reutilizar o Gestor.
4. Remover a marca original, adequar rotas da aplicação, componentes visuais, branding, políticas, URLs e configurar os recursos adicionais do OricStudio, incluindo Trends.
5. Repor os ícones/imagens de marca próprios. Arquivos binários de identidade e mídia do Gestor original **não foram copiados**.
6. Rodar `npm install`, `npm test`, `npx tsc --noEmit`, `npm run build`, homologar conexão Meta, segregação entre duas clínicas, agendamento, publicador automático e renovação de token.
7. Só então substituir a implementação atual de `/oricstudio` e publicar, preservando planos e administração do ORICSE.

## Arquivos desta cópia
Códigos de páginas, componentes, APIs, servidores, testes, scripts e instruções de referência preservados sob este diretório. O `.env` real do projeto de origem foi deliberadamente excluído; `.env.example` contém apenas placeholders e deve ser ajustado à implantação OricStudio.

**Nunca confundir 'código copiado' com 'produto publicado e validado'.** A cópia está presente apenas na ramificação de desenvolvimento até a aprovação técnica.

## Conexões e segurança adicionadas
- Novo botão **Conectar Instagram (sem Facebook)** com Instagram API with Instagram Login, escopos profissionais `instagram_business_*`, OAuth state one-time, troca por token longo e criptografia em servidor. Não usa `config_id` nem Página Facebook.
- Login Facebook for Business permanece o mesmo do Gestor; não reaproveitar App ID ou segredos da instalação original.
- O tipo de login é salvo em `meta_connections.login_provider`, e a publicação escolhe o host Graph conforme a origem do token.
- A verificação da conexão direta confirma perfil e tenta renovar token próximo do vencimento; não há credenciais de produção configuradas nem homologação real.
- `tools/assistente.mjs` exige `ORICSTUDIO_URL`, sem URL-padrão apontando ao Gestor. Armazena a chave local em `.oricstudio`.

**Bloqueio comercial:** Multi-tenancy, SSO com ORICSE, RLS e isolamento por clínica ainda precisam de implementação/testes; não habilitar para clientes antes disso.

## Travas de operação
O agendador de produção retorna `pausado=true` enquanto `ORICSTUDIO_PUBLICACAO_HOMOLOGADA` não estiver definido como `true`. As duas modalidades de OAuth também ficam bloqueadas até `ORICSTUDIO_CONEXOES_HOMOLOGADAS=true`. **Não ativar essas variáveis em produção antes da migração multi-tenant, testes de duas clínicas e liberação pela Meta.** Os testes de CI usam apenas contas e chamadas simuladas.
