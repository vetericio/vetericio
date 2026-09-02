import { useEffect, useState, useSyncExternalStore } from "react";
import { carregarCurvas, salvarCurvas, type Curva } from "@/lib/curva";

let estado: Curva[] = [];
let iniciado = false;
const ouvintes = new Set<() => void>();

function subscribe(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

const getSnapshot = () => estado;

function definir(valor: Curva[] | ((atual: Curva[]) => Curva[])) {
  estado = typeof valor === "function" ? valor(estado) : valor;
  salvarCurvas(estado);
  ouvintes.forEach((fn) => fn());
}

export function useCurvas() {
  const curvas = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [carregado, setCarregado] = useState(iniciado);

  useEffect(() => {
    if (!iniciado) {
      iniciado = true;
      estado = carregarCurvas();
      ouvintes.forEach((fn) => fn());
    }
    setCarregado(true);
    const recarregar = () => {
      estado = carregarCurvas();
      ouvintes.forEach((fn) => fn());
    };
    window.addEventListener("veterico-sync-atualizado", recarregar);
    return () => window.removeEventListener("veterico-sync-atualizado", recarregar);
  }, []);

  return { curvas, setCurvas: definir, carregado };
}
