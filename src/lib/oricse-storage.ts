import { supabase } from "@/integrations/supabase/client";
import { carregarEstadoOricseDrive, salvarEstadoOricseDrive } from "@/lib/oricse-storage.functions";

type Alteracao = { chave: string; valor: string | null };

const memoria = new Map<string, string>();
const sessao = new Map<string, string>();
let hidratado = false;
let hidratando: Promise<void> | null = null;
let fila: Alteracao[] = [];
let enviando = false;
let timer: ReturnType<typeof setTimeout> | null = null;

async function tokenAtual() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Faça login novamente para sincronizar os dados.");
  return data.session.access_token;
}

async function enviarFila() {
  if (enviando || !fila.length) return;
  enviando = true;
  const lote = fila;
  fila = [];
  try {
    const accessToken = await tokenAtual();
    await salvarEstadoOricseDrive({ data: { accessToken, alteracoes: lote } } as never);
  } catch (error) {
    fila = [...lote, ...fila];
    console.error("Falha ao salvar estado no Google Drive:", error);
    throw error;
  } finally {
    enviando = false;
    if (fila.length) agendarEnvio();
  }
}

function agendarEnvio() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void enviarFila().catch(() => undefined);
  }, 180);
}

function enfileirar(chave: string, valor: string | null) {
  const indice = fila.findIndex((item) => item.chave === chave);
  const alteracao = { chave, valor };
  if (indice >= 0) fila[indice] = alteracao;
  else fila.push(alteracao);
  agendarEnvio();
}

export const oricseStorage = {
  get length() { return memoria.size; },
  key(index: number) { return Array.from(memoria.keys())[index] ?? null; },
  getItem(chave: string) { return memoria.get(String(chave)) ?? null; },
  setItem(chave: string, valor: string) {
    const k = String(chave); const v = String(valor);
    memoria.set(k, v);
    if (hidratado) enfileirar(k, v);
  },
  removeItem(chave: string) {
    const k = String(chave);
    memoria.delete(k);
    if (hidratado) enfileirar(k, null);
  },
  clear() {
    const chaves = Array.from(memoria.keys());
    memoria.clear();
    if (hidratado) for (const chave of chaves) enfileirar(chave, null);
  },
};

export const oricseSession = {
  get length() { return sessao.size; },
  key(index: number) { return Array.from(sessao.keys())[index] ?? null; },
  getItem(chave: string) { return sessao.get(String(chave)) ?? null; },
  setItem(chave: string, valor: string) { sessao.set(String(chave), String(valor)); },
  removeItem(chave: string) { sessao.delete(String(chave)); },
  clear() { sessao.clear(); },
};

export async function hidratarOricseStorage(force = false) {
  if (hidratado && !force) return;
  if (hidratando && !force) return hidratando;
  hidratando = (async () => {
    const accessToken = await tokenAtual();
    const resposta = await carregarEstadoOricseDrive({ data: { accessToken } } as never) as { estado?: Record<string, string> };
    memoria.clear();
    for (const [chave, valor] of Object.entries(resposta.estado || {})) memoria.set(chave, String(valor));
    hidratado = true;
  })();
  try { await hidratando; } finally { hidratando = null; }
}

export async function descarregarOricseStorage() {
  if (timer) { clearTimeout(timer); timer = null; }
  await enviarFila();
}

export function limparMemoriaOricse() {
  memoria.clear();
  sessao.clear();
  fila = [];
  hidratado = false;
}

export function storageOricseHidratado() { return hidratado; }
