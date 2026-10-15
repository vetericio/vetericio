import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/configurar-agenda-online")({ component: ConfigurarAgendaOnline });
type Agenda = { id:string; nome:string; responsavel:string; inicio:string; fim:string; dias_semana:number[]; intervalo_min:number; portal_ativo:boolean; modalidade:"livre"|"aprovacao"|"pagamento"; antecedencia_horas:number };
const dias=[["Dom",0],["Seg",1],["Ter",2],["Qua",3],["Qui",4],["Sex",5],["Sáb",6]] as const;
function ConfigurarAgendaOnline(){
 const [clinica,setClinica]=useState<string|null>(null);
 const [agendas,setAgendas]=useState<Agenda[]>([]);
 const [carregando,setCarregando]=useState(true);
 const [salvando,setSalvando]=useState<string|null>(null);
 useEffect(()=>{let ativo=true;(async()=>{
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){if(ativo)setCarregando(false);return;}
  const {data:vinculo,error}=await (supabase as any).from("clinica_usuarios").select("clinica_id").eq("user_id",user.id).eq("ativo",true).limit(1).maybeSingle();
  if(!ativo)return;
  if(error||!vinculo?.clinica_id){toast.error("Clínica não identificada.");setCarregando(false);return;}
  setClinica(vinculo.clinica_id);
  const {data,error:erro}=await (supabase as any).from("oricse_agendas_online").select("id,nome,responsavel,inicio,fim,dias_semana,intervalo_min,portal_ativo,modalidade,antecedencia_horas").eq("clinica_id",vinculo.clinica_id).order("nome");
  if(!ativo)return;
  if(erro)toast.error("Não foi possível carregar as agendas.");
  setAgendas(data||[]);setCarregando(false);
 })();return()=>{ativo=false}},[]);
 const alterar=(id:string,patch:Partial<Agenda>)=>setAgendas(prev=>prev.map(a=>a.id===id?{...a,...patch}:a));
 async function adicionar(){
  if(!clinica)return;
  const {data,error}=await (supabase as any).from("oricse_agendas_online").insert({clinica_id:clinica,nome:"Nova agenda",portal_ativo:false}).select("id,nome,responsavel,inicio,fim,dias_semana,intervalo_min,portal_ativo,modalidade,antecedencia_horas").single();
  if(error)return toast.error(error.message);
  setAgendas(a=>[...a,data]);toast.success("Agenda criada. Configure e salve.");
 }
 async function salvar(a:Agenda){
  if(!clinica)return;
  setSalvando(a.id);
  const {error}=await (supabase as any).from("oricse_agendas_online").update({nome:a.nome,responsavel:a.responsavel,inicio:a.inicio,fim:a.fim,dias_semana:a.dias_semana,intervalo_min:a.intervalo_min,portal_ativo:a.portal_ativo,modalidade:a.modalidade,antecedencia_horas:a.antecedencia_horas}).eq("id",a.id).eq("clinica_id",clinica);
  setSalvando(null);
  if(error)return toast.error(error.message);
  toast.success("Configuração salva no Supabase.");
 }
 return <main className="mx-auto max-w-4xl space-y-5 p-5"><Link to="/recepcao" className="text-sm underline">← Voltar à Recepção</Link><h1 className="text-2xl font-bold">Agenda online do tutor</h1><p className="text-sm text-muted-foreground">Configure a disponibilidade publicada para tutores. Agendamentos públicos permanecerão bloqueados até a ativação segura do login do tutor e da sincronização da agenda da Recepção.</p>
 {carregando?<p>Carregando…</p>:!clinica?<p>Entre com uma conta vinculada a uma clínica.</p>:<><button onClick={()=>void adicionar()} className="rounded-xl bg-primary px-4 py-2 text-primary-foreground">+ Nova agenda online</button>{agendas.map(a=><section key={a.id} className="space-y-4 rounded-2xl border bg-white p-5"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Nome<input className="mt-1 w-full rounded-lg border p-2" value={a.nome} onChange={e=>alterar(a.id,{nome:e.target.value})}/></label><label className="text-sm">Responsável<input className="mt-1 w-full rounded-lg border p-2" value={a.responsavel} onChange={e=>alterar(a.id,{responsavel:e.target.value})}/></label><label className="text-sm">Início<input type="time" className="mt-1 w-full rounded-lg border p-2" value={a.inicio.slice(0,5)} onChange={e=>alterar(a.id,{inicio:e.target.value})}/></label><label className="text-sm">Fim<input type="time" className="mt-1 w-full rounded-lg border p-2" value={a.fim.slice(0,5)} onChange={e=>alterar(a.id,{fim:e.target.value})}/></label><label className="text-sm">Intervalo (minutos)<input type="number" min={5} max={240} className="mt-1 w-full rounded-lg border p-2" value={a.intervalo_min} onChange={e=>alterar(a.id,{intervalo_min:Number(e.target.value)})}/></label><label className="text-sm">Antecedência mínima (horas)<input type="number" min={0} max={720} className="mt-1 w-full rounded-lg border p-2" value={a.antecedencia_horas} onChange={e=>alterar(a.id,{antecedencia_horas:Number(e.target.value)})}/></label></div><div className="flex flex-wrap gap-3">{dias.map(([nome,n])=><label key={n} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={a.dias_semana.includes(n)} onChange={e=>alterar(a.id,{dias_semana:e.target.checked?[...a.dias_semana,n]:a.dias_semana.filter(d=>d!==n)})}/>{nome}</label>)}</div><label className="block text-sm">Modalidade<select className="mt-1 w-full rounded-lg border p-2" value={a.modalidade} onChange={e=>alterar(a.id,{modalidade:e.target.value as Agenda["modalidade"]})}><option value="livre">Livre</option><option value="aprovacao">Mediante aprovação</option><option value="pagamento">Mediante pagamento (integração pendente)</option></select></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={a.portal_ativo} onChange={e=>alterar(a.id,{portal_ativo:e.target.checked})}/>Habilitar agenda para o portal (reservas ainda bloqueadas)</label><button disabled={salvando===a.id} onClick={()=>void salvar(a)} className="rounded-xl bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">Salvar configuração</button></section>)}</>}</main>;
}
