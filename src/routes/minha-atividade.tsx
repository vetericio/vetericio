import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/minha-atividade")({ component: MinhaAtividade });

type Registro = {id:string;modalidade:"hora"|"diaria";data:string;estado:string;segundos_trabalhados:number;ultimo_inicio_em:string|null;valor_unitario:number};
function MinhaAtividade() {
  const [clinica,setClinica]=useState("");
  const [config,setConfig]=useState<{modalidade:"hora"|"diaria";valor_unitario:number}|null>(null);
  const [registros,setRegistros]=useState<Registro[]>([]);
  const [ocupado,setOcupado]=useState(false);
  const [carregando,setCarregando]=useState(true);
  const [agora,setAgora]=useState(Date.now());
  useEffect(()=>{const t=setInterval(()=>setAgora(Date.now()),1000);return()=>clearInterval(t)},[]);
  async function atualizar(id:string,userId:string) {
    const [c,r]=await Promise.all([
      (supabase as any).from("oricse_jornada_config").select("modalidade,valor_unitario").eq("clinica_id",id).eq("funcionario_id",userId).maybeSingle(),
      (supabase as any).from("oricse_jornada_registros").select("*").eq("clinica_id",id).eq("funcionario_id",userId).order("iniciado_em",{ascending:false}).limit(60)
    ]);
    if(c.error)toast.error(c.error.message);else setConfig(c.data);
    if(r.error)toast.error(r.error.message);else setRegistros(r.data||[]);
  }
  useEffect(()=>{let vivo=true;(async()=>{
    const {data}=await supabase.auth.getUser();if(!data.user)return setCarregando(false);
    const {data:v,error}=await supabase.from("clinica_usuarios").select("clinica_id").eq("user_id",data.user.id).eq("ativo",true).limit(1).maybeSingle();
    if(error)toast.error(error.message);
    if(v&&vivo){setClinica(v.clinica_id);await atualizar(v.clinica_id,data.user.id);}
    if(vivo)setCarregando(false);
  })();return()=>{vivo=false}},[]);
  const atual=registros.find(r=>r.estado==="ativa"||r.estado==="pausada");
  const hoje=new Date().toLocaleDateString("sv-SE",{timeZone:"America/Sao_Paulo"});
  const jaFezCheckin=registros.some(r=>r.modalidade==="diaria"&&r.data===hoje);
  const segundos=(r:Registro)=>Number(r.segundos_trabalhados||0)+(r.estado==="ativa"&&r.ultimo_inicio_em?Math.max(0,Math.floor((agora-new Date(r.ultimo_inicio_em).getTime())/1000)):0);
  const duracao=(n:number)=>`${Math.floor(n/3600)}h ${String(Math.floor(n%3600/60)).padStart(2,"0")}min`;
  async function acao(operacao:string){
    if(!clinica||ocupado)return;setOcupado(true);
    const {error}=await (supabase as any).rpc("oricse_registrar_atividade",{p_clinica:clinica,p_acao:operacao});
    if(error)toast.error(error.message);else {toast.success("Atividade registrada.");const {data}=await supabase.auth.getUser();if(data.user)await atualizar(clinica,data.user.id);}
    setOcupado(false);
  }
  return <main className="mx-auto max-w-4xl space-y-5 p-5">
    <Link to="/" className="text-sm font-semibold">← Voltar</Link>
    <header><h1 className="text-2xl font-bold">Minha atividade</h1><p className="text-sm text-muted-foreground">Registre suas horas ou diárias de trabalho. Os horários são registrados pelo servidor.</p></header>
    {carregando?<p>Carregando...</p>:!config?<p className="rounded-xl border p-5">Seu RT ainda não configurou sua modalidade de pagamento.</p>:<>
      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <div><p className="text-sm text-muted-foreground">Modalidade</p><h2 className="text-xl font-bold">{config.modalidade==="hora"?"Pagamento por hora":"Pagamento por diária"}</h2><p className="text-sm">R$ {Number(config.valor_unitario).toFixed(2).replace(".",",")} por {config.modalidade==="hora"?"hora":"diária"}</p></div>
        {config.modalidade==="hora"?<>
          <div className="text-2xl font-bold">{atual?duracao(segundos(atual)):"00h 00min"}</div>
          <p className="text-sm text-muted-foreground">{atual?atual.estado==="ativa"?"Atividade em andamento":"Atividade pausada":"Nenhuma atividade em andamento"}</p>
          <div className="flex flex-wrap gap-2">
            {!atual&&<button disabled={ocupado} onClick={()=>acao("iniciar")} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Iniciar atividade</button>}
            {atual?.estado==="ativa"&&<button disabled={ocupado} onClick={()=>acao("pausar")} className="rounded-xl border px-5 py-3 font-semibold">Pausar atividade</button>}
            {atual?.estado==="pausada"&&<button disabled={ocupado} onClick={()=>acao("retomar")} className="rounded-xl border px-5 py-3 font-semibold">Retomar atividade</button>}
            {atual&&<button disabled={ocupado} onClick={()=>acao("finalizar")} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Finalizar atividade</button>}
          </div>
        </>:<button disabled={ocupado||jaFezCheckin} onClick={()=>acao("checkin")} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{jaFezCheckin?"Check-in realizado hoje":"Fazer check-in de hoje"}</button>}
      </section>
      <section className="rounded-xl border bg-card p-4"><h2 className="mb-3 font-bold">Histórico de atividades</h2>
        <div className="divide-y">{registros.map(r=><div key={r.id} className="flex justify-between gap-3 py-3 text-sm">
          <span>{r.data.split("-").reverse().join("/")} · {r.modalidade==="diaria"?"Diária":duracao(segundos(r))} · {r.estado}</span>
          <strong>{(r.modalidade==="diaria"?Number(r.valor_unitario):segundos(r)/3600*Number(r.valor_unitario)).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong>
        </div>)}</div>
      </section>
    </>}
  </main>;
}
