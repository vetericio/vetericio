import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantScopedAdmin } from "./tenant-admin.server";

type Admin=(typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

/** Somente clínicas sincronizadas, ativas e com licença válida podem executar jobs. */
export async function activeClinicJobs(admin:Admin):Promise<{clinicId:string;admin:Admin}[]>{
  const {data,error}=await (admin as SupabaseClient<any>).from("studio_clinicas")
    .select("id,licenca_expira_em").eq("ativa",true).eq("licenca_ativa",true);
  if(error)throw new Error("Não foi possível validar o licenciamento das clínicas.");
  return (data??[])
    .filter((c)=>!c.licenca_expira_em||Date.parse(c.licenca_expira_em)>Date.now())
    .map((c)=>({clinicId:c.id,admin:tenantScopedAdmin(admin,c.id)}));
}
