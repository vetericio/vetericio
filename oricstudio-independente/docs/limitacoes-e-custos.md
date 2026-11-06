# Limitações conhecidas e custos

## Limitações da plataforma Meta

- **Imagens só em JPEG** (o sistema converte PNG), proporção de feed entre 4:5 e 1,91:1, até 8 MB.
- **Reels**: MP4/MOV, 3 s a 15 min, até 300 MB (o envio pelo assistente aceita até 100 MB por arquivo). **Stories em vídeo**: até 60 s e 100 MB.
- **Stories não aceitam adesivos** de link, enquete ou localização pela API (só menções). O link para um Reel em story continua manual.
- **Sem agendamento nativo** na API: o agendamento é a fila própria do sistema.
- **Limite de publicações**: 100 por conta a cada 24 h (a documentação da Meta também cita 50 em um trecho; o sistema consulta a cota real antes de publicar).
- **Métricas**: “impressões” foi descontinuada (usamos “visualizações”); dados podem atrasar até 48 h; algumas métricas (seguidores ganhos/perdidos, demografia) não existem para contas com menos de 100 seguidores; métricas de Story só ficam disponíveis por 24 h (coletamos de hora em hora); valores ausentes aparecem como “não disponível”.
- **Alcance de vários dias** somado conta a mesma pessoa mais de uma vez; os relatórios chamam esse número de “alcance diário somado”.
- **Histórico de seguidores** começa no primeiro dia de coleta deste sistema (25/10/2026).
- **Comentários**: a API não permite curtir, nem excluir comentários de terceiros por este sistema; ocultar sim (com confirmação).
- **Exclusão de publicações** não é feita pelo sistema (exige ação humana no Instagram).
- **Anúncios** não foram implementados (exigiria `ads_management`/`ads_read` e regras de gasto).
- **App em modo de desenvolvimento**: só pessoas com função no app conectam contas (ver `docs/app-meta.md`).

## Limitações do sistema

- A **classificação de comentários** é por palavras-chave (português) e pode errar; por isso reclamações e casos sensíveis sempre vão para humano.
- **Respostas sugeridas** são modelos curtos por categoria (não usam IA generativa); revise antes de enviar.
- **Análise estratégica** usa regras estatísticas simples (mediana, comparações com amostra mínima) e explicita a confiança; não prova causa.
- **PDF** é gerado pela impressão do navegador (“Salvar como PDF”).
- **Envio de relatórios por e-mail** não está ativo (não há serviço de e-mail configurado); os relatórios ficam no painel.
- O **assistente local** só funciona com o computador ligado no momento do envio; depois de agendado, a publicação roda no servidor.
- O **plano gratuito do Lovable** limita consultas administrativas ao banco pela integração (manutenção), não o funcionamento do sistema.

## Custos recorrentes (estimativa — confira os preços atuais)

| Serviço | Uso atual | Custo |
|---|---|---|
| Lovable (hospedagem + Lovable Cloud) | Plano gratuito; site publicado, banco, storage e cron | US$ 0 hoje. Plano pago (cerca de US$ 25/mês) só se precisar de créditos de IA, domínio próprio ou mais limites; o Lovable Cloud cobra por uso acima da franquia |
| API da Meta (Graph API) | Publicação, métricas, comentários | Gratuita |
| GitHub | Repositório privado | Gratuito |
| Domínio próprio (opcional) | — | Cerca de R$ 40–60/ano + plano do Lovable que permita domínio |
| Armazenamento de mídias | Vídeos de Reels (~10–20 MB cada) | Dentro da franquia enquanto o volume for pequeno; apagar mídias antigas reduz uso |

Pontos de atenção: vídeos grandes consomem storage rapidamente; a coleta de hora em hora gera poucas linhas por dia (centenas), sem impacto relevante.
