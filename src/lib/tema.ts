export type TemaId =
  | "original"
  | "vet"
  | "escuro"
  | "sobrio"
  | "fofo"
  | "black"
  | "cinza"
  | "noite"
  | "esponja"
  | "gatinhos"
  | "verde-cinza"
  | "pro"
  | "laranja"
  | "natal"
  | "jack"
  | "cansado"
  | "feliz"
  | "rock"
  | "veterico"
  | "minha-cor";

export const TEMAS: { id: TemaId; nome: string; classe: string; descricao: string }[] = [
  { id: "original", nome: "Original", classe: "", descricao: "Como o app nasceu" },
  { id: "vet", nome: "Veterinário", classe: "tema-vet", descricao: "Verde clínico" },
  { id: "escuro", nome: "Escuro", classe: "tema-escuro", descricao: "Para o plantão noturno" },
  { id: "sobrio", nome: "Sóbrio", classe: "tema-sobrio", descricao: "Cinzas neutros" },
  { id: "fofo", nome: "Divertido", classe: "tema-fofo", descricao: "Com bichinhos" },
  { id: "black", nome: "Black", classe: "tema-black", descricao: "Tudo preto" },
  { id: "cinza", nome: "Tons de cinza", classe: "tema-cinza", descricao: "Sem nenhuma cor" },
  { id: "noite", nome: "Escuro azulado", classe: "tema-noite", descricao: "Azul-noite" },
  { id: "esponja", nome: "Bob Esponja", classe: "tema-esponja", descricao: "Amarelo e azul-mar" },
  { id: "gatinhos", nome: "Gatinhos", classe: "tema-gatinhos", descricao: "Vários gatinhos" },
  {
    id: "verde-cinza",
    nome: "Verde e cinza",
    classe: "tema-verde-cinza",
    descricao: "Verde folha com cinzas",
  },
  { id: "pro", nome: "Profissional", classe: "tema-pro", descricao: "Azul-marinho sóbrio" },
  { id: "laranja", nome: "Laranja", classe: "tema-laranja", descricao: "Laranja quente" },
  { id: "natal", nome: "Natal", classe: "tema-natal", descricao: "Verde, vermelho e dourado" },
  {
    id: "jack",
    nome: "Jack Skellington",
    classe: "tema-jack",
    descricao: "Morcegos e o Zero ao fundo",
  },
  { id: "cansado", nome: "Cansado", classe: "tema-cansado", descricao: "Contraste suave" },
  { id: "feliz", nome: "Feliz", classe: "tema-feliz", descricao: "Cores alegres" },
  { id: "rock", nome: "Rock", classe: "tema-rock", descricao: "Preto, prata e vermelho" },
  {
    id: "veterico",
    nome: "Veterício",
    classe: "tema-veterico",
    descricao: "Cores e padrão da logo",
  },
  { id: "minha-cor", nome: "Minha cor", classe: "tema-minha-cor", descricao: "Você escolhe a cor" },
];

const CHAVE = "veterico-tema-v1";
const CHAVE_COR = "veterico-tema-cor-v1";
const CLASSES = TEMAS.map((t) => t.classe).filter(Boolean);

export const COR_PADRAO = "#2f7d76";

/** Atalhos de cor para quem não quer abrir o seletor. */
export const CORES_RAPIDAS = [
  "#2f7d76",
  "#1d4ed8",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#111827",
];

/** Variáveis que a cor personalizada precisa limpar ao sair do tema. */
const VARS_CUSTOM = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--input",
  "--ring",
  "--chart-1",
  "--chart-2",
];

export function carregarTema(): TemaId {
  if (typeof window === "undefined") return "original";
  const salvo = window.localStorage.getItem(CHAVE);
  return TEMAS.some((t) => t.id === salvo) ? (salvo as TemaId) : "original";
}

export function carregarCor(): string {
  if (typeof window === "undefined") return COR_PADRAO;
  const salvo = window.localStorage.getItem(CHAVE_COR);
  return salvo && /^#[0-9a-fA-F]{6}$/.test(salvo) ? salvo : COR_PADRAO;
}

export function salvarCor(cor: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_COR, cor);
  } catch {
    /* armazenamento indisponível */
  }
}

export function aplicarTema(id: TemaId, cor = carregarCor()) {
  if (typeof document === "undefined") return;
  const alvo = document.documentElement;
  alvo.classList.remove(...CLASSES);
  for (const v of VARS_CUSTOM) alvo.style.removeProperty(v);

  const tema = TEMAS.find((t) => t.id === id);
  if (tema?.classe) alvo.classList.add(tema.classe);
  if (id === "minha-cor") aplicarCorPersonalizada(cor);

  try {
    window.localStorage.setItem(CHAVE, id);
  } catch {
    /* armazenamento indisponível */
  }
}

/* ---------- cor personalizada ---------- */

function hexParaOklch(hex: string): { l: number; c: number; h: number } {
  const n = hex.replace("#", "");
  const canal = (i: number) => parseInt(n.slice(i, i + 2), 16) / 255;
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const r = lin(canal(0));
  const g = lin(canal(2));
  const b = lin(canal(4));

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const c = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

const ok = (l: number, c: number, h: number) =>
  `oklch(${l.toFixed(3)} ${Math.max(c, 0).toFixed(3)} ${h.toFixed(1)})`;

/** Gera um tema inteiro a partir de uma cor escolhida pelo usuário. */
export function aplicarCorPersonalizada(hex: string) {
  if (typeof document === "undefined") return;
  const { l, c, h } = hexParaOklch(hex);
  const base = Math.min(Math.max(l, 0.25), 0.72);
  const croma = Math.min(c, 0.19);
  const s = document.documentElement.style;

  const par: [string, string][] = [
    ["--background", ok(0.98, croma * 0.06, h)],
    ["--foreground", ok(0.24, croma * 0.25, h)],
    ["--card", ok(1, croma * 0.03, h)],
    ["--card-foreground", ok(0.24, croma * 0.25, h)],
    ["--popover", ok(1, croma * 0.03, h)],
    ["--popover-foreground", ok(0.24, croma * 0.25, h)],
    ["--primary", ok(base, croma, h)],
    ["--primary-foreground", base > 0.62 ? ok(0.2, croma * 0.2, h) : ok(0.99, croma * 0.03, h)],
    ["--secondary", ok(0.93, croma * 0.28, h)],
    ["--secondary-foreground", ok(0.3, croma * 0.35, h)],
    ["--muted", ok(0.94, croma * 0.18, h)],
    ["--muted-foreground", ok(0.52, croma * 0.2, h)],
    ["--accent", ok(0.88, croma * 0.45, h)],
    ["--accent-foreground", ok(0.27, croma * 0.35, h)],
    ["--border", ok(0.89, croma * 0.22, h)],
    ["--input", ok(0.87, croma * 0.26, h)],
    ["--ring", ok(base, croma, h)],
    ["--chart-1", ok(base, croma, h)],
    ["--chart-2", ok(Math.min(base + 0.12, 0.8), croma * 0.85, (h + 150) % 360)],
  ];
  for (const [k, v] of par) s.setProperty(k, v);
}
