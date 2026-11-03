import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const origin = "https://oricse.vetericio.workers.dev";
const token = () => Deno.env.get("ORICSE_MP_ACCESS_TOKEN") || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
const secret = () => Deno.env.get("ORICSE_MP_WEBHOOK_SECRET");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": origin, "access-control-allow-headers": "content-type,apikey,authorization", "access-control-allow-methods": "POST,OPTIONS" } });
function money(value: string): number {
 const n = Number(String(value).replace(/[^0-9,.]/g,"").replace(/\./g,"").replace(",","."));
 if(!Number.isFinite(n)||n<0)throw Error("Preço inválido");
 return Math.round(n*100);
}
async function statusPedido(id:string) {
 const { data, error } = await db.from("oricse_contratacoes").select("id,plano_codigo,plano_nome,ciclo,perfis_extras,quantidade_usuarios,responsavel_email,status,valor_total,pagamento_id").eq("id",id).maybeSingle();
 if(error||!data)throw Error("Pedido não encontrado");
 return data;
}
async function price(p:any) {
 const {data, error}=await db.from("oricse_planos").select("codigo,nome,ativo,preco_mensal,preco_anual,usuarios_inclusos").eq("codigo",p.plano_codigo).eq("ativo",true).maybeSingle();
 if(error||!data)throw Error("Plano indisponível");
 if(!["mensal","anual"].includes(p.ciclo))throw Error("Ciclo inválido");
 const base=money(p.ciclo==="anual"?data.preco_anual:data.preco_mensal);
 const users=Math.max(1,Number(p.quantidade_usuarios)||1);
 const extras=Math.max(0,users-Math.max(1,Number(data.usuarios_inclusos)||1));
 const expected=base+(extras*1490*(p.ciclo==="anual"?12:1));
 if(expected<=0||Math.round(Number(p.valor_total)*100)!==expected)throw Error("Valor do pedido inconsistente; crie um novo cadastro");
 return {amount:expected/100,nome:data.nome};
}
async function verifySignature(req:Request, paymentId:string) {
 const key=secret(); if(!key)throw Error("Assinatura webhook não configurada");
 const signature=req.headers.get("x-signature")||"";
 const requestId=req.headers.get("x-request-id")||"";
 const ts=signature.match(/(?:^|,)ts=([^,]+)/)?.[1];
 const v1=signature.match(/(?:^|,)v1=([^,]+)/)?.[1];
 if(!ts||!v1||!requestId)return false;
 const sentAt=Number(ts); const sentAtMs=ts.length>=13?sentAt:sentAt*1000;
 if(!Number.isFinite(sentAtMs)||Math.abs(Date.now()-sentAtMs)>600000)return false;
 const manifest=`id:${paymentId.toLowerCase()};request-id:${requestId};ts:${ts};`;
 const hmac=await crypto.subtle.sign("HMAC",await crypto.subtle.importKey("raw",new TextEncoder().encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]),new TextEncoder().encode(manifest));
 const actual=Array.from(new Uint8Array(hmac),v=>v.toString(16).padStart(2,"0")).join("");
 return actual.length===v1.length && [...actual].reduce((diff,ch,i)=>diff|(ch.charCodeAt(0)^v1.charCodeAt(i)),0)===0;
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return json({});
 if(req.method!=="POST")return json({error:"Método não permitido"},405);
 const action=new URL(req.url).searchParams.get("action");
 if(action==="checkout"){
  try {
   const {pedido_id}=await req.json();
   if(typeof pedido_id!=="string"||!/^[a-f0-9-]{36}$/i.test(pedido_id))return json({error:"Pedido inválido"},400);
   const access=token();if(!access)return json({error:"Credencial de cobrança da ORICSE não configurada"},503);
   if(!secret())return json({error:"Webhook de confirmação ainda não configurado"},503);
   const p=await statusPedido(pedido_id);
   if(p.status!=="aguardando_pagamento")return json({error:"Pedido não está aguardando pagamento"},409);
   const {amount,nome}=await price(p);
   const body={
    items:[{id:p.plano_codigo,title:`ORICSE — ${nome} (${p.ciclo})`,quantity:1,currency_id:"BRL",unit_price:amount}],
    payer:{email:p.responsavel_email},
    external_reference:p.id,
    back_urls:{success:`${origin}/contratar?retorno=sucesso&pedido=${p.id}`,pending:`${origin}/contratar?retorno=pendente&pedido=${p.id}`,failure:`${origin}/contratar?retorno=falha&pedido=${p.id}`},
    notification_url:`${Deno.env.get("SUPABASE_URL")}/functions/v1/oricse-planos-checkout?action=webhook`,
    auto_return:"approved"
   };
   const response=await fetch("https://api.mercadopago.com/checkout/preferences",{method:"POST",headers:{"authorization":`Bearer ${access}`,"content-type":"application/json","X-Idempotency-Key":`oricse-${p.id}`},body:JSON.stringify(body)});
   const data=await response.json();
   if(!response.ok||!data.init_point) {console.error("Falha em preferência MP",response.status);return json({error:"Não foi possível abrir o checkout"},502);}
   return json({checkout_url:data.init_point});
  } catch(e){return json({error:e instanceof Error?e.message:"Falha no checkout"},400);}
 }
 if(action==="webhook"){
   try {
    const notification=await req.json();
    if(notification.type!=="payment")return json({ok:true});
    const paymentId=String(notification.data?.id||"");
    if(!/^\d+$/.test(paymentId))return json({error:"Identificador inválido"},400);
    if(!await verifySignature(req,paymentId))return json({error:"Assinatura inválida"},401);
    const access=token();if(!access)return json({error:"Token MP ausente"},503);
    const response=await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`,{headers:{authorization:`Bearer ${access}`}});
    if(!response.ok)return json({error:"Consulta ao pagamento falhou"},502);
    const payment=await response.json();
    const orderId=String(payment.external_reference||"");
    if(!/^[a-f0-9-]{36}$/i.test(orderId))return json({ok:true});
    const p=await statusPedido(orderId);
    if(p.status==="pagamento_aprovado"&&p.pagamento_id===paymentId)return json({ok:true});
    if(p.status!=="aguardando_pagamento")return json({ok:true});
    const {amount}=await price(p);
    if(payment.status!=="approved"||payment.currency_id!=="BRL"||Math.round(Number(payment.transaction_amount)*100)!==Math.round(amount*100))return json({ok:true});
    const {error}=await db.from("oricse_contratacoes").update({status:"pagamento_aprovado",pagamento_provedor:"mercadopago",pagamento_id:paymentId,pagamento_aprovado_em:new Date().toISOString()}).eq("id",orderId).eq("status","aguardando_pagamento");
    if(error)throw error;
    return json({ok:true});
   }catch(e){console.error("Webhook planos ORICSE",e);return json({error:"Erro no processamento"},500);}
 }
 return json({error:"Ação desconhecida"},404);
});