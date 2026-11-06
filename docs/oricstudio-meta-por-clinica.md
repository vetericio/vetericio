# OricStúdio — conexão Meta por clínica (etapa 3/5)

## Decisão de arquitetura

- O **OricStúdio é independente** do Gestor Instagram 2.0: não compartilha aplicativos Meta, autenticação, tokens, banco nem fila de posts.
- Existe **um aplicativo Meta oficial do produto OricStúdio**, operado pela plataforma.
- Cada clínica faz seu próprio **Instagram Login** via OAuth e recebe credenciais isoladas para cada conta profissional autorizada.
- Cada clínica pode conectar múltiplas contas de Instagram Business/Creator, conforme o limite comercial futuro. A mesma conta Instagram não pode estar simultaneamente vinculada a duas clínicas.
- Apenas responsável, administrador da clínica, RT ou administração central podem conectar/desconectar. A licença OricStúdio deve estar ativa para iniciar o OAuth.
- Nenhuma conta é importada do Gestor 2.0 e nenhum acesso vem automaticamente de planos Essencial/Plus/Master.

## Metadados e credenciais

- `oricstudio_meta_contas`: dados públicos da conexão, com `clinica_id` e proteção RLS.
- `oricstudio_meta_oauth_states`: nonce aleatório de autorização com SHA-256, vencimento de 10 min e consumo atômico; não legível por `authenticated`.
- `oricstudio_meta_tokens`: tokens de longa duração criptografados com AES-256-GCM por conta; nunca expostos ao cliente, auditoria ou URLs de retorno; nenhuma permissão de acesso ao navegador.
- `oricstudio_meta_auditoria`: conexão/desconexão/erros sem tokens.

## Configuração de infraestrutura

Criar **novo aplicativo Meta** para o produto OricStúdio, em Meta for Developers > Instagram > API setup with Instagram Login.

Configurar os quatro secrets **somente no servidor/Cloudflare Worker**:

- `ORICSTUDIO_META_CLIENT_ID`: Instagram App ID da integração (não ID do Facebook Login).
- `ORICSTUDIO_META_CLIENT_SECRET`: App Secret (secreto) do aplicativo Meta.
- `ORICSTUDIO_META_CONFIG_ID`: Configuration ID do Login Unificado, extraído da URL de login gerada pela Meta.
- `ORICSTUDIO_META_REDIRECT_URI`: `https://oricse.vetericio.workers.dev/api/oricstudio/meta/callback`.
- `ORICSTUDIO_META_ENCRYPTION_KEY`: chave aleatória de 32 bytes codificada em base64; não é senha nem token Meta.

Não versionar esses valores. Nunca usar `VITE_`, nem logar tokens.

Solicitar os escopos profissionais adequados aos recursos efetivamente utilizados. Conferir os requisitos de App Review/Advanced Access e verificação de empresa antes de abrir a integração para clientes externos. A conta precisa ser profissional.

## Fluxo

1. Administrador da clínica abre OricStúdio > Contas > Conectar Instagram.
2. Servidor valida a sessão ORICSE, o vínculo à clínica e a licença, gera `state` aleatório e redireciona ao Instagram.
3. O usuário autoriza o aplicativo e a Meta retorna ao callback.
4. Servidor consome o `state` uma única vez, verifica novamente permissões e licença, troca o `code` por token, identifica a conta e salva o token criptografado.
5. O cliente mostra apenas nome da conta, status e validade, nunca senhas ou tokens.
6. Desconectar apaga as credenciais locais e marca a conta como desconectada. Para revogação global do consentimento, o usuário também poderá removê-lo nas configurações da Meta.

## Pendências para homologação da etapa 3

- Registrar aplicativo Meta e configurar secrets reais do OricStúdio no Cloudflare.
- Aplicar a migração após revisão e testar conexão real em uma conta profissional de teste.
- Exercitar OAuth negado, `state` vencido/repetido, conta vinculada a outra clínica, licença suspensa e dois tenants concorrentes.
- Criar serviço periódico seguro para renovação/verificação de tokens e reautenticação. Já existe verificação manual individual, sem publicação automática.
- Criar agendador e publicador com idempotência, políticas de mídia e tratamento de falhas, **antes de anunciar publicação automática**.
- Validar os escopos que forem concedidos efetivamente e obter as permissões de produção da Meta.
- Não publicar essa PR apenas porque passou no build: **não existe conexão Meta operacional sem segredos e testes reais**.

Referências: https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login ; https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
