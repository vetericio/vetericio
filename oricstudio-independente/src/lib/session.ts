import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Client-side Supabase session. `loading` stays true until the stored session is read. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

export type AppRole="admin"|"editor"|"viewer";
export type StudioClinic={id:string;nome:string;ativa:boolean;licenca_ativa:boolean;licenca_expira_em:string|null;papel:AppRole};

export function useClinicSelection(userId:string|undefined) {
  return useQuery({
    queryKey:["studio-clinic-selection",userId],
    enabled:!!userId,
    queryFn:async()=>{
      const {data,error}=await (supabase as any).from("studio_selecao")
        .select("clinica_id").eq("user_id",userId!).maybeSingle();
      if(error)throw error;
      return (data?.clinica_id as string|undefined)??null;
    },
  });
}

export function useClinicOptions(userId:string|undefined) {
  return useQuery({
    queryKey:["studio-clinic-options",userId],
    enabled:!!userId,
    queryFn:async():Promise<StudioClinic[]>=>{
      const {data:members,error:memberError}=await (supabase as any)
        .from("studio_membros").select("clinica_id,papel").eq("user_id",userId!).eq("ativo",true);
      if(memberError)throw memberError;
      const rows=(members??[]) as {clinica_id:string;papel:AppRole}[];
      if(!rows.length)return [];
      const {data:clinics,error:clinicError}=await (supabase as any)
        .from("studio_clinicas").select("id,nome,ativa,licenca_ativa,licenca_expira_em")
        .in("id",rows.map(x=>x.clinica_id)).order("nome");
      if(clinicError)throw clinicError;
      return (clinics??[]).map((c:any)=>({
        id:c.id,nome:c.nome,ativa:c.ativa,licenca_ativa:c.licenca_ativa,
        licenca_expira_em:c.licenca_expira_em,
        papel:rows.find(x=>x.clinica_id===c.id)?.papel??"viewer",
      }));
    },
  });
}

export function useRoles(userId:string|undefined) {
  const selection=useClinicSelection(userId);
  return useQuery({
    queryKey:["studio-roles",userId,selection.data],
    enabled:!!userId&&!!selection.data,
    queryFn:async()=>{
      const {data,error}=await (supabase as any)
        .from("studio_membros").select("papel").eq("user_id",userId!)
        .eq("clinica_id",selection.data).eq("ativo",true);
      if(error)throw error;
      return (data??[]).map((x:{papel:AppRole})=>x.papel);
    },
  });
}

export function useIsAdmin() {
  const {session}=useSession();
  const roles=useRoles(session?.user.id);
  return !!roles.data?.includes("admin");
}

export async function selectClinic(userId:string,clinicId:string) {
  // O banco verifica o vínculo por RLS, e a sessão nunca é compartilhada com
  // o Gestor 2.0. Nenhum ID de clínica é guardado em localStorage.
  const {error}=await (supabase as any).from("studio_selecao").upsert(
    {user_id:userId,clinica_id:clinicId,atualizada_em:new Date().toISOString()},
    {onConflict:"user_id"},
  );
  if(error)throw error;
  // Elimina qualquer dado em cache de outras clínicas no TanStack Query.
  window.location.reload();
}
