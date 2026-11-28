import { useEffect, useState } from "react";
import { PromocaoPerfisPopup } from "@/components/PromocaoPerfisPopup";
import { supabaseBanco } from "@/integrations/supabase/client";

export function MostrarPromocaoPerfisNaHome() {
  const [disponivel, setDisponivel] = useState(false);
  useEffect(() => {
    let montado = true;
    let pedido = 0;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    function aoVoltar() {
      if (document.visibilityState === "visible") void consultar();
    }
    async function consultar() {
      const atual = ++pedido;
      if (temporizador) clearTimeout(temporizador);
      try {
        const { data, error } = await (supabaseBanco as any).rpc("oricse_oferta_perfis_equipe");
        if (!montado || atual !== pedido) return;
        const fim = typeof data?.encerra_em === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.encerra_em)
          ? Date.parse(data.encerra_em + "T23:59:59.999-03:00") + 1
          : NaN;
        const tempo = fim - Date.now();
        const elegivel = !error && data?.ativa === true && typeof data?.id === "string" &&
          data.id.length > 0 && data.essencial_bonus === 2 && tempo > 0;
        setDisponivel(elegivel);
        if (elegivel) {
          temporizador = setTimeout(() => {
            if (Date.now() >= fim) setDisponivel(false);
            else void consultar();
          }, Math.min(tempo, 2147483000));
        }
      } catch {
        if (montado && atual === pedido) setDisponivel(false);
      }
    }
    void consultar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      montado = false;
      if (temporizador) clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);
  return <PromocaoPerfisPopup disponivel={disponivel} />;
}
