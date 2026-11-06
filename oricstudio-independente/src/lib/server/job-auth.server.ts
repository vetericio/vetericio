// Authenticates scheduled-job calls: pg_cron sends the token kept in the database Vault,
// e o agendador próprio pode enviar ORICSTUDIO_CRON_SECRET. Não reutilizar credenciais do Gestor.
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export async function authenticateJobRequest(request: Request): Promise<Response | null> {
  const token = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return new Response("Unauthorized", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("verify_jobs_token", { _token: token });
  if (data === true) return null;

  if (process.env["ORICSTUDIO_CRON_SECRET"]) return authenticateCronRequest(request);
  return new Response("Unauthorized", { status: 401 });
}
