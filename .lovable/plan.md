# Aba Pendências

Uma página nova onde fica tudo que precisa de acompanhamento e de cobrança ao tutor: as pendências da anamnese, os medicamentos especiais e os procedimentos que acontecem várias vezes (glicose, oxigênio, aquecimento).

## O que muda para você

**Nova aba "Pendências"** no menu das três barrinhas (disponível com plantão ativo):
- Lista separada por animal, usando os animais que já existem no Veterício (internados e anamneses) — sem cadastrar animal de novo.
- Em cada animal: quantas pendências estão abertas, quantas foram feitas e a contagem de cobranças.
- Aparência diferente para os três tipos: pendência comum, medicamento especial (marcado como cobrança ao tutor) e procedimento especial (com contador).
- Editar, concluir, reabrir e excluir cada item (excluir pede confirmação).

**Pendências da anamnese**: continuam sendo escritas na anamnese como hoje, mas passam a aparecer também aqui — e **saem do PDF/exportação da ficha**. As que você já tem são trazidas para a aba automaticamente, sem perder nada.

**Botão +** grande na aba, com três opções:
- Pendência do animal (texto livre).
- Medicamento especial (nome, dose/quantidade, unidade, via quando fizer sentido, observação).
- Procedimento especial (glicose, oxigênio, aquecimento ou outro nome que você digitar).

**Contagem de ocorrências**: cada execução é uma cobrança. O item mostra "Glicose — 3 realizadas — 3 cobranças", com botão "+ registrar" que soma uma na hora, guardando data e hora (observação opcional). Dá para apagar uma ocorrência errada e o total se ajusta sozinho.

**Avisos automáticos na ficha**: ao digitar um valor baixo aparece uma janelinha:
- Temperatura abaixo do limite → "Animal apresentou temperatura baixa. Foi para o aquecimento?" — Sim, registrar / Não / Agora não.
- PAS abaixo do limite → "PAS baixa. Foi iniciada norepinefrina?" — mesmas opções.
Nada é criado sem o seu "Sim, registrar". Os limites usam as faixas por espécie que já existem no app e podem ser ajustados na própria aba Pendências; a estrutura aceita novos parâmetros (glicemia etc.) depois.

**Medicações do animal**: ao lançar uma medicação já cadastrada, a dose padrão do cadastro aparece como referência e ao lado um campo "dose usada agora", editável. Mudar aqui não altera o cadastro, e o histórico guarda o que foi realmente administrado.

**PDF**: só uma mudança — a lista de pendências sai. Medicamentos e procedimentos especiais não entram no PDF clínico; a aba Pendências guarda os dados separados para ter o próprio resumo/exportação no futuro.

O app não inventa dose: usa apenas o que está cadastrado; sem cadastro, o campo fica em branco para você preencher.

Pendências entram no backup e na sincronização entre aparelhos.

## Detalhes técnicos

- `src/lib/pendencias.ts` — tipos e persistência em `localStorage` (`veterico-pendencias-v1`), independentes da ficha:
  `ItemPendencia { id, animalChave, animalNome, especie, categoria: "pendencia" | "medicamento" | "procedimento", nome, unidade?, dose?, via?, observacao?, status: "pendente" | "realizado" | "cancelado", ocorrencias: { id, em, observacao? }[], origem?: "anamnese", criadoEm, atualizadoEm }`.
  Helpers `totalOcorrencias`, `registrarOcorrencia`, `removerOcorrencia`, `agruparPorAnimal`, catálogo `PROCEDIMENTOS_PADRAO` (Glicose, Oxigênio, Aquecimento) e `REGRAS_ALERTA` (parâmetro, lado abaixo/acima, pergunta, item gerado) com limites em `veterico-alertas-v1`.
- `src/hooks/usePendencias.ts` — store `useSyncExternalStore` no mesmo padrão de `useAnamneses`.
- `src/routes/pendencias.tsx` + `src/components/pendencias/` (`CartaoAnimal`, `LinhaItem`, `DialogoNovoItem`, `DialogoAlerta`), envolvido por `ExigePlantao`.
- `src/lib/navegacao.ts`: `/pendencias` em `LINKS_MENU` e em `SO_COM_PLANTAO`.
- `src/lib/ficha.ts`: `blocoAnamnese` deixa de emitir a linha "Pendências"; `pdf.ts` não muda.
- `src/routes/anamnese.tsx`: ao salvar, espelha as pendências no módulo (`origem: "anamnese"`, sem duplicar por id) e migra uma vez as já existentes.
- `src/components/FormAvaliacao.tsx`: valor numérico fora do limite abre `DialogoAlerta`; "Sim, registrar" cria a ocorrência no animal correspondente.
- `src/components/medicamentos/DialogoMinistrar.tsx`: rótulo "dose padrão" (referência) + campo "dose usada agora" já preenchido com ela; cadastro do medicamento intacto. Marcação "especial" no medicamento envia o lançamento para Pendências em vez da lista padrão.
- `src/lib/backup.ts`: `pendencias` e `alertas` em `CHAVES_BACKUP` (lista por id com carimbo) para backup e sincronização.
- `src/lib/versao.ts` → 1.50.

Validação: `bunx tsgo --noEmit` e teste no preview (temperatura 35,8 → aquecimento; PAS 75 → norepinefrina; glicose 1x/2x/3x; PDF sem pendências).
