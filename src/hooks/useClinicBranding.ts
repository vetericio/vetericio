import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ClinicBranding = { nome: string; logoUrl: string | null };
const VAZIO: ClinicBranding = { nome: "", logoUrl: null };

/** Identidade da clínica ativa — nunca a primeira clínica disponível. */
export function useClinicBranding() {
  const [branding, setBranding] = useState<ClinicBranding>(VAZIO);
  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await supabase.rpc("oricse_contexto_clinica_atual");
      if (!ativo || error || !data?.[0]) return;
      setBranding({ nome: data[0].clinica_nome || "", logoUrl: data[0].clinica_logo_url || null });
    })();
    return () => {
      ativo = false;
    };
  }, []);
  return branding;
}
