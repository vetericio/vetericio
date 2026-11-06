// Coleta independente do OricStudio. Cada conta pertence a uma única clínica.
// O agendador nunca lê tokens do Gestor 2.0 ou do navegador.
import {decryptMetaToken} from "@/lib/oricstudio-meta.server";

type Db=any;
type Conta={
  id:string;clinica_id:string|null;instagram_user_id:string;
  login_tipo:string;status:string;token_expira_em:string|null;
};
function graphRoot(direct:boolean) {
  return direct?"https://graph.instagram.com/v26.0":"https://graph.facebook.com/v26.0";
}
async function graph<T=any>(path:string,token:string,params:Record<string,string>={}) {
  const url=new URL(path);
  url.searchParams.set("access_token",token);
  for(const [key,val] of Object.entries(params))url.searchParams.set(key,val);
  const res=await fetch(url,{signal:AbortSignal.timeout(30000)});
  const obj:any=await res.json().catch(()=>null);
  if(!res.ok||!obj||obj.error)throw new Error("A Meta recusou a coleta ou o token expirou.");
  return obj as T;
}
async function isActiveTenant(db:Db,id:string|null) {
  if(id===null)return true; // Plataforma interna só aparece via serviço de administração.
  const [{data:clinic},{data:license}]=await Promise.all([
    db.from("clinicas").select("status,excluido_em").eq("id",id).maybeSingle(),
    db.from("oricstudio_licencas").select("status,expira_em")
      .eq("clinica_id",id).maybeSingle(),
  ]);
  return clinic?.status==="ativa"&&!clinic.excluido_em&&license?.status==="ativo"&&
    (!license.expira_em||Date.parse(license.expira_em)>Date.now());
}
async function tokenFor(db:Db,account:Conta) {
  const {data:encrypted,error}=await db.from("oricstudio_meta_tokens")
    .select("token_cifrado_base64,iv_base64,token_expira_em")
    .eq("conta_id",account.id).maybeSingle();
  if(error||!encrypted||encrypted.token_expira_em&&Date.parse(encrypted.token_expira_em)<Date.now())
    throw new Error("Credencial Meta ausente ou expirada.");
  return decryptMetaToken(encrypted.token_cifrado_base64,encrypted.iv_base64);
}
async function collectAccount(db:Db,account:Conta) {
  if(!await isActiveTenant(db,account.clinica_id))
    return {conta_id:account.id,status:"licenca_inativa"};
  try {
    const token=await tokenFor(db,account);
    const root=graphRoot(account.login_tipo==="instagram");
    const path=account.login_tipo==="instagram"?"/me":"/"+encodeURIComponent(account.instagram_user_id);
    const profile=await graph(root+path,token,{fields:"id,username,followers_count,media_count"});
    const followerCount=Number(profile.followers_count);
    const mediaCount=Number(profile.media_count);
    const data={
      username:String(profile.username||""),
      ...(Number.isFinite(followerCount)?{seguidores:followerCount}:{}),
      ...(Number.isFinite(mediaCount)?{publicacoes:mediaCount}:{}),
    };
    const today=new Date().toISOString().slice(0,10);
    const {error:insightsError}=await db.from("oricstudio_insights").upsert({
      clinica_id:account.clinica_id,conta_id:account.id,
      referencia:today,tipo:"perfil",dados:data,coletado_em:new Date().toISOString(),
    },{onConflict:"conta_id,referencia,tipo"});
    if(insightsError)throw new Error("Falha ao armazenar as métricas desta conta.");
    let count=0;
    try {
      const media=await graph<{data?:Array<{id:string}>}>(root+path.replace("/me","/"+encodeURIComponent(account.instagram_user_id))+"/media",token,{
        fields:"id,timestamp",limit:"12",
      });
      for(const post of media.data||[]) {
        if(!/^\d+$/.test(String(post.id)))continue;
        const response=await graph<{data?:Array<{id:string;text?:string;username?:string;timestamp?:string}>}>(
          root+"/"+encodeURIComponent(post.id)+"/comments",token,{
            fields:"id,text,username,timestamp",limit:"50",
          });
        for(const comment of response.data||[]) {
          if(!/^\d+$/.test(String(comment.id)))continue;
          const {error:commentError}=await db.from("oricstudio_comentarios").upsert({
            clinica_id:account.clinica_id,conta_id:account.id,
            id_comentario_meta:comment.id,id_midia_meta:post.id,
            autor:comment.username||null,texto:String(comment.text||"").slice(0,8000),
            publicado_em:comment.timestamp||null,atualizado_em:new Date().toISOString(),
          },{onConflict:"conta_id,id_comentario_meta"});
          if(commentError)throw new Error("Falha ao salvar comentário da clínica.");
          count++;
        }
      }
    }catch(e){
      await db.from("oricstudio_alertas").insert({
        clinica_id:account.clinica_id,conta_id:account.id,tipo:"coleta_comentarios",
        mensagem:"Métricas do perfil atualizadas; comentários indisponíveis pelas permissões Meta.",
      });
    }
    return {conta_id:account.id,status:"ok",comentarios:count};
  }catch {
    await db.from("oricstudio_alertas").insert({
      clinica_id:account.clinica_id,conta_id:account.id,tipo:"coleta_metricas",
      mensagem:"Não foi possível coletar as métricas. Verifique a conexão e as permissões Instagram.",
    });
    return {conta_id:account.id,status:"erro"};
  }
}
export async function coletarOricStudio(db:Db,limit=30) {
  if(process.env["ORICSTUDIO_COLETA_HOMOLOGADA"]!=="true")
    return {pausado:true,motivo:"Coleta Meta ainda não homologada.",processados:0};
  const {data:accounts,error}=await db.from("oricstudio_meta_contas")
    .select("id,clinica_id,instagram_user_id,login_tipo,status,token_expira_em")
    .eq("status","ativa").limit(Math.min(Math.max(limit,1),100));
  if(error)throw new Error("Falha ao consultar contas OricStudio.");
  const out:Array<{conta_id:string;status:string;comentarios?:number}>=[];
  for(const account of (accounts||[]) as Conta[])out.push(await collectAccount(db,account));
  return {pausado:false,processados:out.length,resultados:out};
}
