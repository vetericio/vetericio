# Cópia do PDF com cada item em sua própria linha

Hoje o PDF já desenha cada parâmetro em uma linha, mas ao copiar o conteúdo (Ctrl+C / copiar no celular) o leitor de PDF junta tudo em um único parágrafo: "Mucosas: normocoradas. Temperatura: 37. Urina: sim".

## O que será feito

1. Ajustar a camada de texto do PDF para que cada informação seja um bloco de texto independente, com espaçamento entre linhas maior e alinhamento explícito, para que os leitores de PDF (Chrome, Acrobat, iOS, Android) reconheçam cada linha como um parágrafo separado ao copiar.
2. Tirar o ponto final de cada item, ficando "Mucosas: normocoradas" e "Temperatura: 37 °C" — isso também evita que o leitor interprete as linhas como uma frase contínua.
3. Verificar o resultado extraindo o texto do PDF gerado (mesma leitura que o "copiar" faz) e confirmar que sai:

```text
Tigresa (Cachorro)
Mucosas: normocoradas
Temperatura: 37 °C
Urina: sim
Observações: ...
Resumo: ...
```

4. Se o leitor de PDF ainda insistir em juntar (limitação de alguns visualizadores de celular), incluir junto do PDF a exportação de um arquivo de texto (.txt) do mesmo plantão, que cola sempre com uma linha por item. O botão "Copiar todos" do app continua funcionando como está.

## Detalhes técnicos

- `src/lib/pdf.ts`: aumentar o leading entre linhas, escrever cada linha com `doc.text` em bloco próprio (sem reaproveitar a mesma linha base) e manter Helvetica 11.
- `src/lib/ficha.ts`: remover o `.` final na função `linha()` usada por `formatarRegistro` (afeta PDF e texto copiado do app, mantendo o mesmo conteúdo).
- Verificação: gerar o PDF em ambiente de teste e rodar extração de texto para conferir as quebras de linha antes de entregar.
