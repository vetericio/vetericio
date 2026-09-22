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
  const proximo = typeof valor === "function" ? valor(estado) : valor;
  if (!salvarAnamneses(proximo)) return false;
  estado = proximo;
  notificar();
  return true;
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
