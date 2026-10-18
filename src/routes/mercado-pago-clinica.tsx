import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
export const Route=createFileRoute("/mercado-pago-clinica")({component:MercadoPagoClinica});
const endpoint="https://mwrmfcyrdxfxssebgknz.supabase.co/functions/v1/oricse-mercadopago-oauth";
function MercadoPagoClinica(){
 const [clinica,setClinica]=useState(""),[nome,setNome]=useState(""),[papel,setPapel]=useState(""),[connected,setConnected]=useState(false),[collector,setCollector]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 async function request(action:string,clinic:string){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)throw new Error("Entre novamente na sua conta.");
  const res=await fetch(endpoint+"?action="+action,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token,"apikey":import.meta.env.VITE_SUPABASE_ANON_KEY||""},body:JSON.stringify({clinica_id:clinic})});
  const data=await res.json();if(!res.ok)throw new Error(data.error||"Falha na conexão");return data;
 }
 useEffect(()=>{void(async()=>{try{
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("É necessário entrar na sua conta.");
  const {data,error}=await (supabase as any).from("clinica_usuarios").select("clinica_id,papel,clinicas(nome)").eq("user_id",user.id).eq("ativo",true).limit(1).maybeSingle();
  if(error||!data)throw new Error("Nenhuma clínica ativa associada à sua conta.");
  setClinica(data.clinica_id);setPapel(data.papel);setNome(data.clinicas?.nome||"Minha clínica");
  const status=await request("status",data.clinica_id);setConnected(Boolean(status.connected));setCollector(status.collector_id||"");
 }catch(err){toast.error(err instanceof Error?err.message:"Não foi possível carregar a conexão");}finally{setLoading(false)}})()},[]);
 async function conectar(){setBusy(true);try{const data=await request("start",clinica);if(!data.authorization_url)throw new Error("Autorização indisponível");window.location.assign(data.authorization_url);}catch(err){toast.error(err instanceof Error?err.message:"Falha ao conectar");setBusy(false);}}
 const allowed=["rt","admin","gestor"].includes(papel);
 const retorno=new URLSearchParams(typeof window==="undefined"?"":window.location.search).get("mp");
 return <main className="mx-auto max-w-3xl space-y-5 p-5 text-foreground"><header><h1 className="text-2xl font-black">Mercado Pago da clínica</h1><p className="text-sm text-muted-foreground">Administração → Configurações → Mercado Pago</p></header>
 {retorno==="conectado"&&<p role="status" className="rounded-xl border bg-secondary p-3 font-semibold">Conta Mercado Pago conectada à clínica com sucesso.</p>}
 {retorno==="erro"&&<p role="alert" className="rounded-xl border p-3 text-destructive">A conexão não foi concluída. Tente novamente ou fale com o suporte.</p>}
 <section className="rounded-2xl border bg-card p-5 space-y-4">
 <div><p className="text-sm text-muted-foreground">Clínica</p><h2 className="text-xl font-bold">{nome||"Carregando..."}</h2></div>
 <div className="rounded-xl bg-secondary/50 p-4"><p className="font-semibold">{loading?"Verificando conexão…":connected?"Conta conectada":"Conta não conectada"}</p><p className="text-sm text-muted-foreground">{connected?"Conta Mercado Pago vinculada exclusivamente a esta clínica. ID: "+collector:"Conecte sua própria conta para preparar os recebimentos no Portal do Tutor."}</p></div>
 <button disabled={loading||busy||!clinica||!allowed} onClick={()=>void conectar()} className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50">{busy?"Abrindo autorização…":connected?"Reconectar Mercado Pago":"Conectar minha conta Mercado Pago"}</button>
 {!allowed&&<p className="text-sm text-muted-foreground">Somente o responsável autorizado pela clínica pode conectar a conta.</p>}
 <p className="text-xs text-muted-foreground">A autorização ocorre no site do Mercado Pago. O ORICSE não solicita sua senha. Pagamentos reais continuam desativados até homologação.</p></section>
 <Link to="/precos-portal" className="text-sm font-semibold underline text-primary">Ir para cobranças da clínica</Link></main>;
}