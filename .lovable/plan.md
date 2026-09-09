# Módulo Pendências

Nova aba do Veterício onde fica tudo que precisa de acompanhamento ou cobrança durante a internação: pendências comuns, medicamentos especiais e procedimentos cobráveis por ocorrência.

## O que você vai ver

**Nova página "Pendências"** (no menu das três barrinhas, disponível só com plantão ativo):
- Lista agrupada por animal, usando os animais que já existem (internados + anamneses do plantão).
- Cada cartão de animal mostra quantas pendências estão abertas, quantas foram concluídas e o total cobrável.
- Três aparências diferentes: pendência comum (neutra), medicamento especial (destaque de cobrança ao tutor) e procedimento especial (com contador).
- Botão **+** grande e fixo na tela. Ao tocar, escolhe: "Pendência", "Medicamento especial" ou "Procedimento especial".
- Em cada item: editar, concluir, reabrir e excluir (com confirmação).

**Contador de ocorrências**: procedimentos como Glicose, Oxigênio e Aquecimento mostram "Glicose — 3 realizadas — 3 cobranças" com botão "+ registrar" que soma uma ocorrência na hora (data e hora gravadas, observação opcional). Cada ocorrência pode ser apagada e o total se recalcula.

**Valor de cobrança opcional**: se você preencher o valor unitário, o app mostra ocorrências × valor. Sem valor, mostra apenas a contagem.

**Avisos inteligentes na ficha**: ao digitar um valor fora do limite, aparece uma janelinha de confirmação:
- Temperatura baixa → "Animal apresentou temperatura baixa. Foi para o aquecimento?" → Sim, registrar / Não / Agora não.
- PAS baixa → "PAS baixa. Foi iniciada norepinefrina?" → mesma escolha.
Nada é criado sem o seu "Sim". Os limites vêm das faixas por espécie que já existem no app e ficam ajustáveis na própria página de Pendências (não fixos no código). A estrutura aceita novas regras (glicemia etc.) no futuro.

**Medicações do animal**: ao lançar uma medicação já cadastrada, a dose padrão do cadastro é carregada e mostrada como "dose padrão"; ao lado, um campo "dose usada agora" editável. Alterar aqui não muda o cadastro. O histórico continua guardando o que foi realmente administrado.

**PDF**: as pendências da anamnese saem do PDF/exportação da ficha. Todo o resto do PDF fica igual. Pendências, medicamentos e procedimentos especiais não entram no PDF clínico.

O app nunca inventa dose: usa só o que está cadastrado; sem cadastro, o campo fica aberto para você preencher.

## Detalhes técnicos

- `src/lib/pendencias.ts` — tipos e persistência em `localStorage` (`veterico-pendencias-v1`), independentes da ficha:
  `ItemPendencia { id, animalChave, animalNome, especie, categoria: "pendencia" | "medicamento" | "procedimento", nome, unidade?, dose?, doseUsada?, via?, observacao?, status: "pendente" | "realizado" | "cancelado", valorUnitario?, ocorrencias: { id, em, observacao? }[], criadoEm, atualizadoEm }`.
  Helpers: `totalOcorrencias`, `totalCobranca`, `registrarOcorrencia`, `removerOcorrencia`, `pendenciasPorAnimal`, catálogo padrão de procedimentos (Glicose, Oxigênio, Aquecimento) e regras de alerta em `REGRAS_ALERTA` (parâmetro, condição abaixo/acima, pergunta, item gerado) com limites salvos em `veterico-alertas-v1`.
- `src/hooks/usePendencias.ts` — store no mesmo padrão de `useAnamneses`/`useMedicamentos` (`useSyncExternalStore`).
- `src/routes/pendencias.tsx` + componentes em `src/components/pendencias/` (`CartaoAnimal`, `ItemLinha`, `DialogoNovoItem`, `DialogoAlerta`), protegidos por `ExigePlantao`.
- `src/lib/navegacao.ts`: novo link `/pendencias` em `LINKS_MENU` e em `SO_COM_PLANTAO`.
- `src/lib/ficha.ts`: `blocoAnamnese` deixa de emitir a linha "Pendências" (única mudança de exportação; `pdf.ts` não muda).
- `src/routes/anamnese.tsx`: pendências digitadas na anamnese passam a ser gravadas também no módulo (migração única das pendências já existentes, sem apagar nada da anamnese).
- `src/components/FormAvaliacao.tsx`: ao sair de um campo numérico com valor fora do limite, dispara `DialogoAlerta`; "Sim, registrar" cria a ocorrência.
- `src/components/medicamentos/DialogoMinistrar.tsx` / `DialogoAplicar.tsx`: rótulo "dose padrão" (somente leitura) + campo "dose usada agora"; cadastro intacto.
- `src/lib/backup.ts`: `pendencias` e `alertas` entram em `CHAVES_BACKUP` (lista por id + carimbo), para backup e sincronização entre aparelhos.
- `src/lib/versao.ts` → 1.50.

Validação: `bunx tsgo --noEmit` e teste do fluxo no preview (temperatura 35,8 → aquecimento; PAS 75 → norepinefrina; glicose 1x/2x/3x; PDF sem pendências).
