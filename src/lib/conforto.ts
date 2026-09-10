/**
 * Preferências de conforto (TDAH/autismo): modo do app, som e vibração.
 * "veterico" = o app exatamente como sempre foi.
 * "calmo" = menos estímulo: sem animações, som baixo, sem vibração repetida,
 * ferramentas extras do Início recolhidas.
 */

export const CHAVE_CONFORTO = "veterico-conforto-v1";

export type ModoApp = "veterico" | "calmo";

export type Conforto = {
  modo: ModoApp;
  /** 0 a 1 */
  volume: number;
  vibracao: boolean;
  /** Calculadora e ferramentas clínicas abertas no Início. */
  ferramentasAbertas: boolean;
};

export const CONFORTO_VETERICO: Conforto = {
  modo: "veterico",
  volume: 1,
  vibracao: true,
  ferramentasAbertas: true,
};

export const CONFORTO_CALMO: Conforto = {
  modo: "calmo",
  volume: 0.35,
  vibracao: false,
  ferramentasAbertas: false,
};

/** Tema sóbrio usado quando o modo calmo é ligado. */
export const TEMA_CALMO = "sobrio";

export function carregarConforto(): Conforto {
  if (typeof window === "undefined") return CONFORTO_VETERICO;
  try {
    const bruto = window.localStorage.getItem(CHAVE_CONFORTO);
    if (!bruto) return CONFORTO_VETERICO;
    const dados = JSON.parse(bruto) as Partial<Conforto>;
    const base = dados.modo === "calmo" ? CONFORTO_CALMO : CONFORTO_VETERICO;
    return {
      modo: base.modo,
      volume:
        typeof dados.volume === "number" && dados.volume >= 0 && dados.volume <= 1
          ? dados.volume
          : base.volume,
      vibracao: typeof dados.vibracao === "boolean" ? dados.vibracao : base.vibracao,
      ferramentasAbertas:
        typeof dados.ferramentasAbertas === "boolean"
          ? dados.ferramentasAbertas
          : base.ferramentasAbertas,
    };
  } catch {
    return CONFORTO_VETERICO;
  }
}

export function salvarConforto(c: Conforto) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_CONFORTO, JSON.stringify(c));
  } catch {
    /* armazenamento indisponível */
  }
}

/** Liga/desliga a classe que remove animações e transições. */
export function aplicarConforto(c: Conforto) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("modo-calmo", c.modo === "calmo");
}
