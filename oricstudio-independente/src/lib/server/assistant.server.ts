// Assistant API authentication. The local assistant (running on the owner's computer) sends a key
// whose SHA-256 hash is registered in assistant_keys; the key itself never leaves that computer.
import { sha256Hex } from "./crypto.server";
import type { Actor } from "./posts.server";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export async function authenticateAssistant(
  request: Request,
): Promise<{ admin: Admin; actor: Actor; keyName: string } | Response> {
  const token = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hash = await sha256Hex(token);
  const { data: key } = await supabaseAdmin
    .from("assistant_keys")
    .select("id, nome, revogada_em")
    .eq("key_hash", hash)
    .maybeSingle();
  if (!key || key.revogada_em) return new Response("Unauthorized", { status: 401 });
  await supabaseAdmin
    .from("assistant_keys")
    .update({ ultimo_uso: new Date().toISOString() })
    .eq("id", key.id);
  return {
    admin: supabaseAdmin,
    actor: { userId: null, email: `assistente:${key.nome}`, role: "assistente" },
    keyName: key.nome,
  };
}

/** Accepts the account's uuid or its @username. Only managed accounts are visible to the assistant. */
export async function resolveAccount(admin: Admin, ref: string) {
  const clean = ref.trim().replace(/^@/, "");
  const query = /^[0-9a-f-]{36}$/.test(clean)
    ? admin.from("instagram_accounts").select("id, username, gerenciada").eq("id", clean)
    : admin.from("instagram_accounts").select("id, username, gerenciada").eq("username", clean);
  const { data } = await query.maybeSingle();
  if (!data?.gerenciada)
    throw new Error(`Conta "${ref}" não encontrada entre as contas gerenciadas.`);
  return data;
}

export function jsonError(e: unknown, status = 400) {
  return Response.json({ ok: false, erro: e instanceof Error ? e.message : String(e) }, { status });
}
