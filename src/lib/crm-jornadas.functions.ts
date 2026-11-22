import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissaoClinica } from "@/lib/permissao-clinica.server";

const base = z.object({ clinicaId: z.string().uuid(), accessToken: z.string().min(20) });
const area = z.enum(["ausentes", "satisfacao"]);
type Area = z.infer<typeof area>;
type Registro = { id?: string; clinicaId?: string; animalId?: string; tutorId?: string; subtipo?: string; status?: string; data?: string; titulo?: string; detalhe?: string; tipo?: string; dados?: Record<string, unknown> };
type Tutor = { id: string; nome: string; telefone?: string | null; outro_telefone?: string | null; email?: string | null; dados?: Record<string, unknown> | null; created_at?: string | null };
type Animal = { id: string; tutor_id: string; nome: string; dados?: Record<string, unknown> | null };
type Agendamento = { tutor_id?: string | null; inicio?: string | null; estado?: string | null };
type Evento = { id: string; tipo: string; tutor_id?: string | null; titulo: string; destinatario_nome: string; animal_nome: string; mensagem: string; status: string; canal: string; agendado_para: string; metadados?: Record<string, unknown> | null; chave_dedupe?: string | null };
type Candidato = { id: string; tutorId: string; tutorNome: string; animalNome: string; dataOrigem: string; dias: number; resumo: string; origem: "registro" | "tutor" };

const EXCLUIR = /eutan[aá]s|[oó]bito|falecid|luto|destina[cç][aã]o de corpo/i;
const CONCLUIDOS = new Set(["concluido", "concluida", "finalizado", "finalizada", "realizado", "realizada", "atendido", "atendida"]);
const CANCELADOS = new Set(["cancelado", "cancelada", "recusado", "recusada", "rejeitado", "rejeitada"]);
const CLINICAL_KEY = "oricse-prontuario-animal-v1";
const MAX_ROWS = 5000;

function diaHoje() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function dataValida(data: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(data) && !Number.isNaN(Date.parse(data + "T12:00:00Z"));
}
function diasDesde(data: string): number {
  return Math.round((Date.parse(diaHoje() + "T12:00:00Z") - Date.parse(data + "T12:00:00Z")) / 86400000);
}
function parseRegistros(estado: unknown): Registro[] {
  if (!estado || typeof estado !== "object" || Array.isArray(estado)) return [];
  const texto = (estado as Record<string, unknown>)[CLINICAL_KEY];
  if (typeof texto !== "string") return [];
  try {
    const lista: unknown = JSON.parse(texto);
    return Array.isArray(lista) ? lista.filter((x): x is Registro => !!x && typeof x === "object" && !Array.isArray(x)) : [];
  } catch { throw new Error("Não foi possível interpretar os registros clínicos persistidos."); }
}
function autorizacao(t: Tutor, tipo: Area): boolean {
  const d = t.dados || {};
  if (d.autorizaWhatsapp !== true || d.autorizaLembretes !== true) return false;
  return tipo !== "ausentes" || d.autorizaMarketing === true;
}
function animalAtivo(a: Animal) {
  const dados = a.dados || {};
  return dados.obito !== true && dados.falecido !== true && !["obito", "falecido", "falecida"].includes(String(dados.status || "").toLowerCase());
}
function nomeTutor(t: Tutor) { return t.nome?.trim().split(/\s+/)[0] || "tutor"; }
function telefone(t: Tutor) {
  const bruto = String(t.telefone || t.outro_telefone || "").replace(/\D/g, "");
  const numero = bruto.length === 10 || bruto.length === 11 ? "55" + bruto : bruto;
  return /^55\d{10,11}$/.test(numero) ? numero : "";
}
async function validarAcesso(d: z.infer<typeof base>, operacao = false) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sessao, error } = await supabaseAdmin.auth.getUser(d.accessToken);
  if (error || !sessao.user) throw new Error("Sua sessão expirou.");
  await exigirPermissaoClinica(supabaseAdmin, sessao.user.id, d.clinicaId,
    operacao ? ["crm.enviar", "crm.gerenciar"] : ["crm.visualizar", "crm.enviar", "crm.gerenciar"], d.accessToken);
  return { admin: supabaseAdmin, usuarioId: sessao.user.id };
}
async function carregarBase(d: z.infer<typeof base>) {
  const { admin } = await validarAcesso(d);
  const [rt,ra,rr,rag,rev] = await Promise.all([
    admin.from("tutores").select("id,nome,telefone,outro_telefone,email,dados,created_at").eq("clinica_id",d.clinicaId).limit(MAX_ROWS),
    admin.from("oricse_animais").select("id,tutor_id,nome,dados").eq("clinica_id",d.clinicaId).limit(MAX_ROWS),
    admin.from("oricse_dados_modulos").select("dados").eq("clinica_id",d.clinicaId).eq("chave","estado_sistema").maybeSingle(),
    admin.from("oricse_agendamentos_online").select("tutor_id,inicio,estado").eq("clinica_id",d.clinicaId).limit(MAX_ROWS),
    admin.from("oricse_crm_eventos").select("id,tipo,tutor_id,titulo,destinatario_nome,animal_nome,mensagem,status,canal,agendado_para,metadados,chave_dedupe")
      .eq("clinica_id",d.clinicaId).in("tipo",["inativo","pesquisa_satisfacao"]).order("agendado_para",{ascending:false}).limit(MAX_ROWS),
  ]);
  if (rt.error || ra.error || rr.error || rag.error || rev.error) throw new Error("Não foi possível consultar os dados da Central de Relacionamento.");
  if ([rt.data?.length,ra.data?.length,rag.data?.length,rev.data?.length].some(n=>n===MAX_ROWS))
    throw new Error("A clínica possui registros demais para esta consulta. É necessária paginação para evitar uma lista incompleta.");
  return {
    tutores:(rt.data||[]) as Tutor[],
    animais:(ra.data||[]) as Animal[],
    registros:parseRegistros(rr.data?.dados).filter(r=>r.clinicaId===d.clinicaId && r.status==="concluido"),
    agendamentos:(rag.data||[]) as Agendamento[],
    eventos:(rev.data||[]) as Evento[],
  };
}
function listarCandidatos(baseDados: Awaited<ReturnType<typeof carregarBase>>, servico: Area, limiteDias: number): Candidato[] {
  const tutores = new Map(baseDados.tutores.map(t=>[t.id,t]));
  const animais = new Map(baseDados.animais.filter(animalAtivo).map(a=>[a.id,a]));
  const ultimo = new Map<string,{data:string; animalNome:string; id:string}>();
  const pesquisas:Candidato[]=[];
  for(const r of baseDados.registros){
    if (!r.id || !r.animalId || !r.data || !dataValida(r.data)) continue;
    const animal=animais.get(r.animalId);
    const tutor=animal && tutores.get(animal.tutor_id);
    if (!tutor || (r.tutorId && r.tutorId !== tutor.id)) continue;
    if (EXCLUIR.test([r.titulo,r.subtipo,r.detalhe].join(" "))) continue;
    const atual=ultimo.get(tutor.id);
    if (!atual || r.data > atual.data) ultimo.set(tutor.id,{data:r.data,animalNome:animal!.nome,id:r.id});
    const dias=diasDesde(r.data);
    if(servico==="satisfacao" && dias>=1 && dias<=14 && r.subtipo==="Consulta" && autorizacao(tutor,"satisfacao")){
      pesquisas.push({id:r.id,tutorId:tutor.id,tutorNome:tutor.nome,animalNome:animal!.nome,dataOrigem:r.data,dias,
        resumo:"Atendimento clínico concluído em "+r.data.split("-").reverse().join("/"),origem:"registro"});
    }
  }
  if(servico==="satisfacao"){
    const jaPreparadas=new Set(baseDados.eventos.filter(e=>e.tipo==="pesquisa_satisfacao").map(e=>e.chave_dedupe));
    return pesquisas.filter(c=>!jaPreparadas.has("pesquisa_satisfacao:registro:"+c.id)).slice(0,150);
  }
  // Apenas atendimentos realmente concluídos. Um agendamento solicitado/confirmado
  // nunca conta como atendimento realizado.
  for(const a of baseDados.agendamentos){
    if(!a.tutor_id || !a.inicio || !CONCLUIDOS.has(String(a.estado||"").toLowerCase()))continue;
    const data=a.inicio.slice(0,10);if(!dataValida(data))continue;
    const atual=ultimo.get(a.tutor_id);
    if(!atual || data>atual.data)ultimo.set(a.tutor_id,{data,animalNome:atual?.animalNome||"seu pet",id:atual?.id||a.tutor_id});
  }
  const haAgendamento=new Set(baseDados.agendamentos.filter(a=>
    a.tutor_id && a.inicio && a.inicio.slice(0,10)>=diaHoje() && !CANCELADOS.has(String(a.estado||"").toLowerCase())
  ).map(a=>a.tutor_id));
  const ultimaTentativa=new Map<string,number>();
  for(const e of baseDados.eventos.filter(e=>e.tipo==="inativo" && e.tutor_id)){
    const data=e.agendado_para?.slice(0,10);if(!data||!dataValida(data))continue;
    const dias=diasDesde(data);const atual=ultimaTentativa.get(e.tutor_id!);
    if(atual===undefined||dias<atual)ultimaTentativa.set(e.tutor_id!,dias);
  }
  return baseDados.tutores.flatMap((t):Candidato[]=>{
    if(!autorizacao(t,"ausentes")||!telefone(t)||haAgendamento.has(t.id))return [];
    if((ultimaTentativa.get(t.id)??9999)<90)return [];
    const last=ultimo.get(t.id);if(!last)return [];
    const dias=diasDesde(last.data);if(dias<limiteDias)return [];
    const animal=baseDados.animais.find(a=>a.tutor_id===t.id&&animalAtivo(a));
    if(!animal)return [];
    return [{id:t.id,tutorId:t.id,tutorNome:t.nome,animalNome:animal.nome,dataOrigem:last.data,dias,
      resumo:"Sem atendimento concluído há "+dias+" dias",origem:"tutor"}];
  }).sort((a,b)=>b.dias-a.dias).slice(0,200);
}
async function hash(token:string) {
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf),v=>v.toString(16).padStart(2,"0")).join("");
}
function novoToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,"0")).join("");
}
export const listarOportunidadesRelacionamento = createServerFn({method:"POST"})
  .validator((v:unknown)=>base.extend({servico:area,limiteDias:z.number().int().min(90).max(3650).optional()}).parse(v))
  .handler(async({data})=>{
    const dados=await carregarBase(data);
    return {
      candidatos:listarCandidatos(dados,data.servico,data.limiteDias||180),
      eventos:dados.eventos.filter(e=>e.tipo===(data.servico==="ausentes"?"inativo":"pesquisa_satisfacao")),
    };
  });

export const prepararOportunidadeRelacionamento = createServerFn({method:"POST"})
  .validator((v:unknown)=>base.extend({servico:area,origemId:z.string().uuid(),limiteDias:z.number().int().min(90).max(3650).optional()}).parse(v))
  .handler(async({data})=>{
    const {admin,usuarioId}=await validarAcesso(data,true);
    const dados=await carregarBase(data);
    const elegivel=listarCandidatos(dados,data.servico,data.limiteDias||180).find(c=>c.id===data.origemId);
    if(!elegivel)throw new Error("Este contato já foi preparado ou não atende mais às regras.");
    const tutor=dados.tutores.find(t=>t.id===elegivel.tutorId)!;
    const tipo=data.servico==="ausentes"?"inativo":"pesquisa_satisfacao";
    const chave=tipo==="inativo"
      ? "reativacao:mensal:"+elegivel.tutorId+":"+diaHoje().slice(0,7)
      : "pesquisa_satisfacao:registro:"+elegivel.id;
    const {data:existente}=await admin.from("oricse_crm_eventos").select("id")
      .eq("clinica_id",data.clinicaId).eq("chave_dedupe",chave).maybeSingle();
    if(existente)return {criado:false};
    let texto="";
    let extras:Record<string,unknown>={servico,data_origem:elegivel.dataOrigem,animal_nome:elegivel.animalNome,
      criado_pela_central:true,somente_envio_humano:true};
    if(data.servico==="ausentes"){
      texto="Olá, "+nomeTutor(tutor)+"! Tudo bem? Faz um tempo que não vemos "+elegivel.animalNome+
        " por aqui. Como ele(a) está? Se precisar de uma avaliação ou de qualquer orientação, estamos à disposição! 🐾";
    }else{
      const token=novoToken();
      const url="https://oricse.com.br/avaliar-atendimento?codigo="+token;
      texto="Olá, "+nomeTutor(tutor)+"! Gostaríamos de saber como foi o atendimento de "+elegivel.animalNome+
        ". Sua opinião nos ajuda a melhorar. Pode avaliar em um minuto? "+url+" Obrigado! 🐾";
      extras={...extras,pesquisa_token_hash:await hash(token),pesquisa_expira_em:new Date(Date.now()+21*86400000).toISOString()};
    }
    const {error}=await admin.from("oricse_crm_eventos").upsert({
      clinica_id:data.clinicaId,tutor_id:tutor.id,tutor_ref_local:tutor.id,destinatario_nome:tutor.nome,
      telefone:telefone(tutor),email:tutor.email||"",animal_nome:elegivel.animalNome,
      tipo,titulo:data.servico==="ausentes"?"Recuperação de cliente ausente":"Pesquisa de satisfação",
      mensagem:texto,canal:"whatsapp",agendado_para:new Date().toISOString(),
      status:"pendente",origem:"manual",chave_dedupe:chave,metadados:extras,criado_por:usuarioId,
    },{onConflict:"clinica_id,chave_dedupe",ignoreDuplicates:true});
    if(error)throw new Error("Não foi possível preparar o contato: "+error.message);
    return {criado:true};
  });

export const obterWhatsAppJornada = createServerFn({method:"POST"})
  .validator((v:unknown)=>base.extend({eventoId:z.string().uuid()}).parse(v))
  .handler(async({data})=>{
    const {admin}=await validarAcesso(data,true);
    const {data:evento,error}=await admin.from("oricse_crm_eventos")
      .select("id,tipo,tutor_id,clinica_id").eq("id",data.eventoId).eq("clinica_id",data.clinicaId).maybeSingle();
    if(error||!evento||!evento.tutor_id||!["pos_cirurgico","inativo","pesquisa_satisfacao"].includes(evento.tipo))
      throw new Error("Contato não encontrado nesta clínica.");
    const {data:tutor,error:e}=await admin.from("tutores")
      .select("id,telefone,outro_telefone,dados").eq("id",evento.tutor_id).eq("clinica_id",data.clinicaId).maybeSingle();
    if(e||!tutor)throw new Error("Tutor não encontrado nesta clínica.");
    const dados=tutor.dados||{};
    if(dados.autorizaWhatsapp!==true || dados.autorizaLembretes!==true ||
      (evento.tipo==="inativo" && dados.autorizaMarketing!==true))
      throw new Error("O tutor não autorizou este tipo de contato.");
    const numero=telefone(tutor as Tutor);
    if(!numero)throw new Error("Telefone WhatsApp inválido ou ausente.");
    return {numero};
  });

export const atualizarContatoJornada = createServerFn({method:"POST"})
  .validator((v:unknown)=>base.extend({eventoId:z.string().uuid(),status:z.enum(["enviado","ignorado"])}).parse(v))
  .handler(async({data})=>{
    const {admin}=await validarAcesso(data,true);
    const {data:evento,error}=await admin.from("oricse_crm_eventos")
      .select("id,tipo,status").eq("id",data.eventoId).eq("clinica_id",data.clinicaId).maybeSingle();
    if(error||!evento||!["pos_cirurgico","inativo","pesquisa_satisfacao"].includes(evento.tipo))
      throw new Error("Contato inválido.");
    if(evento.status!=="pendente")return {alterado:false};
    const {error:erro}=await admin.from("oricse_crm_eventos")
      .update({status:data.status,...(data.status==="enviado"?{enviado_em:new Date().toISOString()}:{})})
      .eq("id",data.eventoId).eq("clinica_id",data.clinicaId).eq("status","pendente");
    if(erro)throw new Error("Não foi possível atualizar o contato.");
    return {alterado:true};
  });

export const responderPesquisaSatisfacao = createServerFn({method:"POST"})
  .validator((v:unknown)=>z.object({
    codigo:z.string().regex(/^[a-f0-9]{48}$/),
    nota:z.number().int().min(1).max(5),
    comentario:z.string().trim().max(700).optional(),
  }).parse(v))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {data:evento,error}=await supabaseAdmin.from("oricse_crm_eventos")
      .select("id,metadados").eq("tipo","pesquisa_satisfacao")
      .eq("metadados->>pesquisa_token_hash",await hash(data.codigo)).maybeSingle();
    if(error||!evento)throw new Error("Pesquisa inválida ou encerrada.");
    const metadados=evento.metadados||{};
    if(metadados.pesquisa_nota)throw new Error("Esta pesquisa já foi respondida. Obrigado!");
    const expira=String(metadados.pesquisa_expira_em||"");
    if(!expira||new Date(expira).getTime()<Date.now())throw new Error("O prazo desta pesquisa expirou.");
    const {error:falha}=await supabaseAdmin.from("oricse_crm_eventos")
      .update({metadados:{...metadados,pesquisa_nota:data.nota,pesquisa_comentario:data.comentario||"",
        pesquisa_respondida_em:new Date().toISOString()}})
      .eq("id",evento.id).is("metadados->>pesquisa_respondida_em",null);
    if(falha)throw new Error("Não foi possível registrar a avaliação.");
    return {ok:true};
  });
