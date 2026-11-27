import {
  faixasParaAnimal, sugerirFaixaPeso,
  type EspeciePreco, type FaixaPrecoPeso, type SexoPreco,
} from "./preco-por-peso.ts";

export const PESO_MAXIMO_ORCAMENTO = 60;

export type PerfilOrcamento = { especie: EspeciePreco; sexo: SexoPreco; peso: string };

export function calcularPrecoOrcamento(faixas: FaixaPrecoPeso[], perfil: PerfilOrcamento) {
  const textoPeso = perfil.peso.trim().replace(",", ".");
  const pesoInformado = /^(?:\d+(?:\.\d{0,3})?|\.\d{1,3})$/.test(textoPeso) ? Number(textoPeso) : NaN;
  const pesoKg = Number.isFinite(pesoInformado) && pesoInformado > 0 &&
    pesoInformado <= PESO_MAXIMO_ORCAMENTO ? pesoInformado : null;

  const compativeis = perfil.especie && perfil.sexo
    ? faixasParaAnimal(faixas, perfil.especie, perfil.sexo) : [];
  // Quando duas regras têm a mesma especificidade, a da espécie prevalece sobre a regra só de sexo.
  const condicao = compativeis.find(faixa => faixa.especie) ?? compativeis[0];
  const tabela = compativeis.filter(faixa => faixa.especie === condicao?.especie && faixa.sexo === condicao?.sexo);
  const indice = sugerirFaixaPeso(tabela, pesoKg);
  const mudancas = tabela.flatMap((faixa, i) => {
    const proxima = tabela[i + 1];
    if (faixa.ateKg === null || faixa.ateKg >= PESO_MAXIMO_ORCAMENTO || !proxima || faixa.valor === proxima.valor) return [];
    return [{ aposKg: faixa.ateKg, valor: proxima.valor }];
  });

  return { pesoKg, tabela, indice, mudancas, valor: tabela[indice]?.valor ?? null };
}
