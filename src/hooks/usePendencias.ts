import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ANIMAL_GERAL as ANIMAL_GERAL_TEXTO,
  carregarPendencias,
  chaveDoAnimal as chaveAnimalPendencia,
  novoId as novoIdPendencia,
  registrarOcorrencia as somarOcorrencia,
  removerOcorrencia as apagarOcorrencia,
  salvarPendencias,
  type ItemPendencia,
} from "@/lib/pendencias";

let estado: ItemPendencia[] = [];
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

/** Garante que o estado já foi lido do aparelho, mesmo fora de um componente. */
export function iniciarPendencias() {
  if (iniciado) return;
  iniciado = true;
  estado = carregarPendencias();
  notificar();
}

export function definirPendencias(
  valor: ItemPendencia[] | ((atual: ItemPendencia[]) => ItemPendencia[]),
) {
  iniciarPendencias();
  estado =
    typeof valor === "function"
      ? (valor as (a: ItemPendencia[]) => ItemPendencia[])(estado)
      : valor;
  salvarPendencias(estado);
  notificar();
}

/** Grava (cria ou atualiza) um item. */
export function salvarItemPendencia(item: ItemPendencia) {
  definirPendencias((atual) => {
    const existe = atual.some((i) => i.id === item.id);
    return existe ? atual.map((i) => (i.id === item.id ? item : i)) : [...atual, item];
  });
}

export function registrarOcorrenciaEm(id: string, observacao = "") {
  definirPendencias((atual) =>
    atual.map((i) => (i.id === id ? somarOcorrencia(i, observacao) : i)),
  );
}

export function removerOcorrenciaDe(id: string, ocorrenciaId: string) {
  definirPendencias((atual) =>
    atual.map((i) => (i.id === id ? apagarOcorrencia(i, ocorrenciaId) : i)),
  );
}

export function excluirItemPendencia(id: string) {
  definirPendencias((atual) => atual.filter((i) => i.id !== id));
}

export function usePendencias() {
  const pendencias = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [carregado, setCarregado] = useState(iniciado);

  useEffect(() => {
    iniciarPendencias();
    setCarregado(true);
  }, []);

  return {
    pendencias,
    carregado,
    setPendencias: definirPendencias,
    salvarItem: salvarItemPendencia,
    excluirItem: excluirItemPendencia,
    registrar: registrarOcorrenciaEm,
    removerOcorrencia: removerOcorrenciaDe,
  };
}

/**
 * Espelha as pendências das anamneses no módulo Pendências.
 * Idempotente: usa `origemId` para não duplicar e serve também de migração
 * das pendências que já existiam antes desta aba.
 */
export function espelharAnamneses(
  lista: {
    id: string;
    animal: string;
    especie?: string;
    pendencias?: { id: string; texto: string; feito: boolean }[];
  }[],
) {
  iniciarPendencias();
  const agora = new Date().toISOString();
  let mudou = false;
  let proximo = [...estado];

  for (const a of lista) {
    const nome = a.animal.trim();
    for (const p of a.pendencias ?? []) {
      const texto = p.texto.trim();
      if (!texto) continue;
      const status: ItemPendencia["status"] = p.feito ? "realizado" : "pendente";
      const existente = proximo.find((i) => i.origemId === p.id);
      if (existente) {
        if (existente.nome !== texto || existente.status !== status) {
          proximo = proximo.map((i) =>
            i.id === existente.id ? { ...i, nome: texto, status, atualizadoEm: agora } : i,
          );
          mudou = true;
        }
        continue;
      }
      proximo.push({
        id: novoIdPendencia(),
        animalChave: chaveAnimalPendencia(nome),
        animalNome: nome || ANIMAL_GERAL_TEXTO,
        especie: a.especie ?? "",
        categoria: "pendencia",
        nome: texto,
        status,
        ocorrencias: [],
        origem: "anamnese",
        origemId: p.id,
        criadoEm: agora,
        atualizadoEm: agora,
      });
      mudou = true;
    }
  }

  if (mudou) definirPendencias(proximo);
}

/**
 * Cria (se ainda não existir) o item do animal e soma uma ocorrência.
 * Usado pelos avisos automáticos da ficha — só roda após o "Sim, registrar".
 */
export function garantirItemERegistrar(dados: {
  animalNome: string;
  especie?: string;
  categoria: ItemPendencia["categoria"];
  nome: string;
}) {
  iniciarPendencias();
  const agora = new Date().toISOString();
  const chave = chaveAnimalPendencia(dados.animalNome);
  const existente = estado.find(
    (i) =>
      i.animalChave === chave &&
      i.categoria === dados.categoria &&
      i.nome.toLowerCase() === dados.nome.toLowerCase(),
  );
  if (existente) {
    registrarOcorrenciaEm(existente.id);
    return;
  }
  const novo: ItemPendencia = {
    id: novoIdPendencia(),
    animalChave: chave,
    animalNome: dados.animalNome.trim() || ANIMAL_GERAL_TEXTO,
    especie: dados.especie ?? "",
    categoria: dados.categoria,
    nome: dados.nome,
    status: "pendente",
    ocorrencias: [{ id: novoIdPendencia(), em: agora }],
    criadoEm: agora,
    atualizadoEm: agora,
  };
  definirPendencias((atual) => [...atual, novo]);
}
