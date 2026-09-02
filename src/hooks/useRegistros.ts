import { agendarSync, marcarRegistrosExcluidos } from "@/lib/sync";
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
  const anterior = estado;
  const proximo =
    typeof valor === "function" ? (valor as (a: Registro[]) => Registro[])(estado) : valor;
  const ids = new Set(proximo.map((r) => r.id));
  marcarRegistrosExcluidos(anterior.filter((r) => !ids.has(r.id)).map((r) => r.id));
  const agora = new Date().toISOString();
  let plantaoId = "";
  try {
    const bruto = window.localStorage.getItem("veterico-plantao-v1");
    const atual = bruto ? (JSON.parse(bruto) as { id?: unknown; finalizadoEm?: unknown }) : null;
    if (typeof atual?.id === "string" && !atual.finalizadoEm) plantaoId = atual.id;
  } catch {
    plantaoId = "";
  }
  const porId = new Map(anterior.map((r) => [r.id, r]));
  estado = proximo.map((r) => {
    const antes = porId.get(r.id);
    const mudou = !antes || antes !== r;
    return {
      ...r,
      ...(r.plantaoId || !plantaoId ? {} : { plantaoId }),
      ...(mudou ? { atualizadoEm: agora } : {}),
    };
  });
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
    const recarregar = () => {
      estado = carregarRegistros();
      notificar();
    };
    window.addEventListener("veterico-sync-atualizado", recarregar);
    return () => window.removeEventListener("veterico-sync-atualizado", recarregar);
  }, []);

  return { registros, setRegistros: definir, carregado };
}
