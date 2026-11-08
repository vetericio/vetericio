import { createHash, randomBytes } from "node:crypto";

const BASE_URL = "https://oricse.com.br";
const CALLBACK_PATH = "/api/oricstudio/meta/data-deletion";

type DeletionStatus = "pending" | "completed" | "failed";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function base64UrlBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return new Uint8Array(Buffer.from(padded, "base64"));
}

function confirmationCode() {
  return `ORICSE${randomBytes(18).toString("hex").toUpperCase()}`;
}

function userHash(userId: string) {
  return createHash("sha256").update(userId).digest("hex");
}

export async function signedMetaUserId(value: string) {
  const [signature, payload, ...extra] = value.split(".");
  const secret = process.env["ORICSTUDIO_META_CLIENT_SECRET"] || "";
  if (!signature || !payload || extra.length || !secret) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlBytes(signature),
    new TextEncoder().encode(payload),
  );
  if (!valid) return null;

  let data: { algorithm?: string; user_id?: string };
  try {
    data = JSON.parse(new TextDecoder().decode(base64UrlBytes(payload)));
  } catch {
    return null;
  }
  if (String(data.algorithm || "").toUpperCase() !== "HMAC-SHA256") return null;
  const userId = String(data.user_id || "").trim();
  return userId || null;
}

function statusUrl(code: string) {
  const url = new URL(CALLBACK_PATH, BASE_URL);
  url.searchParams.set("code", code);
  return url.toString();
}

export async function processMetaDataDeletion(db: any, userId: string) {
  const code = confirmationCode();
  const { data: request, error: createError } = await db
    .from("oricstudio_meta_exclusoes")
    .insert({ confirmation_code: code, meta_user_hash: userHash(userId) })
    .select("id")
    .single();
  if (createError || !request?.id) throw new Error("Não foi possível registrar a exclusão.");

  try {
    const { data: accounts, error: accountError } = await db
      .from("oricstudio_meta_contas")
      .select("id")
      .eq("instagram_user_id", userId);
    if (accountError) throw accountError;

    const accountIds = (accounts || []).map((account: { id: string }) => account.id);
    if (accountIds.length) {
      const { data: sends, error: sendLookupError } = await db
        .from("oricstudio_envios")
        .select("id")
        .in("conta_id", accountIds);
      if (sendLookupError) throw sendLookupError;

      const sendIds = (sends || []).map((send: { id: string }) => send.id);
      if (sendIds.length) {
        const { error: eventError } = await db
          .from("oricstudio_envio_eventos")
          .delete()
          .in("envio_id", sendIds);
        if (eventError) throw eventError;
      }

      const dependentTables = [
        "oricstudio_insights",
        "oricstudio_comentarios",
        "oricstudio_alertas",
        "oricstudio_regras_automacao",
        "oricstudio_relatorios",
      ];
      for (const table of dependentTables) {
        const { error } = await db.from(table).delete().in("conta_id", accountIds);
        if (error) throw error;
      }

      const { error: sendError } = await db
        .from("oricstudio_envios")
        .delete()
        .in("id", sendIds);
      if (sendError) throw sendError;

      const { error: auditError } = await db
        .from("oricstudio_meta_auditoria")
        .delete()
        .in("conta_id", accountIds);
      if (auditError) throw auditError;

      const { error: tokenError } = await db
        .from("oricstudio_meta_tokens")
        .delete()
        .in("conta_id", accountIds);
      if (tokenError) throw tokenError;

      const { error: deleteError } = await db
        .from("oricstudio_meta_contas")
        .delete()
        .in("id", accountIds);
      if (deleteError) throw deleteError;
    }

    const { error: completeError } = await db
      .from("oricstudio_meta_exclusoes")
      .update({ status: "completed", concluido_em: new Date().toISOString() })
      .eq("id", request.id);
    if (completeError) throw completeError;
  } catch (error) {
    await db
      .from("oricstudio_meta_exclusoes")
      .update({ status: "failed", ultimo_erro: "Falha interna ao processar a exclusão." })
      .eq("id", request.id);
    throw error;
  }

  return { url: statusUrl(code), confirmation_code: code };
}

export async function metaDataDeletionStatus(db: any, code: string) {
  const { data, error } = await db
    .from("oricstudio_meta_exclusoes")
    .select("confirmation_code,status,criado_em,concluido_em")
    .eq("confirmation_code", code)
    .maybeSingle();
  if (error || !data) return json({ error: "Código de confirmação não encontrado." }, 404);
  return json({
    confirmation_code: data.confirmation_code,
    status: data.status as DeletionStatus,
    created_at: data.criado_em,
    completed_at: data.concluido_em,
  });
}

export function metaDataDeletionInstructions() {
  return new Response(`<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Exclusão de dados — OricStúdio</title></head>
  <body style="font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 20px;line-height:1.6;color:#312530">
    <h1>Exclusão de dados do OricStúdio</h1>
    <p>Para solicitar a exclusão dos dados Meta associados à sua conta, remova o OricStúdio nas configurações da sua conta Meta. A Meta enviará o pedido assinado para esta aplicação.</p>
    <p>O OricStúdio remove as credenciais, a conexão da conta profissional e os registros de auditoria dessa conexão. Dados clínicos e financeiros da clínica não são apagados por este callback.</p>
    <p>Se precisar de ajuda, escreva para <a href="mailto:vetericio@gmail.com">vetericio@gmail.com</a>.</p>
  </body>
</html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
