export type DominioResumo = {
  id: string;
  clinica_id: string;
  hostname: string;
  status: string;
  publicar_site: boolean;
  atualizado_em?: string | null;
};

export function normalizarDominio(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

/** Cada hostname aparece uma única vez, sem afetar registros de outras clínicas. */
export function dominiosUnicosPorClinica<T extends DominioResumo>(
  dominios: T[],
  clinicaId: string,
): T[] {
  const unicos = new Map<string, T>();
  const prioridade = (dominio: T) => Number(dominio.status === "ativo" && dominio.publicar_site);
  const atualizado = (dominio: T) => Date.parse(dominio.atualizado_em || "") || 0;

  for (const dominio of dominios) {
    if (dominio.clinica_id !== clinicaId) continue;
    const chave = normalizarDominio(dominio.hostname);
    const anterior = unicos.get(chave);
    if (!anterior ||
        prioridade(dominio) > prioridade(anterior) ||
        (prioridade(dominio) === prioridade(anterior) &&
         atualizado(dominio) > atualizado(anterior))) {
      unicos.set(chave, dominio);
    }
  }

  return [...unicos.values()].sort(
    (a, b) => normalizarDominio(a.hostname).localeCompare(normalizarDominio(b.hostname)),
  );
}

export type EstadoOnlineDominio = "ativo" | "indisponivel" | "nao_verificado";

export function rotuloDisponibilidadeDominio(
  dominio: Pick<DominioResumo, "status" | "publicar_site">,
  verificado?: EstadoOnlineDominio | "verificando",
): string {
  if (!dominio.publicar_site) return "Não publicado";
  if (dominio.status === "suspenso") return "Suspenso";
  if (dominio.status === "erro") return "Precisa de atenção";
  if (dominio.status === "aguardando_dns") return "Aguardando DNS";
  if (dominio.status === "rascunho") return "Aguardando ativação";
  if (dominio.status !== "ativo") return "Verificando domínio";
  if (verificado === "ativo") return "Ativo";
  if (verificado === "verificando") return "Verificando";
  if (verificado === "indisponivel") return "Indisponível";
  return "Não verificado";
}
