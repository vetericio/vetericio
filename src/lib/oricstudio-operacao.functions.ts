import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {ORICSTUDIO_PLATAFORMA_ID} from "@/lib/oricstudio-plataforma";

const base=z.object({
  accessToken:z.string().min(20),
  clinicaId:z.string().uuid(),
});
type Db=any;
function filterTenant(query:any,clinicId:string){
  return clinicId===ORICSTUDIO_PLATAFORMA_ID
    ? query.is("clinica_id",null)
    : query.eq("clinica_id",clinicId);
}
async function context(accessToken:string,clinicId:string,write=false){
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {requireMetaEditor}=await import("@/lib/oricstudio-meta.server");
  const actor=await requireMetaEditor(supabaseAdmin,accessToken,clinicId,true);
  if(!actor.isPlatformAdmin && !write) {
    const {data:link,error}=await supabaseAdmin.from("clinica_usuarios")
      .select("user_id,ativo").eq("user_id",actor.userId)
      .eq("clinica_id",clinicId).eq("ativo",true).maybeSingle();
    if(error||!link)throw new Error("Você não tem acesso a esta clínica.");
  }
  return {db:supabaseAdmin as Db,actor};
}
function safeError(error:unknown,message:string) {
  if(error)throw new Error(message);
}
function noteQuery(query:any,prefix:string) {
  return query.order(prefix,{ascending:false}).limit(100);
}
export const consultarOperacaoOricStudio=createServerFn({method:"POST"})
  .validator((i:unknown)=>base.parse(i))
  .handler(async({data})=>{
    const {db}=await context(data.accessToken,data.clinicaId);
    const names=[
      ["envios","oricstudio_envios","id,publicacao_id,conta_id,planejado_para,status,formato,tentativas,erro_resumido,url_publicacao,criado_em","planejado_para"],
      ["insights","oricstudio_insights","id,conta_id,referencia,tipo,dados,coletado_em","coletado_em"],
      ["comentarios","oricstudio_comentarios","id,conta_id,autor,texto,publicado_em,categoria,requer_humano,resposta_sugerida,respondido,arquivado","publicado_em"],
      ["alertas","oricstudio_alertas","id,conta_id,tipo,mensagem,resolvido,criado_em","criado_em"],
      ["regras","oricstudio_regras_automacao","id,conta_id,modo,ativa,max_por_dia,max_por_semana,precisa_aprovacao,suspensa_em","atualizada_em"],
      ["relatorios","oricstudio_relatorios","id,conta_id,tipo,periodo_inicio,periodo_fim,conteudo,gerado_em","gerado_em"],
    ] as const;
    const results=await Promise.all(names.map(async([key,table,columns,order])=>{
      const {data:rows,error}=await noteQuery(filterTenant(db.from(table)
        .select(columns),data.clinicaId),order);
      safeError(error,"Não foi possível carregar "+key+" desta clínica.");
      return [key,rows||[]] as const;
    }));
    return Object.fromEntries(results) as Record<(typeof names)[number][0],any[]>;
  });

export const prepararEnvioOricStudio=createServerFn({method:"POST"})
  .validator((i:unknown)=>base.extend({
    publicacaoId:z.string().uuid(),
    contaId:z.string().uuid(),
    // A publicação requer mídia pública permitida e validação de formato
    // antes de qualquer envio Meta; mídia privada não é publicada.
    midias:z.array(z.string().uuid()).min(1).max(10),
  }).parse(i))
  .handler(async({data})=>{
    const {db,actor}=await context(data.accessToken,data.clinicaId,true);
    const modoPlataforma=data.clinicaId===ORICSTUDIO_PLATAFORMA_ID;
    const postsTable=modoPlataforma?"oricstudio_sistema_publicacoes":"oricstudio_publicacoes";
    const midiasTable=modoPlataforma?"oricstudio_sistema_midias":"oricstudio_midias";
    const {data:post,error:postError}=await filterTenant(db.from(postsTable)
      .select("id,titulo,legenda,tipo,status,planejado_para")
      .eq("id",data.publicacaoId),data.clinicaId).maybeSingle();
    if(postError||!post)throw new Error("Publicação não encontrada nesta clínica.");
    if(post.status!=="aprovado")throw new Error("Aprovação editorial obrigatória antes de agendar.");
    if(!post.planejado_para||Date.parse(post.planejado_para)<=Date.now())
      throw new Error("Defina uma data futura para o envio.");
    const {data:account,error:accountError}=await filterTenant(
      db.from("oricstudio_meta_contas").select("id,status").eq("id",data.contaId),
      data.clinicaId).maybeSingle();
    if(accountError||account?.status!=="ativa")
      throw new Error("Conta não conectada ou pertencente a outra clínica.");
    const {data:files,error:fileError}=await filterTenant(db.from(midiasTable)
      .select("id,caminho_privado,tipo").in("id",data.midias),data.clinicaId);
    if(fileError || files?.length!==data.midias.length)
      throw new Error("Uma ou mais mídias não pertencem à clínica.");
    // A biblioteca continua PRIVADA no Google Drive. Não supor que seja URL
    // pública para a Meta e não promover arquivos privados silenciosamente.
    throw new Error("Arquivos validados. Para publicar é necessário preparar uma URL temporária de mídia autorizada pela Meta; a biblioteca privada nunca será exposta automaticamente.");
  });

export const resolverAlertaOricStudio=createServerFn({method:"POST"})
 .validator((i:unknown)=>base.extend({alertaId:z.string().uuid()}).parse(i))
 .handler(async({data})=>{
   const {db}=await context(data.accessToken,data.clinicaId,true);
   const {data:row,error}=await filterTenant(db.from("oricstudio_alertas")
     .update({resolvido:true,resolvido_em:new Date().toISOString()})
     .eq("id",data.alertaId),data.clinicaId).select("id").maybeSingle();
   if(error||!row)throw new Error("Alerta não encontrado nesta clínica.");
   return {ok:true};
 });

export const salvarRegraOricStudio=createServerFn({method:"POST"})
 .validator((i:unknown)=>base.extend({
   contaId:z.string().uuid(),
   modo:z.enum(["assistido","automatico_regras","gestao_ampliada"]),
   maxPorDia:z.number().int().min(0).max(50),
   maxPorSemana:z.number().int().min(0).max(200),
   ativa:z.boolean(),
   precisaAprovacao:z.boolean(),
 }).parse(i))
 .handler(async({data})=>{
   const {db}=await context(data.accessToken,data.clinicaId,true);
   const {data:account,error}=await filterTenant(db.from("oricstudio_meta_contas")
     .select("id").eq("id",data.contaId),data.clinicaId).maybeSingle();
   if(error||!account)throw new Error("Conta de outra clínica.");
   const {error:saveError}=await db.from("oricstudio_regras_automacao").upsert({
     clinica_id:data.clinicaId===ORICSTUDIO_PLATAFORMA_ID?null:data.clinicaId,
     conta_id:data.contaId,modo:data.modo,ativa:data.ativa,
     max_por_dia:data.maxPorDia,max_por_semana:data.maxPorSemana,
     precisa_aprovacao:data.precisaAprovacao,
     atualizada_em:new Date().toISOString(),
   },{onConflict:"conta_id"});
   safeError(saveError,"Não foi possível salvar a regra.");
   return {ok:true};
 });
