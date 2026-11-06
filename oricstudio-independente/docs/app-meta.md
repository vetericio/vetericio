# App Meta: configuração, permissões e análise

## App configurado

| Item | Valor |
|---|---|
| Nome | a preencher (a Meta não aceita “Instagram” no nome) |
| ID do app | a preencher |
| Portfólio empresarial | a preencher |
| Caso de uso | Gerenciar mensagens e conteúdo no Instagram → configuração da API com login do Facebook |
| Configuração do Login para Empresas | a preencher (token de usuário) |
| URI de redirecionamento OAuth | https://gestor-insta-vetericio.lovable.app/api/public/meta-oauth-callback |
| URL de exclusão de dados | https://gestor-insta-vetericio.lovable.app/api/public/meta-data-deletion |
| Domínio | gestor-insta-vetericio.lovable.app |
| Privacidade / Termos | /privacidade e /termos no mesmo domínio |
| Categoria | Negócio e Páginas |
| Status | a preencher |

Onde encontrar cada valor: Meta for Developers → Meus apps → (seu app) → Configurações do app → Básico (ID e chave secreta) e Login do Facebook para Empresas → Configurações (URIs) / Configurações (configurações de login).

## Matriz de permissões

| Funcionalidade | Permissão | Finalidade | Nível | Situação |
|---|---|---|---|---|
| Identificar contas e ler perfil | instagram_basic | Perfil, mídia, seguidores | Padrão | Concedida |
| Listar Páginas | pages_show_list | Encontrar Páginas ligadas ao Instagram | Padrão | Concedida |
| Token da Página | pages_read_engagement | Obter token e conta IG ligada | Padrão | Concedida |
| Portfólios | business_management | Páginas atribuídas via portfólio | Padrão | Concedida |
| Publicar | instagram_content_publish | Imagem, carrossel, Reels, Stories | Padrão | Concedida |
| Métricas | instagram_manage_insights | Insights da conta e das mídias | Padrão | Concedida |
| Comentários | instagram_manage_comments | Ler, responder e ocultar | Padrão | Concedida |
| Anúncios | ads_read / ads_management | Não implementado | — | Não solicitada |

## Acesso Padrão x Avançado (análise do app)

Com **Acesso Padrão** e o app em desenvolvimento, só pessoas com função no app (administrador, desenvolvedor, testador) autorizam contas. Como o sistema administra contas da própria equipe, **não é preciso análise do app**. Para outra pessoa conectar o Facebook dela: Meta for Developers → Funções do app → Funções → Adicionar pessoas (Testador ou Desenvolvedor) e ela aceita o convite.

Análise do app + verificação da empresa só são necessárias se clientes externos forem conectar contas. Nesse caso será preciso:
1. Verificar o portfólio (Configurações do negócio → Central de segurança → Verificação).
2. Publicar o app (modo ao vivo) com política de privacidade com contato válido.
3. Para cada permissão: descrição de uso, instruções de teste (usuário de teste com acesso a uma conta de teste) e um vídeo mostrando o fluxo (conectar, publicar, métricas, comentários).
4. Material sugerido: este documento, `docs/arquitetura.md` e as páginas /privacidade e /exclusao-de-dados.

Nenhuma aprovação da Meta foi solicitada ou concedida até agora.
