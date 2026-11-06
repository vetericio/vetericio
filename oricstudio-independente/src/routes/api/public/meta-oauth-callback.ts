import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const querySchema = z.object({
  code: z.string().max(2048).optional(),
  state: z.string().max(256).optional(),
  error: z.string().max(200).optional(),
  error_reason: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/public/meta-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { metaConfig, graphGet, syncConnectionAssets, audit } = await import("@/lib/server/meta.server");
        const { sha256Hex, encryptToken } = await import("@/lib/server/crypto.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cfg = metaConfig();
        const back = (ok: boolean, motivo?: string) =>
          Response.redirect(`${cfg.baseUrl || new URL(request.url).origin}/contas?conexao=${ok ? "ok" : "erro"}${motivo ? `&motivo=${encodeURIComponent(motivo)}` : ""}`, 302);

        const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
        if (!parsed.success) return back(false, "parametros_invalidos");
        const q = parsed.data;
        if (!q.state) return back(false, "state_ausente");

        const hash = await sha256Hex(q.state);
        const { data: st } = await supabaseAdmin.from("oauth_states").select("id, user_id, expires_at, used_at, provider").eq("state_hash", hash).maybeSingle();
        if (!st || st.provider!=="facebook") return back(false, "state_invalido");
        if (st.used_at) return back(false, "state_ja_usado");
        if (new Date(st.expires_at).getTime() < Date.now()) return back(false, "state_expirado");
        const { data: marked } = await supabaseAdmin.from("oauth_states").update({ used_at: new Date().toISOString() }).eq("id", st.id).is("used_at", null).gt("expires_at",new Date().toISOString()).select("id");
        if (!marked?.length) return back(false, "state_ja_usado");

        const who = { user_id: st.user_id };
        if (q.error || q.error_reason) {
          await audit(supabaseAdmin, { ...who, acao: "conectar_meta", resultado: "erro", detalhes: { error: q.error, error_reason: q.error_reason } });
          return back(false, q.error_reason || q.error || "erro_meta");
        }
        if (!q.code) return back(false, "code_ausente");
        if (cfg.missing.length) return back(false, "configuracao_incompleta");

        try {
          const short = await graphGet<{ access_token: string }>(`${cfg.graph}/oauth/access_token`, {
            client_id: cfg.appId, client_secret: cfg.appSecret, redirect_uri: cfg.redirectUri, code: q.code,
          });
          const long = await graphGet<{ access_token: string; expires_in?: number }>(`${cfg.graph}/oauth/access_token`, {
            grant_type: "fb_exchange_token", client_id: cfg.appId, client_secret: cfg.appSecret, fb_exchange_token: short.access_token,
          });
          const token = long.access_token;
          const me = await graphGet<{ id: string; name?: string }>(`${cfg.graph}/me`, { fields: "id,name", access_token: token });
          const perms = await graphGet<{ data: { permission: string; status: string }[] }>(`${cfg.graph}/me/permissions`, { access_token: token });
          const granted = perms.data.filter((p) => p.status === "granted").map((p) => p.permission);
          const declined = perms.data.filter((p) => p.status !== "granted").map((p) => p.permission);
          const expira = long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null;

          const { data: conn, error: connErr } = await supabaseAdmin.from("meta_connections").upsert({
            meta_user_id: me.id, meta_user_name: me.name ?? null, connected_by: st.user_id, status: "ativa",
            escopos_concedidos: granted, escopos_recusados: declined, expira_em: expira,
            ultima_verificacao: new Date().toISOString(), ultimo_erro: null,
          }, { onConflict: "meta_user_id" }).select("id").single();
          if (connErr || !conn) throw new Error("falha_ao_salvar_conexao");

          const enc = await encryptToken(token);
          await supabaseAdmin.from("meta_tokens").delete().eq("connection_id", conn.id).eq("tipo", "user");
          await supabaseAdmin.from("meta_tokens").insert({ connection_id: conn.id, tipo: "user", page_id: null, token_criptografado: enc.ciphertext, iv: enc.iv, expira_em: expira });

          const summary = await syncConnectionAssets(supabaseAdmin, conn.id, token, granted);
          await audit(supabaseAdmin, { ...who, acao: "conectar_meta", alvo: conn.id, detalhes: { meta_user: me.name, recusadas: declined, ...summary } });
          return back(true);
        } catch (e: any) {
          await audit(supabaseAdmin, { ...who, acao: "conectar_meta", resultado: "erro", detalhes: { erro: String(e?.message || e).slice(0, 300) } });
          return back(false, "falha_na_troca_do_token");
        }
      },
    },
  },
});
