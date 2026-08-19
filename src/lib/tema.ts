export type TemaId = "original" | "vet" | "escuro" | "sobrio" | "fofo";

export const TEMAS: { id: TemaId; nome: string; classe: string; descricao: string }[] = [
  { id: "original", nome: "Original", classe: "", descricao: "Como o app nasceu" },
  { id: "vet", nome: "Veterinário", classe: "tema-vet", descricao: "Verde clínico" },
  { id: "escuro", nome: "Escuro", classe: "tema-escuro", descricao: "Para o plantão noturno" },
  { id: "sobrio", nome: "Sóbrio", classe: "tema-sobrio", descricao: "Cinzas neutros" },
  { id: "fofo", nome: "Divertido", classe: "tema-fofo", descricao: "Com bichinhos" },
];

const CHAVE = "veterico-tema-v1";
const CLASSES = TEMAS.map((t) => t.classe).filter(Boolean);

export function carregarTema(): TemaId {
  if (typeof window === "undefined") return "original";
  const salvo = window.localStorage.getItem(CHAVE);
  return TEMAS.some((t) => t.id === salvo) ? (salvo as TemaId) : "original";
}

export function aplicarTema(id: TemaId) {
  if (typeof document === "undefined") return;
  const alvo = document.documentElement;
  alvo.classList.remove(...CLASSES);
  const tema = TEMAS.find((t) => t.id === id);
  if (tema?.classe) alvo.classList.add(tema.classe);
  try {
    window.localStorage.setItem(CHAVE, id);
  } catch {
    /* armazenamento indisponível */
  }
}
