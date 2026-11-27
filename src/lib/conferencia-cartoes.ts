export function pagamentoEmCartao(forma: string) {
  return /^(?:cartao(?: de (?:credito|debito))?|credito|debito)$/.test(
    forma
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim(),
  );
}

export function lerValorConferencia(texto: string): number | null {
  if (!/^\d{1,7}(?:[,.]\d{1,2})?$/.test(texto.trim())) return null;
  const [inteiro, fracao = ""] = texto.trim().split(/[,.]/);
  return Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"));
}

export function situacaoConferencia(registro?: {
  recebido_centavos: number;
  liquido_esperado_centavos: number;
}) {
  if (!registro) return "Pendente";
  return registro.recebido_centavos === registro.liquido_esperado_centavos
    ? "Conciliado"
    : "Divergente";
}
