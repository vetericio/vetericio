/**
 * Gate de publicação dos 14 novos consentimentos clínicos.
 * Somente altere após: pareceres independentes sobre o mesmo commit, QA,
 * trilha de backup, assinatura e duas vias em PDF.
 *
 * O estado precisa ser controlado no SERVIDOR. Um botão no front-end,
 * o rascunho da clínica ou uma declaração de IA não destravam o gate.
 */
export const TERMOS_CLINICOS_HOMOLOGADOS = false;

/** UUIDs estáveis para registrar a versão exata no prontuário. */
export const UUID_MODELOS_TERMO = {
  eutanasia: "e14d0000-0000-4000-8000-000000000001",
  cirurgia: "e14d0000-0000-4000-8000-000000000002",
  anestesia: "e14d0000-0000-4000-8000-000000000003",
  "retirada-sem-alta": "e14d0000-0000-4000-8000-000000000004",
  internacao: "e14d0000-0000-4000-8000-000000000005",
  "terapeutico-risco": "e14d0000-0000-4000-8000-000000000006",
  diagnostico: "e14d0000-0000-4000-8000-000000000007",
  recusa: "e14d0000-0000-4000-8000-000000000008",
  transferencia: "e14d0000-0000-4000-8000-000000000009",
  transfusao: "e14d0000-0000-4000-8000-000000000010",
  corpo: "e14d0000-0000-4000-8000-000000000011",
  "doacao-corpo": "e14d0000-0000-4000-8000-000000000012",
  rcp: "e14d0000-0000-4000-8000-000000000013",
  domiciliar: "e14d0000-0000-4000-8000-000000000014",
} as const;

export function codigoTermoPorUuid(uuid: string) {
  return (Object.entries(UUID_MODELOS_TERMO).find(([, valor]) => valor === uuid)?.[0] || null) as
    keyof typeof UUID_MODELOS_TERMO | null;
}
