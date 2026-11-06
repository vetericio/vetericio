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
        const {activeClinicJobs}=await import("@/lib/server/clinic-jobs.server");
        const { runScheduledReports } = await import("@/lib/server/reports.server");
        try {
          const jobs=await activeClinicJobs(supabaseAdmin);
          const relatorios=[];
          for(const {clinicId,admin} of jobs){
            relatorios.push({clinica_id:clinicId,resultado:await runScheduledReports(admin)});
          }
          return Response.json({success:true,total_clinicas:jobs.length,relatorios});
        } catch (e: any) {
          console.error("reports", String(e?.message || e));
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
