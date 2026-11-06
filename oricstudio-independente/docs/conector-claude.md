# Conector MCP para ChatGPT, Codex e Claude

Permite usar o Gestor pelo ChatGPT, Codex ou Claude sem navegador, painel ou PC ligado. O Gestor expõe um servidor MCP em
`https://gestor-insta-vetericio.lovable.app/api/public/mcp`, protegido por OAuth 2.1 (PKCE S256, registro dinâmico de cliente).

## Como conectar (uma vez)

1. No ChatGPT, abra **Plugins** e escolha **Adicionar servidor MCP personalizado**.
2. Nome: `Gestor Instagram`. URL: `https://gestor-insta-vetericio.lovable.app/api/public/mcp`.
3. Clique em **Conectar**. Entre no Gestor, se necessário, e clique em **Autorizar**.
4. Em uma conversa com o plugin ativo, peça por exemplo: “Mostre o que está agendado no Gestor”.

O mesmo endereço também funciona no Codex e no Claude, seguindo a tela de conexão de cada produto.

No celular, o conector adicionado no claude.ai já aparece no app.

## O que o agente pode fazer

| Ferramenta | Efeito |
|---|---|
| listar_contas, status_sistema, ver_publicacoes, listar_midias, listar_comentarios, resumo_metricas, ver_alertas | Somente leitura |
| importar_midia_de_link | Copia um link público direto (JPEG/MP4/MOV, até 100 MB) para a biblioteca |
| enviar_midia_base64 | **Caminho preferido:** recebe JPEG/MP4/MOV diretamente pelo conector, sem navegador, URL pública ou acesso ao bucket |
| gerar_link_envio, confirmar_envio | Alternativa para clientes MCP que conseguem fazer PUT em URL privada |
| agendar_publicacao | Rascunho ou agendamento com mídias da biblioteca, como o papel “assistente” (modo de autonomia, pausa geral e regras valem) |
| reagendar_publicacao, cancelar_agendamento | Só antes de a publicação começar; cancelar volta para rascunho |
| sugerir_resposta | Grava sugestão; publicar a resposta continua sendo o clique em “Responder” |

Não existe ferramenta para publicar na hora, apagar, responder comentário diretamente ou mudar configurações.

## Arquivos

Para criar uma publicação pelo ChatGPT/Codex, o agente envia a imagem ou vídeo pela ferramenta `enviar_midia_base64`, recebe o ID da biblioteca e usa esse ID em `agendar_publicacao`. Esse fluxo é privado e direto: não abre navegador, não exige painel, URL pública nem acesso do agente ao bucket.

O conector valida a codificação Base64, o tamanho (até 100 MB), a assinatura binária e o tipo informado. `importar_midia_de_link` e `gerar_link_envio` continuam disponíveis apenas como alternativas de compatibilidade.

## Segurança

- Só retornos oficiais do ChatGPT, Claude e loopback local são aceitos no registro OAuth.
- Apenas hashes SHA-256 de códigos e tokens ficam no banco. Código vale 5 min e uma vez; acesso 1 h; renovação 30 dias, rotativa.
- Só usuários admin ou editor autorizam. **Configurações → Conectores → Revogar** corta o acesso na hora (o cliente MCP pedirá nova conexão).
- Toda ação fica em Atividades com o autor `mcp:<e-mail>`.

## Observação técnica

A descoberta funciona em `/.well-known/oauth-protected-resource` e `/.well-known/oauth-authorization-server` (o 401 do endpoint indica o endereço).
As variantes com sufixo de vários níveis (`.../api/public/mcp`) voltam vazias na hospedagem do Lovable; os clientes MCP não dependem delas.
