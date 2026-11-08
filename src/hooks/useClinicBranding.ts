import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ClinicBranding = { nome: string; logoUrl: string | null };
const VAZIO: ClinicBranding = { nome: "", logoUrl: null };

/** Identidade da clínica ativa — nunca a primeira clínica disponível. */
export function useClinicBranding() {
  const [branding, setBranding] = useState<ClinicBranding>(VAZIO);
  useEffect(() => {
    let ativo = true;
    let requisicao = 0;
    const carregar = async () => {
      const atual = ++requisicao;
      // Trocar de clínica não pode manter o logo da clínica anterior.
      setBranding(VAZIO);
      const { data, error } = await supabase.rpc("oricse_contexto_clinica_atual");
      if (!ativo || atual !== requisicao) return;
      if (error || !data?.[0]) return;
      setBranding({ nome: data[0].clinica_nome || "", logoUrl: data[0].clinica_logo_url || null });
    };
    void carregar();
    const atualizar = () => { void carregar(); };
    window.addEventListener("oricse:clinica-alterada", atualizar);
    return () => {
      ativo = false;
      window.removeEventListener("oricse:clinica-alterada", atualizar);
    };
  }, []);
  return branding;
}
