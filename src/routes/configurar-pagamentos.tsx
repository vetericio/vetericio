import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
export const Route=createFileRoute("/configurar-pagamentos")({component:ConfigurarPagamentos});
type Taxa={clinica_id:string|null;modalidade:string;mp_percentual:number;mp_fixo_centavos:number;oricse_percentual:number};
const modalidades=["pix","cartao","boleto"] as const;
function ConfigurarPagamentos(){
 const [admin,setAdmin]=useState(false),[carregando,setCarregando]=useState(true);
 const [clinicas,setClinicas]=useState<{id:string;nome:string}[]>([]);
 const [clinica,setClinica]=useState(""),[modalidade,setModalidade]=useState<string>("pix");
 const [taxas,setTaxas]=useState<Taxa[]>([]),[mp,setMp]=useState("0"),[fixo,setFixo]=useState("0"),[oricse,setOricse]=useState("0"),[salvando,setSalvando]=useState(false);
 async function carregar(){
  try{
   const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Faça login.");
   const {data:perfil,error:err}=await (supabase as any).from("app_users").select("role").eq("user_id",user.id).maybeSingle();
   if(err)throw err;if(perfil?.role!=="admin")throw new Error("Acesso exclusivo ao Admin ORICSE.");
   setAdmin(true);
   const [t,c]=await Promise.all([(supabase as any).rpc("oricse_listar_taxas_pagamento"),(supabase as any).from("clinicas").select("id,nome").order("nome")]);
   if(t.error)throw t.error;if(c.error)throw c.error;
   setTaxas(t.data||[]);setClinicas(c.data||[]);
  }catch(e){toast.error(e instanceof Error?e.message:"Falha ao carregar taxas");}finally{setCarregando(false);}
 }
 useEffect(()=>{void carregar()},[]);
 useEffect(()=>{const t=taxas.find(t=>t.clinica_id===(clinica||null)&&t.modalidade===modalidade);setMp(String(t?.mp_percentual??0));setFixo(String((t?.mp_fixo_centavos??0)/100).replace(".",","));setOricse(String(t?.oricse_percentual??0));},[clinica,modalidade,taxas]);
 async function salvar(){
  const dec=(v:string)=>Number(v.replace(",","."));
  const m=dec(mp),o=dec(oricse),f=Math.round(dec(fixo)*100);
  if(![m,o,f].every(Number.isFinite)||m<0||m>=100||o<0||o>=100||f<0){toast.error("Confira as tarifas.");return}
  setSalvando(true);
  const {error}=await (supabase as any).rpc("oricse_configurar_taxa_pagamento",{p_clinica_id:clinica||null,p_modalidade:modalidade,p_mp_percentual:m,p_mp_fixo_centavos:f,p_oricse_percentual:o});
  setSalvando(false);if(error){toast.error(error.message);return;}toast.success("Configuração salva.");await carregar();
 }
 if(carregando)return <main className="p-6 text-foreground">Carregando configurações…</main>;
 if(!admin)return <main className="p-6 text-foreground">Área restrita à administração do ORICSE.</main>;
 return <main className="mx-auto max-w-3xl space-y-5 p-5 text-foreground">
  <header><h1 className="text-2xl font-bold">Taxas e pagamentos</h1><p className="text-sm text-muted-foreground">Defina percentuais gerais ou específicos por clínica e por forma de pagamento.</p></header>
  <section className="rounded-2xl border bg-card p-5 space-y-4">
   <label className="block text-sm font-semibold">Escopo<select value={clinica} onChange={e=>setClinica(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground"><option value="">Padrão para todas as clínicas</option>{clinicas.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
   <label className="block text-sm font-semibold">Forma de pagamento<select value={modalidade} onChange={e=>setModalidade(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground">{modalidades.map(m=><option key={m} value={m}>{m.toUpperCase()}</option>)}</select></label>
   <div className="grid gap-3 sm:grid-cols-3">{[["Mercado Pago (%)",mp,setMp],["Mercado Pago fixo (R$)",fixo,setFixo],["ORICSE (%)",oricse,setOricse]].map(([label,val,set]:any)=><label key={label} className="text-sm font-semibold">{label}<input value={val} onChange={e=>set(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border bg-background p-3 text-foreground"/></label>)}</div>
   <p className="text-xs text-muted-foreground">Os percentuais são estimativas administrativas e não substituem a tarifa confirmada pelo Mercado Pago.</p>
   <button disabled={salvando} onClick={()=>void salvar()} className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50">{salvando?"Salvando…":"Salvar tarifas"}</button>
  </section><Link to="/simulador-pagamentos" className="text-sm font-semibold text-primary underline">Abrir simulador</Link>
  <p className="text-xs text-muted-foreground">Nenhuma cobrança é disparada por esta tela. Conexão OAuth, webhooks e liquidação são etapas separadas.</p>
 </main>
}
