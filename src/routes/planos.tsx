import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/planos")({ component: Planos });

export const PLANOS_PADRAO = [
  { codigo: "essencial", nome: "Essencial", publico_alvo: "Veterinários que atendem em domicílio", descricao: "Bom para veterinários que atendem em domicílio", preco: "R$ 0,00", preco_mensal: "R$ 0,00", preco_anual: "", cobranca_mensal: true, cobranca_anual: false, itens: ["Cadastro de animais e tutores", "Anamnese e prontuários", "Receituário e PDFs clínicos"] },
  { codigo: "plus", nome: "Plus (Clínica)", publico_alvo: "Petshops e clínicas", descricao: "Bom para petshops e clínicas", preco: "R$ 0,00", preco_mensal: "R$ 0,00", preco_anual: "", cobranca_mensal: true, cobranca_anual: false, destaque: true, itens: ["Logo da sua clínica", "3 usuários inclusos", "Consultório e recepção", "Financeiro e caixa", "Serviços e estoque"] },
  { codigo: "master", nome: "Master (Equipe)", publico_alvo: "Equipes e clínicas", descricao: "Para equipes e clínicas que precisam de um sistema sob medida", preco: "R$ 49,90 taxa única", preco_mensal: "R$ 49,90 taxa única", preco_anual: "", cobranca_mensal: true, cobranca_anual: false, itens: ["Tudo que o sistema oferece", "Personalização: ajustamos o sistema à sua necessidade", "www.suaclinica.com.br", "5 usuários inclusos"] },
];

const SITE_PADRAO = {
  marca: "Oricse",
  titulo_planos: "Escolha o plano ideal para sua clínica",
  subtitulo_planos: "Organize atendimento, internação, prontuários, financeiro e estoque em um só sistema.",
  cta_plano: "Escolher plano",
  contato: "",
  logo_url: "",
};

function Planos() {
  const [planos, setPlanos] = useState<any[]>(PLANOS_PADRAO);
  const [site, setSite] = useState(SITE_PADRAO);
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");

  useEffect(() => {
    void (async () => {
      const [p, cfg] = await Promise.all([
        (supabase as any).from("oricse_planos").select("codigo,nome,publico_alvo,preco,preco_mensal,preco_anual,cobranca_mensal,cobranca_anual,descricao,itens,ordem").eq("ativo", true).order("ordem"),
        (supabase as any).from("oricse_config").select("valor").eq("chave", "site_publico").maybeSingle(),
      ]);
      if (!p.error && p.data?.length) {
        setPlanos(p.data.map((x: any) => ({
          ...x,
          destaque: x.codigo === "plus",
          itens: Array.isArray(x.itens) ? x.itens : [],
          cobranca_mensal: x.cobranca_mensal !== false,
          cobranca_anual: Boolean(x.cobranca_anual),
          preco_mensal: x.preco_mensal || x.preco || "",
          preco_anual: x.preco_anual || "",
        })));
      }
      if (!cfg.error && cfg.data?.valor) setSite({ ...SITE_PADRAO, ...cfg.data.valor });
    })();
  }, []);

  const temPlanoMensal = planos.some((plano) => plano.cobranca_mensal !== false);
  const temPlanoAnual = planos.some((plano) => Boolean(plano.cobranca_anual));
  const mostrarSeletor = temPlanoMensal && temPlanoAnual;

  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6"><div className="mx-auto w-full max-w-6xl"><Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary"><ArrowLeft size={18}/> Voltar</Link><header className="mx-auto mt-8 max-w-2xl text-center"><img src={site.logo_url || "/oricse-logo.png"} alt={site.marca || "Oricse"} className="mx-auto max-h-40 max-w-[320px] object-contain"/><p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">{site.marca}</p><h1 className="mt-3 text-4xl font-bold tracking-tight">{site.titulo_planos}</h1><p className="mt-3 text-muted-foreground">{site.subtitulo_planos}</p>{mostrarSeletor && <div className="mx-auto mt-6 inline-flex rounded-2xl border bg-card p-1 shadow-sm"><button type="button" onClick={() => setCiclo("mensal")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${ciclo === "mensal" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Mensal</button><button type="button" onClick={() => setCiclo("anual")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${ciclo === "anual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Anual</button></div>}</header><section className="mt-10 grid gap-5 lg:grid-cols-3">{planos.map((plano) => { const mensal = plano.cobranca_mensal !== false; const anual = Boolean(plano.cobranca_anual); const usandoAnual = anual && (!mensal || ciclo === "anual"); const precoExibido = usandoAnual ? plano.preco_anual : (plano.preco_mensal || plano.preco); const rotuloCobranca = usandoAnual ? "Pagamento anual" : (mensal ? "Pagamento mensal" : ""); return <article key={plano.codigo || plano.nome} className={`relative rounded-3xl border bg-card p-6 shadow-sm ${plano.destaque ? "border-primary shadow-lg ring-2 ring-primary/20" : ""}`}>{plano.destaque && <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Mais escolhido</span>}<h2 className="text-2xl font-bold">{plano.nome}</h2><p className="mt-1 text-sm font-semibold text-primary">{plano.publico_alvo}</p><p className="mt-2 min-h-10 text-sm text-muted-foreground">{plano.descricao}</p><p className="mt-6 text-3xl font-bold">{precoExibido}</p>{rotuloCobranca && <p className="mt-1 text-xs font-semibold text-muted-foreground">{rotuloCobranca}</p>}<button type="button" className="mt-6 min-h-11 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90">{site.cta_plano}</button><ul className="mt-6 space-y-3">{plano.itens.map((item: string) => <li key={item} className="text-sm">{item}</li>)}</ul></article>; })}</section>{site.contato && <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">Contato: {site.contato}</p>}<p className="mx-auto mt-3 max-w-2xl text-center text-xs text-muted-foreground">Os planos e condições podem ser ajustados conforme a necessidade da clínica.</p></div></main>;
}
