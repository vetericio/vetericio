export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RegraComissao = {
  id: string;
  clinica_id: string;
  item_id: string | null;
  dia_semana: DiaSemana | null;
  percentual: number;
};

export type ItemCatalogo = {
  id: string;
  clinica_id: string;
  tipo: "servico" | "produto";
  nome: string;
  categoria: string;
  valor: number;
  estoque_atual: number | null;
  estoque_minimo: number | null;
  ativo: boolean;
};

export type ProfissionalClinica = {
  user_id: string;
  nome: string;
  papel: string;
};

export type RemuneracaoFuncionario = {
  id: string;
  clinica_id: string;
  funcionario_id: string;
  servico_id: string;
  percentual: number;
};

export const DIAS_SEMANA: { value: DiaSemana; label: string; curto: string }[] = [
  { value: 1, label: "Segunda-feira", curto: "Seg" },
  { value: 2, label: "Terça-feira", curto: "Ter" },
  { value: 3, label: "Quarta-feira", curto: "Qua" },
  { value: 4, label: "Quinta-feira", curto: "Qui" },
  { value: 5, label: "Sexta-feira", curto: "Sex" },
  { value: 6, label: "Sábado", curto: "Sáb" },
  { value: 0, label: "Domingo", curto: "Dom" },
];

export function resolverPercentualComissao(
  regras: readonly RegraComissao[],
  itemId: string | null,
  dia: DiaSemana,
): number {
  const prioridades: [string | null, DiaSemana | null][] = itemId
    ? [
        [itemId, dia],
        [null, dia],
        [itemId, null],
        [null, null],
      ]
    : [
        [null, dia],
        [null, null],
      ];
  for (const [regraItemId, regraDia] of prioridades) {
    const regra = regras.find(
      (item) => item.item_id === regraItemId && item.dia_semana === regraDia,
    );
    if (regra) return Number(regra.percentual);
  }
  return 0;
}

export function percentualComissaoNaData(
  regras: readonly RegraComissao[],
  itemId: string | null,
  data: Date,
): number {
  return resolverPercentualComissao(regras, itemId, data.getDay() as DiaSemana);
}
