// Assistant API authentication. The local assistant (running on the owner's computer) sends a key
// whose SHA-256 hash is registered in assistant_keys; the key itself never leaves that computer.
import { sha256Hex } from "./crypto.server";
import type { Actor } from "./posts.server";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export async function authenticateAssistant(
  request: Request,
): Promise<{ admin: Admin; actor: Actor; keyName: string } | Response> {
  if(process.env["ORICSTUDIO_ASSISTENTE_HOMOLOGADO"]!=="true")
    return new Response("Assistente em homologação", {status:503});
  const token = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hash = await sha256Hex(token);
  const { data: key } = await supabaseAdmin
    .from("assistant_keys")
    .select("id, nome, revogada_em, clinica_id")
    .eq("key_hash", hash)
    .maybeSingle();
  if (!key || key.revogada_em || !key.clinica_id)
    return new Response("Unauthorized", { status: 401 });
  // Chave do assistente sempre pertence a exatamente uma clínica.
  const {data:clinic}=await (supabaseAdmin as any).from("studio_clinicas")
    .select("id,ativa,licenca_ativa,licenca_expira_em").eq("id",key.clinica_id).maybeSingle();
  if(!clinic?.ativa||!clinic.licenca_ativa||
    (clinic.licenca_expira_em&&Date.parse(clinic.licenca_expira_em)<=Date.now()))
    return new Response("Clínica sem licença", {status:403});
  const {tenantScopedAdmin}=await import("./tenant-admin.server");
  const admin=tenantScopedAdmin(supabaseAdmin,key.clinica_id);
  await supabaseAdmin
    .from("assistant_keys")
    .update({ ultimo_uso: new Date().toISOString() })
    .eq("id", key.id);
  return {
    admin,
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
