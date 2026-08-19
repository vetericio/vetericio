# Alarmes em aba própria, curva corrigida e temas

## 1. Alarmes

- Nova aba **Alarmes** no menu (rota `/alarmes`), com a central completa; sai da página Início.
- **12 músicas** em vez de 5, mostradas em grade de **3 linhas × 4 colunas**, cada uma com botão de ouvir. Todas geradas dentro do app (sem arquivos), com melodias mais longas e contínuas — sequências que se repetem sem pausa perceptível: Suave, Sino, Urgente, Pulso, Sirene (as atuais) + Ninar, Caixinha de Música, Harpa, Marimba, Alvorada, Ondas e Plantão.
- **Jejum dos animais (00h)** passa a ligar sozinho quando o plantão escolhido é **noturno** (na escolha do turno ao abrir o app). Em plantão diurno segue desligado, e a escolha manual continua valendo.

## 2. Curva

- **Correção do gráfico:** as linhas e a grade usam cores no formato antigo (`hsl(var(--…))`), incompatível com os tokens do app (que são `oklch`), então nada é pintado. Vou passar a usar as cores do tema diretamente, do mesmo jeito que já funciona na aba Evolução, e garantir altura mínima no contêiner.
- Ao **selecionar o animal/parâmetro/intervalo**, o alarme já é sugerido na hora (sem esperar o botão), com a música à escolha.
- A curva e seu alarme valem **até finalizar o plantão**: ao finalizar, as curvas são encerradas e os alarmes de curva removidos automaticamente (o histórico continua na ficha e no PDF).
- Na ficha do Início, ao lado de **Glicemia**, aparece **"Fazer curva? Sim / Não"**. Escolhendo **Sim**, a curva glicêmica do animal é criada automaticamente ao enviar (intervalo padrão 2h, com o alarme sugerido). **Não** não faz nada.

## 3. Temas e rodapé

Cinco temas selecionáveis:

- **Original** (atual), **Veterinário** (verde/azul clínico), **Escuro**, **Sóbrio** (cinzas neutros) e **Divertido com bichinhos** (cores alegres e patinhas discretas ao fundo).

No fim de todas as páginas, um rodapé pequeno com o link **Temas** (abre a escolha ali mesmo) e o texto:

```text
Todos os direitos reservados a Veterício Serviços Veterinários LTDA. 31995512795.
```

A escolha do tema fica salva no aparelho.

## Detalhes técnicos

- `src/lib/toques.ts`: ampliar `TOQUES` para 12 padrões (ciclos mais longos, envelopes suaves, arpejos encadeados); grid `grid-cols-4` na UI.
- `src/routes/alarmes.tsx` novo + link em `Cabecalho.tsx`; remover `<Alarmes />` de `src/routes/index.tsx`.
- `src/hooks/usePlantaoAtual.ts` / `DialogoTurno.tsx`: ao definir turno `noturno`, `definirAlarmes` ativa `jejum-00h` com `proximoDisparo("00:00")`.
- `src/routes/curva.tsx`: trocar `stroke="hsl(var(--primary))"` por tokens válidos (`var(--primary)` / classes de chart já usadas em `src/lib/evolucao.ts`), `minHeight` no wrapper; mover a sugestão de alarme para efeito na seleção.
- Finalizar plantão (`src/routes/registros.tsx`): encerrar curvas ativas + limpar alarmes com `curvaId`.
- `FormAvaliacao.tsx`: campo `fazerCurva` ao lado de glicemia; `src/routes/index.tsx` cria a curva via `useCurvas` no envio.
- Temas: `src/lib/tema.ts` (persistência + lista), classes `.tema-vet`, `.tema-escuro`, `.tema-sobrio`, `.tema-fofo` em `src/styles.css` sobrescrevendo os tokens `oklch`; classe aplicada no `<html>` em `__root.tsx`; `src/components/Rodape.tsx` com seletor e o texto de direitos reservados.
- Tudo offline, sem backend.
