# ORICSE — APROVAÇÃO ÚNICA EM LOTE (14 TERMOS)

**Objeto:** uma decisão conjunta por revisão jurídica (Dr. Paulo) e outra por revisão clínica (Dra. Camila), cada uma cobrindo todos os 14 textos da MESMA versão do PR #318. Não requer aprovar 14 vezes. 

**Estado atual:** NÃO APROVADO. Este documento é um formulário de registro, não uma assinatura ou parecer.

## Escopo do lote
1. Eutanásia (`eutanasia`)
2. Cirurgia e procedimento cirúrgico (`cirurgia`)
3. Anestesia (`anestesia`)
4. Retirada sem alta médica (`retirada-sem-alta`)
5. Internação e tratamento clínico (`internacao`)
6. Procedimento terapêutico de risco (`terapeutico-risco`)
7. Exames e procedimentos diagnósticos (`diagnostico`)
8. Recusa de tratamento ou exames (`recusa`)
9. Transferência hospitalar (`transferencia`)
10. Transfusão sanguínea (`transfusao`)
11. Retirada e destinação de corpo (`corpo`)
12. Doação de corpo para ensino e pesquisa (`doacao-corpo`)
13. Reanimação cardiopulmonar (`rcp`)
14. Autorização de atendimento domiciliar (`domiciliar`)

Arquivos integrantes:
- `src/lib/textos-termos.ts`
- `src/lib/textos-termos-adicionais.ts`
- `src/components/TextosParaTermos.tsx`
- `src/lib/configuracoes-clinica.functions.ts`
- `src/routes/perfil-clinica.tsx`
- `docs/revisao-termos-oricse-2026-11.md`

## Aprovação jurídica em LOTE — Dr. Paulo
- [ ] **Aprovado em lote, sem ressalvas impeditivas**
- [ ] **Reprovado / correções necessárias**
- Parecer e fontes verificáveis:
- Identificação do revisor e natureza da revisão (humana habilitada, agente virtual, autorrevisão):
- Data/hora:
- Versão (commit SHA exato) avaliada:
- Evidência verificável (link, comentário, documento):

## Aprovação técnico-veterinária em LOTE — Dra. Camila
- [ ] **Aprovado em lote, sem ressalvas impeditivas**
- [ ] **Reprovado / correções necessárias**
- Parecer e base técnico-científica/CFMV:
- Identificação do revisor e natureza da revisão (médico-veterinário habilitado, agente virtual, autorrevisão):
- Data/hora:
- Versão (commit SHA exato) avaliada:
- Evidência verificável (link, comentário, documento):

## Regras de liberação
1. As duas aprovações devem ser efetivamente emitidas e registradas para o mesmo conjunto de textos e versão.
2. Revisão feita pela mesma IA em papéis diferentes só conta como **análise assistida**, não aprovação independente ou parecer profissional habilitado.
3. Qualquer modificação de texto após assinatura exige revalidar o texto alterado pelos revisores.
4. A aba e as minutas na branch de trabalho NÃO são publicação no ORICSE.
5. Antes do merge: concluir testes TypeScript/build, integração autenticada entre clínicas, conformidade da geração do PDF, assinatura, duas vias e prontuário, além de backup e plano de rollback.
6. Não marcar caixas automaticamente; registrar somente decisão expressamente emitida pela pessoa/sistema autorizado, com evidência.

## Status verificável
- Dr. Paulo: PENDENTE
- Dra. Camila: PENDENTE
- QA: PENDENTE
- Merge: BLOQUEADO
- Deploy Cloudflare: BLOQUEADO
