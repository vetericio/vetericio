import { createFileRoute } from "@tanstack/react-router";
import { authenticateJobRequest } from "@/lib/server/job-auth.server";

// Called hourly by pg_cron: profile, daily insights, media insights, stories and comments.
export const Route = createFileRoute("/api/public/jobs/collect-metrics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateJobRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const {activeClinicJobs}=await import("@/lib/server/clinic-jobs.server");
        const { runCollection } = await import("@/lib/server/collector.server");
        try {
          const jobs=await activeClinicJobs(supabaseAdmin);
          const resultados=[];
          for(const {clinicId,admin} of jobs){
            resultados.push({clinica_id:clinicId,contas:await runCollection(admin)});
          }
          return Response.json({success:true,total_clinicas:jobs.length,resultados});
        } catch (e: any) {
          console.error("collect-metrics", String(e?.message || e));
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
