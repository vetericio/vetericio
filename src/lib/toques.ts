/** Toques do alarme gerados no próprio aparelho (Web Audio), sem arquivos. */

export type ToqueId =
  | "suave"
  | "sino"
  | "urgente"
  | "pulso"
  | "sirene"
  | "ninar"
  | "caixinha"
  | "harpa"
  | "marimba"
  | "alvorada"
  | "ondas"
  | "plantao";

export const TOQUES: { id: ToqueId; nome: string }[] = [
  { id: "suave", nome: "Suave" },
  { id: "sino", nome: "Sino" },
  { id: "urgente", nome: "Urgente" },
  { id: "pulso", nome: "Pulso" },
  { id: "sirene", nome: "Sirene" },
  { id: "ninar", nome: "Ninar" },
  { id: "caixinha", nome: "Caixinha" },
  { id: "harpa", nome: "Harpa" },
  { id: "marimba", nome: "Marimba" },
  { id: "alvorada", nome: "Alvorada" },
  { id: "ondas", nome: "Ondas" },
  { id: "plantao", nome: "Plantão" },
];

/** [frequência, início (s), duração (s)] */
type Nota = [number, number, number];

/** Monta uma melodia contínua a partir de notas em sequência. */
function melodia(freqs: number[], passo: number, sustento = passo * 1.1): Nota[] {
  return freqs.map((f, i) => [f, i * passo, sustento] as Nota);
}

const DO = 523.25;
const RE = 587.33;
const MI = 659.25;
const FA = 698.46;
const SOL = 784;
const LA = 880;
const SI = 987.77;
const DO2 = 1046.5;
const MI2 = 1318.51;
const SOL2 = 1567.98;

const PADROES: Record<ToqueId, { ciclo: number; onda: OscillatorType; notas: Nota[] }> = {
  suave: {
    ciclo: 4.8,
    onda: "sine",
    notas: melodia([DO, MI, SOL, MI, FA, LA, SOL, MI], 0.6, 0.72),
  },
  sino: {
    ciclo: 4.4,
    onda: "triangle",
    notas: melodia([LA, DO2, SI, SOL, LA, MI2, DO2, LA], 0.55, 0.9),
  },
  urgente: {
    ciclo: 2.4,
    onda: "square",
    notas: melodia([DO2, DO2, MI2, DO2, DO2, MI2, SOL2, MI2], 0.3, 0.18),
  },
  pulso: {
    ciclo: 3.2,
    onda: "sawtooth",
    notas: melodia([MI, LA, MI, DO2, MI, LA, MI, SOL2], 0.4, 0.22),
  },
  sirene: {
    ciclo: 3.2,
    onda: "sawtooth",
    notas: melodia([700, 980, 700, 980, 700, 980, 700, 980], 0.4, 0.42),
  },
  ninar: {
    ciclo: 6,
    onda: "sine",
    notas: melodia([SOL, SOL, RE, RE, MI, MI, RE, DO], 0.75, 0.9),
  },
  caixinha: {
    ciclo: 5.4,
    onda: "triangle",
    notas: melodia([DO2, SOL, MI, SOL, DO2, LA, FA, LA, DO2, SOL], 0.54, 0.5),
  },
  harpa: {
    ciclo: 5.6,
    onda: "sine",
    notas: melodia([DO, MI, SOL, DO2, MI2, DO2, SOL, MI, FA, LA, DO2, LA], 0.46, 0.85),
  },
  marimba: {
    ciclo: 4.2,
    onda: "triangle",
    notas: melodia([DO, RE, MI, SOL, MI, RE, DO, SOL, LA, SOL, MI, DO], 0.35, 0.3),
  },
  alvorada: {
    ciclo: 4.5,
    onda: "square",
    notas: melodia([SOL, DO2, MI2, DO2, SOL, MI2, DO2, SOL, DO2], 0.5, 0.42),
  },
  ondas: {
    ciclo: 6.4,
    onda: "sine",
    notas: melodia([MI, SOL, LA, SOL, MI, RE, MI, SOL], 0.8, 1.1),
  },
  plantao: {
    ciclo: 4.8,
    onda: "triangle",
    notas: melodia([LA, FA, DO2, LA, SOL, MI, SI, SOL], 0.6, 0.55),
  },
};

type Ctx = AudioContext & { criado?: boolean };

let ctx: Ctx | null = null;
let mestre: GainNode | null = null;
let repetidor: number | null = null;

function obterCtx(): Ctx | null {
  if (typeof window === "undefined") return null;
  const Classe =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Classe) return null;
  if (!ctx) {
    ctx = new Classe() as Ctx;
    mestre = ctx.createGain();
    mestre.gain.value = 1;
    mestre.connect(ctx.destination);
  }
  return ctx;
}

/**
 * O navegador só libera o som depois de um toque do usuário.
 * Chamamos isso no primeiro clique dentro do app.
 */
export function desbloquearAudio() {
  const c = obterCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
}

function tocarCiclo(id: ToqueId) {
  const c = obterCtx();
  if (!c || !mestre) return;
  if (c.state === "suspended") void c.resume();
  const padrao = PADROES[id];
  const agora = c.currentTime + 0.02;

  for (const [freq, inicio, duracao] of padrao.notas) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = padrao.onda;
    osc.frequency.value = freq;
    const t0 = agora + inicio;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.8, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duracao);
    osc.connect(g);
    g.connect(mestre);
    osc.start(t0);
    osc.stop(t0 + duracao + 0.05);
  }
}

/** Toca o toque escolhido; em loop quando `loop` (alarme soando). */
export function tocarToque(id: ToqueId, loop = false) {
  pararToque();
  tocarCiclo(id);
  if (!loop) return;
  repetidor = window.setInterval(() => tocarCiclo(id), PADROES[id].ciclo * 1000);
}

/** Duração de um ciclo em milissegundos (usada na prévia). */
export function duracaoToque(id: ToqueId): number {
  return PADROES[id].ciclo * 1000;
}

export function pararToque() {
  if (repetidor !== null) {
    window.clearInterval(repetidor);
    repetidor = null;
  }
}

/** Vibração longa, repetida, enquanto o alarme estiver soando. */
let vibrando = false;

export function vibrar() {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  vibrando = true;
  const padrao: number[] = [];
  for (let i = 0; i < 30; i += 1) padrao.push(600, 300);
  try {
    navigator.vibrate(padrao);
  } catch {
    /* sem vibração */
  }
}

export function pararVibracao() {
  if (!vibrando) return;
  vibrando = false;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(0);
  } catch {
    /* sem vibração */
  }
}
