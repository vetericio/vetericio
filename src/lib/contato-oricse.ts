/** Canais públicos de atendimento da plataforma; não usar para contatos de clínicas. */
export const ORICSE_EMAIL_ATENDIMENTO = "atendimento@oricse.com.br";
export const ORICSE_WHATSAPP_NUMERO = "5531971969699";
export const ORICSE_WHATSAPP_EXIBICAO = "(31) 97196-9699";

export function whatsappAtendimentoOricse(mensagem?: string) {
  const base = `https://wa.me/${ORICSE_WHATSAPP_NUMERO}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

export function emailAtendimentoOricse(assunto?: string) {
  const base = `mailto:${ORICSE_EMAIL_ATENDIMENTO}`;
  return assunto ? `${base}?subject=${encodeURIComponent(assunto)}` : base;
}
