const SLUG_VALIDO = /^[a-z0-9]+(?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const RESERVADOS = new Set(["api", "assets", "c", "contrato", "pet", "vet"]);

export function slugEnderecoFichaAnimal(valor: unknown): string | null {
  if (typeof valor !== "string" || !SLUG_VALIDO.test(valor)) return null;
  // Mantém os endereços de plataforma, portais e sites públicos já existentes.
  return RESERVADOS.has(valor) || valor.startsWith("admin") ? null : valor;
}

export function ehEnderecoFichaAnimal(primeiro: string, segundo: string) {
  return segundo === "animal" && slugEnderecoFichaAnimal(primeiro) !== null;
}

export function idAnimalDaFicha(valor: unknown) {
  return typeof valor === "string" && UUID.test(valor) ? valor : null;
}

export function mostrarEnderecoDaFichaNoHost(hostname: string) {
  return [
    "oricse.com.br",
    "www.oricse.com.br",
    "app.oricse.com.br",
    "localhost",
    "127.0.0.1",
  ].includes(hostname.toLowerCase());
}

export function caminhoInternoDaFicha(pathname: string) {
  const resultado = /^\/([^/]+)\/animal\/?$/.exec(pathname);
  return resultado && ehEnderecoFichaAnimal(resultado[1], "animal") ? "/animal" : pathname;
}

/** Um link direto só é elegível para o mesmo escopo que carregou o resultado. */
export function slugParaLinkDaFicha({
  hostname,
  animalId,
  clinicaDaLista,
  clinicaAtiva,
  slugAtivo,
  podeAbrirFicha,
}: {
  hostname: string;
  animalId: unknown;
  clinicaDaLista: string;
  clinicaAtiva: string;
  slugAtivo: unknown;
  podeAbrirFicha: boolean;
}) {
  if (
    !podeAbrirFicha ||
    !clinicaDaLista ||
    clinicaDaLista !== clinicaAtiva ||
    !idAnimalDaFicha(animalId) ||
    !mostrarEnderecoDaFichaNoHost(hostname)
  ) {
    return null;
  }
  return slugEnderecoFichaAnimal(slugAtivo);
}
