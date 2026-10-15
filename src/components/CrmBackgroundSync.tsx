import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function CrmBackgroundSync() {
  useEffect(() => {
    let ativo = true;
    const sincronizar = async () => {
      if (!ativo || typeof window === "undefined") return;
      const { data: sessao } = await supabase.auth.getSession();
      const userId = sessao.session?.user?.id;
      if (!userId) return;
      const { data: contexto } = await (supabase as any).rpc("oricse_contexto_clinica_atual");
      const clinicaId = contexto?.[0]?.clinica_id;
      if (!clinicaId) return;
      const ler = (chave: string) => {
        try {
          const valor = JSON.parse(window.localStorage.getItem(chave) || "[]");
          return Array.isArray(valor) ? valor : [];
        } catch {
          return [];
        }
      };
      const agora = new Date().toISOString();
      const { error } = await (supabase as any).from("oricse_crm_fontes").upsert({
        clinica_id: clinicaId,
        tutores: ler("oricse-tutores-v1"),
        animais: ler("oricse-animais-v1"),
        prontuario: ler("oricse-prontuario-animal-v1"),
        agendas: ler("oricse-agendas-v2"),
        sincronizado_por: userId,
        sincronizado_em: agora,
        updated_at: agora,
      }, { onConflict: "clinica_id" });
      if (!error) await (supabase as any).rpc("oricse_crm_processar_clinica", { p_clinica_id: clinicaId });
    };
    void sincronizar();
    const timer = window.setInterval(() => void sincronizar(), 300000);
    return () => { ativo = false; window.clearInterval(timer); };
  }, []);
  return null;
}
