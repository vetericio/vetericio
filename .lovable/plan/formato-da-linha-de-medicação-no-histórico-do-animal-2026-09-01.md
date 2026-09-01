# Formato da linha de medicação no histórico do animal

Aplicar a formatação solicitada pelo usuário para o registro de medicação na ficha do animal:

```text
Dipirona 500 - 0,14 mL / IV / a cada 8h
```

## Alterações

1. **Ajustar `linhaMedicacao` em `src/lib/ficha.ts`**
   - Manter `nome` e `quantidade` unidos por `" - "`.
   - Concatenar `via` e `duracao` com `" / "`.
   - Remover a dose de referência e o horário de aplicação da linha exibida.
   - O objeto `Medicacao` continua guardando `dose` e `aplicadoEm` como metadados; apenas a string renderizada fica enxuta.

2. **Validar consumidores**
   - Verificar se `blocoMedicacoes`, PDF e cópia de texto usam `linhaMedicacao` e, portanto, refletem o novo formato automaticamente.
   - Garantir que não haja quebras de linha extras ou rótulos de "Observações" em branco junto à medicação.

## Resultado esperado

Toda medicação aplicada passa a aparecer no histórico do animal exatamente como:

```text
Dipirona 500 - 0,14 mL / IV / a cada 8h
```

Sem dose de referência, sem horário e sem "Observações" vazias na sequência.
