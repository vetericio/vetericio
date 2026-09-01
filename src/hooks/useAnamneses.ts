import { agendarSync } from "@/lib/sync";
import { useEffect, useState, useSyncExternalStore } from "react";
import { carregarAnamneses, salvarAnamneses, type Anamnese } from "@/lib/anamnese";

let estado: Anamnese[] = [];
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

function definir(valor: Anamnese[] | ((atual: Anamnese[]) => Anamnese[])) {
  estado = typeof valor === "function" ? (valor as (a: Anamnese[]) => Anamnese[])(estado) : valor;
  salvarAnamneses(estado);
  agendarSync();
  notificar();
}

export function useAnamneses() {
  const anamneses = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [carregado, setCarregado] = useState(iniciado);

  useEffect(() => {
    if (!iniciado) {
      iniciado = true;
      estado = carregarAnamneses();
      notificar();
    }
    setCarregado(true);
  }, []);

  return { anamneses, setAnamneses: definir, carregado };
}
