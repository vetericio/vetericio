import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/oricstudio/meta/data-deletion")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        if (!code) {
          const { metaDataDeletionInstructions } = await import("@/lib/oricstudio-meta-data-deletion.server");
          return metaDataDeletionInstructions();
        }
        if (!/^ORICSE[A-F0-9]{36}$/.test(code)) return Response.json({ error: "Código de confirmação inválido." }, { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { metaDataDeletionStatus } = await import("@/lib/oricstudio-meta-data-deletion.server");
        return metaDataDeletionStatus(supabaseAdmin, code);
      },
      POST: async ({ request }) => {
        const body = await request.formData();
        const signedRequest = body.get("signed_request");
        if (typeof signedRequest !== "string") return Response.json({ error: "signed_request ausente." }, { status: 400 });
        const { signedMetaUserId, processMetaDataDeletion } = await import("@/lib/oricstudio-meta-data-deletion.server");
        const userId = await signedMetaUserId(signedRequest);
        if (!userId) return Response.json({ error: "signed_request inválido." }, { status: 400 });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          return Response.json(await processMetaDataDeletion(supabaseAdmin, userId), { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json({ error: "Não foi possível processar a exclusão." }, { status: 503 });
        }
      },
    },
  },
});
