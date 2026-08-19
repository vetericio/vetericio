import type { Especie, Registro } from "./ficha";

export type ParametroCurva = "glicemia" | "pas";

export type Medicao = {
  id: string;
  em: string;
  glicemia: string;
  pas: string;
};

export type Curva = {
  id: string;
  /** Nome + espécie normalizados (mesma identidade usada nas fichas). */
  chave: string;
  animal: string;
  especie: Especie;
  parametros: ParametroCurva[];
  intervaloHoras: number;
  ativa: boolean;
  criadoEm: string;
  alarmeId?: string | undefined;
  medicoes: Medicao[];
};

export const ROTULO_PARAMETRO: Record<ParametroCurva, { rotulo: string; unidade: string }> = {
  glicemia: { rotulo: "Glicemia", unidade: "mg/dL" },
  pas: { rotulo: "PAS", unidade: "mmHg" },
};

const CHAVE = "veterico-curvas-v1";

/** Mesma normalização de `chaveAnimal`, sem importar em tempo de execução. */
export function chaveDoAnimal(animal: string, especie: Especie | undefined): string {
  const nome = animal
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return `${nome}|${especie ?? ""}`;
}

export function carregarCurvas(): Curva[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return [];
    const dados = JSON.parse(bruto);
    return Array.isArray(dados) ? (dados as Curva[]) : [];
  } catch {
    return [];
  }
}

export function salvarCurvas(curvas: Curva[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(curvas));
  } catch {
    /* armazenamento indisponível */
  }
}

export function horaDaMedicao(m: Medicao): string {
  const d = new Date(m.em);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
}

export function tituloCurva(c: Curva): string {
  const nomes = c.parametros.map((p) => ROTULO_PARAMETRO[p].rotulo).join(" e ");
  const nome = c.parametros.length === 1 && c.parametros[0] === "glicemia" ? "Curva glicêmica" : `Curva de ${nomes}`;
  return `${nome} (a cada ${c.intervaloHoras}h)`;
}

/** Bloco de texto da curva, uma medição por linha. */
export function textoCurva(c: Curva): string {
  const varios = c.parametros.length > 1;
  const linhas = c.medicoes
    .filter((m) => m.glicemia.trim() || m.pas.trim())
    .map((m) => {
      const partes = c.parametros
        .map((p) => {
          const valor = (p === "glicemia" ? m.glicemia : m.pas).trim();
          if (!valor) return "";
          const prefixo = varios ? `${ROTULO_PARAMETRO[p].rotulo}: ` : "";
          return `${prefixo}${valor.replace(".", ",")} ${ROTULO_PARAMETRO[p].unidade}`;
        })
        .filter(Boolean);
      return `${horaDaMedicao(m)} - ${partes.join(" / ")}`;
    });
  if (linhas.length === 0) return `${tituloCurva(c)}\nsem medições registradas`;
  return [tituloCurva(c), ...linhas].join("\n");
}


/** Blocos de curva de um animal, para a ficha, a cópia e o PDF. */
export function blocoCurvasDoRegistro(
  r: Pick<Registro, "animal" | "especie">,
  lista?: Curva[],
): string {
  const chave = chaveDoAnimal(r.animal, r.especie);
  return (lista ?? carregarCurvas())
    .filter((c) => c.chave === chave)
    .map(textoCurva)
    .filter(Boolean)
    .join("\n");
}

export function curvasDoAnimal(curvas: Curva[], animal: string, especie: Especie | undefined) {
  const chave = chaveDoAnimal(animal, especie);
  return curvas.filter((c) => c.chave === chave);
}
