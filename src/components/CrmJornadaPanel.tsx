import { useCallback, useEffect, useState } from "react";
import { Check, ClipboardCopy, HeartPulse, MessageCircle, RefreshCw, Star, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { criarJornadaPosCirurgica, listarFontesPosCirurgicas } from "@/lib/crm-pos-cirurgico.functions";
import { atualizarContatoJornada, listarOportunidadesRelacionamento, obterWhatsAppJornada, prepararOportunidadeRelacionamento } from "@/lib/crm-jornadas.functions";

type Servico = "pos-cirurgico" | "ausentes" | "satisfacao";
type Candidato = {
  id: string; tutorId: string; tutorNome: string; animalNome: string;
  dataOrigem: string; dias: number; resumo: string;
};
type Evento = {
  id: string; clinica_id: string; tipo: string; titulo: string;
  destinatario_nome: string; animal_nome: string; mensagem: string;
  agendado_para: string; status: string; canal: string;
  chave_dedupe?: string | null;
  metadados?: Record<string, unknown> | null;
};
type Fonte = {
  id: string; tutorId: string; tutorNome: string; animalNome: string;
  dataProcedimento: string; dataAlta: string | null;
};
type DestinatarioPesquisa = {
  tutorId: string; tutorNome: string; disponivel: boolean; motivo?: string;
  animais: { id: string; nome: string }[];
};

const TITULOS: Record<Servico, { nome: string; descricao: string; vazio: string }> = {
  "pos-cirurgico": {
    nome: "Pós-cirúrgico inteligente",
    descricao: "Acompanhe pacientes após cirurgia concluída. Etapas D+1, D+3, D+7 e D+10, calculadas a partir da alta quando informada.",
    vazio: "Nenhum procedimento concluído com acompanhamento ativado. Ative a opção no registro de Cirurgia / Procedimentos.",
  },
  ausentes: {
    nome: "Clientes ausentes",
    descricao: "Localize tutores sem atendimento concluído, respeitando preferências de contato e agendamentos futuros.",
    vazio: "Nenhum tutor elegível para reativação neste intervalo.",
  },
  satisfacao: {
    nome: "Pesquisa de satisfação",
    descricao: "Prepare uma pesquisa curta para atendimentos concluídos. O tutor responde de 1 a 5 estrelas por um link individual.",
    vazio: "Nenhuma consulta recente elegível para sugestão. Você pode escolher qualquer tutor cadastrado na área acima.",
  },
};

function dataBr(valor: string) {
  const dia = valor.slice(0,10);
  const partes=dia.split("-");
  return partes.length===3 ? partes.reverse().join("/") : valor;
}
function destacarResposta(evento: Evento) {
  const nota=Number(evento.metadados?.pesquisa_nota);
  return Number.isInteger(nota) && nota>=1 && nota<=5 ? nota : null;
}

export function CrmJornadaPanel({ clinicaId, tipo, podeOperar }: {
  clinicaId: string; tipo: Servico; podeOperar: boolean;
}) {
  const [candidatos,setCandidatos] = useState<Candidato[]>([]);
  const [destinatarios,setDestinatarios] = useState<DestinatarioPesquisa[]>([]);
  const [buscaTutor,setBuscaTutor] = useState("");
  const [tutorSelecionado,setTutorSelecionado] = useState("");
  const [animalSelecionado,setAnimalSelecionado] = useState("");
  const [fontes,setFontes] = useState<Fonte[]>([]);
  const [eventos,setEventos] = useState<Evento[]>([]);
  const [carregando,setCarregando] = useState(true);
  const [erro,setErro] = useState("");
  const [processando,setProcessando] = useState<string | null>(null);
  const [diasAusentes,setDiasAusentes] = useState(180);
  const [editor,setEditor] = useState<{ evento: Evento; texto: string; numero?: string; erro?: string; verificando: boolean } | null>(null);

  const atualizar = useCallback(async () => {
    if (!clinicaId) return;
    setCarregando(true);setErro("");
    try {
      const { data: sessao, error: erroSessao } = await supabase.auth.getSession();
      if (erroSessao || !sessao.session?.access_token) throw new Error("Faça login novamente.");
      const accessToken=sessao.session.access_token;
      const tipoBanco=tipo==="pos-cirurgico"?"pos_cirurgico":tipo==="ausentes"?"inativo":"pesquisa_satisfacao";
      const [resp,lista]=await Promise.all([
        tipo==="pos-cirurgico"
          ? listarFontesPosCirurgicas({data:{clinicaId,accessToken}})
          : listarOportunidadesRelacionamento({data:{clinicaId,accessToken,servico:tipo,limiteDias:diasAusentes}}),
        tipo==="pos-cirurgico"
          ? (supabaseBanco as any).from("oricse_crm_eventos")
              .select("id,clinica_id,tipo,titulo,destinatario_nome,animal_nome,mensagem,agendado_para,status,canal,chave_dedupe,metadados")
              .eq("clinica_id",clinicaId).eq("tipo",tipoBanco).order("agendado_para",{ascending:true}).limit(300)
          : Promise.resolve({data:[],error:null}),
      ]);
      if(lista.error)throw new Error(lista.error.message);
      if(tipo==="pos-cirurgico"){
        setFontes(resp as Fonte[]);setCandidatos([]);
      }else{
        // Os dois serviços usam um resultado com candidatos e destinatários;
        // a origem cirúrgica é uma lista, tratada em outro caminho.
        const dados=Array.isArray(resp) ? null : resp;
        if(!dados)throw new Error("Resposta inesperada da Central de Relacionamento.");
        setCandidatos(dados.candidatos);
        setDestinatarios(tipo==="satisfacao"?dados.destinatarios:[]);
        setFontes([]);
      }
      const eventosFonte=tipo==="pos-cirurgico" ? (lista.data||[]) as Evento[]
        : Array.isArray(resp) ? [] : resp.eventos;
      setEventos(eventosFonte.filter(e=>
        tipo!=="pos-cirurgico" || String(e.chave_dedupe||"").startsWith("pos_cirurgico:registro:")
      ));
    }catch(e){setErro(e instanceof Error?e.message:"Não foi possível carregar os dados.");}
    finally{setCarregando(false);}
  },[clinicaId,tipo,diasAusentes]);
  useEffect(()=>{void atualizar();},[atualizar]);

  async function preparar(id:string, manual=false) {
    if(!podeOperar)return;
    setProcessando(id);
    try{
      const {data:sessao,error}=await supabase.auth.getSession();
      if(error||!sessao.session?.access_token)throw new Error("Sua sessão expirou.");
      const accessToken=sessao.session.access_token;
      if(tipo==="pos-cirurgico"){
        await criarJornadaPosCirurgica({data:{clinicaId,accessToken,registroId:id}});
      }else{
        await prepararOportunidadeRelacionamento({data:{
          clinicaId,accessToken,servico:tipo,origemId:id,limiteDias:diasAusentes,
          manual:tipo==="satisfacao"&&manual,
          animalId:tipo==="satisfacao"&&manual&&animalSelecionado ? animalSelecionado : undefined,
        }});
      }
      toast.success("Tarefa preparada na Central. Nenhuma mensagem foi enviada.");
      await atualizar();
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível preparar a tarefa.");}
    finally{setProcessando(null);}
  }

  async function abrirContato(evento:Evento) {
    if(!podeOperar)return;
    setEditor({evento,texto:evento.mensagem,verificando:true});
    try{
      const {data:sessao,error}=await supabase.auth.getSession();
      if(error||!sessao.session?.access_token)throw new Error("Faça login novamente.");
      const {numero}=await obterWhatsAppJornada({data:{
        clinicaId,accessToken:sessao.session.access_token,eventoId:evento.id,
      }});
      setEditor(a=>a?.evento.id===evento.id?{...a,numero,verificando:false}:a);
    }catch(e){setEditor(a=>a?.evento.id===evento.id?{...a,verificando:false,erro:e instanceof Error?e.message:"WhatsApp indisponível."}:a);}
  }
  async function alterarStatus(evento:Evento,status:"enviado"|"ignorado") {
    if(!podeOperar)return;
    setProcessando(evento.id);
    try{
      const {data:sessao,error}=await supabase.auth.getSession();
      if(error||!sessao.session?.access_token)throw new Error("Faça login novamente.");
      await atualizarContatoJornada({data:{clinicaId,accessToken:sessao.session.access_token,eventoId:evento.id,status}});
      toast.success(status==="enviado"?"Contato marcado como realizado.":"Contato ignorado.");
      await atualizar();
    }catch(e){toast.error(e instanceof Error?e.message:"Erro ao atualizar contato.");}
    finally{setProcessando(null);}
  }

  const config=TITULOS[tipo];
  const filtrados=destinatarios.filter(d=>
    (d.tutorNome+" "+d.animais.map(a=>a.nome).join(" ")).toLocaleLowerCase("pt-BR")
      .includes(buscaTutor.trim().toLocaleLowerCase("pt-BR"))
  );
  const escolhido=destinatarios.find(d=>d.tutorId===tutorSelecionado);
  return <section className="mt-5 space-y-5" aria-label={config.nome}>
    <div className="rounded-3xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black">
            {tipo==="pos-cirurgico"?<HeartPulse size={22} className="text-primary"/>:tipo==="ausentes"?<Users size={22} className="text-primary"/>:<Star size={22} className="text-primary"/>}
            {config.nome}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{config.descricao}</p>
        </div>
        <button type="button" onClick={()=>void atualizar()} disabled={carregando}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold disabled:opacity-50">
          <RefreshCw size={16} className={carregando?"animate-spin":""}/> Atualizar
        </button>
      </div>
      {tipo==="ausentes"&&<label className="mt-4 inline-flex flex-wrap items-center gap-2 text-sm font-semibold">
        Considerar ausente após
        <select value={diasAusentes} onChange={e=>setDiasAusentes(Number(e.target.value))}
          className="min-h-10 rounded-xl border bg-background px-3">
          <option value={90}>90 dias</option><option value={180}>180 dias</option><option value={365}>365 dias</option>
        </select>
      </label>}
    </div>

    {tipo==="satisfacao" && <div className="rounded-3xl border bg-card p-5">
      <h3 className="text-lg font-black">Enviar pesquisa para qualquer tutor</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Escolha um tutor cadastrado, mesmo sem consulta recente. A pesquisa será preparada,
        e você poderá editar a mensagem antes de abrir o WhatsApp.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Buscar tutor ou animal
          <input type="search" value={buscaTutor} onChange={e=>setBuscaTutor(e.target.value)}
            placeholder="Digite o nome do tutor ou do pet"
            className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"/>
        </label>
        <label className="block text-sm font-semibold">
          Selecionar tutor
          <select value={filtrados.some(d=>d.tutorId===tutorSelecionado)?tutorSelecionado:""}
            onChange={e=>{setTutorSelecionado(e.target.value);setAnimalSelecionado("");}}
            className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal">
            <option value="">Escolha um tutor...</option>
            {filtrados.slice(0,150).map(d=><option key={d.tutorId} value={d.tutorId}>
              {d.tutorNome}{d.disponivel?"":" (contato indisponível)"}
            </option>)}
          </select>
        </label>
      </div>
      {!carregando && destinatarios.length===0 && !erro&&
        <p className="mt-3 text-sm text-muted-foreground">Nenhum tutor cadastrado nesta clínica.</p>}
      {escolhido && <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 text-sm font-semibold">
          Animal (opcional)
          <select value={animalSelecionado} onChange={e=>setAnimalSelecionado(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal">
            <option value="">Atendimento em geral (sem animal específico)</option>
            {escolhido.animais.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </label>
        <button type="button" disabled={!podeOperar||!escolhido.disponivel||!!processando||carregando}
          onClick={()=>void preparar(escolhido.tutorId,true)}
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {processando===escolhido.tutorId?"Preparando...":"Preparar pesquisa para este tutor"}
        </button>
      </div>}
      {escolhido && !escolhido.disponivel &&
        <p role="status" className="mt-3 text-sm text-amber-700">
          {escolhido.motivo} Atualize o cadastro do tutor antes de tentar enviar.
        </p>}
      <p className="mt-3 text-xs text-muted-foreground">O ORICSE não envia automaticamente. É necessário respeitar a autorização atual do tutor.</p>
    </div>}
    {erro&&<div role="alert" className="rounded-xl border border-amber-400/50 bg-amber-50 p-4 text-sm text-amber-950">{erro}</div>}
    {carregando?<div role="status" className="rounded-2xl border bg-card p-7 text-sm text-muted-foreground">Carregando {config.nome.toLowerCase()}...</div>:<>
      <div>
        <h3 className="mb-3 text-base font-black">{tipo==="satisfacao"?"Sugestões de atendimentos recentes":"Contatos para preparar"}</h3>
        {(tipo==="pos-cirurgico"?fontes:candidatos).length===0
          ?<p className="rounded-2xl border border-dashed bg-card p-6 text-sm text-muted-foreground">{config.vazio}</p>
          :<div className="grid gap-3 md:grid-cols-2">
            {(tipo==="pos-cirurgico"?fontes:candidatos).map(c=><article key={c.id} className="rounded-2xl border bg-card p-4">
              <p className="text-lg font-bold">{c.animalNome}</p>
              <p className="mt-1 text-sm text-muted-foreground">Tutor: {c.tutorNome}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tipo==="pos-cirurgico"
                  ?"Cirurgia: "+dataBr((c as Fonte).dataProcedimento)+" · Alta: "+((c as Fonte).dataAlta?dataBr((c as Fonte).dataAlta!):"não registrada")
                  : (c as Candidato).resumo}
              </p>
              {podeOperar&&<button type="button" disabled={processando===c.id}
                onClick={()=>void preparar(c.id)} className="mt-4 min-h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
                {processando===c.id?"Preparando...":tipo==="pos-cirurgico"?"Preparar etapas pós-cirúrgicas":tipo==="ausentes"?"Preparar reativação":"Preparar pesquisa"}
              </button>}
            </article>)}
          </div>}
      </div>
      <div>
        <h3 className="mb-3 text-base font-black">Tarefas e histórico <span className="text-sm font-normal text-muted-foreground">({eventos.length})</span></h3>
        {!eventos.length?<p className="rounded-2xl border border-dashed bg-card p-6 text-sm text-muted-foreground">Nenhuma tarefa deste serviço ainda.</p>
          :<div className="space-y-3">{eventos.map(e=><article key={e.id} className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h4 className="font-black">{e.animal_nome||"Paciente"} · {e.destinatario_nome}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{e.titulo} · {dataBr(e.agendado_para)}</p></div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{e.status}</span>
            </div>
            {destacarResposta(e)!==null&&<p className="mt-3 rounded-xl border bg-muted/40 p-3 text-sm font-semibold">
              Avaliação recebida: {"★".repeat(destacarResposta(e)!)}{"☆".repeat(5-destacarResposta(e)!)}
              {Boolean(e.metadados?.pesquisa_comentario)&&<span className="mt-1 block font-normal">Comentário: {String(e.metadados?.pesquisa_comentario)}</span>}
              {destacarResposta(e)!<=2&&<span className="mt-1 block text-amber-700">Atenção: conversar com o tutor sobre a experiência.</span>}
            </p>}
            {podeOperar&&e.status==="pendente"&&<div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={()=>void abrirContato(e)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
                <MessageCircle size={16}/> Revisar WhatsApp
              </button>
              <button type="button" disabled={processando===e.id} onClick={()=>void alterarStatus(e,"enviado")}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold disabled:opacity-50">
                <Check size={16}/> Marcar contato realizado
              </button>
              <button type="button" disabled={processando===e.id} onClick={()=>void alterarStatus(e,"ignorado")}
                className="min-h-10 rounded-xl border px-3 text-sm text-muted-foreground disabled:opacity-50">Ignorar</button>
            </div>}
          </article>)}</div>}
      </div>
    </>}

    {editor&&<div role="dialog" aria-modal="true" aria-label="Revisar mensagem antes do WhatsApp"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border bg-background p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-black">Revisar mensagem</h3>
          <button type="button" onClick={()=>setEditor(null)} aria-label="Fechar" className="rounded-lg border p-2"><X size={18}/></button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Edite livremente. O ORICSE não envia mensagens automaticamente.</p>
        <textarea value={editor.texto} maxLength={3000} rows={8} onChange={e=>setEditor(a=>a?{...a,texto:e.target.value}:a)}
          className="mt-3 w-full rounded-xl border bg-background p-3 text-sm leading-relaxed" aria-label="Mensagem para o tutor"/>
        {editor.verificando&&<p role="status" className="mt-2 text-xs">Conferindo a autorização de WhatsApp do tutor...</p>}
        {editor.erro&&<p role="alert" className="mt-2 text-xs text-amber-700">{editor.erro}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={()=>{
            void navigator.clipboard?.writeText(editor.texto).then(()=>toast.success("Texto copiado."))
              .catch(()=>toast.error("Não foi possível copiar."));
          }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold"><ClipboardCopy size={16}/> Copiar</button>
          {editor.numero&&editor.texto.trim()&&<a href={"https://wa.me/"+editor.numero+"?text="+encodeURIComponent(editor.texto)}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white">
            <MessageCircle size={16}/> Abrir WhatsApp</a>}
        </div>
      </div>
    </div>}
  </section>;
}
