/**
 * Sincronização entre aparelhos.
 * O app continua funcionando 100% offline: tudo fica salvo no aparelho e, quando
 * há internet, as alterações sobem e descem por um código secreto compartilhado.
 */
import { CHAVES_BACKUP, escreverBruto, lerBruto, type ChaveBackup } from "./backup";

const CHAVE_CODIGO = "veterico-sync-codigo-v1";
const CHAVE_PENDENTE = "veterico-sync-pendente-v1";
const CHAVE_ULTIMO = "veterico-sync-ultimo-v1";
const CHAVE_DESFAZER = "veterico-sync-desfazer-v1";
const CHAVE_PAUSA = "veterico-sync-pausa-v1";

/** Listas que são mescladas item por item (pelo id). */
const LISTAS: ChaveBackup[] = [
  "registros",
  "plantoes",
  "curvas",
  "alarmes",
  "medicamentos",
  "exclusoes",
];
/** Valores únicos: fica o mais recente que chegou. */
const SIMPLES: ChaveBackup[] = ["plantaoAtual", "tema", "cor"];

export type EstadoSync = "sem-codigo" | "sincronizado" | "sincronizando" | "pendente" | "erro";

/* ---------- código secreto ---------- */

const LETRAS = "abcdefghijkmnpqrstuvwxyz";

/** Código curto: uma letra e 6 números (ex: j965459). */
export function gerarCodigo(): string {
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  const letra = LETRAS[bytes[0]! % LETRAS.length]!;
  const numeros = Array.from(bytes.slice(1))
    .map((b) => String(b % 10))
    .join("");
  return `${letra}${numeros}`;
}

export function lerCodigo(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CHAVE_CODIGO) ?? "";
}

export function salvarCodigo(codigo: string) {
  if (typeof window === "undefined") return;
  const limpo = normalizarCodigo(codigo);
  if (limpo) window.localStorage.setItem(CHAVE_CODIGO, limpo);
}

export function esquecerCodigo() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CHAVE_CODIGO);
}

export function normalizarCodigo(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Aceita o código curto novo e também os códigos longos já em uso. */
export function codigoValido(codigo: string): boolean {
  const limpo = normalizarCodigo(codigo);
  return /^[a-z][0-9]{6}$/.test(limpo) || /^[a-z0-9]{16,64}$/.test(limpo);
}

/** Texto do QR lido no outro aparelho. */
export function textoQrSync(codigo: string): string {
  return `VETSYNC1:${codigo}`;
}

export function codigoDoQr(texto: string): string {
  const limpo = texto.trim();
  const bruto = limpo.startsWith("VETSYNC1:") ? limpo.slice(9) : limpo;
  return normalizarCodigo(bruto);
}

/* ---------- estado da fila offline ---------- */

export function temPendencia(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CHAVE_PENDENTE) === "1";
}

export function marcarPendente(valor: boolean) {
  if (typeof window === "undefined") return;
  if (valor) window.localStorage.setItem(CHAVE_PENDENTE, "1");
  else window.localStorage.removeItem(CHAVE_PENDENTE);
}

export function ultimaSync(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CHAVE_ULTIMO) ?? "";
}

function registrarSync(quando: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAVE_ULTIMO, quando);
}

/** Resumo do que chegou na última junção, mostrado na tela de Sincronização. */
export type ResumoSync = { animais: number; plantoes: number; quando: string };

const CHAVE_RESUMO = "veterico-sync-resumo-v1";

function guardarResumo(resumo: ResumoSync) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_RESUMO, JSON.stringify(resumo));
  } catch {
    /* sem espaço: seguimos sem resumo */
  }
}

export function ultimoResumo(): ResumoSync | null {
  if (typeof window === "undefined") return null;
  const bruto = window.localStorage.getItem(CHAVE_RESUMO);
  if (!bruto) return null;
  try {
    const r = JSON.parse(bruto) as Partial<ResumoSync>;
    if (typeof r.animais !== "number" || typeof r.plantoes !== "number") return null;
    return { animais: r.animais, plantoes: r.plantoes, quando: String(r.quando ?? "") };
  } catch {
    return null;
  }
}

/* ---------- mesclagem ---------- */

type Item = Record<string, unknown> & { id?: unknown };

type Exclusao = {
  id: string;
  tipo: "registro";
  excluidoEm: string;
};

type PlantaoSincronizado = {
  id: string;
  dia: string;
  turno: "diurno" | "noturno";
  abertoEm: string;
  atualizadoEm: string;
  finalizadoEm?: string;
};

function iso(valor: unknown): number {
  if (typeof valor !== "string") return 0;
  const n = new Date(valor).getTime();
  return Number.isNaN(n) ? 0 : n;
}

function lerExclusoes(valor: unknown): Exclusao[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((x): x is Exclusao => {
    if (!x || typeof x !== "object") return false;
    const e = x as Partial<Exclusao>;
    return typeof e.id === "string" && e.tipo === "registro" && typeof e.excluidoEm === "string";
  });
}

/** Grava a intenção de apagar para que uma cópia antiga de outro aparelho não reviva o animal. */
export function marcarRegistrosExcluidos(ids: string[]) {
  if (typeof window === "undefined" || ids.length === 0) return;
  const agora = new Date().toISOString();
  const atuais = lerExclusoes(lerBruto(CHAVES_BACKUP.exclusoes));
  const mapa = new Map(atuais.map((e) => [e.id, e]));
  ids.forEach((id) => mapa.set(id, { id, tipo: "registro", excluidoEm: agora }));
  escreverBruto(CHAVES_BACKUP.exclusoes, [...mapa.values()]);
}

function comoLista(valor: unknown): Item[] {
  return Array.isArray(valor) ? (valor as Item[]) : [];
}

function quando(item: Item): number {
  const campos = [
    "excluidoEm",
    "finalizadoEm",
    "atualizadoEm",
    "aplicadoEm",
    "criadoEm",
    "data",
    "fechadoEm",
  ];
  for (const campo of campos) {
    const valor = item[campo];
    if (typeof valor === "string") {
      const t = new Date(valor).getTime();
      if (!Number.isNaN(t)) return t;
    }
  }
  return 0;
}

/**
 * Junta duas listas por id, mantendo a versão mais recente de cada item.
 * Nada é apagado só porque não veio na outra lista e nada é duplicado.
 */
export function mesclarListas(local: unknown, remoto: unknown): Item[] {
  const mapa = new Map<string, Item>();
  const por = (item: Item, indice: number) => String(item?.id ?? `sem-id-${indice}`);

  comoLista(local).forEach((item, i) => mapa.set(por(item, i), item));
  comoLista(remoto).forEach((item, i) => {
    const chave = por(item, i);
    const atual = mapa.get(chave);
    if (!atual || quando(item) > quando(atual)) mapa.set(chave, item);
  });
  return [...mapa.values()];
}

function comoPlantao(valor: unknown): PlantaoSincronizado | null {
  if (!valor || typeof valor !== "object") return null;
  const p = valor as Partial<PlantaoSincronizado>;
  if (!p.dia || (p.turno !== "diurno" && p.turno !== "noturno")) return null;
  const agora = new Date().toISOString();
  return {
    id: typeof p.id === "string" && p.id ? p.id : `legado-${p.dia}-${p.turno}`,
    dia: p.dia,
    turno: p.turno,
    abertoEm: typeof p.abertoEm === "string" ? p.abertoEm : agora,
    atualizadoEm: typeof p.atualizadoEm === "string" ? p.atualizadoEm : agora,
    ...(typeof p.finalizadoEm === "string" ? { finalizadoEm: p.finalizadoEm } : {}),
  };
}

function mesmoPlantao(a: PlantaoSincronizado, b: PlantaoSincronizado): boolean {
  return a.id === b.id || (a.dia === b.dia && a.turno === b.turno);
}

function arquivarPlantao(
  antigo: PlantaoSincronizado,
  registros: Item[],
  plantoes: Item[],
  curvas: Item[],
): { registros: Item[]; plantoes: Item[] } {
  const doPlantao = registros.filter((r) => r["plantaoId"] === antigo.id);
  if (doPlantao.length === 0) return { registros, plantoes };
  const chaves = new Set(
    doPlantao.map((r) => {
      const nome = String(r["animal"] ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return `${nome}|${String(r["especie"] ?? "")}`;
    }),
  );
  const fotoCurvas = curvas.filter((c) => chaves.has(String(c["chave"] ?? "")));
  const historico: Item = {
    id: antigo.id,
    plantaoId: antigo.id,
    data: antigo.dia,
    turno: antigo.turno,
    registros: doPlantao,
    curvas: fotoCurvas,
    criadoEm: antigo.abertoEm,
    atualizadoEm: new Date().toISOString(),
  };
  const semDuplicata = plantoes.filter((p) => p.id !== antigo.id && p["plantaoId"] !== antigo.id);
  // Arquivar não é excluir: nada de marcas de exclusão aqui, senão o outro
  // aparelho perde para sempre os animais do plantão que foi guardado.
  return {
    registros: registros.filter((r) => r["plantaoId"] !== antigo.id),
    plantoes: [historico, ...semDuplicata],
  };
}

export type PacoteSync = {
  atualizadoEm: string;
  dados: Partial<Record<ChaveBackup, unknown>>;
};

/** Lê tudo deste aparelho no formato enviado para a nuvem. */
export function pacoteLocal(): PacoteSync {
  const dados: Partial<Record<ChaveBackup, unknown>> = {};
  for (const [nome, chave] of Object.entries(CHAVES_BACKUP) as [ChaveBackup, string][]) {
    const valor = lerBruto(chave);
    if (valor !== undefined) dados[nome] = valor;
  }
  const plantao = comoPlantao(dados.plantaoAtual);
  if (plantao && Array.isArray(dados.registros)) {
    dados.registros = (dados.registros as Item[]).map((r) =>
      typeof r["plantaoId"] === "string" ? r : { ...r, plantaoId: plantao.id },
    );
  }
  return { atualizadoEm: new Date().toISOString(), dados };
}

function validarPacote(bruto: unknown): PacoteSync | null {
  if (!bruto || typeof bruto !== "object") return null;
  const p = bruto as Record<string, unknown>;
  const dados = p["dados"];
  if (!dados || typeof dados !== "object") return null;
  return {
    atualizadoEm: typeof p["atualizadoEm"] === "string" ? p["atualizadoEm"] : "",
    dados: dados as Partial<Record<ChaveBackup, unknown>>,
  };
}

/** Mescla o pacote remoto com o local, grava no aparelho e devolve o resultado. */
export function mesclarPacote(remoto: PacoteSync): PacoteSync {
  const local = pacoteLocal();
  const remotoAtivo = comoPlantao(remoto.dados.plantaoAtual);
  if (remotoAtivo && Array.isArray(remoto.dados.registros)) {
    remoto.dados.registros = (remoto.dados.registros as Item[]).map((r) =>
      typeof r["plantaoId"] === "string" ? r : { ...r, plantaoId: remotoAtivo.id },
    );
  }
  const resultado: Partial<Record<ChaveBackup, unknown>> = { ...local.dados };

  for (const nome of LISTAS) {
    const juntas = mesclarListas(local.dados[nome], remoto.dados[nome]);
    if (juntas.length > 0 || remoto.dados[nome] !== undefined) resultado[nome] = juntas;
  }

  const exclusoes = lerExclusoes(resultado.exclusoes);
  const exclusaoPorId = new Map(exclusoes.map((e) => [e.id, e]));
  let registros = comoLista(resultado.registros).filter((r) => {
    const exclusao = exclusaoPorId.get(String(r.id ?? ""));
    if (!exclusao) return true;
    // A exclusão só vence se for mais recente que a última alteração do animal.
    return iso(r["atualizadoEm"]) > iso(exclusao.excluidoEm);
  });
  let plantoes = comoLista(resultado.plantoes);
  const curvas = comoLista(resultado.curvas);

  const localPlantao = comoPlantao(local.dados.plantaoAtual);
  const remotoPlantao = comoPlantao(remoto.dados.plantaoAtual);
  let plantaoFinal: PlantaoSincronizado | null = localPlantao;

  if (localPlantao && remotoPlantao) {
    if (mesmoPlantao(localPlantao, remotoPlantao)) {
      plantaoFinal =
        iso(remotoPlantao.atualizadoEm) > iso(localPlantao.atualizadoEm)
          ? remotoPlantao
          : localPlantao;
      const idFinal = plantaoFinal.id;
      registros = registros.map((r) => {
        const pid = r["plantaoId"];
        return pid === localPlantao.id || pid === remotoPlantao.id
          ? { ...r, plantaoId: idFinal }
          : r;
      });
    } else if (!localPlantao.finalizadoEm && !remotoPlantao.finalizadoEm) {
      const localMaisNovo =
        localPlantao.dia > remotoPlantao.dia ||
        (localPlantao.dia === remotoPlantao.dia &&
          iso(localPlantao.abertoEm) >= iso(remotoPlantao.abertoEm));
      const novo = localMaisNovo ? localPlantao : remotoPlantao;
      const antigo = localMaisNovo ? remotoPlantao : localPlantao;
      const arquivado = arquivarPlantao(antigo, registros, plantoes, curvas);
      registros = arquivado.registros;
      plantoes = arquivado.plantoes;
      
      plantaoFinal = novo;
    } else {
      const abertos = [localPlantao, remotoPlantao].filter((p) => !p.finalizadoEm);
      plantaoFinal =
        abertos[0] ??
        (iso(remotoPlantao.atualizadoEm) > iso(localPlantao.atualizadoEm)
          ? remotoPlantao
          : localPlantao);
    }
  } else {
    plantaoFinal = remotoPlantao ?? localPlantao;
  }


  resultado.registros = registros;
  resultado.plantoes = plantoes;
  resultado.exclusoes = exclusoes;
  if (plantaoFinal) resultado.plantaoAtual = plantaoFinal;

  const remotoMaisNovo =
    new Date(remoto.atualizadoEm || 0).getTime() > new Date(ultimaSync() || 0).getTime();
  for (const nome of SIMPLES) {
    if (nome === "plantaoAtual") continue;
    const valor = remoto.dados[nome];
    if (valor === undefined) continue;
    if (local.dados[nome] === undefined || remotoMaisNovo) resultado[nome] = valor;
  }

  for (const nome of Object.keys(resultado) as ChaveBackup[]) {
    escreverBruto(CHAVES_BACKUP[nome], resultado[nome]);
  }

  const idsLocais = new Set(comoLista(local.dados.registros).map((r) => String(r.id ?? "")));
  const plantoesLocais = new Set(comoLista(local.dados.plantoes).map((p) => String(p.id ?? "")));
  guardarResumo({
    animais: registros.filter((r) => !idsLocais.has(String(r.id ?? ""))).length,
    plantoes: plantoes.filter((p) => !plantoesLocais.has(String(p.id ?? ""))).length,
    quando: new Date().toISOString(),
  });

  return { atualizadoEm: new Date().toISOString(), dados: resultado };
}

/* ---------- desfazer ---------- */

/** Guarda o estado atual do aparelho, para o caso de a junção não agradar. */
function guardarDesfazer(pacote: PacoteSync) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_DESFAZER, JSON.stringify(pacote));
  } catch {
    /* espaço cheio: seguimos sem cópia */
  }
}

export function podeDesfazer(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.localStorage.getItem(CHAVE_DESFAZER);
}

/**
 * Volta os dados deste aparelho ao estado anterior à última sincronização e
 * pausa a sincronização automática, para que os dados não voltem sozinhos.
 */
export function desfazerUltimaSync(): boolean {
  if (typeof window === "undefined") return false;
  const bruto = window.localStorage.getItem(CHAVE_DESFAZER);
  if (!bruto) return false;
  const pacote = validarPacote(JSON.parse(bruto));
  if (!pacote) return false;
  for (const [nome, chave] of Object.entries(CHAVES_BACKUP) as [ChaveBackup, string][]) {
    escreverBruto(chave, pacote.dados[nome]);
  }
  window.localStorage.removeItem(CHAVE_DESFAZER);
  marcarPendente(false);
  pausar(true);
  return true;
}

export function sincronizacaoPausada(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CHAVE_PAUSA) === "1";
}

export function pausar(valor: boolean) {
  if (typeof window === "undefined") return;
  if (valor) window.localStorage.setItem(CHAVE_PAUSA, "1");
  else window.localStorage.removeItem(CHAVE_PAUSA);
}

/* ---------- ciclo de sincronização ---------- */

export type ResultadoSync = { ok: true; atualizadoEm: string } | { ok: false; motivo: string };

/**
 * Um ciclo completo: baixa o que está na nuvem, mescla com o aparelho e sobe o
 * resultado. Sem internet, marca as alterações como pendentes.
 */
export async function sincronizarAgora(manual = false): Promise<ResultadoSync> {
  const codigo = lerCodigo();
  if (!codigoValido(codigo)) return { ok: false, motivo: "Nenhum código de sincronização." };
  if (sincronizacaoPausada() && !manual) {
    return { ok: false, motivo: "Sincronização pausada depois de desfazer." };
  }
  if (manual) pausar(false);
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    marcarPendente(true);
    return { ok: false, motivo: "Sem internet: alterações pendentes." };
  }

  try {
    const { puxarSala, enviarSala } = await import("./sync.functions");
    const remoto = await puxarSala({ data: { codigo } });
    const pacoteRemoto = remoto.dadosJson ? validarPacote(JSON.parse(remoto.dadosJson)) : null;
    if (pacoteRemoto) guardarDesfazer(pacoteLocal());
    let final: PacoteSync;
    if (pacoteRemoto) {
      final = mesclarPacote(pacoteRemoto);
    } else {
      final = pacoteLocal();
      guardarResumo({ animais: 0, plantoes: 0, quando: new Date().toISOString() });
    }
    const enviado = await enviarSala({
      data: { codigo, dadosJson: JSON.stringify(final) },
    });
    marcarPendente(false);
    registrarSync(enviado.atualizadoEm);
    window.dispatchEvent(new Event("veterico-sync-atualizado"));
    return { ok: true, atualizadoEm: enviado.atualizadoEm };
  } catch (erro) {
    marcarPendente(true);
    return { ok: false, motivo: erro instanceof Error ? erro.message : "Erro ao sincronizar." };
  }
}

/** Formata o horário da última sincronização. */
export function quandoSync(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

let temporizador: ReturnType<typeof setTimeout> | null = null;

/** Chamado após cada gravação: agrupa mudanças e sincroniza pouco depois. */
export function agendarSync() {
  if (typeof window === "undefined") return;
  if (!codigoValido(lerCodigo())) return;
  marcarPendente(true);
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    temporizador = null;
    void sincronizarAgora();
  }, 2500);
}
