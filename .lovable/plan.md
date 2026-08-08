# Cópia e PDF com uma informação por linha (+ data no início)

## 1. Data na página inicial

Abaixo de "Ficha de Avaliação da Internação", no cabeçalho, aparece a data do aparelho em texto pequeno e discreto (ex.: `08/08/2026`), sempre atualizada.

## 2. O problema da cópia

Ao copiar (do app ou do PDF) o texto cola tudo emendado numa linha só: `alimentação forçado, comportamento responsivo`. Isso acontece porque as quebras de linha usadas não são reconhecidas por alguns aplicativos (WhatsApp, Notas) e porque, no PDF, as linhas são desenhadas muito próximas e o leitor de PDF as junta ao copiar.

## O resultado esperado

```text
Tigresa 🐶
Alimentação: Forçado
Comportamento: Ativo
Fezes: Sim
Temperatura: 38,1 °C
```

Cada informação em sua própria linha, tanto no texto copiado do app quanto no texto copiado de dentro do PDF.

## O que muda

1. **Copiar no app** (um animal e todos os animais): o texto passa a usar quebra de linha compatível com todos os apps (`\r\n`), então cola sempre uma informação por linha.
2. **PDF**: cada informação é escrita como um parágrafo próprio, com espaçamento entre linhas suficiente para o leitor de PDF entender que são linhas separadas ao copiar. O nome do animal continua em negrito e cada animal separado por um espaço em branco.
3. Nada muda no conteúdo em si — só a formatação/quebra de linhas.

## Detalhes técnicos

- `src/components/Cabecalho.tsx`: linha com a data atual (`toLocaleDateString("pt-BR")`) logo abaixo do subtítulo, em `text-[11px] text-muted-foreground`.
- `src/routes/registros.tsx`: `copiarTexto()` normaliza o texto para `\r\n` antes de `navigator.clipboard.writeText` (aplica ao copiar individual e ao copiar todos).
- `src/lib/pdf.ts`: aumentar o espaçamento vertical por linha (de 15 pt para ~17 pt) e desenhar cada linha do registro com `doc.text(l, margem, y)` isolado (já é o caso), garantindo que a extração de texto do PDF preserve as quebras. Manter `splitTextToSize` para linhas longas.
- Sem mudanças em `src/lib/ficha.ts` (a formatação já gera uma informação por linha).
