import { createFileRoute } from "@tanstack/react-router";
import { baseUrl, CORS, verifyAccess } from "@/lib/server/oauth.server";

// MCP endpoint of the MCP connector (ChatGPT/Codex/Claude) (Streamable HTTP, stateless, JSON responses).
// Without a valid OAuth token it answers 401 pointing to the discovery document.
async function handle(request: Request) {
  if(process.env["ORICSTUDIO_MCP_HOMOLOGADO"]!=="true")
    return Response.json({error:"O conector ainda está em homologação."},{status:503});
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const who = await verifyAccess(supabaseAdmin, request);
  if (!who) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
      {
        status: 401,
        headers: {
          ...CORS,
          "WWW-Authenticate": `Bearer resource_metadata="${baseUrl(request)}/.well-known/oauth-protected-resource"`,
        },
      },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400, headers: CORS },
    );
  }
  const { handleRpc } = await import("@/lib/server/mcp.server");
  const {tenantScopedAdmin}=await import("@/lib/server/tenant-admin.server");
  const ctx={admin:tenantScopedAdmin(supabaseAdmin,who.clinicId),actor:who.actor,email:who.email};
  const messages = Array.isArray(body) ? body : [body];
  const out = (await Promise.all(messages.map((m) => handleRpc(ctx, (m ?? {}) as never)))).filter(
    (r) => r !== null,
  );
  if (!out.length) return new Response(null, { status: 202, headers: CORS });
  return Response.json(Array.isArray(body) ? out : out[0], { headers: CORS });
}

export const Route = createFileRoute("/api/public/mcp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => handle(request),
      // No server-initiated stream: clients fall back to plain POST requests.
      GET: async () =>
        new Response("Method Not Allowed", { status: 405, headers: { ...CORS, Allow: "POST" } }),
      DELETE: async () => new Response(null, { status: 405, headers: { ...CORS, Allow: "POST" } }),
    },
  },
});
