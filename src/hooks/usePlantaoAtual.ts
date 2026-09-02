import { useEffect, useState, useSyncExternalStore } from "react";
import {
  carregarPlantaoAtual,
  salvarPlantaoAtual,
  diaDeHoje,
  type PlantaoAtual,
  type Turno,
} from "@/lib/plantao";
import { ativarJejumNoturno } from "./useAlarmes";

let estado: PlantaoAtual | null = null;
let iniciado = false;
const ouvintes = new Set<() => void>();

function subscribe(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

const getSnapshot = () => estado;
// No servidor não existe aparelho: o plantão só é conhecido depois da hidratação.
const getServerSnapshot = () => null;


function definir(turno: Turno | null, dia?: string) {
  estado = turno ? { dia: dia || diaDeHoje(), turno, escolhidoEm: diaDeHoje() } : null;
  salvarPlantaoAtual(estado);
  if (turno === "noturno") ativarJejumNoturno();
  ouvintes.forEach((fn) => fn());
}

export function usePlantaoAtual() {
  const plantao = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Começa sempre em false para o HTML do servidor bater com o do aparelho.
  const [carregado, setCarregado] = useState(false);


  useEffect(() => {
    if (!iniciado) {
      iniciado = true;
      estado = carregarPlantaoAtual();
      ouvintes.forEach((fn) => fn());
    }
    setCarregado(true);
  }, []);

  return { plantao, definirTurno: definir, limparPlantao: () => definir(null), carregado };
}
