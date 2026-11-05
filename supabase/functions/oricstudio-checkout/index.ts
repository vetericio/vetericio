import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Integração de cobrança isolada do OricStúdio. Não compartilhar pedidos nem webhooks
// com oricse-planos-checkout; reutiliza apenas a credencial da mesma conta recebedora.
const ORIGIN = "https://oricse.vetericio.workers.dev";
const API = "https://api.mercadopago.com";
const token = () => Deno.env.get("ORICSE_MP_ACCESS_TOKEN") || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";
const secret = () => Deno.env.get("ORICSE_MP_WEBHOOK_SECRET") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(supabaseUrl, serviceKey);
const HEADERS = {
  "content-type":"application/json",
  "cache-control":"no-store",
  "access-control-allow-origin":ORIGIN,
  "access-control-allow-headers":"authorization,apikey,content-type",
  "access-control-allow-methods":"POST,OPTIONS",
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:HEADERS});
const uuid=(s:unknown)=>typeof s==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const errorText=(e:unknown)=>e instanceof Error?e.message:"Erro no checkout";
type Pedido = {
  id:string;clinica_id:string;solicitado_por:string;quantidade_contas:number;
  valor_mensal_centavos:number;status:string;mp_assinatura_id:string|null;
  mp_assinatura_status:string|null;
};

async function mpFetch(path:string,method="GET",payload?:unknown,idempotencyKey?:string){
  const key=token();
  if(!key)throw new Error("Mercado Pago não está configurado.");
  const response=await fetch(API+path,{
    method,
    headers:{
      "Authorization":"Bearer "+key,
      "Accept":"application/json",
      ...(payload?{"Content-Type":"application/json"}:{}),
      ...(idempotencyKey?{"X-Idempotency-Key":idempotencyKey}:{}),
    },
    ...(payload?{body:JSON.stringify(payload)}:{}),
  });
  const item=await response.json().catch(()=>null) as Record<string,unknown>|null;
  if(!response.ok||!item)throw new Error("O Mercado Pago não confirmou a operação.");
  return item;
}

async function checkout(req:Request){
  const authHeader=req.headers.get("authorization") || "";
  const userToken=authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!userToken)return json({error:"Faça login na sua clínica."},401);
  const {data:user,error:authError}=await db.auth.getUser(userToken);
  if(authError||!user.user?.email||!user.user.id)return json({error:"Sessão expirada ou sem e-mail."},401);
  const email=user.user.email;
  const body=await req.json().catch(()=>null) as {solicitacao_id?:string}|null;
  if(!uuid(body?.solicitacao_id))return json({error:"Solicitação inválida."},400);
  const id=body!.solicitacao_id!;
  const {data:p,error}=await db.from("oricstudio_solicitacoes")
    .select("id,clinica_id,solicitado_por,quantidade_contas,valor_mensal_centavos,status,mp_assinatura_id,mp_assinatura_status")
    .eq("id",id).maybeSingle();
  if(error||!p)return json({error:"Solicitação não encontrada."},404);
  const pedido=p as Pedido;
  const [{data:link},{data:current},{data:product},{data:clinic}]=await Promise.all([
    db.from("clinica_usuarios").select("papel,ativo").eq("user_id",user.user.id).eq("clinica_id",pedido.clinica_id).maybeSingle(),
    db.from("oricse_clinica_ativa_usuario").select("clinica_id").eq("user_id",user.user.id).maybeSingle(),
    db.from("oricstudio_produto").select("comercializacao_ativa").eq("codigo","oricstudio").single(),
    db.from("clinicas").select("status,nome").eq("id",pedido.clinica_id).maybeSingle(),
  ]);
  if(!link?.ativo || !["responsavel","admin_clinica","rt"].includes(link.papel)||
     current?.clinica_id!==pedido.clinica_id||
     pedido.solicitado_por!==user.user.id)return json({error:"Acesso não autorizado para esta clínica."},403);
  if(clinic?.status!=="ativa")return json({error:"Clínica não está ativa."},409);
  if(!product?.comercializacao_ativa)return json({error:"Contratações do OricStúdio ainda não estão liberadas."},503);
  if(!Number.isSafeInteger(pedido.valor_mensal_centavos)||pedido.valor_mensal_centavos<=0)
    return json({error:"Preço da assinatura inválido."},409);
  if(!secret())return json({error:"Webhook Mercado Pago ainda não configurado."},503);

  if(pedido.mp_assinatura_id){
    const existing=await mpFetch("/preapproval/"+encodeURIComponent(pedido.mp_assinatura_id));
    if(existing.external_reference!==id)throw new Error("Assinatura existente não confere.");
    if(existing.status==="cancelled")return json({error:"A assinatura foi cancelada. Entre em contato com o suporte."},409);
    if(typeof existing.init_point==="string"&&existing.init_point.startsWith("https://"))
      return json({checkout_url:existing.init_point,pedido_id:id});
    return json({error:"Assinatura já iniciada. Aguarde a confirmação do pagamento."},409);
  }
  if(pedido.status!=="aguardando_checkout")return json({error:"Este pedido já foi iniciado."},409);

  // Reserva atômica contra múltiplos cliques: somente uma chamada cria o checkout.
  const {data:reserved,error:reserveError}=await db.from("oricstudio_solicitacoes")
    .update({status:"pagamento_pendente",atualizado_em:new Date().toISOString()})
    .eq("id",id).eq("status","aguardando_checkout").select("id").maybeSingle();
  if(reserveError||!reserved)return json({error:"Este checkout já está sendo preparado."},409);
  try{
    const body={
      reason:"OricStúdio — "+pedido.quantidade_contas+" conta(s) Instagram",
      external_reference:id,
      payer_email:email,
      back_url:ORIGIN+"/oricstudio?retorno_pagamento=pendente",
      auto_recurring:{
        frequency:1,frequency_type:"months",
        transaction_amount:pedido.valor_mensal_centavos/100,currency_id:"BRL",
      },
    };
    const created=await mpFetch("/preapproval","POST",body,"oricstudio-assinatura-"+id);
    if(typeof created.id!=="string"||typeof created.init_point!=="string"||
       !created.init_point.startsWith("https://"))
      throw new Error("Checkout não retornou endereço confiável.");
    const {error:saveError}=await db.from("oricstudio_solicitacoes").update({
      mp_assinatura_id:created.id,mp_assinatura_status:String(created.status||"pending"),
      provedor:"mercadopago",atualizado_em:new Date().toISOString(),
      ultimo_erro_checkout:null,
    }).eq("id",id).eq("status","pagamento_pendente");
    if(saveError)throw new Error("Assinatura criada, mas não foi possível registrar o código. Contate o suporte.");
    return json({checkout_url:created.init_point,pedido_id:id});
  }catch(e){
    // Em falhas após criação no MP não recriar automaticamente; chave idempotente
    // permite recuperar assinaturas existentes, mas exige conciliação pelo suporte.
    await db.from("oricstudio_solicitacoes").update({
      ultimo_erro_checkout:"Falha na criação ou persistência do checkout",
      atualizado_em:new Date().toISOString(),
    }).eq("id",id);
    return json({error:errorText(e)},502);
  }
}

async function validateWebhook(req:Request,paymentId:string){
  const key=secret();
  if(!key)throw new Error("Webhook sem segredo configurado.");
  const signature=req.headers.get("x-signature")||"";
  const requestId=req.headers.get("x-request-id")||"";
  const ts=signature.match(/(?:^|,)\s*ts=([^,]+)/)?.[1];
  const v1=signature.match(/(?:^|,)\s*v1=([^,]+)/)?.[1];
  if(!ts||!v1||!requestId||!/^[a-f0-9]{64}$/i.test(v1))return false;
  const millis=ts.length>=13?Number(ts):Number(ts)*1000;
  if(!Number.isFinite(millis)||Math.abs(Date.now()-millis)>600000)return false;
  const message="id:"+paymentId.toLowerCase()+";request-id:"+requestId+";ts:"+ts+";";
  const hmac=await crypto.subtle.sign("HMAC",
    await crypto.subtle.importKey("raw",new TextEncoder().encode(key),
      {name:"HMAC",hash:"SHA-256"},false,["sign"]),
    new TextEncoder().encode(message));
  const actual=[...new Uint8Array(hmac)].map(v=>v.toString(16).padStart(2,"0")).join("");
  let diff=0;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^v1.toLowerCase().charCodeAt(i);
  return diff===0;
}

async function webhook(req:Request){
  if(!token()||!secret())return json({error:"Integração indisponível."},503);
  const notification=await req.json().catch(()=>null) as {
    type?:string;action?:string;data?:{id?:string|number};
  }|null;
  // Apenas notificações de pagamento podem liberar licença.
  if(notification?.type!=="payment")return json({ok:true});
  const id=String(notification.data?.id||"");
  if(!/^\d+$/.test(id))return json({error:"Identificador de pagamento inválido."},400);
  if(!await validateWebhook(req,id))return json({error:"Assinatura webhook inválida."},401);
  const payment=await mpFetch("/v1/payments/"+id);
  if(payment.status!=="approved"||payment.currency_id!=="BRL")return json({ok:true});
  const subscriptionId=String(payment.preapproval_id||"");
  if(!subscriptionId)return json({ok:true});
  const {data:order,error:orderError}=await db.from("oricstudio_solicitacoes")
    .select("id,clinica_id,valor_mensal_centavos,status,mp_assinatura_id")
    .eq("mp_assinatura_id",subscriptionId).maybeSingle();
  if(orderError)throw new Error("Erro na consulta ao pedido.");
  if(!order)return json({ok:true}); // Não afetar pedidos dos planos principais.
  const amount=Math.round(Number(payment.transaction_amount)*100);
  if(!Number.isSafeInteger(amount)||amount!==order.valor_mensal_centavos)
    throw new Error("Valor de pagamento diferente do contrato.");
  if(payment.external_reference && String(payment.external_reference)!==order.id)
    throw new Error("Referência de pagamento inválida.");
  const subscription=await mpFetch("/preapproval/"+encodeURIComponent(subscriptionId));
  if(subscription.external_reference!==order.id || subscription.status!=="authorized" ||
     Math.round(Number((subscription.auto_recurring as Record<string,unknown>|undefined)?.transaction_amount)*100)!==order.valor_mensal_centavos)
    throw new Error("Assinatura Mercado Pago incompatível com o pedido.");
  const approvedAt=String(payment.date_approved||"");
  if(!approvedAt||!Number.isFinite(Date.parse(approvedAt)))throw new Error("Data de aprovação inválida.");
  const {error:rpcError}=await db.rpc("oricstudio_confirmar_pagamento",{
    p_solicitacao_id:order.id,p_mp_pagamento_id:id,
    p_mp_assinatura_id:subscriptionId,p_aprovado_em:approvedAt,
  });
  if(rpcError)throw new Error("Conciliação da assinatura falhou.");
  return json({ok:true});
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:HEADERS});
  if(req.method!=="POST")return json({error:"Método não permitido."},405);
  const action=new URL(req.url).searchParams.get("action");
  try{
    if(action==="checkout")return await checkout(req);
    if(action==="webhook")return await webhook(req);
    return json({error:"Ação não encontrada."},404);
  }catch(e){
    // Nunca escrever tokens, e-mails ou detalhes pessoais nos logs.
    console.error("OricStúdio Mercado Pago: operação não concluída.");
    return json({error:errorText(e)},500);
  }
});
