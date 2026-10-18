import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";
import type { ModoCobranca } from "@/lib/payment-split";
export const Route=createFileRoute("/precos-portal")({component:PrecosPortal});
type Preco={id:string;titulo:string;modo:ModoCobranca;valor_centavos:number;ativo:boolean;area:"consulta"|"portal"|"outros"};
function PrecosPortal(){
 const [area,setArea]=useState<"consulta"|"portal"|"outros">("consulta");
 const [meio,setMeio]=useState("pix");
 const [previa,setPrevia]=useState<{cobrado_tutor_centavos:number;liquido_clinica_centavos:number;desconto_mp_centavos:number;comissao_oricse_centavos:number}|null>(null);
 const [erroPrevia,setErroPrevia]=useState("");
 const [lista,setLista]=useState<Preco[]>([]),[nome,setNome]=useState("Consulta"),[modo,setModo]=useState<ModoCobranca>("receber"),[valor,setValor]=useState("50,00"),[editando,setEditando]=useState<string|null>(null),[salvando,setSalvando]=useState(false),[erro,setErro]=useState("");
 async function carregar(){const {data,error}=await (supabaseBanco as any).rpc("oricse_listar_precos_portal");if(error){setErro(error.message);return;}setErro("");setLista(data||[]);}
 useEffect(()=>{void carregar()},[]);
 useEffect(()=>{let ativo=true;setPrevia(null);setErroPrevia("");const cents=Math.round(Number(valor.replace(",","."))*100);if(!Number.isInteger(cents)||cents<=0)return;const timer=setTimeout(async()=>{const {data,error}=await (supabaseBanco as any).rpc("oricse_previsualizar_cobranca",{p_modo:modo,p_valor_centavos:cents,p_modalidade:meio});if(!ativo)return;if(error)setErroPrevia("Prévia indisponível: tarifas pendentes de configuração.");else setPrevia(data?.[0]||null);},350);return()=>{ativo=false;clearTimeout(timer)};},[modo,valor,meio]);
 function editar(x:Preco){setEditando(x.id);setNome(x.titulo);setModo(x.modo);setValor((x.valor_centavos/100).toFixed(2).replace(".",","));setArea(x.area||"portal");}
 async function salvar(){const c=Math.round(Number(valor.replace(",","."))*100);if(!nome.trim()||!Number.isSafeInteger(c)||c<=0){toast.error("Informe serviço e preço válido.");return;}setSalvando(true);
 const {error}=await (supabaseBanco as any).rpc("oricse_salvar_preco_portal",{p_id:editando,p_titulo:nome,p_modo:modo,p_valor_centavos:c,p_area:area});
 setSalvando(false);if(error){toast.error(error.message);return;}toast.success("Preço salvo.");setEditando(null);setNome("");setValor("50,00");await carregar();}
 return <main className="mx-auto max-w-3xl space-y-5 p-5 text-foreground"><header><h1 className="text-2xl font-bold">Cobranças da clínica</h1><p className="text-sm text-muted-foreground">Configure cada cobrança de consulta ou Portal do Tutor. Escolha quanto deseja cobrar do tutor ou receber líquido.</p></header>
 <nav className="grid gap-2 sm:grid-cols-3">{([["consulta","Consultas"],["portal","Portal do Tutor"],["outros","Outras cobranças"]] as const).map(([id,rotulo])=><button key={id} type="button" onClick={()=>setArea(id)} aria-pressed={area===id} className={`rounded-xl border p-3 font-semibold ${area===id?"border-primary bg-secondary":"bg-card"}`}>{rotulo}</button>)}</nav><section className="rounded-xl border bg-card p-5 space-y-4">
 <label className="block text-sm font-semibold">Serviço ou descrição da cobrança<input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex.: Consulta" className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground"/></label>
 <div className="grid gap-3 sm:grid-cols-2">{(["receber","cobrar"] as const).map(m=><button key={m} onClick={()=>setModo(m)} aria-pressed={modo===m} className={`rounded-lg border p-3 font-semibold ${modo===m?"border-primary bg-secondary":"border-border"}`}>{m==="receber"?"Quero receber (valor líquido)":"Quero cobrar (valor do tutor)"}</button>)}</div>
 <label className="block text-sm font-semibold">{modo==="receber"?"Valor que quero receber (R$)":"Valor que quero cobrar (R$)"}<input value={valor} onChange={e=>setValor(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground"/></label>
 <label className="block text-sm font-semibold">Forma de pagamento para estimativa<select className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground" value={meio} onChange={e=>setMeio(e.target.value)}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option></select></label>
 {previa?<div className="rounded-xl bg-secondary/60 p-4 space-y-2"><div className="flex justify-between"><span>Tutor pagará</span><strong>{(previa.cobrado_tutor_centavos/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></div><div className="flex justify-between"><span>Clínica receberá (estimativa)</span><strong>{(previa.liquido_clinica_centavos/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></div><p className="text-xs text-muted-foreground">Descontos estimados incluídos automaticamente.</p></div>:<p className="text-sm text-muted-foreground">{erroPrevia||"Calculando valores de cobrança…"}</p>}
 <button onClick={()=>void salvar()} disabled={salvando} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{salvando?"Salvando…":editando?"Atualizar preço":"Cadastrar preço"}</button>
 </section>{erro&&<p role="alert" className="text-destructive">{erro}</p>}
 <section className="rounded-xl border bg-card p-5"><h2 className="font-bold">Cobranças cadastradas nesta área</h2><div className="mt-3 space-y-2">{lista.filter(x=>(x.area||"portal")===area).map(x=><div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><strong>{x.titulo}</strong><p className="text-xs text-muted-foreground">{x.modo==="receber"?"Receber líquido":"Cobrar do tutor"} · {(x.valor_centavos/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p></div><button onClick={()=>editar(x)} className="rounded-lg border px-3 py-2 text-sm">Editar</button></div>)}{!lista.length&&<p className="text-sm text-muted-foreground">Nenhum preço cadastrado.</p>}</div></section>
 
 <p className="text-xs text-muted-foreground">Os serviços ainda não geram cobranças automáticas no portal. A ativação depende de OAuth e conciliação.</p></main>;
}
