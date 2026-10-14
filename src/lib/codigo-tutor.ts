export const TUTORES_LOCAL_KEY = "oricse-tutores-v1";
const NOME_CLINICA_LOCAL_KEY = "oricse-clinica-nome-v1";
const CODIGO_TUTOR_REGEX = /^#[A-Z][0-9]{6}$/;

type TutorComCodigo = {
  id: string;
  nome: string;
  codigoPublico?: string;
  codigo_publico?: string;
  codigo?: string;
};

export function normalizarCodigoTutor(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined;
  const codigo = valor.trim().toUpperCase();
  const canonico = codigo.startsWith("#") ? codigo : `#${codigo}`;
  return CODIGO_TUTOR_REGEX.test(canonico) ? canonico : undefined;
}

export function codigoPublicoTutor(tutor: TutorComCodigo): string | undefined {
  return normalizarCodigoTutor(tutor.codigoPublico || tutor.codigo_publico || tutor.codigo);
}

export function lerNomeClinicaLocal(): string {
  if (typeof window === "undefined") return "Oricse";
  try {
    return window.localStorage.getItem(NOME_CLINICA_LOCAL_KEY)?.trim() || "Oricse";
  } catch {
    return "Oricse";
  }
}

export function gerarCodigoTutor(
  tutores: readonly TutorComCodigo[],
  nomeClinica = lerNomeClinicaLocal(),
): string {
  const inicial =
    nomeClinica
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .match(/[A-Z]/)?.[0] || "O";
  const codigos = new Set(
    tutores.map(codigoPublicoTutor).filter((codigo): codigo is string => Boolean(codigo)),
  );
  return proximoCodigoTutor(codigos, inicial);
}

function proximoCodigoTutor(codigos: ReadonlySet<string>, inicial: string): string {
  const prefixo = `#${inicial}`;
  const maiorNumero = [...codigos].reduce(
    (maior, codigo) =>
      codigo.startsWith(prefixo) ? Math.max(maior, Number(codigo.slice(2))) : maior,
    0,
  );

  for (let numero = maiorNumero + 1; numero <= 999999; numero += 1) {
    const codigo = `${prefixo}${String(numero).padStart(6, "0")}`;
    if (!codigos.has(codigo)) return codigo;
  }

  throw new Error("A sequência de IDs de tutores atingiu o limite de 999999.");
}

export function migrarCodigosPublicosTutores<T extends TutorComCodigo>(
  tutores: readonly T[],
  nomeClinica = lerNomeClinicaLocal(),
): T[] {
  const inicial =
    nomeClinica
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .match(/[A-Z]/)?.[0] || "O";
  const codigosPreservados = new Map<number, string>();
  const codigosVistos = new Set<string>();
  tutores.forEach((tutor, indice) => {
    const codigoExistente = codigoPublicoTutor(tutor);
    if (codigoExistente && !codigosVistos.has(codigoExistente)) {
      codigosPreservados.set(indice, codigoExistente);
      codigosVistos.add(codigoExistente);
    }
  });

  const usados = new Set(codigosPreservados.values());
  return tutores.map((tutor, indice) => {
    const codigoPreservado = codigosPreservados.get(indice);
    if (codigoPreservado) return { ...tutor, codigoPublico: codigoPreservado };
    const codigoPublico = proximoCodigoTutor(usados, inicial);
    usados.add(codigoPublico);
    return { ...tutor, codigoPublico };
  });
}

export function migrarCodigosTutoresLocais(nomeClinica: string): void {
  if (typeof window === "undefined") return;
  const nome = nomeClinica.trim();
  if (!nome) return;

  try {
    window.localStorage.setItem(NOME_CLINICA_LOCAL_KEY, nome);
    const valor: unknown = JSON.parse(window.localStorage.getItem(TUTORES_LOCAL_KEY) || "[]");
    if (!Array.isArray(valor)) return;
    const tutores = valor.filter(
      (item): item is TutorComCodigo =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.nome === "string",
    );
    const atualizados = migrarCodigosPublicosTutores(tutores, nome);
    let indiceAtualizado = 0;
    const resultado = valor.map((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.id !== "string" ||
        typeof item.nome !== "string"
      ) {
        return item;
      }
      return atualizados[indiceAtualizado++];
    });
    window.localStorage.setItem(TUTORES_LOCAL_KEY, JSON.stringify(resultado));
  } catch (error) {
    console.error("Não foi possível atualizar os IDs públicos dos tutores:", error);
  }
}
