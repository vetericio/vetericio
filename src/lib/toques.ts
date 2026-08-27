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
  | "plantao"
  | "ode"
  | "elisa"
  | "turca"
  | "aria"
  | "rock"
  | "balada"
  | "arabia"
  | "vila"
  | ExtraId;

const TOQUES_BASE: { id: ToqueId; nome: string }[] = [
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
  { id: "ode", nome: "Ode à Alegria" },
  { id: "elisa", nome: "Para Elisa" },
  { id: "turca", nome: "Marcha Turca" },
  { id: "aria", nome: "Ária (Bach)" },
  { id: "rock", nome: "Rock" },
  { id: "balada", nome: "Balada" },
  { id: "arabia", nome: "Noites da Arábia" },
  { id: "vila", nome: "Vila alegre" },
];


/** [frequência, início (s), duração (s)] */
type Nota = [number, number, number];

/** Monta uma melodia contínua a partir de notas em sequência. */
function melodia(freqs: number[], passo: number, sustento = passo * 1.1): Nota[] {
  return freqs.map((f, i) => [f, i * passo, sustento] as Nota);
}

/** Melodia com ritmo variável: pares [frequência, batidas]. */
function ritmo(pares: [number, number][], batida: number, ligado = 0.95): Nota[] {
  let t = 0;
  return pares.map(([f, b]) => {
    const nota: Nota = [f, t, b * batida * ligado];
    t += b * batida;
    return nota;
  });
}

function duracaoRitmo(pares: [number, number][], batida: number): number {
  return pares.reduce((s, [, b]) => s + b, 0) * batida;
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

/* Oitava grave (para as melodias clássicas e o rock) */
const do_ = 261.63;
const reb_ = 277.18;
const re_ = 293.66;
const mi_ = 329.63;
const fa_ = 349.23;
const solb_ = 369.99;
const sol_ = 392;
const lab_ = 415.3;
const la_ = 440;
const sib_ = 466.16;
const si_ = 493.88;
const mib_ = 311.13;
const la0 = 220;
const mi0 = 164.81;
const sol0 = 196;
const fa0 = 174.61;
const re0 = 146.83;

/* Ode à Alegria (Beethoven) */
const ODE: [number, number][] = [
  [mi_, 1], [mi_, 1], [fa_, 1], [sol_, 1],
  [sol_, 1], [fa_, 1], [mi_, 1], [re_, 1],
  [do_, 1], [do_, 1], [re_, 1], [mi_, 1],
  [mi_, 1.5], [re_, 0.5], [re_, 2],
];

/* Para Elisa (Beethoven) */
const ELISA: [number, number][] = [
  [MI, 0.5], [RE, 0.5], [MI, 0.5], [RE, 0.5], [MI, 0.5], [si_, 0.5], [RE, 0.5], [DO, 0.5],
  [la_, 1.5], [do_, 0.5], [mi_, 0.5], [la_, 0.5],
  [si_, 1.5], [mi_, 0.5], [lab_, 0.5], [si_, 0.5], [DO, 1.5],
];

/* Marcha Turca (Mozart) */
const TURCA: [number, number][] = [
  [si_, 0.5], [la_, 0.5], [lab_, 0.5], [la_, 0.5], [DO, 1],
  [RE, 0.5], [DO, 0.5], [si_, 0.5], [DO, 0.5], [MI, 1],
  [FA, 0.5], [MI, 0.5], [RE, 0.5], [MI, 0.5], [LA, 1],
  [LA, 0.5], [SOL, 0.5], [FA, 0.5], [MI, 0.5], [RE, 1],
];

/* Ária / prelúdio (Bach) — arpejos calmos */
const ARIA: [number, number][] = [
  [do_, 1], [mi_, 1], [sol_, 1], [DO, 1],
  [si_, 1], [sol_, 1], [MI, 1], [RE, 1],
  [do_, 1], [fa_, 1], [la_, 1], [DO, 1],
  [si_, 1], [sol_, 1], [re_, 1], [do_, 1],
];

/* Rock — riff marcado */
const ROCK: [number, number][] = [
  [mi0, 1], [mi0, 0.5], [sol0, 1], [mi0, 0.5], [la0, 1],
  [mi0, 1], [mi0, 0.5], [sib_ / 2, 1], [la0, 0.5], [sol0, 1],
];

/* Balada dramática — clima menor, piano grave */
const BALADA: [number, number][] = [
  [la0, 1], [do_, 1], [mi_, 1], [do_, 1],
  [fa0, 1], [la_, 1], [do_, 1.5], [si_, 0.5],
  [sol0, 1], [si_, 1], [re_, 1], [mi_, 1],
  [la0, 2], [mi_, 2],
];

/* Noites da Arábia — escala oriental */
const ARABIA: [number, number][] = [
  [re_, 1], [mib_, 0.5], [solb_, 1], [fa_, 0.5],
  [mib_, 1], [re_, 1], [do_, 0.5], [re_, 1.5],
  [la_, 1], [solb_, 0.5], [fa_, 1], [mib_, 0.5], [re_, 2],
];

/* Vila alegre — clima de abertura animada */
const VILA: [number, number][] = [
  [sol_, 0.5], [DO, 0.5], [MI, 0.5], [DO, 0.5], [SOL, 1],
  [MI, 0.5], [DO, 0.5], [RE, 0.5], [MI, 0.5], [RE, 1],
  [DO, 0.5], [la_, 0.5], [DO, 0.5], [RE, 0.5], [MI, 1],
  [RE, 0.5], [DO, 0.5], [si_, 0.5], [DO, 0.5], [sol_, 1],
];


const PADROES_BASE: Record<
  Exclude<ToqueId, ExtraId>,
  { ciclo: number; onda: OscillatorType; notas: Nota[] }
> = {
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
  ode: {
    ciclo: duracaoRitmo(ODE, 0.42) + 0.3,
    onda: "triangle",
    notas: ritmo(ODE, 0.42),
  },
  elisa: {
    ciclo: duracaoRitmo(ELISA, 0.34) + 0.3,
    onda: "sine",
    notas: ritmo(ELISA, 0.34),
  },
  turca: {
    ciclo: duracaoRitmo(TURCA, 0.3) + 0.3,
    onda: "triangle",
    notas: ritmo(TURCA, 0.3),
  },
  aria: {
    ciclo: duracaoRitmo(ARIA, 0.5) + 0.4,
    onda: "sine",
    notas: ritmo(ARIA, 0.5, 1.05),
  },
  rock: {
    ciclo: duracaoRitmo(ROCK, 0.3) + 0.2,
    onda: "sawtooth",
    notas: ritmo(ROCK, 0.3, 0.85),
  },
  balada: {
    ciclo: duracaoRitmo(BALADA, 0.45) + 0.4,
    onda: "triangle",
    notas: ritmo(BALADA, 0.45, 1.02),
  },
  arabia: {
    ciclo: duracaoRitmo(ARABIA, 0.38) + 0.3,
    onda: "sine",
    notas: ritmo(ARABIA, 0.38),
  },
  vila: {
    ciclo: duracaoRitmo(VILA, 0.28) + 0.3,
    onda: "square",
    notas: ritmo(VILA, 0.28, 0.9),
  },
};

/* ---- 30 toques extras (total 50) ---- */

type Extra = {
  id: string;
  nome: string;
  onda: OscillatorType;
  batida: number;
  pares: [number, number][];
};

const EXTRAS = [
  { id: "aurora", nome: "Aurora", onda: "sine", batida: 0.45,
    pares: [[DO, 1], [MI, 1], [SOL, 1], [LA, 1], [SOL, 1], [MI, 2]] },
  { id: "brisa", nome: "Brisa", onda: "sine", batida: 0.5,
    pares: [[la_, 1], [DO, 1], [MI, 1], [RE, 1], [DO, 2]] },
  { id: "chuva", nome: "Chuva", onda: "triangle", batida: 0.25,
    pares: [[DO2, 1], [SOL, 1], [DO2, 1], [LA, 1], [SI, 1], [SOL, 1], [MI, 2]] },
  { id: "estrelas", nome: "Estrelas", onda: "sine", batida: 0.3,
    pares: [[DO2, 1], [MI2, 1], [SOL2, 1], [MI2, 1], [DO2, 1], [LA, 1], [DO2, 2]] },
  { id: "manha", nome: "Manhã", onda: "triangle", batida: 0.4,
    pares: [[SOL, 1], [LA, 1], [SI, 1], [DO2, 2], [SI, 1], [SOL, 2]] },
  { id: "flauta", nome: "Flauta", onda: "sine", batida: 0.35,
    pares: [[MI, 1], [FA, 1], [SOL, 1], [LA, 1], [SOL, 1], [FA, 1], [MI, 2]] },
  { id: "violao", nome: "Violão", onda: "triangle", batida: 0.3,
    pares: [[do_, 1], [sol_, 1], [DO, 1], [MI, 1], [DO, 1], [sol_, 1], [do_, 2]] },
  { id: "piano", nome: "Piano", onda: "sine", batida: 0.4,
    pares: [[fa_, 1], [la_, 1], [DO, 1], [FA, 1], [DO, 1], [la_, 1], [fa_, 2]] },
  { id: "valsa", nome: "Valsa", onda: "triangle", batida: 0.35,
    pares: [[DO, 1], [SOL, 1], [SOL, 1], [RE, 1], [SOL, 1], [SOL, 1], [MI, 2]] },
  { id: "cantiga", nome: "Cantiga", onda: "triangle", batida: 0.35,
    pares: [[MI, 1], [RE, 1], [DO, 1], [RE, 1], [MI, 1], [MI, 1], [MI, 2]] },
  { id: "roda", nome: "Roda-roda", onda: "square", batida: 0.3,
    pares: [[SOL, 1], [MI, 1], [MI, 1], [LA, 1], [FA, 1], [FA, 1], [DO, 1], [MI, 1], [RE, 2]] },
  { id: "festa", nome: "Festa", onda: "square", batida: 0.28,
    pares: [[DO, 1], [DO, 1], [SOL, 1], [SOL, 1], [LA, 1], [LA, 1], [SOL, 2]] },
  { id: "circo", nome: "Circo", onda: "square", batida: 0.24,
    pares: [[DO2, 1], [SI, 1], [DO2, 1], [SI, 1], [DO2, 1], [SOL, 1], [MI, 1], [DO, 2]] },
  { id: "carrossel", nome: "Carrossel", onda: "triangle", batida: 0.26,
    pares: [[MI, 1], [SOL, 1], [DO2, 1], [SOL, 1], [MI, 1], [DO, 1], [MI, 2]] },
  { id: "bossa", nome: "Bossa", onda: "sine", batida: 0.34,
    pares: [[re_, 1], [fa_, 1], [la_, 1], [DO, 1], [la_, 1], [fa_, 1], [re_, 2]] },
  { id: "samba", nome: "Samba", onda: "triangle", batida: 0.22,
    pares: [[DO, 1], [MI, 1], [SOL, 1], [MI, 1], [FA, 1], [LA, 1], [SOL, 1], [MI, 1], [DO, 2]] },
  { id: "forro", nome: "Forró", onda: "sawtooth", batida: 0.24,
    pares: [[sol_, 1], [si_, 1], [RE, 1], [si_, 1], [DO, 1], [MI, 1], [SOL, 1], [MI, 2]] },
  { id: "sertao", nome: "Sertão", onda: "triangle", batida: 0.38,
    pares: [[mi_, 1], [sol_, 1], [la_, 1], [si_, 1], [la_, 1], [sol_, 1], [mi_, 2]] },
  { id: "tango", nome: "Tango", onda: "sawtooth", batida: 0.3,
    pares: [[la0, 1], [do_, 1], [mi_, 1], [re_, 1], [do_, 1], [si_, 1], [la_, 2]] },
  { id: "blues", nome: "Blues", onda: "sawtooth", batida: 0.32,
    pares: [[la0, 1], [do_, 1], [re_, 1], [mib_, 1], [re_, 1], [do_, 1], [la0, 2]] },
  { id: "jazz", nome: "Jazz", onda: "triangle", batida: 0.28,
    pares: [[re_, 1], [solb_, 1], [la_, 1], [DO, 1], [si_, 1], [sol_, 1], [re_, 2]] },
  { id: "funk", nome: "Groove", onda: "square", batida: 0.2,
    pares: [[mi0, 1], [mi0, 1], [sol0, 1], [la0, 1], [sol0, 1], [mi0, 1], [re0, 2]] },
  { id: "metal", nome: "Metal", onda: "sawtooth", batida: 0.18,
    pares: [[mi0, 1], [mi0, 1], [mi0, 1], [sib_ / 2, 1], [mi0, 1], [sol0, 1], [la0, 2]] },
  { id: "eletro", nome: "Eletrônico", onda: "square", batida: 0.16,
    pares: [[LA, 1], [LA, 1], [DO2, 1], [MI2, 1], [DO2, 1], [LA, 1], [MI, 2]] },
  { id: "retro", nome: "Retrô 8-bit", onda: "square", batida: 0.14,
    pares: [[DO, 1], [MI, 1], [SOL, 1], [DO2, 1], [SOL, 1], [MI, 1], [DO, 1], [SOL, 2]] },
  { id: "hino", nome: "Hino", onda: "triangle", batida: 0.5,
    pares: [[DO, 1], [DO, 1], [SOL, 1], [SOL, 1], [LA, 1], [SI, 1], [DO2, 2]] },
  { id: "coral", nome: "Coral", onda: "sine", batida: 0.6,
    pares: [[fa_, 1], [sol_, 1], [la_, 1], [DO, 1], [si_, 1], [la_, 2]] },
  { id: "medieval", nome: "Medieval", onda: "triangle", batida: 0.36,
    pares: [[re_, 1], [fa_, 1], [sol_, 1], [la_, 1], [sol_, 1], [fa_, 1], [re_, 2]] },
  { id: "oriente", nome: "Oriente", onda: "sine", batida: 0.34,
    pares: [[do_, 1], [reb_, 1], [fa_, 1], [solb_, 1], [fa_, 1], [reb_, 1], [do_, 2]] },
  { id: "safari", nome: "Safari", onda: "triangle", batida: 0.22,
    pares: [[sol_, 1], [sib_, 1], [DO, 1], [sib_, 1], [sol_, 1], [fa_, 1], [sol_, 2]] },
  /* Cinco melodias reais de domínio público. */
  { id: "turkey", nome: "Turkey in the Straw", onda: "square", batida: 0.2,
    pares: [[DO2, 1], [LA, 1], [FA, 1], [FA, 1], [SOL, 1], [LA, 1], [SI, 1], [DO2, 2],
            [LA, 1], [FA, 1], [SOL, 1], [LA, 1], [FA, 1], [FA, 1], [DO, 2]] },
  { id: "reveille", nome: "Alvorada (Reveille)", onda: "square", batida: 0.22,
    pares: [[SOL, 1], [DO2, 1], [MI2, 1], [DO2, 1], [SOL, 1], [DO2, 1], [MI2, 1], [DO2, 1],
            [SOL, 1], [DO2, 1], [MI2, 2], [DO2, 1], [SOL, 1], [DO2, 2]] },
  { id: "rockclassico", nome: "Rock clássico (12 compassos)", onda: "sawtooth", batida: 0.19,
    pares: [[mi0, 1], [si_ / 2, 1], [mi0, 1], [re_ / 2 * 2, 1], [mi0, 1], [si_ / 2, 1],
            [mi0, 1], [si_ / 2, 1], [la0, 1], [mi_, 1], [la0, 1], [solb_, 1],
            [mi0, 1], [si_ / 2, 1], [sol0, 1], [mi0, 2]] },
  { id: "greensleeves", nome: "Greensleeves", onda: "triangle", batida: 0.3,
    pares: [[la_, 1], [DO, 2], [RE, 1], [MI, 1.5], [FA, 0.5], [MI, 2],
            [RE, 1], [si_, 2], [sol_, 1], [la_, 1.5], [si_, 0.5], [DO, 2],
            [la_, 1], [la_, 1.5], [sol_, 0.5], [la_, 1], [si_, 1], [DO, 2]] },
  { id: "canon", nome: "Canon (Pachelbel)", onda: "sine", batida: 0.42,
    pares: [[MI2 / 2, 2], [RE, 2], [DO, 2], [si_, 2],
            [la_, 2], [si_, 2], [DO, 2], [RE, 2],
            [MI, 2], [RE, 2], [DO, 2], [si_, 2], [la_, 3]] },
  { id: "clair", nome: "Clair de Lune", onda: "sine", batida: 0.5,
    pares: [[reb_ * 2, 2], [DO, 1], [reb_ * 2, 1], [fa_ * 2, 3],
            [mib_ * 2, 1], [reb_ * 2, 2], [DO, 2], [sib_, 2], [reb_ * 2, 3]] },
] as const satisfies readonly Extra[];


export type ExtraId = (typeof EXTRAS)[number]["id"];

export const TOQUES: { id: ToqueId; nome: string }[] = [
  ...TOQUES_BASE,
  ...EXTRAS.map((e) => ({ id: e.id as ToqueId, nome: e.nome })),
];

const PADROES: Record<ToqueId, { ciclo: number; onda: OscillatorType; notas: Nota[] }> = {
  ...PADROES_BASE,
  ...(Object.fromEntries(
    EXTRAS.map((e) => [
      e.id,
      {
        ciclo: duracaoRitmo(e.pares as unknown as [number, number][], e.batida) + 0.3,
        onda: e.onda,
        notas: ritmo(e.pares as unknown as [number, number][], e.batida),
      },
    ]),
  ) as Record<ExtraId, { ciclo: number; onda: OscillatorType; notas: Nota[] }>),
};




type Ctx = AudioContext & { criado?: boolean };

let ctx: Ctx | null = null;
let mestre: GainNode | null = null;
let repetidor: number | null = null;
let ativos: [OscillatorNode, GainNode][] = [];


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
    ativos.push([osc, g]);
    osc.onended = () => {
      ativos = ativos.filter(([o]) => o !== osc);
    };
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

/** Para a repetição e corta na hora tudo que já estava agendado. */
export function pararToque() {
  if (repetidor !== null) {
    window.clearInterval(repetidor);
    repetidor = null;
  }
  const c = ctx;
  const lista = ativos;
  ativos = [];
  if (!c) return;
  const fim = c.currentTime + 0.03;
  for (const [osc, g] of lista) {
    try {
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, fim);
      osc.onended = null;
      osc.stop(fim);
    } catch {
      /* nota já encerrada */
    }
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
