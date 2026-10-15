import { useEffect, useState, useSyncExternalStore } from "react";
import type { Anamnese } from "@/lib/anamnese";
import { carregarModulo, salvarModulo } from "@/lib/persistencia-banco";
import { toast } from "sonner";

let estado: Anamnese[] = [];
let iniciado = false;
let carregamento: Promise<void> | null = null;
let fila = Promise.resolve();
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
  const anterior = estado;
  estado = proximo;
  notificar();
  fila = fila.then(() => salvarModulo("anamneses", proximo)).catch((erro) => {
    console.error("Erro ao salvar anamneses no Supabase", erro);
    if (estado === proximo) { estado = anterior; notificar(); }
    toast.error("Não foi possível salvar as observações no banco.");
  });
  return true;
}

export function useAnamneses() {
  const anamneses = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [carregado, setCarregado] = useState(iniciado);

  useEffect(() => {
    let ativo = true;
    if (!iniciado && !carregamento) {
      carregamento = carregarModulo<Anamnese[]>("anamneses", []).then((dados) => {
        estado = dados;
        iniciado = true;
        notificar();
      }).catch((erro) => {
        console.error("Erro ao carregar anamneses do Supabase", erro);
        toast.error("Não foi possível carregar as observações do banco.");
      }).finally(() => { carregamento = null; });
    }
    (carregamento ?? Promise.resolve()).then(() => { if (ativo) setCarregado(iniciado); });
    return () => { ativo = false; };
  }, []);

  return { anamneses, setAnamneses: definir, carregado };
}
