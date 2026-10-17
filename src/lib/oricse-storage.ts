import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { carregarEstadoOricseDrive, salvarEstadoOricseDrive } from "@/lib/oricse-storage.functions";

type Alteracao = { chave: string; valor: string | null; esperado: string | null };

const memoria = new Map<string, string>();
const sessao = new Map<string, string>();
let hidratado = false;
let hidratando: Promise<void> | null = null;
let fila: Alteracao[] = [];
let enviando = false;
let conflito = false;
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
    const result = await salvarEstadoOricseDrive({ data: { accessToken, alteracoes: lote } } as never) as any;
    if(result?.error)throw Object.assign(new Error(result.error.message), result.error);
  } catch (error: any) {
    fila = [...lote, ...fila];
    console.error("Falha ao salvar estado no Google Drive:", error);
    if(error?.code==="DRIVE_CONFLICT" || /Outros usuários alteraram/.test(error?.message||"")){
      conflito = true;
      toast.error("Alterações conflitantes",{
        description:"Os dados não foram salvos. Outro profissional alterou essas informações. Atualize para revisar a versão atual.",
        duration:Infinity,
        action:{label:"Atualizar e revisar",onClick:()=>window.location.reload()},
      });
    } else {
      toast.error("Falha na sincronização",{
        description:"Os dados ainda não foram confirmados no Google Drive. Mantenha esta janela aberta.",
        duration:10000,
      });
    }
    throw error;
  } finally {
    enviando = false;
    if (fila.length && !conflito) agendarEnvio();
  }
}

function agendarEnvio() {
  if(conflito)return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void enviarFila().catch(() => undefined);
  }, 180);
}

function enfileirar(chave: string, valor: string | null, esperado: string | null) {
  if(conflito)throw new Error("Há um conflito pendente. Atualize a tela antes de salvar.");
  const indice = fila.findIndex((item) => item.chave === chave);
  const alteracao = { chave, valor, esperado };
  if (indice >= 0) fila[indice] = { ...alteracao, esperado: fila[indice].esperado };
  else fila.push(alteracao);
  agendarEnvio();
}

export const oricseStorage = {
  get length() { return memoria.size; },
  key(index: number) { return Array.from(memoria.keys())[index] ?? null; },
  getItem(chave: string) { return memoria.get(String(chave)) ?? null; },
  setItem(chave: string, valor: string) {
    const k = String(chave); const v = String(valor);
    if(conflito)throw new Error("Atualize a tela para resolver o conflito de edição.");
    const esperado=memoria.get(k)??null;
    memoria.set(k, v);
    if (hidratado) enfileirar(k, v, esperado);
  },
  removeItem(chave: string) {
    const k = String(chave);
    if(conflito)throw new Error("Atualize a tela para resolver o conflito de edição.");
    const esperado=memoria.get(k)??null;
    memoria.delete(k);
    if (hidratado) enfileirar(k, null, esperado);
  },
  clear() {
    if(conflito)throw new Error("Atualize a tela para resolver o conflito de edição.");
    const antigos=Array.from(memoria.entries());
    memoria.clear();
    if (hidratado) for (const [chave, esperado] of antigos) enfileirar(chave, null, esperado);
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
  conflito = false;
  hidratado = false;
}

export function storageOricseHidratado() { return hidratado; }

// Prevent accidental tab closure while unconfirmed operational changes remain.
if(typeof window!=="undefined"){
  window.addEventListener("beforeunload",(event)=>{
    if(fila.length || enviando){
      event.preventDefault();
      event.returnValue="";
    }
  });
}
