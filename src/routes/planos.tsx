import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Tag } from "lucide-react";

export const Route = createFileRoute("/planos")({ component: Planos });

export const PLANOS_PADRAO = [
  { nome: "Essencial", descricao: "Bom para veterinários que atendem em domicílio", preco: "R$ 49,90", itens: ["Cadastro de animais e tutores", "Anamnese e prontuários", "Receituário e PDFs clínicos"] },
  { nome: "Plus (Clínica)", descricao: "Bom para petshops e clínicas", preco: "R$ 99,90", destaque: true, itens: ["Logo da sua clínica", "3 usuários inclusos", "Consultório e recepção", "Financeiro e caixa", "Serviços e estoque"] },
  { nome: "Master (Equipe)", descricao: "Para equipes e clínicas que precisam de um sistema sob medida", preco: "R$ 199,90", itens: ["Tudo que o sistema oferece", "Personalização: ajustamos o sistema à sua necessidade", "www.suaclinica.com.br", "5 usuários inclusos"] },
] as const;

type Cupom = { codigo:string; tipo:"percentual"|"fixo"; valor:number; planos:string[]; inicio?:string; validade?:string; limite?:number; usos?:number; recorrencia:"unico"|"periodo"|"continuo"; ativo:boolean };
function numeroPreco(valor:string){ return Number(valor.replace(/[^0-9,.-]/g,"").replace(".","").replace(",", ".")) || 0; }
function brl(valor:number){ return valor.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function Planos() {
  const [cupom, setCupom] = useState("");
  const [cupomAtivo, setCupomAtivo] = useState<Cupom|null>(null);
  const [mensagemCupom, setMensagemCupom] = useState("");
  const [planos, setPlanos] = useState<typeof PLANOS_PADRAO>(PLANOS_PADRAO);
  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem("vetericio-planos");
      if (salvo) setPlanos(JSON.parse(salvo));
    } catch { /* usa os planos padrão */ }
  }, []);
  function validarCupom(){
    const codigo=cupom.trim().toUpperCase();
    const lista: Cupom[]=JSON.parse(window.localStorage.getItem("vetericio-cupons") || "[]");
    const hoje=new Date().toISOString().slice(0,10);
    const encontrado=lista.find(c=>c.ativo && c.codigo.toUpperCase()===codigo && (!c.inicio || hoje>=c.inicio) && (!c.validade || hoje<=c.validade) && (!c.limite || (c.usos||0)<c.limite));
    if(!encontrado){ setCupomAtivo(null); setMensagemCupom("Código inválido, expirado ou indisponível."); return; }
    setCupomAtivo(encontrado); setMensagemCupom("Cupom aplicado com sucesso.");
  }
  function preco(plano:any){ if(!cupomAtivo || (cupomAtivo.planos.length && !cupomAtivo.planos.includes(plano.nome))) return null; const base=numeroPreco(plano.preco); return Math.max(0,cupomAtivo.tipo==="percentual"?base*(1-cupomAtivo.valor/100):base-cupomAtivo.valor); }
  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6"><div className="mx-auto w-full max-w-6xl"><Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary"><ArrowLeft size={18} /> Voltar</Link><header className="mx-auto mt-8 max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Veterício</p><h1 className="mt-3 text-4xl font-bold tracking-tight">Escolha o plano ideal para sua clínica</h1><p className="mt-3 text-muted-foreground">Organize atendimento, internação, prontuários, financeiro e estoque em um só sistema.</p></header><section className="mx-auto mt-8 max-w-xl rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-center gap-2 font-bold"><Tag size={18}/> Código de desconto</div><div className="mt-3 flex gap-2"><input value={cupom} onChange={e=>setCupom(e.target.value)} placeholder="Digite seu código" className="min-h-11 flex-1 rounded-xl border bg-background px-3 uppercase"/><button type="button" onClick={validarCupom} className="rounded-xl bg-primary px-4 font-semibold text-primary-foreground">Aplicar</button></div>{mensagemCupom && <p className={`mt-2 text-sm ${cupomAtivo?"text-emerald-700":"text-destructive"}`}>{mensagemCupom}</p>}</section><section className="mt-10 grid gap-5 lg:grid-cols-3">{planos.map((plano) => <article key={plano.nome} className={`relative rounded-3xl border bg-card p-6 shadow-sm ${plano.destaque ? "border-primary shadow-lg ring-2 ring-primary/20" : ""}`}>{plano.destaque && <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Mais escolhido</span>}<h2 className="text-2xl font-bold">{plano.nome}</h2><p className="mt-2 min-h-10 text-sm text-muted-foreground">{plano.descricao}</p><p className="mt-6 text-3xl font-bold">{preco(plano) !== null && <span className="mr-2 text-base text-muted-foreground line-through">{plano.preco}</span>}{preco(plano) !== null ? brl(preco(plano) as number) : plano.preco}<span className="text-sm font-normal text-muted-foreground"> / mês</span></p><button type="button" className="mt-6 min-h-11 w-full rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90">Escolher plano</button><ul className="mt-6 space-y-3">{plano.itens.map((item) => <li key={item} className="flex items-start gap-2 text-sm"><Check size={18} className="mt-0.5 shrink-0 text-primary" />{item}</li>)}</ul></article>)}</section><p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">Os planos e valores podem ser ajustados conforme a necessidade da clínica.</p></div></main>;
}
