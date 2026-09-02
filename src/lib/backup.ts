/**
 * Backup e transferência de dados entre aparelhos — 100% offline.
 * Nada é enviado para a internet: gera um arquivo (ou um QR) com o conteúdo
 * guardado no próprio aparelho e permite abrir esse conteúdo em outro.
 */

export const CHAVES_BACKUP = {
  registros: "veterico-registros-v1",
  plantoes: "veterico-plantoes-v1",
  plantaoAtual: "veterico-plantao-v1",
  curvas: "veterico-curvas-v1",
  alarmes: "veterico-alarmes-v1",
  medicamentos: "veterico-medicamentos-v1",
  exclusoes: "veterico-sync-exclusoes-v1",
  tema: "veterico-tema-v1",
  cor: "veterico-tema-cor-v1",
} as const;

export type ChaveBackup = keyof typeof CHAVES_BACKUP;

export type Backup = {
  app: "veterico";
  versao: 1;
  criadoEm: string;
  dados: Partial<Record<ChaveBackup, unknown>>;
};

export type ModoRestauracao = "substituir" | "juntar";

export type ResumoBackup = {
  criadoEm: string;
  registros: number;
  plantoes: number;
  curvas: number;
  alarmes: number;
  medicamentos: number;
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

/** Monta o backup com tudo que está guardado neste aparelho. */
export function montarBackup(): Backup {
  const dados: Partial<Record<ChaveBackup, unknown>> = {};
  for (const [nome, chave] of Object.entries(CHAVES_BACKUP) as [ChaveBackup, string][]) {
    const valor = lerBruto(chave);
    if (valor !== undefined) dados[nome] = valor;
  }
  return { app: "veterico", versao: 1, criadoEm: new Date().toISOString(), dados };
}

/** Valida o conteúdo lido de um arquivo/QR. Devolve null quando não é do app. */
export function validarBackup(bruto: unknown): Backup | null {
  if (!bruto || typeof bruto !== "object") return null;
  const b = bruto as Record<string, unknown>;
  if (b["app"] !== "veterico") return null;
  if (typeof b["versao"] !== "number") return null;
  const dados = b["dados"];
  if (!dados || typeof dados !== "object") return null;
  return {
    app: "veterico",
    versao: 1,
    criadoEm: typeof b["criadoEm"] === "string" ? b["criadoEm"] : "",
    dados: dados as Partial<Record<ChaveBackup, unknown>>,
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
    temPlantaoAtual: Boolean(b.dados.plantaoAtual),
    temTema: Boolean(b.dados.tema),
  };
}

/** Junta duas listas por `id`, mantendo o que já existe neste aparelho. */
function juntarPorId(atual: unknown, novo: unknown): unknown {
  const a = lista(atual);
  const n = lista(novo);
  if (a.length === 0) return n;
  const vistos = new Set(a.map((item) => String(item?.id ?? "")));
  const extras = n.filter((item) => !vistos.has(String(item?.id ?? "")));
  return [...a, ...extras];
}

/** Grava o backup neste aparelho. */
export function aplicarBackup(b: Backup, modo: ModoRestauracao) {
  const listas: ChaveBackup[] = [
    "registros",
    "plantoes",
    "curvas",
    "alarmes",
    "medicamentos",
    "exclusoes",
  ];

  for (const nome of listas) {
    const novo = b.dados[nome];
    if (novo === undefined) continue;
    const valor = modo === "substituir" ? novo : juntarPorId(lerBruto(CHAVES_BACKUP[nome]), novo);
    escreverBruto(CHAVES_BACKUP[nome], valor);
  }

  const registrosRestaurados = lista(b.dados.registros);
  const idsRestaurados = new Set(registrosRestaurados.map((r) => String(r?.id ?? "")));

  if (modo === "substituir") {
    // Restaurar por cima é definitivo: marcas antigas de exclusão não podem
    // apagar de novo os animais que acabaram de voltar do backup.
    const exclusoes = lista(lerBruto(CHAVES_BACKUP.exclusoes)).filter(
      (e) => !idsRestaurados.has(String(e?.id ?? "")),
    );
    escreverBruto(CHAVES_BACKUP.exclusoes, exclusoes);
  } else {
    const exclusoes = lista(lerBruto(CHAVES_BACKUP.exclusoes)) as Array<{
      id?: unknown;
      excluidoEm?: unknown;
    }>;
    if (exclusoes.length > 0) {
      const quando = new Map(
        exclusoes.map((e) => [String(e.id ?? ""), String(e.excluidoEm ?? "")]),
      );
      const registros = lista(lerBruto(CHAVES_BACKUP.registros)).filter((r) => {
        const excluidoEm = quando.get(String(r?.id ?? ""));
        if (excluidoEm === undefined) return true;
        // A exclusão só vence se for mais recente que a última alteração do animal.
        return String(r?.["atualizadoEm"] ?? "") > excluidoEm;
      });
      escreverBruto(CHAVES_BACKUP.registros, registros);
    }
  }

  const simples: ChaveBackup[] = ["plantaoAtual", "tema", "cor"];
  for (const nome of simples) {
    const novo = b.dados[nome];
    if (novo === undefined) continue;
    const jaTem = lerBruto(CHAVES_BACKUP[nome]) !== undefined;
    if (modo === "juntar" && jaTem) continue;
    escreverBruto(CHAVES_BACKUP[nome], novo);
  }
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
