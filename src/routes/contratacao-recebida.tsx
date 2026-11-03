import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, Mail, ArrowUpRight, ShieldCheck, CalendarCheck2, Headset } from "lucide-react";

export const Route = createFileRoute("/contratacao-recebida")({
  head: () => ({ meta: [{ title: "Solicitação recebida | ORICSE" }, { name: "description", content: "Acompanhe os próximos passos da sua contratação ORICSE." }] }),
  component: ContratacaoRecebida,
});

function ContratacaoRecebida() {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const situacao = params.get("retorno");
  const pagamentoFalhou = situacao === "falha";
  const titulo = pagamentoFalhou ? "O pagamento não foi concluído" : "Recebemos sua solicitação!";
  const mensagem = pagamentoFalhou
    ? "Sua solicitação foi registrada, mas não recebemos a confirmação do pagamento. Você poderá entrar em contato com nossa equipe para continuar."
    : "Seu cadastro e sua solicitação de contratação foram recebidos. Nossa equipe analisará as informações e entrará em contato para orientar os próximos passos.";
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#F8F5F2] px-4 py-10 text-[#341421] sm:py-14"><div aria-hidden="true" className="pointer-events-none absolute -left-36 -top-44 h-80 w-[34rem] rotate-[-20deg] rounded-[100%] bg-gradient-to-r from-[#703047] via-[#B37787] to-transparent opacity-20"/><div aria-hidden="true" className="pointer-events-none absolute -bottom-44 -right-32 h-80 w-[34rem] rotate-[-20deg] rounded-[100%] bg-gradient-to-r from-transparent via-[#B37787] to-[#703047] opacity-20"/>
      <div className="relative mx-auto max-w-4xl">
        <header className="mb-9 flex flex-col items-center justify-center gap-3 text-center">
          <Link to="/" aria-label="ORICSE — página inicial" className="flex items-center justify-center">
            <img src="/oricse-logo-oryx.svg" alt="Logo oficial da ORICSE" width="110" height="110" className="h-[92px] w-[92px] object-contain sm:h-[110px] sm:w-[110px]"/>
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
              <div className="flex items-start gap-3"><CalendarCheck2 className="mt-0.5 shrink-0 text-[#703047]" size={30}/><div><p className="font-bold">O que acontece agora?</p><p className="mt-1 text-sm leading-6 text-[#6B5961]">A confirmação do pagamento será verificada automaticamente. Após essa confirmação, nossa equipe poderá analisar e preparar o espaço do seu estabelecimento. O acesso não é liberado automaticamente.</p></div></div>
            </div>}
            <div className="mx-auto mt-8 max-w-2xl border-t border-[#F0E7E9] pt-7"><Headset className="mx-auto mb-3 text-[#703047]" size={27}/>
              <p className="text-sm font-semibold">Precisa falar com a nossa equipe?</p>
              <p className="mt-2 text-sm text-[#6B5961]">Estamos à disposição para esclarecer qualquer dúvida.</p>
              <a href="mailto:vetericio@gmail.com?subject=Contrata%C3%A7%C3%A3o%20ORICSE" className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#703047] px-6 py-3 font-bold text-white transition hover:bg-[#542235]"><Mail size={18}/> vetericio@gmail.com <ArrowUpRight size={17}/></a>
            </div>
          </div>
        </article>
        <footer className="mt-8 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-[#8B7D82]"><ShieldCheck size={15}/> Seus dados são tratados conforme a <Link to="/politica-de-privacidade" className="font-semibold underline">Política de Privacidade</Link> da ORICSE.</footer>
      </div>
    </main>
  );
}
