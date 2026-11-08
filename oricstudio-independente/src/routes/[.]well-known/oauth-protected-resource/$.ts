import { createFileRoute } from "@tanstack/react-router";
import { baseUrl, CORS, oauthJson, protectedResourceMetadata } from "@/lib/server/oauth.server";

// OAuth discovery for the Claude connector (also answers the path-suffixed form).
export const Route = createFileRoute("/.well-known/oauth-protected-resource/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => oauthJson(protectedResourceMetadata(baseUrl(request))),
    },
  },
});
