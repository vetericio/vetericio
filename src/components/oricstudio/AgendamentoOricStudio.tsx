import {useState,type FormEvent} from "react";
import {toast} from "sonner";
import {supabase} from "@/integrations/supabase/client";
import {prepararEnvioOricStudio,cancelarEnvioOricStudio}
  from "@/lib/oricstudio-operacao.functions";

type Post={id:string;titulo:string;tipo:string;status:string;planejado_para:string|null};
type Midia={id:string;nome:string;tipo:string};
type Conta={id:string;username:string;status:string};
type Envio={id:string;status:string;planejado_para:string;formato:string;tentativas:number;erro_resumido?:string|null};
export function AgendamentoOricStudio({clinicaId,posts,midias,contas,envios,podeEditar,onUpdated}:{
  clinicaId:string;posts:Post[];midias:Midia[];contas:Conta[];envios:Envio[];
  podeEditar:boolean;onUpdated:()=>void;
}){
  const [postId,setPostId]=useState("");
  const [contaId,setContaId]=useState("");
  const [selecionadas,setSelecionadas]=useState<string[]>([]);
  const [ocupado,setOcupado]=useState(false);
  const aprovados=posts.filter(p=>p.status==="aprovado"&&p.planejado_para&&
    Date.parse(p.planejado_para)>Date.now()+60000);
  const contasAtivas=contas.filter(c=>c.status==="ativa");
  async function token(){
    const {data}=await supabase.auth.getSession();
    if(!data.session?.access_token)throw new Error("Sessão expirada. Entre novamente.");
    return data.session.access_token;
  }
  async function criar(e:FormEvent){
    e.preventDefault();
    if(!podeEditar||!postId||!contaId||selecionadas.length===0)return;
    setOcupado(true);
    try{
      const result=await prepararEnvioOricStudio({data:{
        accessToken:await token(),clinicaId,publicacaoId:postId,
        contaId,midias:selecionadas,
      }});
      toast.success(result.publicacaoHabilitada
        ?"Publicação incluída na fila para o horário aprovado."
        :"Agendamento preparado. A Meta ainda precisa ser homologada para envio automático.");
      setPostId("");setContaId("");setSelecionadas([]);
      onUpdated();
    }catch(error){
      toast.error(error instanceof Error?error.message:"Não foi possível preparar a publicação.");
    }finally{setOcupado(false);}
  }
  async function cancelar(id:string){
    if(!window.confirm("Cancelar este envio ainda não iniciado?"))return;
    setOcupado(true);
    try{
      await cancelarEnvioOricStudio({data:{accessToken:await token(),clinicaId,envioId:id}});
      toast.success("Agendamento cancelado.");onUpdated();
    }catch(error){
      toast.error(error instanceof Error?error.message:"Não foi possível cancelar.");
    }finally{setOcupado(false);}
  }
  return <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
    <div>
      <h3 className="font-semibold">Agendamentos do Instagram</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        O conteúdo permanece isolado nesta clínica. O Google Drive não será aberto publicamente;
        o publicador usa apenas links temporários. Nenhuma postagem será enviada antes da
        homologação da Meta.
      </p>
    </div>
    {podeEditar&&aprovados.length>0&&<form className="space-y-3" onSubmit={e=>void criar(e)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Publicação aprovada
          <select required value={postId} onChange={e=>setPostId(e.target.value)}
            className="w-full rounded-lg border bg-background p-2">
            <option value="">Selecionar publicação</option>
            {aprovados.map(p=><option key={p.id} value={p.id}>{p.titulo} — {new Date(p.planejado_para!).toLocaleString("pt-BR")}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">Conta Instagram
          <select required value={contaId} onChange={e=>setContaId(e.target.value)}
            className="w-full rounded-lg border bg-background p-2">
            <option value="">Selecionar conta</option>
            {contasAtivas.map(c=><option key={c.id} value={c.id}>@{c.username}</option>)}
          </select>
        </label>
      </div>
      <div>
        <p className="text-sm font-medium">Mídias desta biblioteca (1 a 10)</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {midias.map(m=><label key={m.id} className="flex items-center gap-2 rounded-lg border p-2 text-xs">
            <input type="checkbox" checked={selecionadas.includes(m.id)}
              disabled={ocupado||(!selecionadas.includes(m.id)&&selecionadas.length>=10)}
              onChange={e=>setSelecionadas(before=>e.target.checked?
                [...before,m.id]:before.filter(x=>x!==m.id))}/>
            <span className="truncate">{m.nome} · {m.tipo}</span>
          </label>)}
        </div>
      </div>
      <button disabled={ocupado||!contaId||!postId||!selecionadas.length}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {ocupado?"Preparando...":"Adicionar à fila"}
      </button>
    </form>}
    {!aprovados.length&&podeEditar&&<p className="text-xs text-muted-foreground">
      Aprove uma publicação com data futura para agendá-la.
    </p>}
    {contasAtivas.length===0&&<p className="text-xs text-muted-foreground">
      Conecte uma conta profissional para habilitar a seleção de destino.
    </p>}
    {envios.length>0&&<div className="space-y-2 border-t pt-3">
      <h4 className="text-sm font-semibold">Fila e histórico</h4>
      {envios.slice(0,20).map(j=><div key={j.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-xs">
        <span>{new Date(j.planejado_para).toLocaleString("pt-BR")} · {j.formato} · <strong>{j.status}</strong></span>
        {j.erro_resumido&&<span className="text-destructive">{j.erro_resumido}</span>}
        {podeEditar&&j.status==="agendado"&&<button type="button" disabled={ocupado}
          onClick={()=>void cancelar(j.id)} className="rounded-lg border px-2 py-1 text-destructive">
          Cancelar
        </button>}
      </div>)}
    </div>}
  </section>;
}
