import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/planos")({ component: Planos });

export const PLANOS_PADRAO = [
  { codigo: "essencial", nome: "Essencial", publico_alvo: "Veterinários que atendem em domicílio", descricao: "Bom para veterinários que atendem em domicílio", preco: "R$ 0,00", preco_mensal: "R$ 0,00", preco_anual: "", cobranca_mensal: true, cobranca_anual: false, itens: ["Cadastro de animais e tutores", "Anamnese e prontuários", "Receituário e PDFs clínicos"] },
  { codigo: "plus", nome: "Plus (Clínica)", publico_alvo: "Petshops e clínicas", descricao: "Bom para petshops e clínicas", preco: "R$ 0,00", preco_mensal: "R$ 0,00", preco_anual: "", cobranca_mensal: true, cobranca_anual: false, maisVendido: true, itens: ["Logo da sua clínica", "3 usuários inclusos", "Consultório e recepção", "Financeiro e caixa", "Serviços e estoque"] },
  { codigo: "master", nome: "Master (Equipe)", publico_alvo: "Equipes e clínicas", descricao: "Para equipes e clínicas que precisam de um sistema sob medida", preco: "R$ 49,90 taxa única", preco_mensal: "R$ 49,90 taxa única", preco_anual: "", cobranca_mensal: true, cobranca_anual: false, recomendado: true, itens: ["Tudo que o sistema oferece", "Personalização: ajustamos o sistema à sua necessidade", "www.suaclinica.com.br", "5 usuários inclusos"] },
];

const SITE_PADRAO = {
  marca: "Oricse",
  titulo_planos: "Escolha o plano ideal para sua clínica ou petshop.",
  subtitulo_planos: "Organize atendimento, internação, prontuários, financeiro e estoque em um só sistema.",
  cta_plano: "Escolher plano",
  contato: "",
  logo_url: "",
  selo_mais_vendido: "Mais vendido",
  selo_recomendado: "Recomendado",
  rotulo_mensal: "Mensal",
  rotulo_anual: "Anual",
  texto_pagamento_mensal: "Pagamento mensal",
  texto_pagamento_anual: "Pagamento anual",
  rodape_planos: "Os planos e condições podem ser ajustados conforme a necessidade da clínica.",
};

function Planos() {
  const [planos, setPlanos] = useState<any[]>(PLANOS_PADRAO);
  const [site, setSite] = useState<any>(SITE_PADRAO);
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
          maisVendido: x.codigo === "plus",
          recomendado: x.codigo === "master",
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

  const temPlanoMensal = planos.some((plano) => plano.codigo !== "teste-gratis" && plano.cobranca_mensal !== false);
  const temPlanoAnual = planos.some((plano) => plano.codigo !== "teste-gratis" && Boolean(plano.cobranca_anual));
  const mostrarSeletor = temPlanoMensal && temPlanoAnual;

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary"><ArrowLeft size={18}/> Voltar</Link>

        <header className="mx-auto mt-5 max-w-3xl text-center">
          <img src={site.logo_url || "/oricse-logo.png"} alt={site.marca || "Oricse"} className="mx-auto h-auto w-full max-w-[280px] object-contain sm:max-w-[330px]"/>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">{site.titulo_planos}</h1>
          <p className="mt-3 text-muted-foreground">{site.subtitulo_planos}</p>
          {mostrarSeletor && <div className="mx-auto mt-6 inline-flex rounded-2xl border bg-card p-1 shadow-sm">
            <button type="button" onClick={() => setCiclo("mensal")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${ciclo === "mensal" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{site.rotulo_mensal}</button>
            <button type="button" onClick={() => setCiclo("anual")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${ciclo === "anual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{site.rotulo_anual}</button>
          </div>}
        </header>

        <section className="mt-10 grid items-stretch gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {planos.map((plano) => {
            const ehTesteGratis = plano.codigo === "teste-gratis";
            const mensal = plano.cobranca_mensal !== false;
            const anual = Boolean(plano.cobranca_anual);
            const usandoAnual = !ehTesteGratis && anual && (!mensal || ciclo === "anual");
            const cicloEscolhido = usandoAnual ? "anual" : "mensal";
            const precoExibido = ehTesteGratis ? "Grátis por 7 dias" : usandoAnual ? plano.preco_anual : (plano.preco_mensal || plano.preco);
            const rotuloCobranca = ehTesteGratis ? "Teste gratuito · 1 vez por CPF/CNPJ" : usandoAnual ? site.texto_pagamento_anual : (mensal ? site.texto_pagamento_mensal : "");
            const destacado = plano.maisVendido || plano.recomendado;

            return <article key={plano.codigo || plano.nome} className={`relative flex h-full flex-col rounded-3xl border bg-card p-6 shadow-sm ${destacado ? "border-primary shadow-lg ring-2 ring-primary/20" : ""}`}>
              {plano.maisVendido && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground shadow-sm">{site.selo_mais_vendido}</span>}
              {plano.recomendado && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground shadow-sm">{site.selo_recomendado}</span>}
              <div className="grid min-h-[148px] content-start grid-rows-[auto_auto_1fr]"><h2 className="text-2xl font-bold">{plano.nome}</h2><p className="mt-1 text-sm font-semibold text-primary">{plano.publico_alvo}</p><p className="mt-2 text-sm text-muted-foreground">{plano.descricao}</p></div>
              <div className="mt-6 grid min-h-[74px] content-start grid-rows-[44px_20px]"><p className="self-start text-3xl font-bold leading-tight">{precoExibido}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{rotuloCobranca || "\u00a0"}</p></div>
              <button type="button" onClick={() => { window.location.href = `/contratar?plano=${encodeURIComponent(plano.codigo || plano.nome)}&ciclo=${cicloEscolhido}`; }} className="mt-5 min-h-11 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90">{ehTesteGratis ? "Começar 7 dias grátis" : site.cta_plano}</button>
              <ul className="mt-6 space-y-3">{plano.itens.map((item: string) => <li key={item} className="text-sm">{item}</li>)}</ul>
            </article>;
          })}
        </section>

        {site.contato && <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">Contato: {site.contato}</p>}
        <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-muted-foreground">{site.rodape_planos}</p>
      </div>
    </main>
  );
}
