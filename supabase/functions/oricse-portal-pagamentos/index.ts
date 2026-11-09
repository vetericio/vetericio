import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const origin = "https://oricse.com.br";
const encoder = new TextEncoder();
const cors = {
  "content-type": "application/json",
  "access-control-allow-origin": origin,
  "access-control-allow-headers": "authorization,apikey,content-type",
  "access-control-allow-methods": "POST,OPTIONS",
  "cache-control": "no-store",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const fromB64 = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (item) => item.charCodeAt(0));
function hexBytes(value: string) {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error("Chave de criptografia de pagamentos inválida.");
  return new Uint8Array(value.match(/../g)!.map((item) => parseInt(item, 16)));
}
async function decrypt(value: string) {
  const secret = Deno.env.get("ORICSE_MP_ENCRYPTION_KEY");
  if (!secret) throw new Error("Integração Mercado Pago ainda não configurada.");
  const [ivValue, cipherValue] = value.split(".");
  if (!ivValue || !cipherValue) throw new Error("Credencial de pagamento inválida.");
  const key = await crypto.subtle.importKey("raw", hexBytes(secret), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(ivValue) }, key, fromB64(cipherValue));
  return new TextDecoder().decode(plain);
}
async function verifySignature(req: Request, paymentId: string) {
  const key = Deno.env.get("ORICSE_MP_WEBHOOK_SECRET");
  if (!key) throw new Error("Assinatura webhook não configurada.");
  const signature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const ts = signature.match(/(?:^|,)ts=([^,]+)/)?.[1];
  const v1 = signature.match(/(?:^|,)v1=([^,]+)/)?.[1];
  if (!ts || !v1 || !requestId) return false;
  const sent = Number(ts);
  const sentMs = ts.length >= 13 ? sent : sent * 1000;
  if (!Number.isFinite(sentMs) || Math.abs(Date.now() - sentMs) > 600000) return false;
  const manifest = "id:" + paymentId.toLowerCase() + ";request-id:" + requestId + ";ts:" + ts + ";";
  const hmac = await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), encoder.encode(manifest));
  const actual = Array.from(new Uint8Array(hmac), (value) => value.toString(16).padStart(2, "0")).join("");
  return actual.length === v1.length && [...actual].reduce((diff, value, index) => diff | (value.charCodeAt(0) ^ v1.charCodeAt(index)), 0) === 0;
}
async function tutorAtual(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!bearer) throw new Error("Sessão necessária.");
  const { data, error } = await service.auth.getUser(bearer);
  if (error || !data.user) throw new Error("Sessão inválida.");
  const { data: tutor, error: tutorError } = await service.from("oricse_portal_tutores")
    .select("auth_user_id,clinica_id,tutor_id").eq("auth_user_id", data.user.id).maybeSingle();
  if (tutorError || !tutor) throw new Error("Acesso do tutor inválido.");
  return { token: bearer, authUserId: data.user.id, clinicaId: tutor.clinica_id as string, tutorId: tutor.tutor_id as string };
}
async function conexaoClinica(clinicaId: string) {
  const { data, error } = await service.from("oricse_mercadopago_conexoes")
    .select("access_token_cifrado,collector_id,status").eq("clinica_id", clinicaId).eq("status", "conectada").maybeSingle();
  if (error || !data?.access_token_cifrado) throw new Error("A clínica ainda não conectou uma conta Mercado Pago para receber pagamentos.");
  return { token: await decrypt(data.access_token_cifrado), collector: String(data.collector_id) };
}
async function taxaOricse(clinicaId: string, valorCentavos: number) {
  const specific = await service.from("oricse_taxas_oricse_segmento").select("oricse_percentual,ativo")
    .eq("clinica_id", clinicaId).eq("segmento", "portal_tutor").maybeSingle();
  const global = specific.data?.ativo ? specific.data : (await service.from("oricse_taxas_oricse_segmento")
    .select("oricse_percentual,ativo").is("clinica_id", null).eq("segmento", "portal_tutor").maybeSingle()).data;
  const percentual = global?.ativo ? Number(global.oricse_percentual || 0) : 0;
  return Math.max(0, Math.round(valorCentavos * percentual / 100));
}
async function criarCheckout(pagamento: any, titulo: string, clinicaId: string, slug: string, access: string) {
  const marketplaceFee = Number(pagamento.estimativa_oricse_centavos || 0) / 100;
  const body = {
    items: [{ id: pagamento.id, title: titulo, quantity: 1, currency_id: "BRL", unit_price: Number(pagamento.bruto_centavos) / 100 }],
    external_reference: "portal:" + pagamento.id,
    marketplace_fee: marketplaceFee > 0 ? marketplaceFee : undefined,
    back_urls: {
      success: origin + "/pet/" + encodeURIComponent(slug) + "/portal?pagamento=sucesso",
      pending: origin + "/pet/" + encodeURIComponent(slug) + "/portal?pagamento=pendente",
      failure: origin + "/pet/" + encodeURIComponent(slug) + "/portal?pagamento=falha",
    },
    auto_return: "approved",
    notification_url: url + "/functions/v1/oricse-portal-pagamentos?action=webhook&referencia=portal:" + pagamento.id,
  };
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { authorization: "Bearer " + access, "content-type": "application/json", "X-Idempotency-Key": "oricse-portal-" + pagamento.id },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.init_point) {
    console.error("Portal checkout MP", response.status, clinicaId);
    throw new Error("Não foi possível abrir o pagamento online.");
  }
  return String(data.init_point);
}
async function reservaAgenda(req: Request, body: any) {
  const tutor = await tutorAtual(req);
  const { token, clinicaId, tutorId } = tutor;
  const agendaId = String(body?.agenda_id || "");
  const animalId = String(body?.animal_id || "");
  const inicio = String(body?.inicio || "");
  const slug = String(body?.slug || "");
  if (!/^[a-f0-9-]{36}$/i.test(agendaId) || !/^[a-f0-9-]{36}$/i.test(animalId) || !inicio || !slug) throw new Error("Dados do agendamento inválidos.");
  const connection = await conexaoClinica(clinicaId);
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: "Bearer " + token } } });
  const { data, error } = await userClient.rpc("oricse_portal_reservar_pagamento_agenda", {
    p_agenda_id: agendaId, p_animal_id: animalId, p_inicio: inicio, p_observacoes: typeof body?.observacoes === "string" ? body.observacoes : null,
  });
  if (error || !data?.[0]) throw new Error(error?.message || "Não foi possível reservar este horário.");
  const reserva = data[0];
  const valor = Number(reserva.valor_centavos);
  const comissao = await taxaOricse(clinicaId, valor);
  const { data: pagamento, error: paymentError } = await service.from("oricse_pagamentos").insert({
    clinica_id: clinicaId, tipo: "agenda_portal", origem_id: reserva.agendamento_id, modalidade: "online",
    bruto_centavos: valor, estimativa_oricse_centavos: comissao, estimativa_clinica_centavos: Math.max(0, valor - comissao),
    status: "criado", taxas_snapshot: { origem: "portal_tutor", comissao_oricse_centavos: comissao },
  }).select("*").single();
  if (paymentError || !pagamento) throw new Error("Não foi possível iniciar o pagamento.");
  await service.from("oricse_agendamentos_online").update({ pagamento_id: pagamento.id }).eq("id", reserva.agendamento_id);
  return { checkout_url: await criarCheckout(pagamento, String(reserva.descricao || "Agendamento online"), clinicaId, slug, connection.token) };
}
async function checkoutComanda(req: Request, body: any) {
  const tutor = await tutorAtual(req);
  const id = String(body?.comanda_id || "");
  const slug = String(body?.slug || "");
  if (!/^[a-f0-9-]{36}$/i.test(id) || !slug) throw new Error("Comanda inválida.");
  const connection = await conexaoClinica(tutor.clinicaId);
  const { data: comanda, error } = await service.from("oricse_portal_comandas")
    .select("id,tutor_id,animal_id,numero,saldo,visivel_tutor,status").eq("id", id).eq("clinica_id", tutor.clinicaId).maybeSingle();
  if (error || !comanda || comanda.tutor_id !== tutor.tutorId || !comanda.visivel_tutor || Number(comanda.saldo) <= 0) throw new Error("Esta comanda não está disponível para pagamento.");
  const solicitado = Number(body?.valor_centavos || 0);
  const saldo = Math.round(Number(comanda.saldo) * 100);
  const valor = solicitado > 0 ? Math.min(solicitado, saldo) : saldo;
  if (valor <= 0) throw new Error("Informe um valor de pagamento válido.");
  const comissao = await taxaOricse(tutor.clinicaId, valor);
  const { data: pagamento, error: paymentError } = await service.from("oricse_pagamentos").insert({
    clinica_id: tutor.clinicaId, tipo: "comanda_portal", origem_id: comanda.id, modalidade: "online",
    bruto_centavos: valor, estimativa_oricse_centavos: comissao, estimativa_clinica_centavos: Math.max(0, valor - comissao),
    status: "criado", taxas_snapshot: { origem: "portal_tutor", comissao_oricse_centavos: comissao, adiantamento: valor < saldo },
  }).select("*").single();
  if (paymentError || !pagamento) throw new Error("Não foi possível iniciar o pagamento.");
  return { checkout_url: await criarCheckout(pagamento, "Comanda #" + String(comanda.numero).padStart(5, "0"), tutor.clinicaId, slug, connection.token) };
}
async function processWebhook(req: Request) {
  const notification = await req.json();
  if (notification.type !== "payment") return reply({ ok: true });
  const paymentId = String(notification.data?.id || "");
  if (!/^\d+$/.test(paymentId)) return reply({ error: "Identificador inválido" }, 400);
  if (!await verifySignature(req, paymentId)) return reply({ error: "Assinatura inválida" }, 401);
  const externalHint = new URL(req.url).searchParams.get("referencia");
  const reference = String(externalHint || "");
  if (!reference.startsWith("portal:")) return reply({ ok: true });

  const paymentRowId = reference.slice(7);
  if (!/^[a-f0-9-]{36}$/i.test(paymentRowId)) return reply({ ok: true });
  const { data: row, error } = await service.from("oricse_pagamentos").select("*").eq("id", paymentRowId).maybeSingle();
  if (error || !row) return reply({ ok: true });
  const connection = await conexaoClinica(row.clinica_id);
  const response = await fetch("https://api.mercadopago.com/v1/payments/" + paymentId, { headers: { authorization: "Bearer " + connection.token } });
  if (!response.ok) return reply({ error: "Consulta ao pagamento falhou" }, 502);
  const payment = await response.json();
  if (String(payment.external_reference || "") !== "portal:" + paymentRowId || payment.status !== "approved" || payment.currency_id !== "BRL" || Math.round(Number(payment.transaction_amount) * 100) !== Number(row.bruto_centavos)) return reply({ ok: true });
  const net = Math.round(Number(payment.transaction_details?.net_received_amount ?? (Number(row.bruto_centavos) / 100)) * 100);
  const mpFees = Math.max(0, Number(row.bruto_centavos) - net - Number(row.estimativa_oricse_centavos || 0));
  await service.from("oricse_pagamentos").update({
    mp_payment_id: paymentId, recebido_mp_centavos: mpFees,
    recebido_oricse_centavos: Number(row.estimativa_oricse_centavos || 0),
    recebido_clinica_centavos: net, status: "aprovado", updated_at: new Date().toISOString(),
  }).eq("id", paymentRowId);
  const { error: confirmError } = await service.rpc("oricse_confirmar_pagamento_portal", {
    p_pagamento_id: paymentRowId, p_mp_payment_id: paymentId,
    p_forma: String(payment.payment_method_id || payment.payment_type_id || "online"), p_liquido_centavos: net,
  });
  if (confirmError) throw confirmError;
  return reply({ ok: true });
}

// Ajusta somente os cabeçalhos CORS das origens oficiais e subdomínios ORICSE.
// Não altera os retornos de checkout, webhooks nem o processamento de pagamentos.
function origemPermitidaParaCors(req: Request): string | null {
  const origem = req.headers.get("origin") || "";
  if (!origem) return null;
  const adicional = Deno.env.get("ORICSE_APP_ORIGIN") || "";
  if (["https://oricse.com.br","https://app.oricse.com.br",
       "https://www.oricse.com.br","https://oricse.vetericio.workers.dev",adicional].includes(origem)) return origem;
  try {
    const u = new URL(origem);
    if (u.protocol === "https:" && !u.port && u.origin === origem &&
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.oricse\.com\.br$/.test(u.hostname))
      return origem;
  } catch {}
  return null;
}
function comCorsDoDominio(req: Request, resposta: Response): Response {
  const origem = origemPermitidaParaCors(req);
  if (!origem) return resposta;
  const cabecalhos = new Headers(resposta.headers);
  cabecalhos.set("Access-Control-Allow-Origin", origem);
  cabecalhos.set("Vary", "Origin");
  cabecalhos.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version");
  cabecalhos.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return new Response(resposta.body, {status:resposta.status,statusText:resposta.statusText,headers:cabecalhos});
}

async function processarRequisicao(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método não permitido" }, 405);
  try {
    const requestedAction = new URL(req.url).searchParams.get("action");
    if (requestedAction === "webhook") return await processWebhook(req);
    const body = await req.json();
    // Mantém compatibilidade com chamadas antigas sem query string.
    const action = requestedAction || (body?.agenda_id ? "agenda" : body?.comanda_id ? "comanda" : "");
    if (action === "agenda") return reply(await reservaAgenda(req, body));
    if (action === "comanda") return reply(await checkoutComanda(req, body));
    return reply({ error: "Ação desconhecida" }, 404);
  } catch (error) {
    console.error("Portal pagamentos", error instanceof Error ? error.message : "erro");
    return reply({ error: error instanceof Error ? error.message : "Não foi possível processar o pagamento." }, 400);
  }
}
Deno.serve(async(req: Request) => comCorsDoDominio(req, await processarRequisicao(req)));
