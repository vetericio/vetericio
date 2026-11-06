import { createFileRoute } from "@tanstack/react-router";
import { CORS, oauthErrorResponse, oauthJson, registerClient } from "@/lib/server/oauth.server";

// Dynamic client registration (RFC 7591) used by Claude when the connector is added.
export const Route = createFileRoute("/api/public/oauth/register")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const body = await request.json().catch(() => null);
          return oauthJson(await registerClient(supabaseAdmin, body), 201);
        } catch (e) {
          return oauthErrorResponse(e);
        }
      },
    },
  },
});
