import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const origin = "https://oricse.vetericio.workers.dev";
const token = () => Deno.env.get("ORICSE_MP_ACCESS_TOKEN") || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
const secret = () => Deno.env.get("ORICSE_MP_WEBHOOK_SECRET");
const headers = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "access-control-allow-origin": origin,
  "access-control-allow-headers": "content-type,apikey,authorization",
  "access-control-allow-methods": "POST,OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function money(value: string | number | null | undefined): number {
  if (typeof value === "number") return Math.round(value * 100);
  const n = Number(String(value || "").replace(/[^0-9,.]/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("Preço inválido");
  return Math.round(n * 100);
}
function mesesDoCiclo(ciclo: string) {
  return ({ mensal: 1, trimestral: 3, semestral: 6, anual: 12, bienal: 24 } as Record<string, number>)[ciclo] || 0;
}
function campoPreco(ciclo: string) {
  return ({ mensal: "preco_mensal", trimestral: "preco_trimestral", semestral: "preco_semestral", anual: "preco_anual", bienal: "preco_bienal" } as Record<string, string>)[ciclo];
}
async function statusPedido(id: string) {
  const { data, error } = await db.from("oricse_contratacoes")
    .select("id,plano_codigo,plano_nome,ciclo,perfis_extras,quantidade_usuarios,responsavel_email,status,valor_total,pagamento_id,modo_renovacao,renovacao_automatica,mp_assinatura_id,mp_assinatura_status,clinica_criada_id")
    .eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Pedido não encontrado");
  return data as any;
}
async function price(p: any) {
  const field = campoPreco(String(p.ciclo));
  if (!field) throw new Error("Ciclo inválido");
  const { data, error } = await db.from("oricse_planos")
    .select("codigo,nome,ativo,preco_mensal,preco_trimestral,preco_semestral,preco_anual,preco_bienal,usuarios_inclusos")
    .eq("codigo", p.plano_codigo).eq("ativo", true).maybeSingle();
  if (error || !data) throw new Error("Plano indisponível");
  const base = money((data as any)[field]);
  const users = Math.max(1, Number(p.quantidade_usuarios) || 1);
  const extras = Math.max(0, users - Math.max(1, Number(data.usuarios_inclusos) || 1));
  const expected = base + extras * 1490 * mesesDoCiclo(String(p.ciclo));
  const amount = money(Number(p.valor_total));
  if (expected <= 0 || amount <= 0 || amount > expected) throw new Error("Valor do pedido inconsistente; crie uma nova contratação.");
  return { amount: amount / 100, nome: String(data.nome) };
}
async function verifySignature(req: Request, paymentId: string) {
  const key = secret();
  if (!key) throw new Error("Assinatura webhook não configurada");
  const signature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const ts = signature.match(/(?:^|,)ts=([^,]+)/)?.[1];
  const v1 = signature.match(/(?:^|,)v1=([^,]+)/)?.[1];
  if (!ts || !v1 || !requestId) return false;
  const sentAt = Number(ts);
  const sentAtMs = ts.length >= 13 ? sentAt : sentAt * 1000;
  if (!Number.isFinite(sentAtMs) || Math.abs(Date.now() - sentAtMs) > 600000) return false;
  const manifest = "id:" + paymentId.toLowerCase() + ";request-id:" + requestId + ";ts:" + ts + ";";
  const hmac = await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), new TextEncoder().encode(manifest));
  const actual = Array.from(new Uint8Array(hmac), (v) => v.toString(16).padStart(2, "0")).join("");
  return actual.length === v1.length && [...actual].reduce((diff, ch, i) => diff | (ch.charCodeAt(0) ^ v1.charCodeAt(i)), 0) === 0;
}
async function checkoutManual(p: any, amount: number, nome: string, access: string) {
  const body = {
    items: [{ id: p.plano_codigo, title: "ORICSE — " + nome + " (" + p.ciclo + ")", quantity: 1, currency_id: "BRL", unit_price: amount }],
    payer: { email: p.responsavel_email },
    external_reference: p.id,
    back_urls: {
      success: origin + "/contratar?retorno=sucesso&pedido=" + p.id,
      pending: origin + "/contratar?retorno=pendente&pedido=" + p.id,
      failure: origin + "/contratar?retorno=falha&pedido=" + p.id,
    },
    notification_url: Deno.env.get("SUPABASE_URL") + "/functions/v1/oricse-planos-checkout?action=webhook",
    auto_return: "approved",
  };
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { authorization: "Bearer " + access, "content-type": "application/json", "X-Idempotency-Key": "oricse-manual-" + p.id },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.init_point) {
    console.error("Falha em preferência MP", response.status);
    throw new Error("Não foi possível abrir o checkout");
  }
  return String(data.init_point);
}
async function checkoutAssinatura(p: any, amount: number, nome: string, access: string) {
  const existingId = String(p.mp_assinatura_id || "");
  if (existingId && ["authorized", "pending"].includes(String(p.mp_assinatura_status || ""))) {
    const current = await fetch("https://api.mercadopago.com/preapproval/" + existingId, { headers: { authorization: "Bearer " + access } });
    const item = await current.json().catch(() => null);
    if (current.ok && item?.init_point && item.status !== "cancelled") return String(item.init_point);
  }
  const meses = mesesDoCiclo(String(p.ciclo));
  if (!meses) throw new Error("Ciclo inválido");
  const body = {
    reason: "ORICSE — " + nome + " (" + p.ciclo + ")",
    external_reference: p.id,
    payer_email: p.responsavel_email,
    back_url: origin + "/contratar?retorno=sucesso&pedido=" + p.id,
    auto_recurring: { frequency: meses, frequency_type: "months", transaction_amount: amount, currency_id: "BRL" },
  };
  const response = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { authorization: "Bearer " + access, "content-type": "application/json", "X-Idempotency-Key": "oricse-assinatura-" + p.id },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id || !data?.init_point) {
    console.error("Falha em assinatura MP", response.status);
    throw new Error("Não foi possível iniciar a renovação automática no cartão.");
  }
  const { error } = await db.from("oricse_contratacoes").update({
    mp_assinatura_id: String(data.id), mp_assinatura_status: String(data.status || "pending"),
    modo_renovacao: "automatica_cartao", renovacao_automatica: true, updated_at: new Date().toISOString(),
  }).eq("id", p.id);
  if (error) throw error;
  return String(data.init_point);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const action = new URL(req.url).searchParams.get("action");
  if (action === "checkout") {
    try {
      const { pedido_id } = await req.json();
      if (typeof pedido_id !== "string" || !/^[a-f0-9-]{36}$/i.test(pedido_id)) return json({ error: "Pedido inválido" }, 400);
      const access = token();
      if (!access) return json({ error: "Credencial de cobrança da ORICSE não configurada" }, 503);
      if (!secret()) return json({ error: "Webhook de confirmação ainda não configurado" }, 503);
      const p = await statusPedido(pedido_id);
      if (p.status !== "aguardando_pagamento") return json({ error: "Pedido não está aguardando pagamento" }, 409);
      const { amount, nome } = await price(p);
      const automatico = p.modo_renovacao === "automatica_cartao" || p.renovacao_automatica === true;
      const checkout_url = automatico ? await checkoutAssinatura(p, amount, nome, access) : await checkoutManual(p, amount, nome, access);
      return json({ checkout_url, renovacao_automatica: automatico });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Falha no checkout" }, 400);
    }
  }
  if (action === "webhook") {
    try {
      const notification = await req.json();
      if (notification.type !== "payment") return json({ ok: true });
      const paymentId = String(notification.data?.id || "");
      if (!/^\d+$/.test(paymentId)) return json({ error: "Identificador inválido" }, 400);
      if (!await verifySignature(req, paymentId)) return json({ error: "Assinatura inválida" }, 401);
      const access = token();
      if (!access) return json({ error: "Token MP ausente" }, 503);
      const response = await fetch("https://api.mercadopago.com/v1/payments/" + paymentId, { headers: { authorization: "Bearer " + access } });
      if (!response.ok) return json({ error: "Consulta ao pagamento falhou" }, 502);
      const payment = await response.json();
      const orderId = String(payment.external_reference || "");
      if (!/^[a-f0-9-]{36}$/i.test(orderId)) return json({ ok: true });
      const p = await statusPedido(orderId);
      const { amount } = await price(p);
      if (payment.status !== "approved" || payment.currency_id !== "BRL" || Math.round(Number(payment.transaction_amount) * 100) !== Math.round(amount * 100)) return json({ ok: true });
      const approvedAt = payment.date_approved || new Date().toISOString();
      if (p.status === "aguardando_pagamento") {
        const { error } = await db.from("oricse_contratacoes").update({
          status: "pagamento_aprovado", pagamento_provedor: "mercadopago", pagamento_id: paymentId,
          pagamento_aprovado_em: approvedAt, mp_assinatura_id: payment.preapproval_id ? String(payment.preapproval_id) : p.mp_assinatura_id,
          mp_assinatura_status: payment.preapproval_id ? "authorized" : p.mp_assinatura_status, updated_at: new Date().toISOString(),
        }).eq("id", orderId).eq("status", "aguardando_pagamento");
        if (error) throw error;
      }
      const { error: renewalError } = await db.rpc("oricse_registrar_pagamento_assinatura", {
        p_contratacao_id: orderId, p_pagamento_id: paymentId, p_pago_em: approvedAt,
      });
      if (renewalError) throw renewalError;
      return json({ ok: true });
    } catch (e) {
      console.error("Webhook planos ORICSE", e);
      return json({ error: "Erro no processamento" }, 500);
    }
  }
  return json({ error: "Ação desconhecida" }, 404);
});