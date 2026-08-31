import { useEffect, useState, useSyncExternalStore } from "react";
import {
  carregarMedicamentos,
  salvarMedicamentos,
  type Medicamento,
} from "@/lib/medicamentos";

let estado: Medicamento[] = [];
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

function definir(valor: Medicamento[] | ((atual: Medicamento[]) => Medicamento[])) {
  estado = typeof valor === "function" ? (valor as (a: Medicamento[]) => Medicamento[])(estado) : valor;
  salvarMedicamentos(estado);
  notificar();
}

export function useMedicamentos() {
  const medicamentos = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [carregado, setCarregado] = useState(iniciado);

  useEffect(() => {
    if (!iniciado) {
      iniciado = true;
      estado = carregarMedicamentos();
      // Grava já na primeira vez para que exclusões não voltem no próximo acesso.
      salvarMedicamentos(estado);
      notificar();
    }
    setCarregado(true);
  }, []);

  const salvar = (item: Medicamento) => {
    definir((atual) => {
      const existe = atual.some((m) => m.id === item.id);
      return existe ? atual.map((m) => (m.id === item.id ? item : m)) : [...atual, item];
    });
  };

  const remover = (id: string) => definir((atual) => atual.filter((m) => m.id !== id));

  return { medicamentos, setMedicamentos: definir, salvar, remover, carregado };
}
