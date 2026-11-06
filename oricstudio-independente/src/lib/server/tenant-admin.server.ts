import type { SupabaseClient } from "@supabase/supabase-js";
import { assertIndependentOricStudio } from "./instance-guard.server";

// Todos os dados do OricStudio estão associados a uma clínica e ao seu plano ativo.
// A identidade vem exclusivamente do JWT verificado no servidor + RLS do banco,
// nunca de um ID fornecido no corpo da solicitação.
type Context = { supabase: SupabaseClient<any>; userId: string };
type Role = "admin" | "editor" | "viewer";
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export type StudioTenant = { clinicId: string; userId: string; role: Role };

export async function tenantForUser(context: Context, min: Role = "viewer"): Promise<StudioTenant> {
  assertIndependentOricStudio();
  const {data:selected,error:selectedErr} = await (context.supabase as any)
    .from("studio_selecao").select("clinica_id").eq("user_id",context.userId).maybeSingle();
  if(selectedErr || !selected?.clinica_id)throw new Error("Escolha uma clínica do OricStudio para continuar.");
  const id=String(selected.clinica_id);
  const {data:allowed,error:allowedErr}=await (context.supabase as any)
    .rpc("studio_pode_ler",{p_clinica:id});
  if(allowedErr || allowed !== true)throw new Error("Licença OricStudio inativa ou sem autorização nesta clínica.");
  const {data:member,error:memberErr}=await (context.supabase as any)
    .from("studio_membros").select("papel,ativo").eq("clinica_id",id).eq("user_id",context.userId).maybeSingle();
  if(memberErr||!member?.ativo||!["admin","editor","viewer"].includes(member.papel))
    throw new Error("Vínculo com a clínica inválido.");
  const role=member.papel as Role;
  if(min==="admin" && role!=="admin")throw new Error("Ação exclusiva de administradores desta clínica.");
  if(min==="editor" && role==="viewer")throw new Error("Permissão de edição necessária nesta clínica.");
  return { clinicId:id,userId:context.userId,role };
}

function tenantValue(value:unknown,clinicId:string):unknown {
  if(Array.isArray(value))return value.map(v=>tenantValue(v,clinicId));
  if(!value||typeof value!=="object")throw new Error("Registro de clínica inválido.");
  const record=value as Record<string,unknown>;
  if(record.clinica_id!=null && record.clinica_id!==clinicId)
    throw new Error("Tentativa de alteração entre clínicas bloqueada.");
  return {...record,clinica_id:clinicId};
}

// Este proxy existe para proteger operações internas que usam service_role (RLS
// não se aplica ao service_role). TUDO deve passar por filtro de clínica no
// banco, inclusive o WHERE das mutações. A trigger SQL confirma a relação de
// cada linha com sua conta/Post pai e impede troca de propriedade.
export function tenantScopedAdmin(admin:Admin, clinicId:string):Admin {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clinicId))
    throw new Error("Identificador de clínica inválido.");
  return new Proxy(admin,{
    get(target,prop,receiver){
      if(prop==="from")return (table:string)=>{
        const original=(target.from as any).call(target,table);
        if(["studio_clinicas","studio_membros","studio_selecao","user_roles"].includes(table))
          throw new Error("Tabelas de autorização não podem ser acessadas pelo serviço editorial.");
        return {
          select:(...args:any[])=>original.select(...args).eq("clinica_id",clinicId),
          update:(payload:unknown,...args:any[])=>original.update(tenantValue(payload,clinicId),...args).eq("clinica_id",clinicId),
          delete:(...args:any[])=>original.delete(...args).eq("clinica_id",clinicId),
          insert:(payload:unknown,...args:any[])=>original.insert(tenantValue(payload,clinicId),...args),
          upsert:(payload:unknown,...args:any[])=>original.upsert(tenantValue(payload,clinicId),...args),
        };
      };
      if(prop==="rpc")return (fn:string,args:Record<string,unknown>={})=>{
        if(fn==="claim_due_posts")return (target.rpc as any).call(target,fn,{...args,_clinica_id:clinicId});
        throw new Error(`RPC sem escopo de clínica não permitida: ${fn}`);
      };
      // Storage e Auth nunca podem aceitar identificadores sem validação
      // explícita de pertencimento em server functions. Não expor o cliente
      // de administrador ao navegador.
      return Reflect.get(target,prop,receiver);
    },
  }) as Admin;
}

export async function scopedAdminForUser(context:Context,min:Role="viewer") {
  const tenant=await tenantForUser(context,min);
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  return {tenant,admin:tenantScopedAdmin(supabaseAdmin,tenant.clinicId)};
}

export async function assertTenantObject(
  context:Context,
  table:"instagram_accounts"|"posts"|"meta_connections"|"comments"|"media_assets"|"alerts"|"regras_publicacao",
  id:string,
  min:Role="viewer",
) {
  const tenant=await tenantForUser(context,min);
  const {data,error}=await (context.supabase as any).from(table)
    .select("id,clinica_id").eq("id",id).eq("clinica_id",tenant.clinicId).maybeSingle();
  if(error||!data)throw new Error("Registro não pertence à clínica ativa.");
  return tenant;
}

export async function assertTenantStillActive(admin:Admin, clinicId:string, userId:string, min:Role="admin") {
  // Usado no callback OAuth após o navegador voltar da Meta. Nunca confiar
  // apenas no state: o operador pode ter sido removido durante o login.
  const {data:clinic}=await admin.from("studio_clinicas" as any)
    .select("id,ativa,licenca_ativa,licenca_expira_em").eq("id",clinicId).maybeSingle();
  if(!clinic?.ativa||!clinic.licenca_ativa||
     (clinic.licenca_expira_em&&Date.parse(clinic.licenca_expira_em)<=Date.now()))
    throw new Error("Clínica indisponível ou sem licença.");
  const {data:member}=await admin.from("studio_membros" as any)
    .select("papel,ativo").eq("clinica_id",clinicId).eq("user_id",userId).maybeSingle();
  if(!member?.ativo||(min==="admin"&&member.papel!=="admin")||
     (min==="editor"&&member.papel==="viewer"))
    throw new Error("Permissão da clínica revogada.");
}
