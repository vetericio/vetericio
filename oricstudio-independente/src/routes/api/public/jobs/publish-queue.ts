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
        const {activeClinicJobs}=await import("@/lib/server/clinic-jobs.server");
        const { runPublishQueue } = await import("@/lib/server/publisher.server");
        try {
          const jobs=await activeClinicJobs(supabaseAdmin);
          const resultados=[];
          for(const {clinicId,admin} of jobs){
            resultados.push({clinica_id:clinicId,...(await runPublishQueue(admin,clinicId))});
          }
          return Response.json({success:true,total_clinicas:jobs.length,resultados});
        } catch (e: any) {
          console.error("publish-queue", String(e?.message || e));
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
