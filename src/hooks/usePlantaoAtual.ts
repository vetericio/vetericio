import { useEffect, useState, useSyncExternalStore } from "react";
import {
  carregarPlantaoAtual,
  salvarPlantaoAtual,
  diaDeHoje,
  type PlantaoAtual,
  type Turno,
} from "@/lib/plantao";

let estado: PlantaoAtual | null = null;
let iniciado = false;
const ouvintes = new Set<() => void>();

function subscribe(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

const getSnapshot = () => estado;
const getServerSnapshot = () => estado;

function definir(turno: Turno | null, dia?: string) {
  estado = turno ? { dia: dia || diaDeHoje(), turno, escolhidoEm: diaDeHoje() } : null;
  salvarPlantaoAtual(estado);
  ouvintes.forEach((fn) => fn());
}

export function usePlantaoAtual() {
  const plantao = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [carregado, setCarregado] = useState(iniciado);

  useEffect(() => {
    if (!iniciado) {
      iniciado = true;
      estado = carregarPlantaoAtual();
      ouvintes.forEach((fn) => fn());
    }
    setCarregado(true);
  }, []);

  return { plantao, definirTurno: definir, carregado };
}
