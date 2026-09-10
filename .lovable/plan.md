# Estrela e "Medicação Cobrada" separadas

Hoje a estrela do cartão e a marcação de "especial" são a mesma coisa. Vão passar a ser duas marcações independentes.

## 1. Estrela = favorita (fica no início)

- A estrela ☆/★ do cartão passa a marcar a medicação como favorita.
- Favoritas aparecem no topo da lista de medicações, em ordem alfabética entre elas; as demais seguem depois, também em ordem alfabética.
- Os atalhos de medicação na ficha do animal passam a usar as favoritas (é o que a estrela já fazia na prática, então nada muda para quem já usa).

## 2. "Medicação Cobrada"

- A antiga marcação "Medicação especial" passa a se chamar **Medicação Cobrada**, dentro do cadastro/edição do medicamento.
- No cartão aparece um selo discreto "Cobrada", sem mudar o layout nem as cores atuais.
- Quem já tinha medicações marcadas como especiais continua com elas marcadas como Cobrada **e** como favoritas, para não perder nada do que já era exibido.

## 3. Ao ministrar uma medicação Cobrada, vai para Pendências

- Ao confirmar a ministração e escolher o animal, se a medicação for Cobrada, o app cria (ou reaproveita) o item dela em **Pendências**, na categoria "Medicamento", para o animal escolhido, e soma uma ocorrência — cada ministração é uma cobrança.
- O registro normal no histórico do animal continua exatamente como é hoje.
- Medicações não Cobradas não geram nada em Pendências.
- Uma confirmação curta avisa que o item foi lançado em Pendências.

## Detalhes técnicos

- `src/lib/medicamentos.ts`: novo campo `favorito?: boolean`; `especial` permanece como o campo de "Cobrada" (sem migração destrutiva). `ordenarMedicamentos` ordena favoritas primeiro. Migração leve na carga: `especial: true` sem `favorito` definido recebe `favorito: true`.
- `src/routes/medicacoes.tsx`: estrela chama `salvar({ ...m, favorito: !m.favorito })`; selo "Cobrada" quando `especial`.
- `src/components/medicamentos/FormMedicamento.tsx`: rótulos atualizados para "Medicação Cobrada".
- `src/components/Medicacoes.tsx`: atalhos passam a filtrar por `favorito`.
- `DialogoMinistrar` → `AplicacaoPendente` ganha `cobrada?: boolean`; `DialogoAplicar` chama `garantirItemERegistrar` de `src/hooks/usePendencias.ts` com o nome do animal, espécie e categoria `medicamento`.
- `src/lib/pdf-medicamentos.ts`: texto "Medicação cobrada"; versão do app incrementada.
