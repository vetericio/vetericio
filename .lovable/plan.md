# Medicações com IA na foto + adicionar/editar/excluir

## 1. Leitura da foto com IA

- Ao tirar ou enviar a foto, o app manda a imagem para a IA (modelo de visão) que devolve as medicações já separadas em **Medicação · Dose · Duração**, entendendo receitas impressas e boa parte da letra manuscrita.
- A IA também normaliza o que estiver abreviado (ex.: "dipi 0,5ml 12/12h 3d" → Dipirona · 0,5 mL · 3 dias, 12/12h).
- Sem internet: o app usa automaticamente a leitura offline atual (Tesseract) como reserva e avisa que a precisão é menor.
- Enquanto lê, o botão mostra "Lendo foto…"; se nada for reconhecido, o texto lido aparece para correção manual.
- O resultado entra sempre como **sugestão**: você revisa e confirma antes de salvar.

## 2. Adicionar medicação com botão "Enviar"

- No lugar de linhas soltas, a seção Medicações passa a ter um mini-formulário: três campos (Medicação, Dose, Duração) e o botão **Enviar**.
- Ao enviar, a medicação sai do formulário e entra na **lista acima**, já salva na ficha do animal.
- Cada item da lista tem os botões **Editar** (carrega os valores de volta no formulário para corrigir e reenviar) e **Excluir**.
- As sugestões vindas da foto também aparecem nessa lista, prontas para editar ou excluir.
- Mesmo comportamento na página inicial (ficha nova) e em Animais internados.

## 3. Sem mudanças no resto

- O bloco "Medicações:" continua igual na cópia do texto, na ficha e no PDF.

## Detalhes técnicos

- Nova server function `src/lib/medicacoes.functions.ts` chamando o Lovable AI Gateway (`/v1/chat/completions`, `google/gemini-3.1-flash`) com a imagem em `image_url` base64 e saída estruturada (JSON) `{ nome, dose, duracao }[]`; a chave `LOVABLE_API_KEY` é lida dentro do `.handler()`.
- Tratamento de erro do Gateway: 429/5xx com nova tentativa curta; 402/403 mostram a mensagem do serviço e caem para o modo offline.
- `src/lib/ocr.ts` permanece como reserva offline (detecção via `navigator.onLine` + falha da chamada).
- `src/components/Medicacoes.tsx` reescrito: estado do formulário (`rascunho`), índice em edição, lista com Editar/Excluir; assinatura `lista`/`onChange` mantida, então `FormAvaliacao.tsx` e `ListaRegistros.tsx` seguem sem alteração de contrato.
