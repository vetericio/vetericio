import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useRegistros } from "./useRegistros";
import { usePlantoes } from "./usePlantoes";
import { usePlantaoAtual } from "./usePlantaoAtual";
import { useCurvas } from "./useCurvas";
import { limparAlarmesDeCurva } from "./useAlarmes";
import { chaveDoAnimal } from "@/lib/curva";
import { diaDeHoje } from "@/lib/plantao";
import type { Plantao } from "@/lib/ficha";

/** Arquiva o plantão atual no histórico e limpa o aparelho para o próximo. */
export function useFinalizarPlantao() {
  const { registros, setRegistros } = useRegistros();
  const { setPlantoes } = usePlantoes();
  const { plantao, limparPlantao } = usePlantaoAtual();
  const { curvas, setCurvas } = useCurvas();
  const navigate = useNavigate();

  return () => {
    if (registros.length > 0) {
      const novo: Plantao = {
        id: crypto.randomUUID(),
        data: plantao?.dia ?? diaDeHoje(),
        turno: plantao?.turno ?? "",
        registros,
        // Guarda a foto das curvas destes animais para o PDF deste plantão.
        curvas: curvas.filter((c) =>
          registros.some((r) => chaveDoAnimal(r.animal, r.especie) === c.chave),
        ),
        criadoEm: new Date().toISOString(),
      };
      setPlantoes((ps) => [novo, ...ps]);
      setRegistros([]);
    }
    // As curvas valem até o fim do plantão: encerra e desliga os alarmes delas.
    setCurvas((lista) => lista.map((c) => (c.ativa ? { ...c, ativa: false } : c)));
    limparAlarmesDeCurva();
    limparPlantao();
    toast.success("Plantão finalizado.");
    navigate({ to: "/plantoes" });
  };
}
