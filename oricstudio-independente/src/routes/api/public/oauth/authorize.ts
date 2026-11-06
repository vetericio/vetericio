import { createFileRoute } from "@tanstack/react-router";
import { OAuthError, validateAuthorize } from "@/lib/server/oauth.server";

// Authorization endpoint: checks the request and sends the person to the approval page, where they
// log in (if needed) and approve the connection.
export const Route = createFileRoute("/api/public/oauth/authorize")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await validateAuthorize(supabaseAdmin, Object.fromEntries(url.searchParams));
          return new Response(null, {
            status: 302,
            headers: { Location: `/oauth/autorizar${url.search}` },
          });
        } catch (e) {
          const msg = e instanceof OAuthError ? e.message : "Erro interno.";
          return new Response(`Não foi possível conectar: ${msg}`, {
            status: 400,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      },
    },
  },
});
