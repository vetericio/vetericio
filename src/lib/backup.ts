/**
 * Backup e transferência de dados entre aparelhos — 100% offline.
 * Nada é enviado para a internet: gera um arquivo (ou um QR) com o conteúdo
 * guardado no próprio aparelho e permite abrir esse conteúdo em outro.
 */
import { plantaoFinalizado } from "./plantao";


export const CHAVES_BACKUP = {
  registros: "veterico-registros-v1",
  plantoes: "veterico-plantoes-v1",
  plantaoAtual: "veterico-plantao-v1",
  curvas: "veterico-curvas-v1",
  alarmes: "veterico-alarmes-v1",
  medicamentos: "veterico-medicamentos-v1",
  anamneses: "veterico-anamneses",
  notas: "veterico-bloco-notas",
  tema: "veterico-tema-v1",
  cor: "veterico-tema-cor-v1",
} as const;

export type ChaveBackup = keyof typeof CHAVES_BACKUP;

export type Carimbo = { hash: string; quando: string };
export type Carimbos = Record<string, Carimbo>;
/** Marca de "este item foi apagado às tantas horas" (chave -> data ISO). */
export type Apagados = Record<string, string>;

export type Backup = {
  app: "veterico";
  versao: 1;
  criadoEm: string;
  dados: Partial<Record<ChaveBackup, unknown>>;
  /** Marca de "mudou às tantas horas" por item, usada só na sincronização. */
  carimbos?: Carimbos;
  /** Itens apagados de propósito: não voltam na sincronização. */
  apagados?: Apagados;
};



export type ModoRestauracao = "substituir" | "juntar";

export type ResumoBackup = {
  criadoEm: string;
  registros: number;
  plantoes: number;
  curvas: number;
  alarmes: number;
  medicamentos: number;
  anamneses: number;
  temNotas: boolean;
  temPlantaoAtual: boolean;
  temTema: boolean;
};

export function lerBruto(chave: string): unknown {
  if (typeof window === "undefined") return undefined;
  try {
    const bruto = window.localStorage.getItem(chave);
    if (bruto === null) return undefined;
    try {
      return JSON.parse(bruto);
    } catch {
      return bruto;
    }
  } catch {
    return undefined;
  }
}

export function escreverBruto(chave: string, valor: unknown) {
  if (typeof window === "undefined") return;
  try {
    const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
    window.localStorage.setItem(chave, texto);
  } catch {
    /* armazenamento indisponível */
  }
}

/* ---------- carimbos de alteração ---------- */

const CHAVE_CARIMBOS = "veterico-sync-carimbos-v1";

const LISTAS: ChaveBackup[] = [
  "registros",
  "plantoes",
  "curvas",
  "alarmes",
  "medicamentos",
  "anamneses",
];

const SIMPLES: ChaveBackup[] = ["plantaoAtual", "notas", "tema", "cor"];

function hashTexto(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i += 1) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function lerCarimbos(): Carimbos {
  const bruto = lerBruto(CHAVE_CARIMBOS);
  return bruto && typeof bruto === "object" && !Array.isArray(bruto) ? (bruto as Carimbos) : {};
}

function gravarCarimbos(c: Carimbos) {
  escreverBruto(CHAVE_CARIMBOS, c);
}

const CHAVE_APAGADOS = "veterico-sync-apagados-v1";
/** Marcas de apagado mais velhas que isto são descartadas (30 dias). */
const VALIDADE_APAGADO = 30 * 24 * 60 * 60 * 1000;

function lerApagados(): Apagados {
  const bruto = lerBruto(CHAVE_APAGADOS);
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  const limite = Date.now() - VALIDADE_APAGADO;
  const saida: Apagados = {};
  for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    const t = Date.parse(v);
    if (Number.isNaN(t) || t < limite) continue;
    saida[k] = v;
  }
  return saida;
}

function gravarApagados(a: Apagados) {
  escreverBruto(CHAVE_APAGADOS, a);
}

/**
 * Atualiza as marcas de "mudou às tantas horas" comparando o conteúdo atual
 * com o hash guardado, e anota o que desapareceu daqui como apagado de propósito.
 * Nenhum outro ponto do app precisa carimbar nada.
 */
function carimbarLocal(): { carimbos: Carimbos; apagados: Apagados } {
  const c = lerCarimbos();
  const apagados = lerApagados();
  const agora = new Date().toISOString();
  const presentes = new Set<string>();

  for (const nome of LISTAS) {
    for (const item of lista(lerBruto(CHAVES_BACKUP[nome]))) {
      const id = String(item?.id ?? "");
      if (!id) continue;
      const k = `${nome}:${id}`;
      presentes.add(k);
      delete apagados[k];
      const hash = hashTexto(JSON.stringify(item));
      if (c[k]?.hash !== hash) c[k] = { hash, quando: agora };
    }
  }

  for (const nome of SIMPLES) {
    const valor = lerBruto(CHAVES_BACKUP[nome]);
    const k = `simples:${nome}`;
    if (valor === undefined) continue;
    presentes.add(k);
    delete apagados[k];
    const hash = hashTexto(JSON.stringify(valor));
    if (c[k]?.hash !== hash) c[k] = { hash, quando: agora };
  }

  // Tinha carimbo e não está mais aqui: foi apagado neste aparelho.
  for (const k of Object.keys(c)) {
    if (presentes.has(k)) continue;
    if (k === "simples:plantaoAtual") {
      // O plantão atual tem tratamento próprio (finalizado x aberto).
      delete c[k];
      continue;
    }
    if (!apagados[k]) apagados[k] = agora;
    delete c[k];
  }

  gravarCarimbos(c);
  gravarApagados(apagados);
  return { carimbos: c, apagados };
}


function maisNovo(a: Carimbo | undefined, b: Carimbo | undefined): boolean {
  if (!b) return false;
  if (!a) return true;
  return b.quando > a.quando;
}

/** Monta o backup com tudo que está guardado neste aparelho. */
export function montarBackup(): Backup {
  const dados: Partial<Record<ChaveBackup, unknown>> = {};
  for (const [nome, chave] of Object.entries(CHAVES_BACKUP) as [ChaveBackup, string][]) {
    const valor = lerBruto(chave);
    if (valor !== undefined) dados[nome] = valor;
  }
  const marcas = carimbarLocal();
  return {
    app: "veterico",
    versao: 1,
    criadoEm: new Date().toISOString(),
    dados,
    carimbos: marcas.carimbos,
    apagados: marcas.apagados,
  };

}

/** Valida o conteúdo lido de um arquivo/QR. Devolve null quando não é do app. */
export function validarBackup(bruto: unknown): Backup | null {
  if (!bruto || typeof bruto !== "object") return null;
  const b = bruto as Record<string, unknown>;
  if (b["app"] !== "veterico") return null;
  if (typeof b["versao"] !== "number") return null;
  const dados = b["dados"];
  if (!dados || typeof dados !== "object") return null;
  const carimbos = b["carimbos"];
  const apagados = b["apagados"];
  return {
    app: "veterico",
    versao: 1,
    criadoEm: typeof b["criadoEm"] === "string" ? b["criadoEm"] : "",
    dados: dados as Partial<Record<ChaveBackup, unknown>>,
    ...(carimbos && typeof carimbos === "object" && !Array.isArray(carimbos)
      ? { carimbos: carimbos as Carimbos }
      : {}),
    ...(apagados && typeof apagados === "object" && !Array.isArray(apagados)
      ? { apagados: apagados as Apagados }
      : {}),
  };

}

function lista(valor: unknown): { id?: unknown }[] {
  return Array.isArray(valor) ? (valor as { id?: unknown }[]) : [];
}

export function resumirBackup(b: Backup): ResumoBackup {
  return {
    criadoEm: b.criadoEm,
    registros: lista(b.dados.registros).length,
    plantoes: lista(b.dados.plantoes).length,
    curvas: lista(b.dados.curvas).length,
    alarmes: lista(b.dados.alarmes).length,
    medicamentos: lista(b.dados.medicamentos).length,
    anamneses: lista(b.dados.anamneses).length,
    temNotas: Boolean(b.dados.notas),
    temPlantaoAtual: Boolean(b.dados.plantaoAtual),
    temTema: Boolean(b.dados.tema),
  };
}

/** Data do apagado, ou "" quando não há marca. */
function quandoApagado(mapa: Apagados, k: string): string {
  const v = mapa[k];
  return typeof v === "string" ? v : "";
}

/**
 * Junta duas listas por `id`. Para itens que existem nos dois aparelhos,
 * vence a versão alterada mais recentemente; itens só remotos são acrescentados,
 * a não ser que tenham sido apagados de propósito depois disso.
 */
function juntarPorId(
  atual: unknown,
  novo: unknown,
  nome: ChaveBackup,
  locais: Carimbos,
  remotos: Carimbos,
  apagadosLocais: Apagados,
  apagadosRemotos: Apagados,
): unknown {
  const a = lista(atual);
  const n = lista(novo);
  const porId = new Map(n.map((item) => [String(item?.id ?? ""), item]));

  const resultado: { id?: unknown }[] = [];

  for (const item of a) {
    const id = String(item?.id ?? "");
    const k = `${nome}:${id}`;
    const apagadoRemoto = quandoApagado(apagadosRemotos, k);
    const mudouAqui = locais[k]?.quando ?? "";
    // Foi apagado no outro aparelho depois da última mudança daqui: apaga aqui também.
    if (apagadoRemoto && apagadoRemoto > mudouAqui) {
      apagadosLocais[k] = apagadoRemoto;
      delete locais[k];
      continue;
    }
    const remotoItem = porId.get(id);
    if (remotoItem && maisNovo(locais[k], remotos[k])) {
      locais[k] = remotos[k]!;
      resultado.push(remotoItem);
      continue;
    }
    resultado.push(item);
  }

  const vistos = new Set(a.map((item) => String(item?.id ?? "")));
  for (const item of n) {
    const id = String(item?.id ?? "");
    if (vistos.has(id)) continue;
    const k = `${nome}:${id}`;
    const apagadoAqui = quandoApagado(apagadosLocais, k);
    const mudouLa = remotos[k]?.quando ?? "";
    // Apagado aqui de propósito: não volta pela sincronização.
    if (apagadoAqui && apagadoAqui >= mudouLa) continue;
    const remoto = remotos[k];
    if (remoto) locais[k] = remoto;
    delete apagadosLocais[k];
    resultado.push(item);
  }
  return resultado;
}

/** Grava o backup neste aparelho. */
export function aplicarBackup(b: Backup, modo: ModoRestauracao) {
  const remotos = b.carimbos ?? {};
  const apagadosRemotos = b.apagados ?? {};
  const marcas = modo === "juntar" ? carimbarLocal() : null;
  const locais: Carimbos = marcas ? marcas.carimbos : {};
  const apagadosLocais: Apagados = marcas ? marcas.apagados : {};

  for (const nome of LISTAS) {
    const novo = b.dados[nome];
    if (novo === undefined && modo === "substituir") continue;
    const valor =
      modo === "substituir"
        ? novo
        : juntarPorId(
            lerBruto(CHAVES_BACKUP[nome]),
            novo ?? [],
            nome,
            locais,
            remotos,
            apagadosLocais,
            apagadosRemotos,
          );
    escreverBruto(CHAVES_BACKUP[nome], valor);
  }

  for (const nome of SIMPLES) {
    const k = `simples:${nome}`;
    const atual = lerBruto(CHAVES_BACKUP[nome]);
    const novo = b.dados[nome];

    if (modo === "juntar" && nome !== "plantaoAtual") {
      const apagadoRemoto = quandoApagado(apagadosRemotos, k);
      const mudouAqui = locais[k]?.quando ?? "";
      // Apagado no outro aparelho: apaga aqui também (ex.: bloco de notas).
      if (atual !== undefined && apagadoRemoto && apagadoRemoto > mudouAqui) {
        try {
          window.localStorage.removeItem(CHAVES_BACKUP[nome]);
        } catch {
          /* armazenamento indisponível */
        }
        apagadosLocais[k] = apagadoRemoto;
        delete locais[k];
        continue;
      }
      const apagadoAqui = quandoApagado(apagadosLocais, k);
      const mudouLa = remotos[k]?.quando ?? "";
      // Apagado aqui de propósito: não volta pela sincronização.
      if (atual === undefined && apagadoAqui && apagadoAqui >= mudouLa) continue;
    }

    if (novo === undefined) continue;
    // Um plantão finalizado neste aparelho não volta a abrir por causa de um backup.
    if (nome === "plantaoAtual" && plantaoFinalizado(atual)) continue;
    if (modo === "juntar" && atual !== undefined) {
      if (!maisNovo(locais[k], remotos[k])) continue;
      locais[k] = remotos[k]!;
    }
    delete apagadosLocais[k];
    escreverBruto(CHAVES_BACKUP[nome], novo);
  }

  if (modo === "juntar") {
    gravarCarimbos(locais);
    gravarApagados(apagadosLocais);
  } else {
    escreverBruto(CHAVE_CARIMBOS, remotos);
    escreverBruto(CHAVE_APAGADOS, apagadosRemotos);
  }
}



/**
 * Sincronização segura: junta o que veio do outro aparelho com o que existe aqui,
 * sem apagar nada. Devolve true quando algo mudou neste aparelho.
 */
export function juntarSincronizacao(remoto: Backup): boolean {
  const antes = JSON.stringify(montarBackup().dados);
  aplicarBackup(remoto, "juntar");
  return JSON.stringify(montarBackup().dados) !== antes;
}


/** "veterico-backup-29.08.26.json" */
export function nomeArquivoBackup(data = new Date()): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  const dia = `${dois(data.getDate())}.${dois(data.getMonth() + 1)}.${String(data.getFullYear()).slice(-2)}`;
  return `veterico-backup-${dia}.json`;
}

/** Baixa o backup como arquivo. */
export function baixarBackup(b: Backup = montarBackup()) {
  const texto = JSON.stringify(b, null, 2);
  const blob = new Blob([texto], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivoBackup();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Lê um arquivo escolhido pelo usuário. */
export function lerArquivoBackup(arquivo: File): Promise<Backup | null> {
  return new Promise((resolve) => {
    const leitor = new FileReader();
    leitor.onerror = () => resolve(null);
    leitor.onload = () => {
      try {
        resolve(validarBackup(JSON.parse(String(leitor.result))));
      } catch {
        resolve(null);
      }
    };
    leitor.readAsText(arquivo);
  });
}

/* ---------- QR ---------- */

/** Limite prático de caracteres em um QR legível pela câmera. */
export const LIMITE_QR = 2200;

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ParaBytes(texto: string): Uint8Array {
  const bin = atob(texto);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Texto compactado que vai dentro do QR ("VET1:<base64>"). */
export async function backupParaTextoQr(b: Backup = montarBackup()): Promise<string> {
  const { deflate } = await import("pako");
  const comprimido = deflate(JSON.stringify(b));
  return `VET1:${bytesParaBase64(comprimido)}`;
}

/** Reconstrói o backup a partir do texto lido de um QR. */
export async function textoQrParaBackup(texto: string): Promise<Backup | null> {
  const limpo = texto.trim();
  try {
    if (limpo.startsWith("VET1:")) {
      const { inflate } = await import("pako");
      const json = inflate(base64ParaBytes(limpo.slice(5)), { to: "string" });
      return validarBackup(JSON.parse(json));
    }
    return validarBackup(JSON.parse(limpo));
  } catch {
    return null;
  }
}

/** Gera a imagem (data URL) do QR com o backup. */
export async function gerarImagemQr(texto: string): Promise<string> {
  const QR = await import("qrcode");
  const toDataURL = (QR as unknown as { toDataURL: typeof import("qrcode").toDataURL }).toDataURL;
  return toDataURL(texto, { errorCorrectionLevel: "L", margin: 1, width: 512 });
}
