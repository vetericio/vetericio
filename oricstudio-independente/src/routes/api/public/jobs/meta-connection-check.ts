import { createFileRoute } from "@tanstack/react-router";
import { authenticateJobRequest } from "@/lib/server/job-auth.server";

export const Route = createFileRoute("/api/public/jobs/meta-connection-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateJobRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runConnectionCheck, audit } = await import("@/lib/server/meta.server");
        try {
          const results = await runConnectionCheck(supabaseAdmin);
          await audit(supabaseAdmin, {
            acao: "verificacao_diaria",
            alvo: "todas",
            detalhes: { total: results.length },
          });
          return Response.json({ success: true, total: results.length });
        } catch (e: any) {
          await audit(supabaseAdmin, {
            acao: "verificacao_diaria",
            alvo: "todas",
            resultado: "erro",
            detalhes: { erro: String(e?.message || e).slice(0, 300) },
          });
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
