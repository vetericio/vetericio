import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Approval and revocation of MCP connector access (ChatGPT/Codex/Claude). Only admins and editors may connect.

type Ctx = { supabase: any; userId: string; claims: any };

async function roles(context:Ctx):Promise<string[]>{
  const {tenantForUser}=await import("./server/tenant-admin.server");
  const tenant=await tenantForUser(context);
  return [tenant.role];
}

function emailOf(context: Ctx) {
  return typeof context.claims?.email === "string" ? (context.claims.email as string) : null;
}

const authorizeSchema = z.object({
  client_id: z.string().max(200),
  redirect_uri: z.string().max(2000).optional(),
  response_type: z.string().max(20),
  code_challenge: z.string().max(200),
  code_challenge_method: z.string().max(20),
  state: z.string().max(2000).optional(),
});

/** Gives the approval page the client's name (and rejects invalid requests before the click). */
export const describeOAuthRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => authorizeSchema.parse(input))
  .handler(async ({ context, data }) => {
    await roles(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { validateAuthorize } = await import("./server/oauth.server");
    const { clientName, params } = await validateAuthorize(supabaseAdmin, data);
    return { clientName, redirectHost: new URL(params.redirect_uri).host };
  });

export const decideOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => authorizeSchema.extend({ aprovar: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { validateAuthorize, createCode, redirectWith } = await import("./server/oauth.server");
    const { audit } = await import("./server/meta.server");
    const { aprovar, ...req } = data;
    const { params } = await validateAuthorize(supabaseAdmin, req);
    if (!aprovar)
      return {
        redirect: redirectWith(params.redirect_uri, {
          error: "access_denied",
          state: params.state,
        }),
      };
    const r = await roles(context);
    if (!r.includes("admin") && !r.includes("editor"))
      throw new Error("Somente administradores e editores podem conectar o Gestor Instagram.");
    const {admin}=await (await import("./server/tenant-admin.server"))
      .scopedAdminForUser(context,"editor");
    const code = await createCode(admin, context.userId, params);
    await audit(admin, {
      user_id: context.userId,
      user_email: emailOf(context),
      acao: "conector_mcp_autorizado",
      alvo: params.client_id,
    });
    return { redirect: redirectWith(params.redirect_uri, { code, state: params.state }) };
  });

/** Revokes every token of one MCP client; it must connect again afterwards. */
export const revokeConnector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ client_id: z.string().max(200) }).parse(input))
  .handler(async ({ context, data }) => {
    if (!(await roles(context)).includes("admin"))
      throw new Error("Somente administradores podem revogar conexões.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("./server/meta.server");
    const {admin}=await (await import("./server/tenant-admin.server"))
      .scopedAdminForUser(context,"admin");
    const { error } = await admin
      .from("oauth_tokens")
      .update({ revogado_em: new Date().toISOString(), refresh_hash: null })
      .eq("client_id", data.client_id)
      .is("revogado_em", null);
    if (error) throw new Error("Não foi possível revogar.");
    await audit(admin, {
      user_id: context.userId,
      user_email: emailOf(context),
      acao: "conector_mcp_revogado",
      alvo: data.client_id,
    });
    return { ok: true };
  });
