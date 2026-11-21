# ORICSE — revisão dupla da biblioteca de termos (14 minutas)

**Situação em 20/11/2026:** RASCUNHOS / NÃO APROVADOS / NÃO PUBLICAR.

## Escopo
- Quatro termos: eutanásia, cirurgia, anestesia e retirada sem alta médica, em `src/lib/textos-termos.ts`.
- Dez termos adicionais: internação, procedimento terapêutico de risco, exames diagnósticos, recusa de tratamento/exames, transferência hospitalar, transfusão, retirada do corpo, doação de corpo, RCP e atendimento domiciliar, em `src/lib/textos-termos-adicionais.ts`.
- **Importante:** arquivos são apenas dados de revisão, sem importação pela interface do ORICSE, sem migração de banco e sem ativação na produção.

## Condições obrigatórias antes de publicar
- [ ] Dr. Paulo: parecer jurídico com identificação da versão, data, bases legais vigentes, riscos e ajustes aprovados. O agente virtual auxilia, mas não substitui advogado habilitado em matéria privativa.
- [ ] Dra. Camila: parecer técnico-veterinário sobre indicação, terminologia, segurança clínica, informações essenciais, compatibilidade com o Código de Ética e regras do CFMV.
- [ ] Registrar efetivamente ambas as aprovações sobre a **mesma versão** de todos os 14 textos. Não assumir aprovação por inferência, pela ausência de objeções ou por simulação.
- [ ] Após qualquer alteração, devolver o item alterado para as duas revisões.
- [ ] Implementar identificação clínica padrão, profissional/CRMV, responsável pelo animal, data por extenso, assinaturas e controle de versão; só o corpo deve ser editável.
- [ ] Emissão de duas vias, preservação no prontuário e disponibilização ao responsável, segundo Resoluções CFMV 1321/2020 e 1653/2025.
- [ ] Completar dados obrigatórios do procedimento e verificar autorização separada de anestesia, cirurgia e risco.
- [ ] Na retirada sem alta: registrar eventual recusa de assinatura e duas testemunhas presentes conforme CFMV 1653/2025.
- [ ] Na transfusão: hemocomponente, identificação/rastreabilidade, compatibilidade e local apto; CFMV 1690/2026 veda transfusão domiciliar.
- [ ] Na eutanásia: indicação profissional justificada, método admissível e destinação do corpo; consentimento não substitui indicação ética.
- [ ] Na RCP: decisão documentada, reavaliação e adequação às obrigações éticas, sem tratar a escolha isolada como autorização irrestrita para omitir assistência.
- [ ] Na doação: instituição receptora, finalidade, documentação de recebimento, cadeia de custódia e destinação.
- [ ] No atendimento domiciliar: conferir os procedimentos permitidos e vedados pela CFMV 1690/2026.
- [ ] Testes automatizados e manuais para autorização por clínica/perfil, prévia em PDF, ausência de placeholders, assinatura, salvamento e reversão.
- [ ] Backup dos dados e plano de rollback antes de disponibilizar no Cloudflare.
- [ ] Não ativar em clínicas até concluir todos os itens acima.

## Pareceres
| Revisor | Escopo | Estado | Evidência |
| --- | --- | --- | --- |
| Dr. Paulo | Jurídico | **Pendente** | Nenhum aceite independente registrado |
| Dra. Camila | Técnico-veterinário | **Pendente** | Nenhum aceite independente registrado |

## Fontes de referência a verificar na homologação
- CFMV Resolução 1321/2020: https://manual.cfmv.gov.br/arquivos/resolucao/1321.pdf
- CFMV Resolução 1653/2025: https://www.cfmv.gov.br/retirada-de-pets-sem-alta-medica-exige-termo-de-responsabilidade-reafirma-cfmv/comunicacao/noticias/2025/07/03/
- CFMV Resolução 1690/2026: https://www.cfmv.gov.br/medico-veterinario-em-casa-ate-onde-vai-o-atendimento-domiciliar/comunicacao/noticias/2026/08/14/
- Conferir também normas locais, disposições éticas e exigências sanitárias aplicáveis à clínica.

**Critério final:** não publicar por simples autorrevisão. Publicar somente após validação de ambas as revisões e QA de implementação.
