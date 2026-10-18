import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ModoCobranca } from "@/lib/payment-split";
export const Route=createFileRoute("/precos-portal")({component:PrecosPortal});
type Preco={id:string;titulo:string;modo:ModoCobranca;valor_centavos:number;ativo:boolean};
function PrecosPortal(){
 const [lista,setLista]=useState<Preco[]>([]),[nome,setNome]=useState("Consulta"),[modo,setModo]=useState<ModoCobranca>("receber"),[valor,setValor]=useState("50,00"),[editando,setEditando]=useState<string|null>(null),[salvando,setSalvando]=useState(false),[erro,setErro]=useState("");
 async function carregar(){const {data,error}=await (supabase as any).rpc("oricse_listar_precos_portal");if(error){setErro(error.message);return;}setErro("");setLista(data||[]);}
 useEffect(()=>{void carregar()},[]);
 function editar(x:Preco){setEditando(x.id);setNome(x.titulo);setModo(x.modo);setValor((x.valor_centavos/100).toFixed(2).replace(".",","));}
 async function salvar(){const c=Math.round(Number(valor.replace(",","."))*100);if(!nome.trim()||!Number.isSafeInteger(c)||c<=0){toast.error("Informe serviço e preço válido.");return;}setSalvando(true);
 const {error}=await (supabase as any).rpc("oricse_salvar_preco_portal",{p_id:editando,p_titulo:nome,p_modo:modo,p_valor_centavos:c});
 setSalvando(false);if(error){toast.error(error.message);return;}toast.success("Preço salvo.");setEditando(null);setNome("");setValor("50,00");await carregar();}
 return <main className="mx-auto max-w-3xl space-y-5 p-5 text-foreground"><header><h1 className="text-2xl font-bold">Preços do Portal do Tutor</h1><p className="text-sm text-muted-foreground">Defina serviços e escolha quanto deseja receber ou cobrar. Os valores são guardados por clínica no banco de dados.</p></header>
 <section className="rounded-xl border bg-card p-5 space-y-4">
 <label className="block text-sm font-semibold">Serviço<input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex.: Consulta" className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground"/></label>
 <div className="grid gap-3 sm:grid-cols-2">{(["receber","cobrar"] as const).map(m=><button key={m} onClick={()=>setModo(m)} aria-pressed={modo===m} className={`rounded-lg border p-3 font-semibold ${modo===m?"border-primary bg-secondary":"border-border"}`}>{m==="receber"?"Quero receber (líquido)":"Quero cobrar (total)"}</button>)}</div>
 <label className="block text-sm font-semibold">Valor em reais<input value={valor} onChange={e=>setValor(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground"/></label>
 <button onClick={()=>void salvar()} disabled={salvando} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{salvando?"Salvando…":editando?"Atualizar preço":"Cadastrar preço"}</button>
 </section>{erro&&<p role="alert" className="text-destructive">{erro}</p>}
 <section className="rounded-xl border bg-card p-5"><h2 className="font-bold">Serviços cadastrados</h2><div className="mt-3 space-y-2">{lista.map(x=><div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><strong>{x.titulo}</strong><p className="text-xs text-muted-foreground">{x.modo==="receber"?"Receber líquido":"Cobrar do tutor"} · {(x.valor_centavos/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p></div><button onClick={()=>editar(x)} className="rounded-lg border px-3 py-2 text-sm">Editar</button></div>)}{!lista.length&&<p className="text-sm text-muted-foreground">Nenhum preço cadastrado.</p>}</div></section>
 <Link to="/simulador-pagamentos" className="text-sm font-semibold text-primary underline">Simular desconto e repasse</Link>
 <p className="text-xs text-muted-foreground">Os serviços ainda não geram cobranças automáticas no portal. A ativação depende de OAuth e conciliação.</p></main>;
}
