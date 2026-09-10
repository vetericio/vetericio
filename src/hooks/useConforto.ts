import { useEffect, useSyncExternalStore } from "react";
import {
  CONFORTO_CALMO,
  CONFORTO_VETERICO,
  aplicarConforto,
  carregarConforto,
  salvarConforto,
  type Conforto,
  type ModoApp,
} from "@/lib/conforto";

let estado: Conforto = CONFORTO_VETERICO;
let iniciado = false;
const ouvintes = new Set<() => void>();

function subscribe(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

const getSnapshot = () => estado;
const getServerSnapshot = () => estado;

function definir(valor: Conforto) {
  estado = valor;
  salvarConforto(valor);
  aplicarConforto(valor);
  ouvintes.forEach((fn) => fn());
}

/** Lê as preferências fora de componentes (som, vibração). */
export function confortoAtual(): Conforto {
  if (!iniciado) {
    iniciado = true;
    estado = carregarConforto();
  }
  return estado;
}

export function useConforto() {
  const conforto = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!iniciado) {
      iniciado = true;
      estado = carregarConforto();
    }
    aplicarConforto(estado);
    ouvintes.forEach((fn) => fn());
  }, []);

  const definirModo = (modo: ModoApp) =>
    definir(modo === "calmo" ? { ...CONFORTO_CALMO } : { ...CONFORTO_VETERICO });

  const atualizar = (parcial: Partial<Conforto>) => definir({ ...estado, ...parcial });

  return { conforto, definirModo, atualizar };
}
