import { descarregarOricseStorage } from "@/lib/oricse-storage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fecharPlantaoComHistorico } from "@/lib/painel-plantao.functions";
import { turnoDoPainel } from "@/lib/painel-plantao";
import { usePermissoes } from "./usePermissoes";
import { usePlantaoAtual } from "./usePlantaoAtual";
import { descarregarRegistros } from "./useRegistros";

let fechando = false;

/** Finaliza apenas o turno; as internações permanecem abertas. */
export function useFinalizarPlantao() {
  const { plantao } = usePlantaoAtual();
  const { clinicaId, pode, carregando } = usePermissoes();

  return async () => {
    if (fechando) return;
    const turno = turnoDoPainel(plantao);
    if (
      !turno ||
      !clinicaId ||
      carregando ||
      !pode("internacao.plantoes") ||
      !pode("internacao.registrar")
    ) {
      toast.error("Sem plantão ativo ou sem permissão para finalizar.");
      return;
    }
    fechando = true;
    const id = toast.loading("Confirmando fechamento do plantão…");
    try {
      descarregarRegistros();
      await descarregarOricseStorage();
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw new Error("Sessão expirada. Entre novamente.");
      await fecharPlantaoComHistorico({
        data: { accessToken: data.session.access_token, clinicaId, turno: turno.chave },
      });
      toast.success("Plantão arquivado. As internações continuam abertas.", { id });
      window.location.assign("/plantoes");
    } catch (erro) {
      toast.error(
        erro instanceof Error ? erro.message : "Fechamento não confirmado. Confira o histórico.",
        { id },
      );
    } finally {
      fechando = false;
    }
  };
}
