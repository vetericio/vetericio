import { createFileRoute } from "@tanstack/react-router";
import { CORS, exchangeToken, oauthErrorResponse, oauthJson } from "@/lib/server/oauth.server";

// Token endpoint: authorization_code (with PKCE) and refresh_token (rotating).
export const Route = createFileRoute("/api/public/oauth/token")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const type = request.headers.get("content-type") ?? "";
          const form = type.includes("application/json")
            ? new URLSearchParams((await request.json()) as Record<string, string>)
            : new URLSearchParams(await request.text());
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          return oauthJson(await exchangeToken(supabaseAdmin, form));
        } catch (e) {
          return oauthErrorResponse(e);
        }
      },
    },
  },
});
