import { agendarSync } from "@/lib/sync";
import { useEffect, useState, useSyncExternalStore } from "react";
import { carregarRegistros, salvarRegistros, type Registro } from "@/lib/ficha";

// Store compartilhado: todas as telas (cabeçalho, início, registros) enxergam
// a mesma lista e re-renderizam juntas.
let estado: Registro[] = [];
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

function definir(valor: Registro[] | ((atual: Registro[]) => Registro[])) {
  estado = typeof valor === "function" ? (valor as (a: Registro[]) => Registro[])(estado) : valor;
  salvarRegistros(estado);
  agendarSync();
  notificar();
}

export function useRegistros() {
  const registros = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [carregado, setCarregado] = useState(iniciado);

  useEffect(() => {
    if (!iniciado) {
      iniciado = true;
      estado = carregarRegistros();
      notificar();
    }
    setCarregado(true);
  }, []);

  return { registros, setRegistros: definir, carregado };
}
