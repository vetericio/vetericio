import { createFileRoute } from "@tanstack/react-router";
import { authenticateJobRequest } from "@/lib/server/job-auth.server";

// Called daily by pg_cron: daily report, weekly on Mondays, monthly on the 1st.
export const Route = createFileRoute("/api/public/jobs/reports")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateJobRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runScheduledReports } = await import("@/lib/server/reports.server");
        try {
          return Response.json({
            success: true,
            relatorios: await runScheduledReports(supabaseAdmin),
          });
        } catch (e: any) {
          console.error("reports", String(e?.message || e));
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
