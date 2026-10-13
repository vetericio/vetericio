import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/planos")({ component: Planos });

export const PLANOS_PADRAO = [
  { nome: "Essencial", descricao: "Bom para veterinários que atendem em domicílio", preco: "R$ 49,90", preco_mensal: "R$ 49,90", preco_anual: "R$ 499,00", itens: ["Cadastro de animais e tutores", "Anamnese e prontuários", "Receituário e PDFs clínicos"] },
  { nome: "Plus (Clínica)", descricao: "Bom para petshops e clínicas", preco: "R$ 99,90", preco_mensal: "R$ 99,90", preco_anual: "R$ 999,00", destaque: true, itens: ["Logo da sua clínica", "3 usuários inclusos", "Consultório e recepção", "Financeiro e caixa", "Serviços e estoque"] },
  { nome: "Master (Equipe)", descricao: "Para equipes e clínicas que precisam de um sistema sob medida", preco: "R$ 199,90", preco_mensal: "R$ 199,90", preco_anual: "R$ 1.999,00", itens: ["Tudo que o sistema oferece", "Personalização: ajustamos o sistema à sua necessidade", "www.suaclinica.com.br", "5 usuários inclusos"] },
] as const;

function numeroPreco(valor:string){ return Number(String(valor || "").replace(/[^0-9,.-]/g,"").replace(".","").replace(",", ".")) || 0; }
function ehPlanoGratis(plano:any){
  const nome = String(plano?.nome || "").toLowerCase();
  const preco = String(plano?.preco || plano?.preco_mensal || "").toLowerCase();
  return nome.includes("teste grátis") || nome.includes("teste gratis") || nome.includes("grátis") || nome.includes("gratis") || preco.includes("grátis") || preco.includes("gratis") || numeroPreco(preco) === 0;
}
function Planos() {
  const [planos, setPlanos] = useState<any[]>([...PLANOS_PADRAO]);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const { data } = await (supabase as any)
          .from("oricse_planos")
          .select("codigo,nome,descricao,preco,preco_mensal,preco_anual,itens,ativo,ordem")
          .eq("ativo", true)
          .order("ordem");
        if (ativo && Array.isArray(data) && data.length) setPlanos(data);
      } catch {
        // Mantém os planos padrão se a consulta estiver indisponível.
      }
    })();
    return () => { ativo = false; };
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-[1600px]">
        <Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary">
          <ArrowLeft size={18} /> Voltar
        </Link>

        <header className="mx-auto mt-8 max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Oricse</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Escolha o plano ideal para sua clínica</h1>
          <p className="mt-3 text-muted-foreground">Organize atendimento, internação, prontuários, financeiro e estoque em um só sistema.</p>
        </header>

        <section className="mt-10 grid gap-5 lg:grid-cols-4">
          {planos.map((plano) => {
            const gratis = ehPlanoGratis(plano);
            const mensal = String(plano.preco_mensal || plano.preco || "");
            const anual = String(plano.preco_anual || "");
            const nome = String(plano.nome || "");
            const nomeMin = nome.toLowerCase();
            const codigo = plano.codigo || (gratis ? "teste-gratis" : nomeMin);
            const selo = nomeMin.includes("plus") ? "Mais vendido" : nomeMin.includes("master") ? "Recomendado" : "";

            return (
              <article key={codigo} className={"relative flex h-full flex-col rounded-3xl border bg-card p-6 shadow-sm " + (nomeMin.includes("plus") ? "border-primary shadow-lg ring-2 ring-primary/20" : "")}>
                {selo && <span className={"absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-bold " + (nomeMin.includes("plus") ? "bg-primary text-primary-foreground" : "bg-slate-800 text-white")}>{selo}</span>}
                <h2 className="text-2xl font-bold">{nome}</h2>
                <p className="mt-2 min-h-[120px] text-sm text-muted-foreground">{plano.descricao}</p>

                <div className="mt-6 min-h-32">
                  {gratis ? (
                    <p className="text-3xl font-bold">{plano.preco || mensal || "Grátis por 7 dias"}</p>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mensal</span>
                        <p className="text-3xl font-bold">{mensal}<span className="text-sm font-normal text-muted-foreground"> / mês</span></p>
                      </div>
                      {anual && <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Anual</span>
                        <p className="text-xl font-bold">{anual}<span className="text-sm font-normal text-muted-foreground"> / ano</span></p>
                      </div>}
                    </div>
                  )}
                </div>

                <a href={"/contratar?plano=" + encodeURIComponent(codigo) + "&ciclo=mensal"} className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90">
                  Contratar
                </a>

                <ul className="mt-6 space-y-3">
                  {(plano.itens || []).map((item: string) => <li key={item} className="text-sm">{item}</li>)}
                </ul>
              </article>
            );
          })}
        </section>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">Os planos e valores podem ser ajustados conforme a necessidade da clínica.</p>
      </div>
    </main>
  );
}
