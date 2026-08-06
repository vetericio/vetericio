import { useEffect, useState } from "react";
import { carregarPlantoes, salvarPlantoes, type Plantao } from "@/lib/ficha";

export function usePlantoes() {
  const [plantoes, setPlantoes] = useState<Plantao[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    setPlantoes(carregarPlantoes());
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (carregado) salvarPlantoes(plantoes);
  }, [plantoes, carregado]);

  return { plantoes, setPlantoes, carregado };
}
