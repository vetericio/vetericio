import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

type Box = { x:number; y:number; w:number; h:number; fontSize:number; fontWeight:number; color:string; align:"left"|"center"|"right"; z:number };
type CanvasElement = { id:string; kind:"logo"|"title"|"subtitle"|"text"|"cards"; text?:string; desktop:Box; mobile:Box };

function Planos() {
  const [planos, setPlanos] = useState<any[]>(PLANOS_PADRAO);
  const [site, setSite] = useState<any>(SITE_PADRAO);
  const [canvas, setCanvas] = useState<CanvasElement[] | null>(null);
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");
  const [largura, setLargura] = useState(() => typeof window === "undefined" ? 1920 : window.innerWidth);

  useEffect(() => {
    const onResize = () => setLargura(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    void (async () => {
      const [p, cfg, canvasCfg] = await Promise.all([
        (supabase as any).from("oricse_planos").select("codigo,nome,publico_alvo,preco,preco_mensal,preco_anual,cobranca_mensal,cobranca_anual,descricao,itens,ordem").eq("ativo", true).order("ordem"),
        (supabase as any).from("oricse_config").select("valor").eq("chave", "site_publico").maybeSingle(),
        (supabase as any).from("oricse_config").select("valor").eq("chave", "planos_canvas").maybeSingle(),
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
      if (!canvasCfg.error && Array.isArray(canvasCfg.data?.valor?.elements)) setCanvas(canvasCfg.data.valor.elements);
    })();
  }, []);

  const temPlanoMensal = planos.some((plano) => plano.codigo !== "teste-gratis" && plano.cobranca_mensal !== false);
  const temPlanoAnual = planos.some((plano) => plano.codigo !== "teste-gratis" && Boolean(plano.cobranca_anual));
  const mostrarSeletor = temPlanoMensal && temPlanoAnual;
  const device = largura < 640 ? "mobile" : "desktop";
  const canvasWidth = device === "mobile" ? 390 : 1920;
  const canvasHeight = device === "mobile" ? 2200 : 1400;
  const scale = Math.min(1, Math.max(0.1, (largura - (device === "mobile" ? 0 : 16)) / canvasWidth));
  const ordenados = useMemo(() => canvas ? [...canvas].sort((a,b) => a[device].z - b[device].z) : [], [canvas, device]);

  const cards = (compacto = false) => <>
    {mostrarSeletor && <div className="mb-6 flex justify-center"><div className="inline-flex rounded-2xl border bg-card p-1 shadow-sm">
      <button type="button" onClick={() => setCiclo("mensal")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${ciclo === "mensal" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{site.rotulo_mensal}</button>
      <button type="button" onClick={() => setCiclo("anual")} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${ciclo === "anual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{site.rotulo_anual}</button>
    </div></div>}
    <div className={`grid h-full items-stretch gap-5 ${compacto ? "grid-cols-1" : "grid-cols-4"}`}>
      {planos.map((plano) => {
        const ehTesteGratis = plano.codigo === "teste-gratis";
        const mensal = plano.cobranca_mensal !== false;
        const anual = Boolean(plano.cobranca_anual);
        const usandoAnual = !ehTesteGratis && anual && (!mensal || ciclo === "anual");
        const cicloEscolhido = usandoAnual ? "anual" : "mensal";
        const precoExibido = ehTesteGratis ? "Grátis por 7 dias" : usandoAnual ? plano.preco_anual : (plano.preco_mensal || plano.preco);
        const rotuloCobranca = ehTesteGratis ? "Teste gratuito · 1 vez por CPF/CNPJ" : usandoAnual ? site.texto_pagamento_anual : (mensal ? site.texto_pagamento_mensal : "");
        const destacado = plano.maisVendido || plano.recomendado;
        return <article key={plano.codigo || plano.nome} className={`relative flex h-full min-h-0 flex-col rounded-3xl border bg-card p-6 shadow-sm ${destacado ? "border-primary shadow-lg ring-2 ring-primary/20" : ""}`}>
          {plano.maisVendido && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground shadow-sm">{site.selo_mais_vendido}</span>}
          {plano.recomendado && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground shadow-sm">{site.selo_recomendado}</span>}
          <div className="grid min-h-[120px] content-start grid-rows-[auto_auto_1fr]"><h2 className="text-2xl font-bold">{plano.nome}</h2><p className="mt-1 text-sm font-semibold text-primary">{plano.publico_alvo}</p><p className="mt-2 text-sm text-muted-foreground">{plano.descricao}</p></div>
          <div className="mt-5"><p className="text-3xl font-bold leading-tight">{precoExibido}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{rotuloCobranca || "\u00a0"}</p></div>
          <button type="button" onClick={() => { window.location.href = `/contratar?plano=${encodeURIComponent(plano.codigo || plano.nome)}&ciclo=${cicloEscolhido}`; }} className="mt-5 min-h-11 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90">{ehTesteGratis ? "Começar 7 dias grátis" : site.cta_plano}</button>
          <ul className="mt-5 space-y-2 overflow-auto">{plano.itens.map((item: string) => <li key={item} className="text-sm">{item}</li>)}</ul>
        </article>;
      })}
    </div>
  </>;

  if (canvas?.length) {
    return <main className="min-h-screen overflow-hidden bg-[#f6f4ef]">
      <div className="relative z-20 px-4 pt-3"><Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/80 px-3 text-sm font-semibold text-muted-foreground shadow-sm backdrop-blur hover:bg-white"><ArrowLeft size={18}/> Voltar</Link></div>
      <div className="mx-auto overflow-hidden" style={{ width: canvasWidth * scale, height: canvasHeight * scale }}>
        <div className="relative origin-top-left bg-[#f6f4ef]" style={{ width:canvasWidth, height:canvasHeight, transform:`scale(${scale})` }}>
          {ordenados.map((el) => {
            const b = el[device];
            const style: React.CSSProperties = { position:"absolute", left:b.x, top:b.y, width:b.w, height:b.h, zIndex:b.z, boxSizing:"border-box" };
            if (el.kind === "logo") return <div key={el.id} style={style}><img src={site.logo_url || "/oricse-logo.png"} alt={site.marca || "Oricse"} className="h-full w-full object-contain"/></div>;
            if (el.kind === "cards") return <section key={el.id} style={style} className="flex min-h-0 flex-col">{cards(device === "mobile")}</section>;
            return <div key={el.id} style={{...style,fontSize:b.fontSize,fontWeight:b.fontWeight,color:b.color,textAlign:b.align,lineHeight:1.15,whiteSpace:"pre-wrap",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:b.align === "left" ? "flex-start" : b.align === "right" ? "flex-end" : "center"}}>{el.text}</div>;
          })}
        </div>
      </div>
      {(site.contato || site.rodape_planos) && <footer className="px-4 pb-8 text-center text-xs text-muted-foreground">{site.contato && <p>Contato: {site.contato}</p>}<p className="mt-2">{site.rodape_planos}</p></footer>}
    </main>;
  }

  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
    <div className="mx-auto w-full max-w-7xl">
      <Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary"><ArrowLeft size={18}/> Voltar</Link>
      <header className="mx-auto mt-5 max-w-3xl text-center"><img src={site.logo_url || "/oricse-logo.png"} alt={site.marca || "Oricse"} className="mx-auto h-auto w-full max-w-[280px] object-contain sm:max-w-[330px]"/><h1 className="mt-3 text-4xl font-bold tracking-tight">{site.titulo_planos}</h1><p className="mt-3 text-muted-foreground">{site.subtitulo_planos}</p></header>
      <section className="mt-10">{cards(false)}</section>
      {site.contato && <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">Contato: {site.contato}</p>}
      <p className="mx-auto mt-3 max-w-2xl text-center text-xs text-muted-foreground">{site.rodape_planos}</p>
    </div>
  </main>;
}
