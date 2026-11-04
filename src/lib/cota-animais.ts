/** Política compartilhada: a quantidade é por clínica, não por funcionário. */
export function avaliarLimiteAnimais(
  limite: number | null,
  idsExistentes: Iterable<string>,
  idsPropostos: Iterable<string>,
) {
  const anteriores = new Set([...idsExistentes].filter(Boolean));
  const posteriores = new Set(anteriores);
  for (const id of idsPropostos) if (id) posteriores.add(id);
  const novos = posteriores.size - anteriores.size;
  return {
    ocupados: anteriores.size,
    aposCadastro: posteriores.size,
    novos,
    permitido: limite === null || novos === 0 || posteriores.size <= limite,
  };
}
