import { useEffect, useState, useSyncExternalStore } from "react";
import { carregarRegistros, salvarRegistros, type Registro } from "@/lib/ficha";

// Store compartilhado: todas as telas (cabeçalho, início, registros) enxergam
// a mesma lista e re-renderizam juntas.
let estado: Registro[] = [];
let iniciado = false;
let salvarPendente: ReturnType<typeof setTimeout> | null = null;
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
  notificar();
  // Persistência fora do caminho crítico do clique/digitação.
  if (salvarPendente) clearTimeout(salvarPendente);
  salvarPendente = setTimeout(descarregarRegistros, 0);
}

export function descarregarRegistros() {
  if (!salvarPendente) return;
  clearTimeout(salvarPendente);
  salvarPendente = null;
  salvarRegistros(estado);
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
