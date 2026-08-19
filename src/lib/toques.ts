/** Toques do alarme gerados no próprio aparelho (Web Audio), sem arquivos. */

export type ToqueId = "suave" | "sino" | "urgente" | "pulso" | "sirene";

export const TOQUES: { id: ToqueId; nome: string }[] = [
  { id: "suave", nome: "Suave" },
  { id: "sino", nome: "Sino" },
  { id: "urgente", nome: "Urgente" },
  { id: "pulso", nome: "Pulso" },
  { id: "sirene", nome: "Sirene" },
];

/** [frequência, início (s), duração (s)] */
type Nota = [number, number, number];

const PADROES: Record<ToqueId, { ciclo: number; onda: OscillatorType; notas: Nota[] }> = {
  suave: {
    ciclo: 2.6,
    onda: "sine",
    notas: [
      [523.25, 0, 0.45],
      [659.25, 0.5, 0.45],
      [784, 1, 0.7],
    ],
  },
  sino: {
    ciclo: 2.2,
    onda: "triangle",
    notas: [
      [880, 0, 0.9],
      [1174.66, 0.15, 0.8],
      [880, 1.1, 0.9],
    ],
  },
  urgente: {
    ciclo: 1.2,
    onda: "square",
    notas: [
      [1046.5, 0, 0.14],
      [1046.5, 0.2, 0.14],
      [1046.5, 0.4, 0.14],
      [1318.5, 0.6, 0.3],
    ],
  },
  pulso: {
    ciclo: 1,
    onda: "sawtooth",
    notas: [
      [660, 0, 0.18],
      [880, 0.3, 0.18],
    ],
  },
  sirene: {
    ciclo: 1.6,
    onda: "sawtooth",
    notas: [
      [700, 0, 0.4],
      [980, 0.4, 0.4],
      [700, 0.8, 0.4],
      [980, 1.2, 0.4],
    ],
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
    g.gain.exponentialRampToValueAtTime(0.9, t0 + 0.02);
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

export function pararToque() {
  if (repetidor !== null) {
    window.clearInterval(repetidor);
    repetidor = null;
  }
}

/** Vibração longa, repetida, enquanto o alarme estiver soando. */
export function vibrar() {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  const padrao: number[] = [];
  for (let i = 0; i < 30; i += 1) padrao.push(600, 300);
  try {
    navigator.vibrate(padrao);
  } catch {
    /* sem vibração */
  }
}

export function pararVibracao() {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(0);
  } catch {
    /* sem vibração */
  }
}
