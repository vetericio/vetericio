import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, Mail, MessageCircle, ShieldCheck, CalendarCheck2, Headset } from "lucide-react";

export const Route = createFileRoute("/contratacao-recebida")({
  head: () => ({ meta: [{ title: "Solicitação recebida | ORICSE" }, { name: "description", content: "Acompanhe os próximos passos da sua contratação ORICSE." }] }),
  component: ContratacaoRecebida,
});

function ContratacaoRecebida() {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const situacao = params.get("retorno");
  const pedido = params.get("pedido");
  const pedidoCurto = pedido && /^[0-9a-f-]{36}$/i.test(pedido) ? pedido.slice(0, 8) : null;
  const pagamentoFalhou = situacao === "falha";
  const solicitacaoIsenta = situacao === "isento";
  const pagamentoPendente = situacao === "pendente";
  // O retorno do Mercado Pago não prova liquidação. Somente o webhook
  // confirma o pagamento e habilita a análise administrativa.
  const titulo = pagamentoFalhou ? "Pagamento não concluído" : "Solicitação recebida. Agora é só aguardar!";
  const mensagem = pagamentoFalhou
    ? "Sua solicitação foi registrada, mas o pagamento não foi concluído. Fale com nossa equipe se precisar de ajuda para finalizar."
    : solicitacaoIsenta
      ? "Seu cupom foi aplicado e sua contratação foi recebida sem cobrança. Nossa equipe analisará o cadastro e entrará em contato."
      : pagamentoPendente
        ? "Recebemos sua solicitação. O pagamento ainda está pendente; assim que for confirmado, nossa equipe dará andamento à análise."
        : "Recebemos sua solicitação! A confirmação do pagamento será verificada pela ORICSE e, em seguida, nossa equipe analisará o cadastro. O acesso não é liberado automaticamente.";
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#F8F5F2] px-4 py-10 text-[#341421] sm:py-14"><div aria-hidden="true" className="pointer-events-none absolute -left-36 -top-44 h-80 w-[34rem] rotate-[-20deg] rounded-[100%] bg-gradient-to-r from-[#703047] via-[#B37787] to-transparent opacity-20"/><div aria-hidden="true" className="pointer-events-none absolute -bottom-44 -right-32 h-80 w-[34rem] rotate-[-20deg] rounded-[100%] bg-gradient-to-r from-transparent via-[#B37787] to-[#703047] opacity-20"/>
      <div className="relative mx-auto max-w-4xl">
        <header className="mb-9 flex flex-col items-center justify-center gap-3 text-center">
          <Link to="/" aria-label="ORICSE — página inicial" className="flex items-center justify-center">
            <img src="/oricse-logo-oryx.svg?v=15" alt="Logo oficial da ORICSE" width="110" height="110" className="h-[92px] w-[92px] object-contain sm:h-[110px] sm:w-[110px]"/>
          </Link>
        </header>
        <article className="overflow-hidden rounded-[2rem] border border-[#E8DBDD] bg-white shadow-[0_24px_80px_-45px_rgba(67,22,38,.35)]">
          <div className="h-1.5 bg-gradient-to-r from-[#703047] via-[#A9667B] to-[#703047]" />
          <div className="px-6 pb-9 pt-9 text-center sm:px-12 sm:pb-12 sm:pt-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F7ECF0] text-[#703047]">
              {pagamentoFalhou ? <Clock3 size={39} strokeWidth={1.7}/> : <CheckCircle2 size={42} strokeWidth={1.7}/>}
            </div>
            <p className="mb-7 flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-[.2em] text-[#8A5668]"><span className="h-px w-12 bg-[#D4BFC7] sm:w-28"/>ORICSE • Contratação<span className="h-px w-12 bg-[#D4BFC7] sm:w-28"/></p>
            <h1 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-bold tracking-tight text-[#703047] sm:text-5xl">{titulo}</h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-[#6B5961]">{mensagem}</p>
            {!pagamentoFalhou && <div className="mx-auto mt-9 max-w-2xl rounded-2xl border border-[#EFE3E7] bg-[#FAF2F4] px-6 py-6 text-left">
              <div className="flex items-start gap-3"><CalendarCheck2 className="mt-0.5 shrink-0 text-[#703047]" size={30}/><div><p className="font-bold">O que acontece agora?</p><p className="mt-1 text-sm leading-6 text-[#6B5961]">{solicitacaoIsenta
                  ? "Não é necessário pagar nada. Sua solicitação já pode ser analisada pela equipe da ORICSE; a ativação dependerá da aprovação administrativa."
                  : "A confirmação financeira será conferida antes da análise. Aguarde nosso contato: a ativação do estabelecimento não é automática."}</p></div></div>
            </div>}
            <div className="mx-auto mt-8 max-w-2xl border-t border-[#F0E7E9] pt-7"><Headset className="mx-auto mb-3 text-[#703047]" size={27}/>
              <p className="text-base font-bold">Dúvidas? Fale com a ORICSE.</p>
              <p className="mt-2 text-sm leading-6 text-[#6B5961]">Se precisar de qualquer coisa enquanto aguarda, estamos à disposição por e-mail ou WhatsApp.</p>
              {pedidoCurto && <p className="mt-3 text-xs font-semibold text-[#8A5668]">Solicitação: {pedidoCurto}</p>}
              <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
                <a href="mailto:atendimento@oricse.com.br?subject=Atendimento%20ORICSE%20-%20Contrata%C3%A7%C3%A3o" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#703047] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#542235]"><Mail size={18}/> atendimento@oricse.com.br</a>
                <a href="https://wa.me/5531995512795?text=Ol%C3%A1%21%20Preciso%20de%20ajuda%20com%20minha%20contrata%C3%A7%C3%A3o%20na%20ORICSE." target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#703047] bg-white px-5 py-3 text-sm font-bold text-[#703047] transition hover:bg-[#FAF2F4]"><MessageCircle size={18}/> WhatsApp (31) 99551-2795</a>
              </div>
            </div>
          </div>
        </article>
        <footer className="mt-8 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-[#8B7D82]"><ShieldCheck size={15}/> Seus dados são tratados conforme a <Link to="/politica-de-privacidade" className="font-semibold underline">Política de Privacidade</Link> da ORICSE.</footer>
      </div>
    </main>
  );
}
