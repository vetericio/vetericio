import { createFileRoute } from "@tanstack/react-router";
import { authenticateJobRequest } from "@/lib/server/job-auth.server";

export const Route = createFileRoute("/api/public/jobs/meta-connection-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateJobRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const {activeClinicJobs}=await import("@/lib/server/clinic-jobs.server");
        const { runConnectionCheck, audit } = await import("@/lib/server/meta.server");
        try {
          const jobs=await activeClinicJobs(supabaseAdmin);
          let total=0;
          for(const {admin} of jobs){
            const results=await runConnectionCheck(admin);
            total+=results.length;
            await audit(admin,{acao:"verificacao_diaria",alvo:"clinica",detalhes:{total:results.length}});
          }
          return Response.json({success:true,total});
        } catch (e: any) {
          console.error("meta-connection-check",String(e?.message||e).slice(0,200));
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
