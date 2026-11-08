# Guia de operação

## Dia a dia

1. **Visão geral**: KPIs do período, publicações agendadas, falhas, aprovações pendentes, alertas e estado das integrações. Se aparecer “O agendador não roda há mais de 5 minutos”, veja [manutenção](manutencao.md#agendador).
2. **Criar publicação**: escolha conta e formato, envie os arquivos (ou importe de um link), escreva a legenda (a contagem de hashtags e menções segue os limites do Instagram) e escolha **Salvar rascunho**, **Agendar** ou **Publicar agora** (pede confirmação).
3. **Agendadas**: reagendar ou cancelar (até o momento em que a publicação começa).
4. **Histórico**: publicadas (com link), falhas (com o motivo; “Tentar novamente” verifica antes de republicar) e resultados desconhecidos.
5. **Calendário**: mês/semana/dia, por conta; mostra frequência planejada (perfil da marca) versus realizada e conflitos.
6. **Métricas**: dados reais; “Coletar agora” força uma atualização. Métricas indisponíveis aparecem como “não disponível”.
7. **Relatórios**: automáticos (diário, semanal, mensal) e sob demanda; exportação CSV e PDF (botão imprimir → salvar como PDF).
8. **Comentários**: filtro “Precisam de atenção humana” primeiro; responder exige confirmação.
9. **Alertas**: resolva ou acompanhe; conexão, fila e aprovação se resolvem sozinhos.

## Perfil da marca

Em Contas conectadas → Perfil da marca: posicionamento, público, tom de voz, objetivos, frequência semanal (usada no calendário e na análise), temas proibidos (bloqueiam o assistente), hashtags padrão, contato usado nas respostas a comentários e limites de alerta.

## Assistente local

Roda no computador do dono e lê arquivos de qualquer pasta (ex.: `Documentos\Instagram`).

```sh
node tools/assistente.mjs lista
node tools/assistente.mjs publicar --conta minha_conta --tipo reels --arquivo "C:\...\video.mp4" --capa "C:\...\capa.jpg" --legenda-arquivo "C:\...\legenda.txt" --titulo "Nome interno" --campanha "Campanha" --quando 2026-10-27T19:00
node tools/assistente.mjs publicar --conta outra_conta --tipo carrossel --arquivo a.png --arquivo b.png --legenda "..." --quando 2026-11-02T12:00
```

- PNG é convertido para JPEG automaticamente; limite de 100 MB por arquivo.
- Horário sempre de Brasília. `--rascunho` salva sem agendar; `--agora` publica imediatamente (respeita regras e pausa).
- No modo **Assistido**, tudo que o assistente agenda fica aguardando aprovação. Nos outros modos entra direto na fila, desde que respeite as Regras de automação; fora delas, vai para aprovação.
- Revogar o acesso: Configurações → Assistente local → Revogar. Nova chave: `node tools/assistente.mjs criar-chave --substituir` e registrar o hash (ver manutenção).

## Pausa geral

Botão no topo de todas as telas. Interrompe a fila, “Publicar agora” e respostas automáticas. Nada é apagado; ao retomar, o que estiver vencido é publicado na sequência (revise Agendadas antes de retomar se a pausa foi longa).

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Conta não aparece ao conectar | Conta precisa ser profissional e estar ligada a uma Página que você administra; use “Reconectar” e marque a Página na tela da Meta |
| Conexão “token expirado”/“revogada” | Contas conectadas → Reconectar |
| Publicação “falhou” | Leia o motivo no Histórico (ex.: proporção da imagem, vídeo fora do padrão); corrija e “Tentar novamente” |
| “Resultado desconhecido” | Aguarde: o sistema confirma com a Meta em 1–2 minutos e nunca republica sem verificar |
| Métricas “não disponível” | Normal para contas com menos de 100 seguidores (algumas métricas) e nas primeiras 48h |
