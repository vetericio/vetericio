import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/meta-data-deletion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { metaConfig, audit } = await import("@/lib/server/meta.server");
        const { b64UrlToBytes, timingSafeEqualBytes, randomToken } =
          await import("@/lib/server/crypto.server");
        const cfg = metaConfig();
        if (!cfg.appSecret) return new Response("Server configuration error", { status: 500 });

        let signed = "";
        const ct = request.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const j: any = await request.json().catch(() => ({}));
          signed = String(j?.signed_request || "");
        } else {
          const form = await request.formData().catch(() => null);
          signed = String(form?.get("signed_request") || "");
        }
        if (!signed || signed.length > 4096 || !signed.includes("."))
          return new Response("Bad request", { status: 400 });

        const [sigPart = "", payloadPart = ""] = signed.split(".", 2);
        if (!sigPart || !payloadPart) return new Response("Bad request", { status: 400 });
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(cfg.appSecret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const expected = new Uint8Array(
          await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadPart)),
        );
        let provided: Uint8Array;
        try {
          provided = b64UrlToBytes(sigPart);
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }
        if (!timingSafeEqualBytes(expected, provided))
          return new Response("Invalid signature", { status: 401 });

        let payload: any;
        try {
          payload = JSON.parse(new TextDecoder().decode(b64UrlToBytes(payloadPart)));
        } catch {
          return new Response("Bad payload", { status: 400 });
        }
        if (
          payload?.algorithm?.toUpperCase() !== "HMAC-SHA256" ||
          typeof payload?.user_id !== "string"
        ) {
          return new Response("Bad payload", { status: 400 });
        }
        const metaUserId = payload.user_id.slice(0, 64);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const code = randomToken(12);
        await supabaseAdmin
          .from("data_deletion_requests")
          .insert({ confirmation_code: code, meta_user_id: metaUserId });

        let status = "concluida";
        try {
          const { data: conns } = await supabaseAdmin
            .from("meta_connections")
            .select("id")
            .eq("meta_user_id", metaUserId);
          const ids = (conns || []).map((c) => c.id);
          if (ids.length) {
            await supabaseAdmin.from("instagram_accounts").delete().in("connection_id", ids);
            await supabaseAdmin.from("meta_connections").delete().in("id", ids); // cascades tokens + pages
          }
        } catch {
          status = "erro";
        }
        await supabaseAdmin
          .from("data_deletion_requests")
          .update({
            status,
            concluida_em: status === "concluida" ? new Date().toISOString() : null,
          })
          .eq("confirmation_code", code);
        await audit(supabaseAdmin, {
          acao: "exclusao_de_dados_meta",
          alvo: code,
          resultado: status === "concluida" ? "sucesso" : "erro",
        });

        const base = cfg.baseUrl || new URL(request.url).origin;
        return Response.json({
          url: `${base}/exclusao-de-dados?codigo=${code}`,
          confirmation_code: code,
        });
      },
    },
  },
});
