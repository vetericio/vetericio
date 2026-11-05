import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Integração de cobrança isolada do OricStúdio. Não compartilhar pedidos nem webhooks
// com oricse-planos-checkout; reutiliza apenas a credencial da mesma conta recebedora.
const ORIGIN = "https://oricse.vetericio.workers.dev";
const API = "https://api.mercadopago.com";
const token = () => Deno.env.get("ORICSE_MP_ACCESS_TOKEN") || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";
const secret = () => Deno.env.get("ORICSTUDIO_MP_WEBHOOK_SECRET") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(supabaseUrl, serviceKey);
const HEADERS = {
  "content-type":"application/json",
  "cache-control":"no-store",
  "access-control-allow-origin":ORIGIN,
  "access-control-allow-headers":"authorization,apikey,content-type,x-client-info,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version",
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

async function cancelarAssinatura(req:Request){
  const authHeader=req.headers.get("authorization")||"";
  const tokenUsuario=authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!tokenUsuario)return json({error:"Sessão necessária."},401);
  const {data:user,error:authError}=await db.auth.getUser(tokenUsuario);
  if(authError||!user.user?.id)return json({error:"Sessão inválida."},401);
  const data=await req.json().catch(()=>null) as {solicitacao_id?:string}|null;
  if(!uuid(data?.solicitacao_id))return json({error:"Assinatura inválida."},400);
  const {data:order,error:orderErr}=await db.from("oricstudio_solicitacoes")
    .select("id,clinica_id,mp_assinatura_id,mp_assinatura_status,status")
    .eq("id",data!.solicitacao_id!).maybeSingle();
  if(orderErr||!order)return json({error:"Assinatura não encontrada."},404);
  const [{data:membership},{data:selected},{data:clinic}]=await Promise.all([
    db.from("clinica_usuarios").select("ativo,papel")
      .eq("clinica_id",order.clinica_id).eq("user_id",user.user.id).maybeSingle(),
    db.from("oricse_clinica_ativa_usuario").select("clinica_id")
      .eq("user_id",user.user.id).maybeSingle(),
    db.from("clinicas").select("status").eq("id",order.clinica_id).maybeSingle(),
  ]);
  if(!membership?.ativo||!["responsavel","admin_clinica","rt"].includes(membership.papel)||
     selected?.clinica_id!==order.clinica_id || clinic?.status!=="ativa")
    return json({error:"Sem autorização para cancelar a assinatura desta clínica."},403);
  if(!order.mp_assinatura_id)return json({error:"Assinatura ainda não foi criada no Mercado Pago."},409);
  const id=String(order.mp_assinatura_id);
  const remote=await mpFetch("/preapproval/"+encodeURIComponent(id));
  if(remote.id!==id||remote.external_reference!==order.id)
    return json({error:"Assinatura não confere com o pedido."},409);
  if(!["canceled","cancelled"].includes(String(remote.status))){
    const updated=await mpFetch("/preapproval/"+encodeURIComponent(id),"PUT",{status:"canceled"});
    if(updated.id!==id||!["canceled","cancelled"].includes(String(updated.status)))
      return json({error:"O Mercado Pago ainda não confirmou o cancelamento."},502);
  }
  const {error:saveError}=await db.rpc("oricstudio_atualizar_estado_mp",{
    p_solicitacao:order.id,p_status_mp:"canceled",
  });
  if(saveError)throw new Error("Cancelamento confirmado, aguardando sincronização com a clínica.");
  return json({ok:true,mensagem:"Renovação cancelada. Acesso já pago permanece até o vencimento."});
}

async function verificarAssinatura(req:Request){
  const userToken=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
  if(!userToken)return json({error:"Faça login novamente."},401);
  const {data:user,error:authError}=await db.auth.getUser(userToken);
  if(authError||!user.user?.id)return json({error:"Sessão inválida."},401);
  const data=await req.json().catch(()=>null) as {solicitacao_id?:string}|null;
  if(!uuid(data?.solicitacao_id))return json({error:"Contrato inválido."},400);
  const {data:order,error:orderError}=await db.from("oricstudio_solicitacoes")
    .select("id,clinica_id,mp_assinatura_id")
    .eq("id",data!.solicitacao_id!).maybeSingle();
  if(orderError||!order)return json({error:"Contrato não encontrado."},404);
  const [{data:link},{data:selected}]=await Promise.all([
    db.from("clinica_usuarios").select("ativo,papel").eq("clinica_id",order.clinica_id)
      .eq("user_id",user.user.id).maybeSingle(),
    db.from("oricse_clinica_ativa_usuario").select("clinica_id")
      .eq("user_id",user.user.id).maybeSingle(),
  ]);
  if(!link?.ativo||!["responsavel","admin_clinica","rt"].includes(link.papel)||
     selected?.clinica_id!==order.clinica_id)
    return json({error:"Acesso à assinatura negado."},403);
  if(!order.mp_assinatura_id)
    return json({error:"O checkout ainda não criou uma assinatura."},409);
  const subId=String(order.mp_assinatura_id);
  await conciliarAssinatura(subId);
  const params=new URLSearchParams({preapproval_id:subId,limit:"30",offset:"0"});
  const invoices=await mpFetch("/authorized_payments/search?"+params.toString());
  const rows=Array.isArray(invoices.results)?invoices.results as Record<string,unknown>[]:[];
  let aprovadas=0;
  for(const invoice of rows){
    if(!/^\d+$/.test(String(invoice.id||"")))continue;
    if((invoice.payment as Record<string,unknown>|undefined)?.status!=="approved")continue;
    await conciliarFatura(String(invoice.id));
    aprovadas++;
  }
  return json({ok:true,faturas_verificadas:rows.length,pagamentos_verificados:aprovadas});
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
  // O Mercado Pago pode reenviar notificações horas depois da primeira tentativa.
  // A proteção contra replay fica com a chave única do pagamento no banco.
  if(!Number.isFinite(millis)||millis>Date.now()+60_000||millis<Date.now()-30*86400_000)return false;
  const message="id:"+paymentId.toLowerCase()+";request-id:"+requestId+";ts:"+ts+";";
  const hmac=await crypto.subtle.sign("HMAC",
    await crypto.subtle.importKey("raw",new TextEncoder().encode(key),
      {name:"HMAC",hash:"SHA-256"},false,["sign"]),
    new TextEncoder().encode(message));
  const actual=[...new Uint8Array(hmac)].map(v=>v.toString(16).padStart(2,"0")).join("");
  let diff=0;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^v1.toLowerCase().charCodeAt(i);
  return diff===0;
}

async function conciliarPagamento(paymentId:string){
  if(!/^\d+$/.test(paymentId))throw new Error("Pagamento inválido.");
  const payment=await mpFetch("/v1/payments/"+paymentId);
  const status=String(payment.status||"");
  if(["refunded","charged_back"].includes(status)){
    const {error}=await db.rpc("oricstudio_registrar_estorno",{
      p_mp_pagamento_id:paymentId,p_status_mp:status,
    });
    if(error)throw new Error("Estorno não conciliado.");
    return;
  }
  if(status!=="approved"||payment.currency_id!=="BRL")return;
  const subId=String(payment.preapproval_id||"");
  if(!subId)return; // Não interferir com pagamentos de outros produtos.
  const {data:order,error:orderError}=await db.from("oricstudio_solicitacoes")
    .select("id,clinica_id,valor_mensal_centavos,status,mp_assinatura_id")
    .eq("mp_assinatura_id",subId).maybeSingle();
  if(orderError)throw new Error("Erro na consulta ao contrato.");
  if(!order)return;
  const amount=Math.round(Number(payment.transaction_amount)*100);
  if(!Number.isSafeInteger(amount)||amount!==order.valor_mensal_centavos)
    throw new Error("Pagamento diferente do valor contratado.");
  if(payment.external_reference && String(payment.external_reference)!==order.id)
    throw new Error("Referência não confere.");
  const subscription=await mpFetch("/preapproval/"+encodeURIComponent(subId));
  const recurring=subscription.auto_recurring as Record<string,unknown>|undefined;
  if(subscription.external_reference!==order.id || subscription.status!=="authorized"||
     recurring?.currency_id!=="BRL"||
     Math.round(Number(recurring?.transaction_amount)*100)!==order.valor_mensal_centavos)
    throw new Error("Assinatura não confere com a contratação.");
  const approvedAt=String(payment.date_approved||"");
  if(!approvedAt||!Number.isFinite(Date.parse(approvedAt)))
    throw new Error("Data de pagamento inválida.");
  const {error}=await db.rpc("oricstudio_confirmar_pagamento",{
    p_solicitacao_id:order.id,p_mp_pagamento_id:paymentId,
    p_mp_assinatura_id:subId,p_aprovado_em:approvedAt,
  });
  if(error)throw new Error("Pagamento não conciliado.");
}

async function conciliarAssinatura(subscriptionId:string){
  if(!/^[a-z0-9-]{8,100}$/i.test(subscriptionId))throw new Error("Assinatura inválida.");
  const {data:order,error}=await db.from("oricstudio_solicitacoes")
    .select("id,mp_assinatura_id").eq("mp_assinatura_id",subscriptionId).maybeSingle();
  if(error)throw new Error("Erro ao consultar assinatura.");
  if(!order)return;
  const remote=await mpFetch("/preapproval/"+encodeURIComponent(subscriptionId));
  if(remote.id!==subscriptionId || remote.external_reference!==order.id)
    throw new Error("Vínculo de assinatura inválido.");
  const {error:saveError}=await db.rpc("oricstudio_atualizar_estado_mp",{
    p_solicitacao:order.id,p_status_mp:String(remote.status),
  });
  if(saveError)throw new Error("Estado de assinatura não conciliado.");
}

async function conciliarFatura(invoiceId:string){
  if(!/^\d+$/.test(invoiceId))throw new Error("Fatura inválida.");
  const invoice=await mpFetch("/authorized_payments/"+invoiceId);
  // Mesmo faturas emitidas não implicam pagamento; só conciliar o pagamento real.
  const payment=invoice.payment as Record<string,unknown>|undefined;
  if(String(payment?.status)!=="approved" || !/^\d+$/.test(String(payment?.id||"")))return;
  const subId=String(invoice.preapproval_id||"");
  if(!subId)return;
  const {data:contract}=await db.from("oricstudio_solicitacoes")
    .select("id,valor_mensal_centavos").eq("mp_assinatura_id",subId).maybeSingle();
  if(!contract)return;
  if(invoice.currency_id!=="BRL"||
     Math.round(Number(invoice.transaction_amount)*100)!==contract.valor_mensal_centavos||
     (invoice.external_reference && String(invoice.external_reference)!==contract.id))
    throw new Error("Fatura não confere com o contrato.");
  await conciliarPagamento(String(payment.id));
}

// Chamada programada pelo GitHub Actions. Não usar service_role ou webhooks como
// credencial de agendamento: cada segredo tem um escopo distinto.
async function statusIntegracaoPagamento(req:Request){
  const userToken=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
  if(!userToken)return json({error:"Sessão necessária."},401);
  const {data:user,error}=await db.auth.getUser(userToken);
  if(error||!user.user?.id)return json({error:"Sessão inválida."},401);
  const {data:profile}=await db.from("app_users")
    .select("role").eq("user_id",user.user.id).maybeSingle();
  if(profile?.role!=="admin")return json({error:"Apenas Administração Geral."},403);
  const {data:product}=await db.from("oricstudio_produto")
    .select("comercializacao_ativa,preco_centavos,preco_conta_adicional_centavos")
    .eq("codigo","oricstudio").maybeSingle();
  return json({
    mercado_pago_configurado:Boolean(token()),
    webhook_exclusivo_configurado:Boolean(secret()),
    conciliacao_programada_configurada:
      (Deno.env.get("ORICSTUDIO_RECONCILIATION_SECRET")||"").length>=32,
    precos_configurados:product?.preco_centavos!=null&&product?.preco_conta_adicional_centavos!=null,
    comercializacao_ativa:product?.comercializacao_ativa===true,
  });
}

async function reconciliarLote(req:Request){
  const configured=(Deno.env.get("ORICSTUDIO_RECONCILIATION_SECRET")||"").trim();
  const provided=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1]||"";
  // Compara hashes sem aceitar segredos vazios ou requisições de usuários.
  if(configured.length<32||provided.length<32)return json({error:"Não autorizado."},401);
  const hash=async(v:string)=>new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));
  const [expected,actual]=await Promise.all([hash(configured),hash(provided)]);
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected[i]^actual[i];
  if(diff!==0)return json({error:"Não autorizado."},401);
  if(!token()||!secret())return json({error:"Mercado Pago ainda não homologado."},503);
  const {data:orders,error}=await db.from("oricstudio_solicitacoes")
    .select("id,mp_assinatura_id,ultima_conciliacao_em")
    .in("status",["pagamento_pendente","pago"])
    .not("mp_assinatura_id","is",null)
    .order("ultima_conciliacao_em",{ascending:true,nullsFirst:true})
    .limit(6);
  if(error)throw new Error("Não foi possível selecionar assinaturas para conciliação.");
  let checked=0,failed=0,inspectedInvoices=0;
  for(const order of orders||[]){
    const subId=String(order.mp_assinatura_id||"");
    try{
      await conciliarAssinatura(subId);
      const query=new URLSearchParams({preapproval_id:subId,limit:"30",offset:"0"});
      const invoices=await mpFetch("/authorized_payments/search?"+query.toString());
      const rows=Array.isArray(invoices.results)?invoices.results as Record<string,unknown>[]:[];
      // Faturas pendentes não liberam o módulo; conciliar somente pagamento aprovado.
      for(const invoice of rows){
        if(!/^\d+$/.test(String(invoice.id||"")))continue;
        if(String((invoice.payment as Record<string,unknown>|undefined)?.status)!=="approved")continue;
        await conciliarFatura(String(invoice.id));
        inspectedInvoices++;
      }
      checked++;
    }catch{
      // Erro isolado por clínica, nunca registrar token, assinatura ou CPF nos logs.
      failed++;
    }
  }
  return json({ok:failed===0,assinaturas_conferidas:checked,erros:failed,faturas_aprovadas_conferidas:inspectedInvoices},failed?503:200);
}

async function webhook(req:Request){
  if(!token()||!secret())return json({error:"Integração indisponível."},503);
  const notification=await req.json().catch(()=>null) as {
    type?:string;data?:{id?:string|number};
  }|null;
  const kind=String(notification?.type||"");
  if(!["payment","subscription_preapproval","subscription_authorized_payment"].includes(kind))
    return json({ok:true});
  const id=String(notification?.data?.id||"");
  const queryId=new URL(req.url).searchParams.get("data.id");
  if(!id||queryId&&queryId!==id)return json({error:"Notificação inconsistente."},400);
  if(!await validateWebhook(req,id))
    return json({error:"Assinatura de webhook inválida."},401);
  if(kind==="payment")await conciliarPagamento(id);
  else if(kind==="subscription_preapproval")await conciliarAssinatura(id);
  else await conciliarFatura(id);
  return json({ok:true});
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:HEADERS});
  if(req.method!=="POST")return json({error:"Método não permitido."},405);
  const queryAction=new URL(req.url).searchParams.get("action");
  const body=await req.clone().json().catch(()=>null) as {acao?:string}|null;
  const action=queryAction||body?.acao||"";
  try{
    if(action==="checkout")return await checkout(req);
    if(action==="cancelar")return await cancelarAssinatura(req);
    if(action==="verificar_assinatura")return await verificarAssinatura(req);
    if(action==="reconciliar_lote")return await reconciliarLote(req);
    if(action==="status_configuracao")return await statusIntegracaoPagamento(req);
    if(action==="webhook")return await webhook(req);
    return json({error:"Ação não encontrada."},404);
  }catch(e){
    // Nunca escrever tokens, e-mails ou detalhes pessoais nos logs.
    console.error("OricStúdio Mercado Pago: operação não concluída.");
    return json({error:errorText(e)},500);
  }
});
