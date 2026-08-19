import type { ToqueId } from "./toques";

export type PlataformaMusica = "youtube" | "spotify" | "deezer";

export type Alarme = {
  id: string;
  rotulo: string;
  /** "00:00" — hora do primeiro disparo. */
  hora: string;
  toque: ToqueId;
  ativo: boolean;
  /** Repete todos os dias no mesmo horário. */
  diario: boolean;
  /** Repete a cada X horas (usado pelas curvas). */
  intervaloHoras?: number | undefined;
  /** Curva que criou este alarme, quando houver. */
  curvaId?: string | undefined;
  /** Link de música do YouTube, Spotify ou Deezer. */
  linkExterno?: string | undefined;
  plataforma?: PlataformaMusica | undefined;
  /** Próximo disparo (ISO). */
  proximo: string;
};

/** Descobre a plataforma pelo endereço colado. */
export function detectarPlataforma(link: string): PlataformaMusica | undefined {
  const l = link.toLowerCase();
  if (l.includes("youtube.com") || l.includes("youtu.be")) return "youtube";
  if (l.includes("spotify.com") || l.startsWith("spotify:")) return "spotify";
  if (l.includes("deezer.com") || l.includes("dzr.page.link")) return "deezer";
  return undefined;
}

export const NOME_PLATAFORMA: Record<PlataformaMusica, string> = {
  youtube: "YouTube",
  spotify: "Spotify",
  deezer: "Deezer",
};

/** Id do vídeo do YouTube, para o player embutido. */
export function idYoutube(link: string): string | undefined {
  const curto = link.match(/youtu\.be\/([\w-]{6,})/);
  if (curto?.[1]) return curto[1];
  const normal = link.match(/[?&]v=([\w-]{6,})/);
  if (normal?.[1]) return normal[1];
  const shorts = link.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/);
  if (shorts?.[1]) return shorts[1];
  return undefined;
}


const CHAVE = "veterico-alarmes-v1";

export function carregarAlarmes(): Alarme[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return [padraoJejum()];
    const dados = JSON.parse(bruto);
    return Array.isArray(dados) ? (dados as Alarme[]) : [padraoJejum()];
  } catch {
    return [padraoJejum()];
  }
}

export function salvarAlarmes(alarmes: Alarme[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(alarmes));
  } catch {
    /* armazenamento indisponível */
  }
}

/** Alarme pré-definido, só falta ativar. */
export function padraoJejum(): Alarme {
  return {
    id: "jejum-00h",
    rotulo: "Jejum dos animais",
    hora: "00:00",
    toque: "sino",
    ativo: false,
    diario: true,
    proximo: proximoDisparo("00:00"),
  };
}

/** Próxima ocorrência de "HH:MM" (hoje se ainda não passou, senão amanhã). */
export function proximoDisparo(hora: string, base = new Date()): string {
  const [h = "0", m = "0"] = hora.split(":");
  const alvo = new Date(base);
  alvo.setHours(Number(h), Number(m), 0, 0);
  if (alvo.getTime() <= base.getTime()) alvo.setDate(alvo.getDate() + 1);
  return alvo.toISOString();
}

export function horaDeAgoraMais(horas: number, base = new Date()): Date {
  const d = new Date(base);
  d.setMinutes(d.getMinutes() + Math.round(horas * 60), 0, 0);
  return d;
}

/** "09:05" a partir de uma data. */
export function horaDe(data: Date): string {
  return `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
}

export function criarAlarme(dados: {
  rotulo: string;
  hora: string;
  toque: ToqueId;
  diario?: boolean;
  intervaloHoras?: number;
  curvaId?: string;
  linkExterno?: string;
}): Alarme {
  const link = dados.linkExterno?.trim();
  return {
    id: crypto.randomUUID(),
    rotulo: dados.rotulo.trim() || "Alarme",
    hora: dados.hora,
    toque: dados.toque,
    ativo: true,
    diario: dados.diario ?? false,
    intervaloHoras: dados.intervaloHoras,
    curvaId: dados.curvaId,
    linkExterno: link || undefined,
    plataforma: link ? detectarPlataforma(link) : undefined,
    proximo: proximoDisparo(dados.hora),
  };
}


/** Depois de soar: reprograma (diário/intervalo) ou desliga. */
export function reprogramar(a: Alarme, base = new Date()): Alarme {
  if (a.intervaloHoras && a.intervaloHoras > 0) {
    const proximo = horaDeAgoraMais(a.intervaloHoras, base);
    return { ...a, proximo: proximo.toISOString(), hora: horaDe(proximo) };
  }
  if (a.diario) return { ...a, proximo: proximoDisparo(a.hora, base) };
  return { ...a, ativo: false };
}

export function adiar(a: Alarme, minutos = 5, base = new Date()): Alarme {
  const proximo = new Date(base.getTime() + minutos * 60000);
  return { ...a, ativo: true, proximo: proximo.toISOString() };
}

/** "hoje às 14:00" / "amanhã às 02:00" */
export function textoProximo(a: Alarme): string {
  const d = new Date(a.proximo);
  if (Number.isNaN(d.getTime())) return "";
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  const amanha = new Date(hoje.getTime() + 86400000).toDateString() === d.toDateString();
  const quando = mesmoDia ? "hoje" : amanha ? "amanhã" : d.toLocaleDateString("pt-BR");
  return `${quando} às ${horaDe(d)}`;
}
