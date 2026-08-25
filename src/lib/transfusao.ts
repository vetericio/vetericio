import { paraNumero } from "./ficha";

export type EspecieTransfusao = "Cachorro" | "Gato";

export const FATORES_SANGUE_TOTAL: Record<EspecieTransfusao, number> = {
  Cachorro: 90,
  Gato: 70,
};

export const ROTULOS_ESPECIE: Record<EspecieTransfusao, string> = {
  Cachorro: "Cão",
  Gato: "Gato",
};

export interface DadosTransfusao {
  especie: EspecieTransfusao;
  peso: string;
  vgAtual: string;
  vgUnidade: string;
  vgAlvo: string;
}

export interface ResultadoTransfusao {
  volume: number | null;
  formula: string;
  fator: number;
  erro: string | null;
}

export function calcularVolumeSangueTotal(
  especie: EspecieTransfusao,
  peso: number,
  vgAtual: number,
  vgAlvo: number,
  vgUnidade: number,
): number {
  const fator = FATORES_SANGUE_TOTAL[especie];
  return Math.round((peso * fator * (vgAlvo - vgAtual)) / vgUnidade);
}

export function validarTransfusao(dados: DadosTransfusao): ResultadoTransfusao {
  const peso = paraNumero(dados.peso);
  const vgAtual = paraNumero(dados.vgAtual);
  const vgUnidade = paraNumero(dados.vgUnidade);
  const vgAlvo = paraNumero(dados.vgAlvo);

  if (Number.isNaN(peso) || peso <= 0) {
    return {
      volume: null,
      formula: "",
      fator: FATORES_SANGUE_TOTAL[dados.especie],
      erro: "Informe um peso válido maior que zero.",
    };
  }
  if (Number.isNaN(vgAtual) || vgAtual <= 0) {
    return {
      volume: null,
      formula: "",
      fator: FATORES_SANGUE_TOTAL[dados.especie],
      erro: "Informe o VG/HT atual do paciente.",
    };
  }
  if (Number.isNaN(vgUnidade) || vgUnidade <= 0) {
    return {
      volume: null,
      formula: "",
      fator: FATORES_SANGUE_TOTAL[dados.especie],
      erro: "Informe o VG/HT da unidade sanguínea.",
    };
  }
  if (Number.isNaN(vgAlvo) || vgAlvo <= 0) {
    return {
      volume: null,
      formula: "",
      fator: FATORES_SANGUE_TOTAL[dados.especie],
      erro: "Informe o VG/HT alvo.",
    };
  }
  if (vgAtual >= vgAlvo) {
    return {
      volume: null,
      formula: "",
      fator: FATORES_SANGUE_TOTAL[dados.especie],
      erro: "VG/HT atual deve ser menor que o VG/HT alvo.",
    };
  }

  const fator = FATORES_SANGUE_TOTAL[dados.especie];
  const volume = calcularVolumeSangueTotal(dados.especie, peso, vgAtual, vgAlvo, vgUnidade);
  const formula = `${peso} × ${fator} × (${vgAlvo} − ${vgAtual}) ÷ ${vgUnidade}`;

  return { volume, formula, fator, erro: null };
}

export function valorNumericoPercentual(valor: string): number {
  return paraNumero(valor);
}
