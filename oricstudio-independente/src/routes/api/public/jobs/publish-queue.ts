import { createFileRoute } from "@tanstack/react-router";
import { authenticateJobRequest } from "@/lib/server/job-auth.server";

// Called every minute by pg_cron. Publishes whatever is due; safe to call concurrently.
export const Route = createFileRoute("/api/public/jobs/publish-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateJobRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runPublishQueue } = await import("@/lib/server/publisher.server");
        try {
          return Response.json({ success: true, ...(await runPublishQueue(supabaseAdmin)) });
        } catch (e: any) {
          console.error("publish-queue", String(e?.message || e));
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
