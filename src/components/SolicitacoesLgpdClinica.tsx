import { useEffect, useMemo, useState } from "react";
import { FileClock, Plus, Save, ShieldCheck, Download } from "lucide-react";
import { toast } from "sonner";
import { oricseStorage, hidratarOricseStorage, descarregarOricseStorage } from "@/lib/oricse-storage";

type Tipo = "acesso"|"correcao"|"exclusao"|"portabilidade"|"revogacao"|"outros";
type Status = "recebida"|"em_analise"|"respondida"|"encerrada";
type Registro={id:string;protocolo:string;tipo:Tipo;titularReferencia:string;recebidoEm:string;prazo:string;status:Status;responsavel:string;descricao:string;registroResposta:string;resolvidoEm:string};
type Estado={versao:1;solicitacoes:Registro[]};
const CHAVE="oricse-lgpd-solicitacoes-v1";
const nomes:Record<Tipo,string>={acesso:"Acesso",correcao:"Correção",exclusao:"Exclusão",portabilidade:"Portabilidade",revogacao:"Revogação",outros:"Outros"};
const statusNomes:Record<Status,string>={recebida:"Recebida",em_analise:"Em análise",respondida:"Respondida",encerrada:"Encerrada"};
const clonar=(v:Estado)=>JSON.parse(JSON.stringify(v)) as Estado;
function ler():Estado{
 const bruto=oricseStorage.getItem(CHAVE);
 if(!bruto)return {versao:1,solicitacoes:[]};
 const v=JSON.parse(bruto) as Estado;
 if(v?.versao!==1||!Array.isArray(v.solicitacoes))throw new Error("Registro LGPD inconsistente. Não foi substituído.");
 return v;
}
function csv(campo:string){let v=campo.replaceAll("\r"," ").replaceAll("\n"," ");if(/^[\s]*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';}
export function SolicitacoesLgpdClinica({podeGerenciar}:{podeGerenciar:boolean}){
 const [estado,setEstado]=useState<Estado>({versao:1,solicitacoes:[]});
 const [salvo,setSalvo]=useState<Estado>({versao:1,solicitacoes:[]});
 const [carregando,setCarregando]=useState(true),[salvando,setSalvando]=useState(false),[erro,setErro]=useState("");
 const [filtro,setFiltro]=useState<"todas"|"pendentes"|"encerradas">("pendentes");
 useEffect(()=>{let ativo=true;void(async()=>{try{await hidratarOricseStorage();const v=ler();if(ativo){setEstado(v);setSalvo(clonar(v));}}catch(e){if(ativo)setErro(e instanceof Error?e.message:"Falha ao carregar.");}finally{if(ativo)setCarregando(false);}})();return()=>{ativo=false;};},[]);
 const alterado=useMemo(()=>JSON.stringify(estado)!==JSON.stringify(salvo),[estado,salvo]);
 const registros=useMemo(()=>estado.solicitacoes.filter(x=>filtro==="todas"||(filtro==="pendentes"?x.status!=="encerrada":x.status==="encerrada")).sort((a,b)=>b.recebidoEm.localeCompare(a.recebidoEm)),[estado.solicitacoes,filtro]);
 function mudar(id:string,patch:Partial<Registro>){setEstado(s=>({...s,solicitacoes:s.solicitacoes.map(x=>x.id===id?{...x,...patch}:x)}));}
 function adicionar(){
  if(!podeGerenciar||estado.solicitacoes.length>=500)return toast.error("Limite de 500 protocolos.");
  const id=crypto.randomUUID(),dia=new Date().toISOString().slice(0,10);
  const protocolo="LGPD-"+new Date().toISOString().replace(/[-:TZ.]/g,"").slice(0,14)+"-"+id.slice(0,6).toUpperCase();
  setEstado(s=>({...s,solicitacoes:[{id,protocolo,tipo:"acesso",titularReferencia:"Titular não identificado",recebidoEm:dia,prazo:"",status:"recebida",responsavel:"",descricao:"",registroResposta:"",resolvidoEm:""},...s.solicitacoes]}));
  setFiltro("todas");
 }
 async function salvar(){
  if(!podeGerenciar||salvando||!alterado)return;
  if(estado.solicitacoes.some(x=>x.titularReferencia.trim().length<2||x.protocolo.trim().length<3||x.descricao.length>1400||x.registroResposta.length>1400))return toast.error("Revise o titular, protocolo e limites de texto.");
  setSalvando(true);
  try{oricseStorage.setItem(CHAVE,JSON.stringify(estado));await descarregarOricseStorage();setSalvo(clonar(estado));toast.success("Registro de solicitações confirmado no servidor.");}
  catch(e){toast.error(e instanceof Error?e.message:"Falha no salvamento.");}finally{setSalvando(false);}
 }
 function exportar(){
  const cabecalho=["Protocolo","Tipo","Referência do titular","Recebido em","Prazo interno","Status","Responsável","Descrição","Registro da resposta","Encerrado em"];
  const linhas=estado.solicitacoes.map(x=>[x.protocolo,nomes[x.tipo],x.titularReferencia,x.recebidoEm,x.prazo,statusNomes[x.status],x.responsavel,x.descricao,x.registroResposta,x.resolvidoEm].map(csv).join(";"));
  const blob=new Blob(["\uFEFF"+[cabecalho.join(";"),...linhas].join("\r\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="oricse-lgpd-protocolos.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 if(carregando)return <p className="mt-4 rounded-lg border p-3 text-xs">Carregando solicitações de privacidade...</p>;
 if(erro)return <p role="alert" className="mt-4 rounded-lg border border-destructive p-3 text-xs text-destructive">{erro}</p>;
 return <section className="mt-5 rounded-xl border bg-background p-4">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={18}/> Solicitações LGPD</h3>
   <p className="mt-1 text-xs text-muted-foreground">Controle interno de solicitações e respostas. Não apaga dados pessoais nem executa portabilidade automaticamente.</p></div>
   <div className="flex flex-wrap gap-2"><button type="button" onClick={exportar} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs"><Download size={15}/> Exportar CSV</button>
   {podeGerenciar&&<button type="button" onClick={adicionar} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><Plus size={15}/> Novo protocolo</button>}</div>
  </div>
  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><FileClock size={15}/>{estado.solicitacoes.filter(x=>x.status!=="encerrada").length} solicitações em aberto</p>
  <div className="my-3 flex flex-wrap gap-2">{(["pendentes","encerradas","todas"] as const).map(k=><button type="button" key={k} onClick={()=>setFiltro(k)} className={"rounded-md border px-3 py-2 text-xs "+(filtro===k?"bg-primary text-primary-foreground":"")}>{k==="pendentes"?"Em aberto":k==="encerradas"?"Encerradas":"Todas"}</button>)}</div>
  <div className="max-h-[760px] space-y-3 overflow-auto">{registros.map(x=><article key={x.id} className="rounded-lg border p-3">
   <div className="mb-3 flex flex-wrap justify-between gap-2"><strong className="text-sm">{x.protocolo}</strong><span className="text-xs text-muted-foreground">{statusNomes[x.status]}</span></div>
   <div className="grid gap-3 md:grid-cols-2">
    <label className="text-xs font-medium">Referência interna do titular<input value={x.titularReferencia} maxLength={120} disabled={!podeGerenciar} onChange={e=>mudar(x.id,{titularReferencia:e.target.value})} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-3 text-sm"/></label>
    <label className="text-xs font-medium">Tipo<select value={x.tipo} disabled={!podeGerenciar} onChange={e=>mudar(x.id,{tipo:e.target.value as Tipo})} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-3">{Object.entries(nomes).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
    <label className="text-xs font-medium">Recebido em<input type="date" value={x.recebidoEm} disabled={!podeGerenciar} onChange={e=>mudar(x.id,{recebidoEm:e.target.value})} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-3"/></label>
    <label className="text-xs font-medium">Prazo de controle interno<input type="date" value={x.prazo} disabled={!podeGerenciar} onChange={e=>mudar(x.id,{prazo:e.target.value})} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-3"/></label>
    <label className="text-xs font-medium">Responsável<input value={x.responsavel} maxLength={100} disabled={!podeGerenciar} onChange={e=>mudar(x.id,{responsavel:e.target.value})} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-3"/></label>
    <label className="text-xs font-medium">Situação<select value={x.status} disabled={!podeGerenciar} onChange={e=>mudar(x.id,{status:e.target.value as Status, ...(e.target.value==="encerrada"&&!x.resolvidoEm?{resolvidoEm:new Date().toISOString().slice(0,10)}:{})})} className="mt-1 min-h-10 w-full rounded-lg border bg-card px-3">{Object.entries(statusNomes).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
    <label className="text-xs font-medium md:col-span-2">Descrição<textarea rows={2} maxLength={1400} disabled={!podeGerenciar} value={x.descricao} onChange={e=>mudar(x.id,{descricao:e.target.value})} className="mt-1 w-full rounded-lg border bg-card p-3 text-sm"/></label>
    <label className="text-xs font-medium md:col-span-2">Registro de análise e resposta<textarea rows={2} maxLength={1400} disabled={!podeGerenciar} value={x.registroResposta} onChange={e=>mudar(x.id,{registroResposta:e.target.value})} className="mt-1 w-full rounded-lg border bg-card p-3 text-sm"/></label>
   </div>
   {x.prazo&&x.prazo<new Date().toISOString().slice(0,10)&&x.status!=="encerrada"&&<p className="mt-2 text-xs text-amber-700">Prazo interno ultrapassado — revisar imediatamente.</p>}
  </article>)}
  {!registros.length&&<p className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">Nenhuma solicitação neste filtro.</p>}</div>
  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4"><p className="text-xs text-muted-foreground">{alterado?"Existem alterações não salvas.":"Registro atualizado."}</p>
   <button type="button" disabled={!podeGerenciar||salvando||!alterado} onClick={()=>void salvar()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Save size={15}/>{salvando?"Salvando...":"Salvar solicitações"}</button>
  </div>
  <p className="mt-3 text-xs text-muted-foreground">Evite dados pessoais sensíveis nos campos livres. Prazos precisam ser definidos conforme o tipo de solicitação e orientação jurídica aplicável.</p>
 </section>;
}
