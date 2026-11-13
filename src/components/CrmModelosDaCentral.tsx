import { useState } from "react";
import { CheckCircle2, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { consultarPoliticasAgendaClinica } from "@/lib/politicas-operacionais.functions";

type ModeloResumo = {id:string;tipo:string;mensagem:string;ativo:boolean};
type Proposta = {id:string;tipo:string;rotulo:string;original:string;novo:string};
type Props = {
  clinicaId:string;
  modelos:ModeloResumo[];
  podeGerenciar:boolean;
  onAtualizados:(alteracoes:Array<{id:string;mensagem:string}>)=>void;
};

const CONEXOES=[
  {tipo:"lembrete_consulta",chave:"confirmacaoConsulta",rotulo:"Confirmação e lembrete de consulta"},
  {tipo:"vacina",chave:"lembreteVacina",rotulo:"Vacinação e reforços"},
  {tipo:"retorno",chave:"mensagemRetorno",rotulo:"Retornos clínicos"},
] as const;

function converterVariaveis(texto:string){
  const convertido=texto.replaceAll("{{paciente}}","{{animal}}");
  const permitidas=new Set(["tutor","animal","data","hora","servico","clinica"]);
  const variaveis=[...convertido.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map(match=>match[1].trim());
  if(variaveis.some(nome=>!permitidas.has(nome)))throw new Error(
    "Modelo contém campo não suportado pelo CRM: "+variaveis.filter(nome=>!permitidas.has(nome)).join(", ")
  );
  if(convertido.length>1500)throw new Error("O modelo excede 1.500 caracteres.");
  return convertido;
}

export function CrmModelosDaCentral({clinicaId,modelos,podeGerenciar,onAtualizados}:Props){
  const [propostas,setPropostas]=useState<Proposta[]>([]);
  const [avisos,setAvisos]=useState<string[]>([]);
  const [carregando,setCarregando]=useState(false);
  const [aplicando,setAplicando]=useState(false);
  const [carregou,setCarregou]=useState(false);

  async function preparar(){
    if(!podeGerenciar||!clinicaId||carregando||aplicando)return;
    setCarregando(true);setCarregou(false);setPropostas([]);setAvisos([]);
    try{
      const {data:sessao,error:erroSessao}=await supabase.auth.getSession();
      if(erroSessao||!sessao.session?.access_token)throw new Error("Sessão expirada.");
      const politicas=await consultarPoliticasAgendaClinica({
        data:{accessToken:sessao.session.access_token,clinicaId},
      });
      if(!politicas.configurado){
        setAvisos(["A Central ainda não tem modelos personalizados salvos. Configure-os antes de sincronizar."]);
        setCarregou(true);
        return;
      }
      const propostasNovas:Proposta[]=[];
      const avisosNovos:string[]=[];
      for(const conexao of CONEXOES){
        const ativos=modelos.filter(m=>m.tipo===conexao.tipo&&m.ativo);
        if(ativos.length!==1){
          avisosNovos.push(conexao.rotulo+": esperado um único modelo ativo no CRM. Encontrados "+ativos.length+".");
          continue;
        }
        const atual=ativos[0];
        const texto=politicas.comunicacao[conexao.chave].trim();
        if(!texto){
          avisosNovos.push(conexao.rotulo+": mensagem não preenchida na Central.");
          continue;
        }
        try{
          const convertido=converterVariaveis(texto);
          if(atual.mensagem!==convertido){
            propostasNovas.push({id:atual.id,tipo:conexao.tipo,rotulo:conexao.rotulo,original:atual.mensagem,novo:convertido});
          }
        }catch(e){
          avisosNovos.push(conexao.rotulo+": "+(e instanceof Error?e.message:"formato inválido."));
        }
      }
      setPropostas(propostasNovas);
      setAvisos(avisosNovos);
      setCarregou(true);
    }catch(e){
      toast.error(e instanceof Error?e.message:"Não foi possível consultar os modelos da Central.");
    }finally{setCarregando(false);}
  }

  async function aplicar(){
    if(!podeGerenciar||!clinicaId||!propostas.length||aplicando)return;
    if(!window.confirm("Atualizar "+propostas.length+" modelos ATIVOS do CRM? Essa ação não envia mensagens nem altera eventos já gerados."))return;
    setAplicando(true);
    const concluidos:Array<{id:string;mensagem:string}>=[];
    try{
      for(const item of propostas){
        // Protege contra mudanças concorrentes desde a prévia.
        const {data:atuais,error:erroConsulta}=await(supabase as any)
          .from("oricse_crm_modelos").select("id,mensagem,ativo,tipo")
          .eq("clinica_id",clinicaId).eq("id",item.id).limit(1);
        if(erroConsulta)throw new Error("Falha ao conferir o modelo "+item.rotulo+": "+erroConsulta.message);
        const atual=atuais?.[0];
        if(!atual||!atual.ativo||atual.tipo!==item.tipo||atual.mensagem!==item.original){
          throw new Error("O modelo "+item.rotulo+" foi modificado. Refaça a prévia antes de aplicar.");
        }
        const {data:confirmado,error:erroUpdate}=await(supabase as any).from("oricse_crm_modelos")
          .update({mensagem:item.novo,updated_at:new Date().toISOString()})
          .eq("clinica_id",clinicaId).eq("id",item.id).eq("tipo",item.tipo)
          .eq("ativo",true).eq("mensagem",item.original)
          .select("id").maybeSingle();
        if(erroUpdate||!confirmado)throw new Error(
          "A atualização de "+item.rotulo+" não foi confirmada. "+(erroUpdate?.message||"Recarregue os modelos.")
        );
        concluidos.push({id:item.id,mensagem:item.novo});
      }
      onAtualizados(concluidos);
      setPropostas([]);
      setCarregou(false);
      toast.success(concluidos.length+" modelos sincronizados com o CRM.");
    }catch(e){
      if(concluidos.length){
        onAtualizados(concluidos);
        setPropostas(antigos=>antigos.filter(p=>!concluidos.some(c=>c.id===p.id)));
      }
      toast.error((e instanceof Error?e.message:"Falha ao sincronizar.")+
        (concluidos.length?" "+concluidos.length+" modelo(s) já salvo(s); revise antes de repetir.":"")
      );
    }finally{setAplicando(false);}
  }

  if(!podeGerenciar)return null;
  return <section className="rounded-2xl border bg-card p-4 sm:p-5 lg:col-span-2" aria-label="Modelos de comunicação da Central">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <ShieldCheck size={19} className="mt-0.5 shrink-0 text-primary"/>
        <div>
          <h2 className="text-sm font-bold">Vincular modelos da Central de Configurações</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Confira antes de atualizar os três modelos ativos de consulta, vacinação e retorno.
            Não muda os modelos de pós-cirúrgico, não envia mensagens e não altera notificações já criadas.
          </p>
        </div>
      </div>
      <button type="button" disabled={carregando||aplicando} onClick={()=>void preparar()}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50">
        <RefreshCw size={15}/>{carregando?"Conferindo...":"Conferir diferenças"}
      </button>
    </div>
    {carregou&&<div className="mt-3 space-y-3">
      {avisos.map((aviso,i)=><p key={i} role="status" className="rounded-lg border p-3 text-xs text-muted-foreground">{aviso}</p>)}
      {!propostas.length&&<p className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 size={15}/> Nenhuma alteração segura pendente.</p>}
      {propostas.map((p)=><div key={p.id} className="rounded-lg border p-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold"><FileText size={15}/>{p.rotulo}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><span className="text-xs font-semibold text-muted-foreground">Mensagem atual</span><p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-xs">{p.original||"(vazia)"}</p></div>
          <div><span className="text-xs font-semibold text-muted-foreground">Nova mensagem</span><p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-xs">{p.novo}</p></div>
        </div>
      </div>)}
      {!!propostas.length&&<div className="flex flex-wrap gap-2">
        <button type="button" disabled={aplicando} onClick={()=>void aplicar()}
          className="min-h-10 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50">
          {aplicando?"Aplicando...":"Aplicar "+propostas.length+" modelos conferidos"}
        </button>
        <button type="button" disabled={aplicando} onClick={()=>{setPropostas([]);setCarregou(false);}}
          className="min-h-10 rounded-lg border px-3 text-xs">Cancelar</button>
      </div>}
    </div>}
  </section>;
}
