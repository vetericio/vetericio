import { useEffect, useState, useSyncExternalStore } from "react";
import type { Curva } from "@/lib/curva";
import { carregarModulo, salvarModulo } from "@/lib/persistencia-banco";
import { toast } from "sonner";

let estado: Curva[] = [];
let iniciado = false;
let carregamento: Promise<void> | null = null;
let fila = Promise.resolve();
const ouvintes = new Set<() => void>();

function subscribe(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

const getSnapshot = () => estado;

function definir(valor: Curva[] | ((atual: Curva[]) => Curva[])) {
  const anterior = estado;
  estado = typeof valor === "function" ? valor(estado) : valor;
  const proximo = estado;
  ouvintes.forEach((fn) => fn());
  fila = fila.then(() => salvarModulo("curvas", proximo)).catch((erro) => {
    console.error("Erro ao salvar curvas no Supabase", erro);
    if (estado === proximo) { estado = anterior; ouvintes.forEach((fn) => fn()); }
    toast.error("Não foi possível salvar as curvas no banco.");
  });
}

export function useCurvas() {
  const curvas = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [carregado, setCarregado] = useState(iniciado);

  useEffect(() => {
    let ativo = true;
    if (!iniciado && !carregamento) {
      carregamento = carregarModulo<Curva[]>("curvas", []).then((dados) => {
        estado = dados;
        iniciado = true;
        ouvintes.forEach((fn) => fn());
      }).catch((erro) => {
        console.error("Erro ao carregar curvas do Supabase", erro);
        toast.error("Não foi possível carregar as curvas do banco.");
      }).finally(() => { carregamento = null; });
    }
    (carregamento ?? Promise.resolve()).then(() => { if (ativo) setCarregado(iniciado); });
    return () => { ativo = false; };
  }, []);

  return { curvas, setCurvas: definir, carregado };
}
