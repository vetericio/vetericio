export type CategoriaExame = "Sangue" | "Urina" | "Fezes" | "Imagem" | "Outros";

export type ExamePadrao = {
  nome: string;
  categoria: CategoriaExame;
};

// Catálogo inicial. Cada clínica define o próprio preço e pode acrescentar,
// renomear ou desativar itens no catálogo de serviços.
export const EXAMES_PADRAO: ExamePadrao[] = [
  { nome: "Hemograma completo", categoria: "Sangue" },
  { nome: "Bioquímica sérica", categoria: "Sangue" },
  { nome: "Coagulograma", categoria: "Sangue" },
  { nome: "Hemogasometria", categoria: "Sangue" },
  { nome: "Dosagem hormonal", categoria: "Sangue" },
  { nome: "Sorologia", categoria: "Sangue" },
  { nome: "PCR", categoria: "Sangue" },
  { nome: "Teste rápido", categoria: "Sangue" },
  { nome: "Urina tipo 1", categoria: "Urina" },
  { nome: "Urocultura", categoria: "Urina" },
  { nome: "Coprológico", categoria: "Fezes" },
  { nome: "Ultrassonografia abdominal", categoria: "Imagem" },
  { nome: "Radiografia", categoria: "Imagem" },
  { nome: "Ecocardiograma", categoria: "Imagem" },
  { nome: "Eletrocardiograma", categoria: "Imagem" },
  { nome: "Pressão arterial", categoria: "Outros" },
  { nome: "Citologia", categoria: "Outros" },
  { nome: "Histopatológico", categoria: "Outros" },
];

export function categoriaExame(categoria?: string | null): CategoriaExame | null {
  const encontrada = String(categoria || "").match(/^Exames\s*[·-]\s*(Sangue|Urina|Fezes|Imagem|Outros)$/i)?.[1];
  if (!encontrada) return null;
  return `${encontrada.charAt(0).toUpperCase()}${encontrada.slice(1).toLowerCase()}` as CategoriaExame;
}

export function categoriaCatalogoExame(categoria: CategoriaExame) {
  return `Exames · ${categoria}`;
}
