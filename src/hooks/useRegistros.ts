import { useEffect, useState } from "react";
import { carregarRegistros, salvarRegistros, type Registro } from "@/lib/ficha";

export function useRegistros() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    setRegistros(carregarRegistros());
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (carregado) salvarRegistros(registros);
  }, [registros, carregado]);

  return { registros, setRegistros, carregado };
}
