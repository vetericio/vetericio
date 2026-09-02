import { useEffect, useState, useSyncExternalStore } from "react";
import {
  carregarPlantaoAtual,
  finalizarPlantaoAtual,
  salvarPlantaoAtual,
  diaDeHoje,
  type PlantaoAtual,
  type Turno,
} from "@/lib/plantao";
import { agendarSync } from "@/lib/sync";
import { ativarJejumNoturno } from "./useAlarmes";

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
  const anterior = estado;
  const agora = new Date().toISOString();
  estado = turno
    ? {
        id: crypto.randomUUID(),
        dia: dia || diaDeHoje(),
        turno,
        escolhidoEm: diaDeHoje(),
        abertoEm: agora,
        atualizadoEm: agora,
      }
    : null;
  if (estado) salvarPlantaoAtual(estado);
  else if (anterior) finalizarPlantaoAtual(anterior);
  else salvarPlantaoAtual(null);
  agendarSync();
  if (turno === "noturno") ativarJejumNoturno();
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
    const recarregar = () => {
      estado = carregarPlantaoAtual();
      ouvintes.forEach((fn) => fn());
    };
    window.addEventListener("veterico-sync-atualizado", recarregar);
    return () => window.removeEventListener("veterico-sync-atualizado", recarregar);
  }, []);

  return { plantao, definirTurno: definir, limparPlantao: () => definir(null), carregado };
}
