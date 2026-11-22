import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Star, HeartHandshake, CheckCircle2 } from "lucide-react";
import { responderPesquisaSatisfacao } from "@/lib/crm-jornadas.functions";

export const Route = createFileRoute("/avaliar-atendimento")({
  validateSearch: ({codigo}: Record<string, unknown>): {codigo?:string} => ({
    codigo: typeof codigo==="string" && /^[a-f0-9]{48}$/.test(codigo) ? codigo : undefined,
  }),
  component: AvaliacaoAtendimento,
});

function AvaliacaoAtendimento() {
  const {codigo}=Route.useSearch();
  const [nota,setNota]=useState(0);
  const [comentario,setComentario]=useState("");
  const [enviando,setEnviando]=useState(false);
  const [concluido,setConcluido]=useState(false);
  const [erro,setErro]=useState("");

  async function enviar() {
    if(!codigo || nota<1 || nota>5)return;
    setEnviando(true);setErro("");
    try {
      await responderPesquisaSatisfacao({data:{codigo,nota,comentario}});
      setConcluido(true);
    }catch(e){setErro(e instanceof Error?e.message:"Não foi possível registrar sua avaliação.");}
    finally{setEnviando(false);}
  }

  return <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
    <section className="rounded-3xl border border-primary/20 bg-card p-6 shadow-lg sm:p-9">
      <div className="flex items-center gap-3 text-primary">
        <HeartHandshake size={29} aria-hidden="true"/>
        <span className="text-xs font-black uppercase tracking-widest">ORICSE · Pesquisa de satisfação</span>
      </div>
      {concluido?<div className="mt-8 text-center">
        <CheckCircle2 size={48} className="mx-auto text-emerald-700"/>
        <h1 className="mt-4 text-2xl font-black">Obrigado pela sua avaliação!</h1>
        <p className="mt-3 text-sm text-muted-foreground">Sua opinião ajuda a equipe veterinária a melhorar o atendimento.</p>
      </div>:<>
        <h1 className="mt-7 text-2xl font-black">Como foi sua experiência?</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sua avaliação é importante para aprimorarmos o cuidado com os animais e seus tutores.</p>
        {!codigo?<div role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Este link de avaliação está incompleto. Solicite um novo à clínica.
        </div>:<>
          <fieldset className="mt-6">
            <legend className="text-sm font-bold">Escolha de 1 a 5 estrelas</legend>
            <div className="mt-3 flex justify-center gap-2 sm:gap-4">
              {[1,2,3,4,5].map(n=><button key={n} type="button"
                onClick={()=>setNota(n)} aria-label={n+" estrela"+(n>1?"s":"")} aria-pressed={nota===n}
                className="rounded-xl p-2 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-primary">
                <Star size={34} fill={nota>=n?"#E9B84C":"transparent"} color={nota>=n?"#C99426":"#9CA3AF"}/>
              </button>)}
            </div>
          </fieldset>
          <label className="mt-6 block text-sm font-bold">
            Comentário (opcional)
            <textarea value={comentario} maxLength={700} rows={4} onChange={e=>setComentario(e.target.value)}
              placeholder="Conte como foi o atendimento..."
              className="mt-2 w-full rounded-xl border bg-background p-3 text-sm font-normal"/>
          </label>
          {erro&&<p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{erro}</p>}
          <button type="button" onClick={()=>void enviar()} disabled={enviando||nota<1}
            className="mt-5 min-h-12 w-full rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50">
            {enviando?"Registrando...":"Enviar avaliação"}
          </button>
        </>}
      </>}
      <p className="mt-7 text-center text-xs text-muted-foreground">Sua resposta é registrada exclusivamente para melhoria do atendimento. Esta pesquisa não substitui orientações veterinárias.</p>
    </section>
  </main>;
}
