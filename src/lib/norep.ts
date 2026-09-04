import { paraNumero } from "./ficha";

export const CONCENTRACAO_NOREP = 40; // mcg/mL

export interface DadosNorep {
  peso: string;
  dose: string;
  taxa: string;
}

export interface ResultadoNorep {
  doseCalculada: number | null;
  taxaCalculada: number | null;
  formula: string;
  erro: string | null;
}

function formatarDuasCasas(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export function calcularNorep(
  dados: DadosNorep,
  ultimoEditado: "dose" | "taxa" | null,
): ResultadoNorep {
  const peso = paraNumero(dados.peso);
  const dose = paraNumero(dados.dose);
  const taxa = paraNumero(dados.taxa);

  if (Number.isNaN(peso) || peso <= 0) {
    return {
      doseCalculada: null,
      taxaCalculada: null,
      formula: "",
      erro: "Informe um peso válido maior que zero.",
    };
  }

  const dosePreenchida = !Number.isNaN(dose) && dose >= 0;
  const taxaPreenchida = !Number.isNaN(taxa) && taxa >= 0;

  if (!dosePreenchida && !taxaPreenchida) {
    return {
      doseCalculada: null,
      taxaCalculada: null,
      formula: "",
      erro: null,
    };
  }

  if (dosePreenchida && !taxaPreenchida) {
    const taxaCalculada = (peso * dose * 60) / CONCENTRACAO_NOREP;
    return {
      doseCalculada: null,
      taxaCalculada,
      formula: `Taxa (mL/h) = ${peso} × ${dose} × 60 ÷ ${CONCENTRACAO_NOREP}`,
      erro: null,
    };
  }

  if (taxaPreenchida && !dosePreenchida) {
    const doseCalculada = (taxa * CONCENTRACAO_NOREP) / (peso * 60);
    return {
      doseCalculada,
      taxaCalculada: null,
      formula: `Dose (mcg/kg/min) = ${taxa} × ${CONCENTRACAO_NOREP} ÷ (${peso} × 60)`,
      erro: null,
    };
  }

  // Ambos preenchidos: o último editado é a fonte e recalcula o outro.
  if (ultimoEditado === "taxa") {
    const doseCalculada = (taxa * CONCENTRACAO_NOREP) / (peso * 60);
    return {
      doseCalculada,
      taxaCalculada: null,
      formula: `Dose (mcg/kg/min) = ${taxa} × ${CONCENTRACAO_NOREP} ÷ (${peso} × 60)`,
      erro: null,
    };
  }

  const taxaCalculada = (peso * dose * 60) / CONCENTRACAO_NOREP;
  return {
    doseCalculada: null,
    taxaCalculada,
    formula: `Taxa (mL/h) = ${peso} × ${dose} × 60 ÷ ${CONCENTRACAO_NOREP}`,
    erro: null,
  };
}

export function formatarNorep(valor: number | null, unidade: string): string {
  if (valor === null || !isFinite(valor)) return "—";
  return `${formatarDuasCasas(valor)} ${unidade}`;
}
