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
let envioAtual: Promise<void> | null = null;
let conflito = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let falhasConsecutivas = 0;
const AVISO_SINCRONIZACAO = "oricse-sync-status";

async function tokenAtual() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Faça login novamente para sincronizar os dados.");
  return data.session.access_token;
}

async function processarLote() {
  enviando = true;
  const lote = fila;
  fila = [];
  try {
    const accessToken = await tokenAtual();
    const result = await salvarEstadoOricseDrive({ data: { accessToken, alteracoes: lote } } as never) as any;
    if(result?.error)throw Object.assign(new Error(result.error.message), result.error);
    if(result?.ok === false) throw new Error("O servidor não confirmou a gravação.");
    falhasConsecutivas = 0;
    toast.dismiss(AVISO_SINCRONIZACAO);
    // Se a mesma chave foi editada enquanto o lote anterior estava em voo,
    // a próxima gravação deve esperar a versão que acabou de ser confirmada.
    for (const pendente of fila) {
      const anterior = lote.find(item => item.chave === pendente.chave);
      if (anterior && pendente.esperado === anterior.valor) continue;
      if (anterior && pendente.esperado === anterior.esperado) pendente.esperado = anterior.valor;
    }
  } catch (error: any) {
    // Preserve apenas a alteração mais recente de cada chave, sem perder
    // o valor esperado do primeiro envio que não foi confirmado.
    for (const anterior of lote) {
      const indice = fila.findIndex(item => item.chave === anterior.chave);
      if (indice < 0) fila.push(anterior);
      else fila[indice] = { ...fila[indice], esperado: anterior.esperado };
    }
    falhasConsecutivas++;
    console.error("Falha ao confirmar gravação no PostgreSQL:", error);
    if(error?.code==="DRIVE_CONFLICT" || /Outros usuários alteraram/.test(error?.message||"")){
      conflito = true;
      toast.error("Alterações conflitantes",{
        id: AVISO_SINCRONIZACAO,
        description:"Há alterações pendentes que conflitam com outra edição. Revise antes de continuar.",
        duration:Infinity,
        action:{label:"Atualizar e revisar",onClick:()=>window.location.reload()},
      });
    } else {
      const mensagem = error instanceof Error ? error.message : "Falha desconhecida na gravação.";
      toast.error("Alterações não salvas", {
        id: AVISO_SINCRONIZACAO,
        description: mensagem.slice(0, 240) + " — Tente novamente. Não feche esta aba antes de confirmar o salvamento.",
        duration: Infinity,
        action: { label: "Tentar novamente", onClick: () => { void descarregarOricseStorage().catch(() => undefined); } },
      });
    }
    throw error;
  } finally {
    enviando = false;
    if (fila.length && !conflito) agendarEnvio();
  }
}

// Um salvamento explícito aguarda o envio já em andamento.
// Antes, descarregarOricseStorage retornava sem aguardar o servidor,
// exibindo confirmação na tela enquanto o lote anterior ainda estava pendente.
async function enviarFila(): Promise<void> {
  if (envioAtual) return envioAtual;
  if (!fila.length) return;
  const atual = processarLote();
  envioAtual = atual;
  try {
    await atual;
  } finally {
    if (envioAtual === atual) envioAtual = null;
  }
}

function agendarEnvio() {
  if(conflito)return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void enviarFila().catch(() => undefined);
  }, falhasConsecutivas ? Math.min(30000, 1000 * 2 ** Math.min(falhasConsecutivas - 1, 5)) : 180);
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
  // Uma reidratação forçada não pode apagar edições ainda pendentes em memória.
  if (fila.length || envioAtual) {
    await descarregarOricseStorage();
  }
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
  while (fila.length || envioAtual) {
    await enviarFila();
    if (timer) { clearTimeout(timer); timer = null; }
  }
}

export function limparMemoriaOricse() {
  memoria.clear();
  sessao.clear();
  if (fila.length || enviando) {
    console.warn("Há alterações não confirmadas ao encerrar a sessão ORICSE.");
  }
  fila = [];
  envioAtual = null;
  conflito = false;
  falhasConsecutivas = 0;
  toast.dismiss(AVISO_SINCRONIZACAO);
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
