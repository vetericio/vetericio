import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clock3, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-solicitacoes")({ component: AdminSolicitacoes });

type Solicitacao = {
  id:string; plano_nome:string; ciclo:string; valor_exibido:string|null; status:string; clinica_nome:string; cnpj:string; clinica_telefone:string; clinica_email:string; clinica_cidade:string; clinica_uf:string; responsavel_nome:string; responsavel_cpf:string; responsavel_crmv:string; responsavel_crmv_uf:string; responsavel_email:string; responsavel_telefone:string; pagamento_provedor:string|null; pagamento_id:string|null; pagamento_aprovado_em:string|null; created_at:string;
};

function AdminSolicitacoes(){
  const [itens,setItens]=useState<Solicitacao[]>([]);
  const [carregando,setCarregando]=useState(true);
  async function carregar(){
    setCarregando(true);
    const {data,error}=await (supabase as any).from("oricse_contratacoes").select("id,plano_nome,ciclo,valor_exibido,status,clinica_nome,cnpj,clinica_telefone,clinica_email,clinica_cidade,clinica_uf,responsavel_nome,responsavel_cpf,responsavel_crmv,responsavel_crmv_uf,responsavel_email,responsavel_telefone,pagamento_provedor,pagamento_id,pagamento_aprovado_em,created_at").in("status",["pagamento_aprovado","em_analise","ativada"]).order("created_at",{ascending:false});
    setCarregando(false);
    if(error){toast.error("Não foi possível carregar as solicitações.");return;}
    setItens(data||[]);
  }
  useEffect(()=>{void carregar()},[]);
  async function marcarAnalise(id:string){
    const {error}=await (supabase as any).from("oricse_contratacoes").update({status:"em_analise",updated_at:new Date().toISOString()}).eq("id",id);
    if(error){toast.error("Não foi possível atualizar.");return;} toast.success("Solicitação marcada como em análise."); void carregar();
  }
  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6"><div className="mx-auto max-w-6xl"><Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={18}/> Voltar ao Admin</Link><header className="mt-6"><h1 className="text-3xl font-bold">Solicitações pagas</h1><p className="mt-2 text-muted-foreground">Só aparecem aqui cadastros cujo pagamento já foi confirmado.</p></header>{carregando?<p className="mt-8 text-muted-foreground">Carregando...</p>:itens.length===0?<div className="mt-8 rounded-3xl border bg-card p-8 text-center"><Clock3 className="mx-auto text-muted-foreground"/><h2 className="mt-3 text-xl font-bold">Nenhuma solicitação paga</h2><p className="mt-2 text-muted-foreground">Cadastros aguardando pagamento ficam fora desta lista.</p></div>:<section className="mt-6 space-y-4">{itens.map(item=><article key={item.id} className="rounded-3xl border bg-card p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-primary"/><span className="text-xs font-bold uppercase text-primary">{item.status.replaceAll("_"," ")}</span></div><h2 className="mt-2 text-2xl font-bold">{item.clinica_nome}</h2><p className="text-sm text-muted-foreground">{item.plano_nome} · {item.ciclo} · {item.valor_exibido||"valor não informado"}</p></div>{item.status==="pagamento_aprovado"&&<button onClick={()=>void marcarAnalise(item.id)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Iniciar análise</button>}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-muted/40 p-4 text-sm"><h3 className="font-bold">Clínica</h3><p>CNPJ: {item.cnpj}</p><p>{item.clinica_email}</p><p>{item.clinica_telefone}</p><p>{item.clinica_cidade}/{item.clinica_uf}</p></div><div className="rounded-2xl bg-muted/40 p-4 text-sm"><h3 className="font-bold">Responsável</h3><p>{item.responsavel_nome}</p><p>CPF: {item.responsavel_cpf}</p><p>CRMV: {item.responsavel_crmv}/{item.responsavel_crmv_uf}</p><p>{item.responsavel_email} · {item.responsavel_telefone}</p></div></div>{item.pagamento_id&&<p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground"><ExternalLink size={14}/>Pagamento {item.pagamento_provedor||""} · {item.pagamento_id}</p>}</article>)}</section>}</div></main>;
}
