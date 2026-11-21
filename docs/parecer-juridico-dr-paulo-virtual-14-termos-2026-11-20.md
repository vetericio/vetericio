# PARECER JURÍDICO ASSISTIDO POR IA — ORICSE/JUR/2026-11-20/01

**Perspectiva funcional:** Dr. Paulo, assessor jurídico **virtual** do ORICSE.  
**Autor real da análise:** ChatGPT, a partir do protocolo do agente Dr. Paulo e de fontes legais consultadas.  
**Natureza:** parecer técnico-informativo, **sem assinatura de advogado OAB**, **sem revisão independente** e **sem poder para registrar aprovação em nome de terceiro**.  
**Data-base:** 20 de novembro de 2026, Brasil.  
**Objeto:** revisão conjunta das 14 minutas do PR [#318](https://github.com/vetericio/vetericio/pull/318), na branch `feat/textos-termos-cfmv-20261120`.  
**Conclusão executiva:** **FAVORÁVEL ÀS MINUTAS COMO BASE DE TRABALHO, COM RESSALVAS IMPEDITIVAS AO USO E À PUBLICAÇÃO ATUAL.** Não equivale a homologação jurídica independente.

## Legislação e bases verificadas
1. Resolução CFMV nº 1.321/2020, arts. 3º, 9º, 10, 11 e 12 e Anexos III, IV, V, VI, VII, VIII, IX, X e XII, conforme versão atualizada pela Resolução CFMV nº 1.653/2025: https://manual.cfmv.gov.br/arquivos/resolucao/1321.pdf
2. CFMV: retirada sem alta exige ciência, assinatura e testemunhas na recusa: https://www.cfmv.gov.br/retirada-de-pets-sem-alta-medica-exige-termo-de-responsabilidade-reafirma-cfmv/comunicacao/noticias/2025/07/03/
3. Resolução CFMV nº 1.690/2026: normas para atendimento domiciliar: https://www.cfmv.gov.br/medico-veterinario-em-casa-ate-onde-vai-o-atendimento-domiciliar/comunicacao/noticias/2026/08/14/
4. Resolução CFMV nº 1.000/2012, critérios de eutanásia, referenciada no rol oficial: https://www.cfmv.gov.br/principaislegislacoescfmv/

## Avaliação individual, na mesma rodada
| Nº | Termo | Avaliação jurídica do texto | Providência |
|---|---|---|---|
| 01 | Eutanásia | Adequado como minuta. Consentimento não substitui indicação médica ética. | Exigir justificativa, método, profissional, assinatura e data. |
| 02 | Cirurgia | Adequado como minuta, riscos descritos em geral. | Obrigar procedimento e riscos específicos; anestesia separada. |
| 03 | Anestesia | Adequado como minuta específica. | Vincular intervenção, risco individual e assinatura. |
| 04 | Retirada sem alta | Adequado quanto à ciência e responsabilidade sem quitação genérica. | Prever fluxo de recusa de assinatura e duas testemunhas efetivas. |
| 05 | Internação | Adequado como minuta, porém não deve valer como carta branca para intervenções eletivas não previstas. | Discriminar plano, limites e autorizações adicionais. |
| 06 | Procedimento de risco | Adequado como minuta de ciência. | Discriminar procedimento, riscos, alternativas e consentimento expresso. |
| 07 | Exames diagnósticos | Adequado como minuta. | Listar exames; exigir consentimento próprio para sedação/anestesia pertinente. |
| 08 | Recusa de exames/tratamento | Adequado como declaração de recusa, sem exoneração irrestrita da clínica. | Documentar informação, alternativas, escolha e assinatura/recusa. |
| 09 | Transferência | Adequado como minuta. | Identificar destino, transporte e responsabilidade efetiva; não prometer aceite de hospital sem confirmação. |
| 10 | Transfusão | Adequado como minuta de consentimento. | Vincular produto, rastreabilidade, condições clínicas e testes indicados; não consentir em domicílio. |
| 11 | Retirada de corpo | Adequado como minuta. | Registrar recebimento, restrições sanitárias e destinação; atestado de óbito é distinto. |
| 12 | Doação do corpo | Adequado como minuta. **Referência correta: Anexo XII** da Res. 1.321/2020. | Identificar instituição, finalidade e aceite; não confundir com consentimento de eutanásia. |
| 13 | RCP | Requer cuidado reforçado. Consentimento/recusa não dispensa critério ético-técnico. | Exigir opção inequívoca, data/hora e reavaliação da ordem de não reanimar. |
| 14 | Atendimento domiciliar | Adequado como minuta condicionada à legislação. | Restringir práticas vedadas e não prometer transporte/hospitalização não contratados. |

## Ressalvas jurídicas impeditivas ao release
**J1 — Falta de emissão formal:** a branch apenas adiciona arquivos de texto e editor de rascunhos; não comprova emissão de termo assinado em duas vias, entrega ao responsável, integração ao prontuário, guarda íntegra e rastreabilidade. A Res. 1.321/2020, art. 3º, exige esses requisitos.

**J2 — Campos obrigatórios não validados:** rótulos de texto como “(preenchimento obrigatório)” não constituem validação de preenchimento. É necessário impedir emissão com dados essenciais vazios, placeholders não resolvidos ou consentimento ambíguo.

**J3 — Responsável e profissional:** padronizar “responsável pelo animal” no documento exibido; identificar nome, CPF, endereço, paciente e profissional/CRMV, local, data e assinatura conforme aplicável.

**J4 — Versões e integridade:** alteração posterior a uma assinatura não pode mudar o documento histórico. Armazenar cópia imutável, versão, evidência de aceite, autoria, data e autenticidade; autorização de um atendimento não se transfere automaticamente para outro.

**J5 — Exceção de urgência:** não bloquear, por falta de termo, atuação no risco iminente de morte ou incapacidade permanente, nos termos do art. 10, § 3º. Deve-se registrar no prontuário o motivo da atuação sem prévia autorização.

**J6 — Saída sem alta:** a recusa de assinatura não deve inviabilizar o registro da retirada. Art. 11, § 1º: registrar e obter duas testemunhas que tenham presenciado a recusa, com integridade da documentação.

**J7 — Privacidade e permissões:** dados e minutas são segregados por clínica, mas o fluxo de documentos deve ter controles efetivos de acesso, consentimento e confidencialidade, inclusive no Portal do Tutor. Verificar isolamento multi-tenant por teste autenticado.

**J8 — Aprovação declarada:** a análise deste agente virtual não substitui uma segunda revisão independente nem a assinatura de advogado quando necessária. Não registrar APROVADO em nome de Dr. Paulo humano.

## Condição para parecer jurídico final favorável à publicação
1. Corrigir J1 a J7 e validar cada texto na versão definitiva.
2. Submeter a revisão independente ao responsável jurídico designado; registrar nome, evidência, versão e data.
3. Conferir testes, cópias, assinatura, dados, integridade, permissões e rollback antes de publicar.

### Decisão formal desta análise virtual
**APTO PARA REVISÃO E DESENVOLVIMENTO; NÃO APTO PARA PUBLICAÇÃO NA FORMA ATUAL.**  
**Status de aprovação independente Dr. Paulo: NÃO REGISTRADA.**  
*Documento informativo automatizado. Não assinado. Não equivale a chancela profissional.*
