import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Shared read queries. All reads go through RLS with the signed-in user's session;
// writes that touch Meta or need auditing go through server functions in app.functions.ts.

export const qk = {
  settings: ["app_settings"] as const,
  connections: ["meta_connections"] as const,
  accounts: ["instagram_accounts"] as const,
  pages: ["facebook_pages"] as const,
  brands: ["brands"] as const,
  audit: ["audit_log"] as const,
};

export function useSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useConnections() {
  return useQuery({
    queryKey: qk.connections,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_connections")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: qk.accounts,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_accounts")
        .select("*")
        .order("username");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePages() {
  return useQuery({
    queryKey: qk.pages,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facebook_pages")
        .select("id, nome, connection_id, origem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBrands() {
  return useQuery({
    queryKey: qk.brands,
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: unknown }).message);
  return "Erro inesperado.";
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
