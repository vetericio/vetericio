import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/usePermissoes";
import { lerComandas, saldoComanda, totalComanda, totalPagoComanda } from "@/lib/comandas";

export function ComandasBackgroundSync() {
  const { clinicaId, carregando, pode } = usePermissoes();

  useEffect(() => {
    if (carregando || !clinicaId || !pode("caixa.comandas")) return;
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const sincronizar = async () => {
      try {
        const comandas = lerComandas();
        if (!comandas.length || cancelado) return;

        const [tutoresResp, animaisResp] = await Promise.all([
          (supabase as any).from("tutores").select("id,dados").eq("clinica_id", clinicaId),
          (supabase as any).from("oricse_animais").select("id,tutor_id,dados").eq("clinica_id", clinicaId),
        ]);
        if (tutoresResp.error) throw tutoresResp.error;
        if (animaisResp.error) throw animaisResp.error;

        const mapaTutores = new Map<string, string>();
        for (const tutor of tutoresResp.data || []) {
          mapaTutores.set(String(tutor.id), String(tutor.id));
          const origem = tutor.dados?.origem_local_id;
          if (origem) mapaTutores.set(String(origem), String(tutor.id));
        }

        const mapaAnimais = new Map<string, { id: string; tutorId: string }>();
        for (const animal of animaisResp.data || []) {
          const item = { id: String(animal.id), tutorId: String(animal.tutor_id) };
          mapaAnimais.set(String(animal.id), item);
          const origem = animal.dados?.origem_local_id;
          if (origem) mapaAnimais.set(String(origem), item);
        }

        const payload = comandas.flatMap((comanda) => {
          const tutorId = mapaTutores.get(comanda.tutorId);
          const animal = mapaAnimais.get(comanda.animalId);
          if (!tutorId || !animal || animal.tutorId !== tutorId) return [];
          return [{
            id: comanda.id,
            clinica_id: clinicaId,
            tutor_id: tutorId,
            animal_id: animal.id,
            numero: comanda.numero,
            status: comanda.status,
            origem: comanda.origem,
            aberta_em: comanda.abertaEm,
            finalizada_em: comanda.finalizadaEm || null,
            itens: comanda.itens,
            pagamentos: comanda.pagamentos,
            total: totalComanda(comanda),
            total_pago: totalPagoComanda(comanda),
            saldo: saldoComanda(comanda),
            visivel_tutor: true,
            updated_at: new Date().toISOString(),
          }];
        });
        if (!payload.length || cancelado) return;

        const { error } = await (supabase as any)
          .from("oricse_portal_comandas")
          .upsert(payload, { onConflict: "id" });
        if (error) throw error;
      } catch (error) {
        console.error("Falha ao sincronizar comandas com o Portal do Tutor:", error);
      }
    };

    const agendar = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void sincronizar(), 250);
    };

    void sincronizar();
    window.addEventListener("oricse-comandas-atualizadas", agendar);
    window.addEventListener("storage", agendar);
    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("oricse-comandas-atualizadas", agendar);
      window.removeEventListener("storage", agendar);
    };
  }, [carregando, clinicaId, pode]);

  return null;
}
