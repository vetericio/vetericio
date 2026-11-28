import { useQuery } from "@tanstack/react-query";
import { supabaseBanco } from "@/integrations/supabase/client";
import { lerCampanhaPerfis } from "@/lib/promocao-perfis-ui";

export function useCampanhaPerfisEquipe(ativada = true) {
  return useQuery({
    queryKey: ["oricse-oferta-perfis-equipe"],
    enabled: ativada,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async () => {
      // Contrato público; não envia identificadores pessoais ou dados do pedido.
      const { data, error } = await (
        supabaseBanco.rpc as unknown as (funcao: "oricse_oferta_perfis_equipe") => Promise<{
          data: unknown;
          error: unknown;
        }>
      )("oricse_oferta_perfis_equipe");
      if (error) throw new Error("Não foi possível confirmar as condições para perfis.");
      return lerCampanhaPerfis(data);
    },
  });
}
