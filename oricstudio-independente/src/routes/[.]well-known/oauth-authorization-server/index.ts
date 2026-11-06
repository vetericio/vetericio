import { createFileRoute } from "@tanstack/react-router";
import { baseUrl, CORS, oauthJson, authServerMetadata } from "@/lib/server/oauth.server";

// OAuth discovery for the MCP connector (ChatGPT/Codex/Claude) (also answers the path-suffixed form).
export const Route = createFileRoute("/.well-known/oauth-authorization-server/")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => oauthJson(authServerMetadata(baseUrl(request))),
    },
  },
});
