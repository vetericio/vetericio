import {
  emailAtendimentoOricse,
  ORICSE_EMAIL_ATENDIMENTO,
  ORICSE_WHATSAPP_EXIBICAO,
  whatsappAtendimentoOricse,
} from "@/lib/contato-oricse";

export function ContatosAtendimentoOricse({ className }: { className?: string }) {
  return (
    <address aria-label="Atendimento do Oricse" className={className}>
      <a
        className="underline underline-offset-2"
        href={whatsappAtendimentoOricse()}
        target="_blank"
        rel="noopener noreferrer"
      >
        WhatsApp {ORICSE_WHATSAPP_EXIBICAO}
      </a>
      <a className="break-all underline underline-offset-2" href={emailAtendimentoOricse()}>
        {ORICSE_EMAIL_ATENDIMENTO}
      </a>
    </address>
  );
}
