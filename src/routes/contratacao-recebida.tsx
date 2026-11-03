import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, Mail, ArrowUpRight, ShieldCheck } from "lucide-react";

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
    <main className="min-h-[100dvh] bg-[#F8F5F2] px-4 py-10 text-[#341421] sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex items-center justify-between gap-4">
          <Link to="/" className="text-xl font-extrabold tracking-[.17em]">ORICSE<span className="text-[#986578]">.</span></Link>
          <span className="rounded-full border border-[#E7D8DC] px-3 py-1.5 text-xs font-semibold">Atendimento ORICSE</span>
        </header>
        <article className="overflow-hidden rounded-[2rem] border border-[#E8DBDD] bg-white shadow-[0_24px_80px_-45px_rgba(67,22,38,.35)]">
          <div className="h-1.5 bg-[#703047]" />
          <div className="px-6 pb-9 pt-10 text-center sm:px-12 sm:pb-12 sm:pt-14">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#F7ECF0] text-[#703047]">
              {pagamentoFalhou ? <Clock3 size={39} strokeWidth={1.7}/> : <CheckCircle2 size={42} strokeWidth={1.7}/>}
            </div>
            <p className="mt-8 text-xs font-bold uppercase tracking-[.25em] text-[#8A5668]">ORICSE • Contratação</p>
            <h1 className="mx-auto mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{titulo}</h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-[#6B5961]">{mensagem}</p>
            {!pagamentoFalhou && <div className="mx-auto mt-7 max-w-xl rounded-2xl border border-[#EFE3E7] bg-[#FCF9FA] px-5 py-4 text-left">
              <div className="flex items-start gap-3"><Clock3 className="mt-0.5 shrink-0 text-[#703047]" size={21}/><div><p className="font-bold">O que acontece agora?</p><p className="mt-1 text-sm leading-6 text-[#6B5961]">A confirmação do pagamento será verificada automaticamente. Após essa confirmação, nossa equipe poderá analisar e preparar o espaço do seu estabelecimento. O acesso não é liberado automaticamente.</p></div></div>
            </div>}
            <div className="mx-auto mt-8 max-w-xl border-t border-[#F0E7E9] pt-7">
              <p className="text-sm font-semibold">Precisa falar com a nossa equipe?</p>
              <p className="mt-2 text-sm text-[#6B5961]">Estamos à disposição para esclarecer qualquer dúvida.</p>
              <a href="mailto:vetericio@gmail.com?subject=Contrata%C3%A7%C3%A3o%20ORICSE" className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#703047] px-6 py-3 font-bold text-white transition hover:bg-[#542235]"><Mail size={18}/> vetericio@gmail.com <ArrowUpRight size={17}/></a>
            </div>
          </div>
        </article>
        <footer className="mt-8 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-[#8B7D82]"><ShieldCheck size={15}/> Seus dados são tratados conforme a <Link to="/politica-de-privacidade" className="font-semibold underline">Política de Privacidade</Link> da ORICSE.</footer>
      </div>
    </main>
  );
}
