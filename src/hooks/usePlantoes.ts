import { useEffect, useState, useSyncExternalStore } from "react";
import { carregarPlantoes, salvarPlantoes, type Plantao } from "@/lib/ficha";
import { agendarSync } from "@/lib/sync";

let estado: Plantao[] = [];
let iniciado = false;
const ouvintes = new Set<() => void>();

function notificar() {
  ouvintes.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

const getSnapshot = () => estado;
const getServerSnapshot = () => estado;

function definir(valor: Plantao[] | ((atual: Plantao[]) => Plantao[])) {
  estado = typeof valor === "function" ? (valor as (a: Plantao[]) => Plantao[])(estado) : valor;
  salvarPlantoes(estado);
  agendarSync();
  notificar();
}

export function usePlantoes() {
  const plantoes = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [carregado, setCarregado] = useState(iniciado);

  useEffect(() => {
    if (!iniciado) {
      iniciado = true;
      estado = carregarPlantoes();
      notificar();
    }
    setCarregado(true);
    const recarregar = () => {
      estado = carregarPlantoes();
      notificar();
    };
    window.addEventListener("veterico-sync-atualizado", recarregar);
    return () => window.removeEventListener("veterico-sync-atualizado", recarregar);
  }, []);

  return { plantoes, setPlantoes: definir, carregado };
}
