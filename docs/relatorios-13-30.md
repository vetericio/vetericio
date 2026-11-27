# ORICSE: relatórios 13 a 30

Implementação em branch local. Não publicada, sem alteração de permissões ou banco em produção.
Os relatórios 01 a 12 continuam disponíveis e independentes deste lote.

| Nº | Relatório |
| --- | --- |
| 13 | Equipe: produtividade, escalas e comissões |
| 14 | RH: ponto, jornada e banco de horas |
| 15 | Consultas, procedimentos, retornos e encaminhamentos |
| 16 | Prontuários: preenchimento, retificações e solicitações de cópia |
| 17 | Internação: ocupação, permanência, altas e desfechos |
| 18 | Plantões: passagens e pendências |
| 19 | Medicações: prescrição, aplicação e acompanhamento |
| 20 | Exames: pedidos, laudos e tempo de entrega |
| 21 | Vacinas: aplicação e previsões registradas |
| 22 | Receitas emitidas e guarda documental |
| 23 | Aquisição e movimentação de controlados |
| 24 | Termos, atestados, laudos e comprovantes |
| 25 | Estoque: saldo, movimentações e reposição |
| 26 | Tutores e pacientes: cadastro, recorrência e inatividade |
| 27 | CRM, campanhas, site, OricStudio e captação |
| 28 | Portal do Tutor: agendamento, adesão e avaliações |
| 29 | Contratos, planos, assinaturas e cancelamentos |
| 30 | Auditoria |

## Segurança e leitura

- Piloto continua exclusivo da Veterício, com vínculo ativo, exigências de plano/cargo
  e validação de cada permissão de origem do relatório no servidor.
- Os relatórios não são um exportador de prontuários ou dados pessoais em massa.
  As consultas são limitadas e vinculadas à clínica. Dados monetários de equipe ficam
  protegidos pela permissão de pagamentos da equipe.
- Período de até 93 dias. O relatório distingue totais históricos e retratos de hoje.
  Ausência de trilha não equivale a zero ou a uma pendência confirmada. As notas na
  tela explicam o que está ausente, não se aplica ou é uma aproximação.
- Receitas: filtro cruzado por campos e PDF vinculado pela API já autorizada. O
  relatório não comprova assinatura qualificada, dispensa, cumprimento de prazo,
  validade ou autorização para descarte. Não classifica automaticamente medicamento
  controlado a partir de nome nem transforma movimentação de estoque em compra
  regulatória.
- Nenhuma regra de cálculo operacional, fechamento, pagamento, prescrição ou
  dispensação foi substituída pelo relatório.

## Checklist antes da publicação

1. Conferir migrações aditivas do lote e aplicá-las **primeiro em homologação**;
   testar emissão nova, leitura de receitas antigas e PDF com permissões distintas.
2. Executar testes locais e CI no SHA final. Em homologação autenticada, usar
   dois usuários de clínicas diferentes, cada um com as permissões de origem,
   e verificar que apenas Veterício consulta seus registros. Testar também o
   acesso a relatórios que exigem mais de uma permissão, e às colunas opcionais.
3. Conferir números com os módulos de origem, períodos vazios, datas antigas e
   volume superior à primeira página. Validar receituário com o responsável técnico.
4. Aguardar autorização expressa para publicar, aplicar a migração aditiva antes
   do aplicativo e confirmar a versão do Cloudflare. Para reverter, reimplantar
   a versão 01–12; manter dados aditivos já gravados, sem apagar documentos.
