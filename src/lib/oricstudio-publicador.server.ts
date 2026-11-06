// OricStudio: publicador independente, derivado das garantias de idempotência
// do Gestor 2.0. Executar apenas em servidor, com credenciais do ORICSE.
import {ORICSTUDIO_PLATAFORMA_ID} from "@/lib/oricstudio-plataforma";
import {criarLinkTemporarioOricstudio} from "@/lib/oricstudio-midia.server";
import {decryptMetaToken} from "@/lib/oricstudio-meta.server";

type Db=any;
type Envio={
  id:string;clinica_id:string|null;conta_id:string;formato:string;legenda:string;
  status:string;planejado_para:string;midias:{id:string;tipo:string}[];
  conteiner_meta:string|null;conteineres_filhos:string[]|null;
  iniciada_publicacao_em:string|null;tentativas:number;
};
function rootUrl(direto:boolean){
  return direto?"https://graph.instagram.com/v26.0":"https://graph.facebook.com/v26.0";
}
async function graph(url:URL,fields?:Record<string,string>) {
  const res=await fetch(url,{method:fields?"POST":"GET",
    ...(fields?{body:new URLSearchParams(fields)}:{}),signal:AbortSignal.timeout(30000)});
  const body:any=await res.json().catch(()=>null);
  if(!res.ok || !body || body.error) {
    // Não registrar o token presente na URL nem na resposta da Meta.
    throw new Error("A Meta recusou a operação solicitada ou houve falha de rede.");
  }
  return body as {id?:string;status_code?:string;permalink?:string};
}
function graphUrl(root:string,path:string,token:string){
  const url=new URL(root+path);url.searchParams.set("access_token",token);return url;
}
async function getMeta(root:string,path:string,token:string,query?:Record<string,string>) {
  const url=graphUrl(root,path,token);
  for(const [k,v] of Object.entries(query||{}))url.searchParams.set(k,v);
  return graph(url);
}
async function postMeta(root:string,path:string,token:string,params:Record<string,string>) {
  const url=new URL(root+path);
  return graph(url,{...params,access_token:token});
}
async function alterar(db:Db,id:string,values:Record<string,unknown>) {
  const {error}=await db.from("oricstudio_envios").update({
    ...values,atualizado_em:new Date().toISOString(),
  }).eq("id",id);
  if(error)throw new Error("Falha ao registrar progresso do envio.");
}
async function evento(db:Db,envio:Envio,etapa:string,resultado:string,detalhe:string) {
  await db.from("oricstudio_envio_eventos").insert({
    clinica_id:envio.clinica_id,envio_id:envio.id,etapa,resultado,detalhe:detalhe.slice(0,500),
  });
}
async function alerta(db:Db,envio:Envio,mensagem:string) {
  await db.from("oricstudio_alertas").insert({
    clinica_id:envio.clinica_id,conta_id:envio.conta_id,tipo:"falha_publicacao",
    mensagem:mensagem.slice(0,400),referencia:envio.id,
  });
}
async function falha(db:Db,envio:Envio,mensagem:string) {
  if(envio.iniciada_publicacao_em){
    await alterar(db,envio.id,{
      status:"resultado_desconhecido",bloqueado_ate:null,erro_resumido:
        "A confirmação da Meta não chegou. Verifique o Instagram antes de reenviar.",
    });
    await alerta(db,envio,"Resultado incerto. Verifique a publicação na conta antes de qualquer reenvio.");
    await evento(db,envio,"media_publish","incerto","Não repetir publicação sem verificação.");
    return "resultado_desconhecido";
  }
  const tentativas=(envio.tentativas||0)+1;
  const definitivo=tentativas>=5;
  const esperaMinutos=[1,2,5,15,30][Math.min(tentativas-1,4)]||30;
  await alterar(db,envio.id,{
    status:definitivo?"falhou":"agendado",tentativas,
    proxima_tentativa:definitivo?null:new Date(Date.now()+esperaMinutos*60000).toISOString(),
    bloqueado_ate:null,erro_resumido:mensagem.slice(0,240),
  });
  await evento(db,envio,"preparacao","falhou",mensagem);
  if(definitivo)await alerta(db,envio,"Publicação suspensa após cinco tentativas.");
  return definitivo?"falhou":"aguardando_tentativa";
}
async function aguardar(db:Db,envio:Envio,etapa:string) {
  await alterar(db,envio.id,{
    status:"aguardando_meta",etapa,bloqueado_ate:null,
    proxima_tentativa:new Date(Date.now()+2*60000).toISOString(),
  });
  return "aguardando_meta";
}
async function contaValida(db:Db,envio:Envio){
  const {data:account,error}=await db.from("oricstudio_meta_contas")
    .select("id,instagram_user_id,clinica_id,status,login_tipo,account_type,token_expira_em")
    .eq("id",envio.conta_id).maybeSingle();
  if(error||!account||account.status!=="ativa"||
     account.clinica_id!==envio.clinica_id ||
     (account.token_expira_em&&Date.parse(account.token_expira_em)<=Date.now()))
    throw new Error("Conta desconectada, de outro ambiente ou token expirado.");
  const {data:secret}=await db.from("oricstudio_meta_tokens")
    .select("token_cifrado_base64,iv_base64").eq("conta_id",envio.conta_id).maybeSingle();
  if(!secret)throw new Error("Conta sem token ativo.");
  const token=await decryptMetaToken(secret.token_cifrado_base64,secret.iv_base64);
  return {id:String(account.instagram_user_id),token,
    root:rootUrl(account.login_tipo==="instagram"),
    accountType:String(account.account_type||"")};
}
function validarMidias(envio:Envio) {
  if(!Array.isArray(envio.midias)||envio.midias.length<1||envio.midias.length>10)
    throw new Error("Nenhuma mídia válida para esta publicação.");
  if(envio.formato==="carrossel" && envio.midias.length<2)
    throw new Error("Carrossel requer duas mídias.");
  if(envio.formato!=="carrossel" && envio.midias.length!==1)
    throw new Error("Formato exige exatamente uma mídia.");
}
async function container(db:Db,envio:Envio,ctx:Awaited<ReturnType<typeof contaValida>>) {
  const clinic=envio.clinica_id||ORICSTUDIO_PLATAFORMA_ID;
  const urls=envio.midias.map(m=>criarLinkTemporarioOricstudio(m.id,clinic,6));
  const raiz=`/${encodeURIComponent(ctx.id)}`;
  if(envio.formato==="carrossel") {
    const filhos=[...(envio.conteineres_filhos||[])];
    for(let i=filhos.length;i<urls.length;i++){
      const m=envio.midias[i]!;
      const args:Record<string,string>={is_carousel_item:"true"};
      args[m.tipo==="video"?"video_url":"image_url"]=urls[i]!;
      if(m.tipo==="video")args.media_type="VIDEO";
      const created=await postMeta(ctx.root,raiz+"/media",ctx.token,args);
      if(!created.id)throw new Error("A Meta não gerou o item do carrossel.");
      filhos.push(created.id);
      await alterar(db,envio.id,{conteineres_filhos:filhos,etapa:"filhos_carrossel"});
    }
    for(const id of filhos){
      const status=await getMeta(ctx.root,`/${encodeURIComponent(id)}`,ctx.token,{fields:"status_code"});
      if(status.status_code==="ERROR"||status.status_code==="EXPIRED")
        throw new Error("Um item do carrossel foi rejeitado.");
      if(status.status_code!=="FINISHED")return null;
    }
    const parent=await postMeta(ctx.root,raiz+"/media",ctx.token,{
      media_type:"CAROUSEL",children:filhos.join(","),caption:envio.legenda,
    });
    if(!parent.id)throw new Error("A Meta não gerou o carrossel.");
    await alterar(db,envio.id,{conteiner_meta:parent.id,etapa:"carrossel_pronto"});
    return parent.id;
  }
  if(envio.formato==="story" && ctx.accountType && ctx.accountType!=="BUSINESS")
    throw new Error("Stories pela API exigem Instagram Business.");
  const args:Record<string,string>={};
  const media=envio.midias[0]!;
  args[media.tipo==="video"?"video_url":"image_url"]=urls[0]!;
  if(envio.formato==="reels") {
    args.media_type="REELS";args.caption=envio.legenda;args.share_to_feed="true";
  }else if(envio.formato==="story") {
    args.media_type="STORIES";
  }else {
    args.caption=envio.legenda;
  }
  const created=await postMeta(ctx.root,raiz+"/media",ctx.token,args);
  if(!created.id)throw new Error("A Meta não gerou contêiner de publicação.");
  await alterar(db,envio.id,{conteiner_meta:created.id,etapa:"conteiner_pronto"});
  return created.id;
}
async function processar(db:Db,envio:Envio) {
  if(envio.iniciada_publicacao_em) {
    // Regra crítica de idempotência. Se a chamada anterior teve resultado incerto,
    // não efetuar segunda chamada a media_publish.
    await alterar(db,envio.id,{status:"resultado_desconhecido",bloqueado_ate:null});
    await evento(db,envio,"media_publish","revisao_manual","Publicação não repetida.");
    return "resultado_desconhecido";
  }
  try {
    validarMidias(envio);
    const ctx=await contaValida(db,envio);
    const id=envio.conteiner_meta || await container(db,envio,ctx);
    if(!id)return aguardar(db,envio,"aguardando_carrossel");
    const state=await getMeta(ctx.root,`/${encodeURIComponent(id)}`,ctx.token,
      {fields:"status_code"});
    if(state.status_code==="EXPIRED"||state.status_code==="ERROR")
      throw new Error("Contêiner Meta expirado ou recusado.");
    if(state.status_code==="PUBLISHED") {
      await alterar(db,envio.id,{
        status:"resultado_desconhecido",bloqueado_ate:null,
        erro_resumido:"A Meta informa PUBLISHED sem ID do envio. Verificar manualmente.",
      });
      return "resultado_desconhecido";
    }
    if(state.status_code!=="FINISHED")
      return aguardar(db,envio,"processamento_meta");
    // Marcação DURÁVEL acontece antes do request externo. Se cair a conexão,
    // a execução seguinte jamais faz outra chamada, evitando duplicatas.
    const iniciadoEm=new Date().toISOString();
    await alterar(db,envio.id,{
      status:"resultado_desconhecido",iniciada_publicacao_em:iniciadoEm,
      bloqueado_ate:null,etapa:"media_publish_iniciado",
    });
    envio.iniciada_publicacao_em=iniciadoEm;
    const published=await postMeta(ctx.root,`/${encodeURIComponent(ctx.id)}/media_publish`,
      ctx.token,{creation_id:id});
    if(!published.id)throw new Error("Resposta Meta sem ID da publicação.");
    let link:string|null=null;
    try {
      const media=await getMeta(ctx.root,`/${encodeURIComponent(published.id)}`,
        ctx.token,{fields:"permalink"});
      if(media.permalink?.startsWith("https://www.instagram.com/"))link=media.permalink;
    }catch{}
    await alterar(db,envio.id,{
      status:"publicado",midia_publicada_meta:published.id,url_publicacao:link,
      bloqueado_ate:null,meta_publicacao_confirmada_em:new Date().toISOString(),
      proxima_tentativa:null,erro_resumido:null,etapa:"concluido",
    });
    await evento(db,envio,"media_publish","publicado","Meta confirmou "+published.id);
    return "publicado";
  }catch(e){
    return falha(db,envio,e instanceof Error?e.message:"Falha não identificada.");
  }
}
export async function processarFilaOricstudio(db:Db,limite=3) {
  if(process.env["ORICSTUDIO_PUBLICACAO_HOMOLOGADA"]!=="true") {
    return {pausado:true,motivo:"Publicação automática ainda não homologada.",processados:0};
  }
  if(!process.env["ORICSTUDIO_MIDIA_SIGNING_KEY"])
    throw new Error("Gateway de mídia não configurado.");
  const {data:jobs,error}=await db.rpc("oricstudio_claim_envios",{p_limite:Math.min(10,Math.max(1,limite))});
  if(error)throw new Error("Não foi possível reservar a fila.");
  const results:Array<{id:string;status:string}>=[];
  for(const row of jobs||[]){
    const status=await processar(db,row as Envio);
    results.push({id:row.id,status});
  }
  return {pausado:false,processados:results.length,resultados:results};
}
