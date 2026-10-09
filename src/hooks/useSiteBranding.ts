import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiteBranding = {
  marca: string;
  logo_url: string;
};

const PADRAO: SiteBranding = {
  marca: "Oricse",
  logo_url: "/oricse-logo.png",
};

export function useSiteBranding() {
  const [branding, setBranding] = useState<SiteBranding>(PADRAO);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await (supabase as any)
        .from("oricse_config")
        .select("valor")
        .eq("chave", "site_publico")
        .maybeSingle();

      if (!ativo || error) return;
      const valor = data?.valor || {};
      setBranding({
        marca: valor.marca?.trim() || PADRAO.marca,
        logo_url: valor.logo_url?.trim() || PADRAO.logo_url,
      });
    })();

    return () => { ativo = false; };
  }, []);

  return branding;
}
