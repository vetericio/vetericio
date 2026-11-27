export type TutorOpcaoComanda = {
  id: string;
  nome: string;
  codigoPublico?: string;
  codigo_publico?: string;
};

export const LIMITE_TUTORES_VISIVEIS = 50;

const comparadorNome = new Intl.Collator("pt-BR");
function normalizarBusca(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function codigoPublicoTutorComanda(tutor: TutorOpcaoComanda) {
  return tutor.codigoPublico || tutor.codigo_publico || "";
}

export function ordenarTutoresComanda<T extends TutorOpcaoComanda>(tutores: readonly T[]): T[] {
  return [...tutores].sort(
    (a, b) =>
      comparadorNome.compare(a.nome, b.nome) ||
      comparadorNome.compare(codigoPublicoTutorComanda(a), codigoPublicoTutorComanda(b)) ||
      a.id.localeCompare(b.id),
  );
}

export function filtrarTutoresComanda<T extends TutorOpcaoComanda>(
  tutores: readonly T[],
  consulta: string,
): T[] {
  const termos = normalizarBusca(consulta).split(/\s+/).filter(Boolean);
  if (!termos.length) return [...tutores];
  return tutores.filter((tutor) => {
    const texto = normalizarBusca(`${tutor.nome} ${codigoPublicoTutorComanda(tutor)}`);
    return termos.every((termo) => texto.includes(termo));
  });
}
