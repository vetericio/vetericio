/** Catálogo comercial aprovado para os quatro planos de 2026. Os controles são independentes da matriz técnica de permissões. */
export const NIVEIS_PLANOS = ["solo-2026", "essencial-2026", "profissional-2026", "master-2026"] as const;
export type NivelPlano = 0 | 1 | 2 | 3;
export type BeneficioOricse = {
  codigo: string;
  nome: string;
  grupo: string;
  ordem: number;
  nivelMinimo: NivelPlano;
};
const GRUPOS: ReadonlyArray<readonly [string, NivelPlano, readonly string[]]> = [
  [
    "Painel e Recepção",
    0,
    [
      "Painel inicial e resumo do dia",
      "Cadastro de tutores",
      "Cadastro de animais",
      "Pesquisa e histórico dos animais",
      "Dados completos de identificação e contato"
    ]
  ],
  [
    "Recepção e agendamento",
    1,
    [
      "Agenda básica de consultas"
    ]
  ],
  [
    "Recepção e agendamento",
    2,
    [
      "Painel completo da recepção",
      "Agenda completa por horários",
      "Fila de espera e controle de atendimento",
      "Visualização de todas as agendas"
    ]
  ],
  [
    "Clínica veterinária e documentos",
    0,
    [
      "Consultas e prontuários básicos",
      "Receituário veterinário em PDF",
      "Assinatura de documentos clínicos",
      "Exames, laudos e anexos",
      "Documentos e encaminhamentos clínicos"
    ]
  ],
  [
    "Clínica veterinária e documentos",
    1,
    [
      "Anamnese completa",
      "Prontuário clínico completo",
      "Calculadora de medicações",
      "Histórico e acompanhamento clínico completo"
    ]
  ],
  [
    "Internação veterinária",
    2,
    [
      "Painel de internação",
      "Cadastro e acompanhamento dos internados",
      "Evoluções e registros clínicos",
      "Curvas e parâmetros vitais",
      "Controle de medicações na internação",
      "Horários das medicações por animal",
      "Alarmes e lembretes clínicos",
      "Pendências da internação",
      "Plantões e histórico de plantões"
    ]
  ],
  [
    "Banho e Tosa",
    2,
    [
      "Painel do Banho e Tosa",
      "Agenda específica de Banho e Tosa",
      "Agendamento e acompanhamento de novos serviços",
      "Fila de serviços",
      "Cadastro de serviços e preços",
      "Histórico de atendimentos"
    ]
  ],
  [
    "Hotelzinho",
    2,
    [
      "Painel do Hotelzinho",
      "Agenda e calendário de hospedagem",
      "Reservas",
      "Controle de ocupação",
      "Check-in e check-out",
      "Hóspedes ativos",
      "Acomodações",
      "Rotina e cuidados",
      "Itens e serviços extras na estadia",
      "Atualizações para os tutores"
    ]
  ],
  [
    "Financeiro, caixa e pagamentos",
    1,
    [
      "Controle financeiro básico",
      "Caixa básico"
    ]
  ],
  [
    "Financeiro, caixa e pagamentos",
    2,
    [
      "Painel financeiro completo",
      "Caixa geral da clínica",
      "Lançamentos de receitas e despesas",
      "Comandas",
      "Cobranças e pagamentos online",
      "Gestão das formas de pagamento",
      "Conciliação e acompanhamento dos recebimentos"
    ]
  ],
  [
    "Estoque e pet shop",
    2,
    [
      "Catálogo de produtos",
      "Catálogo de serviços",
      "Cadastro de preços",
      "Entradas de estoque",
      "Saídas de estoque",
      "Movimentações e ajustes",
      "Histórico de movimentações",
      "Gestão de produtos utilizados ou vendidos"
    ]
  ],
  [
    "Recursos Humanos (RH)",
    3,
    [
      "Registro de ponto (check-in e check-out)",
      "Controle das horas trabalhadas",
      "Banco de horas",
      "Controle de diárias",
      "Gestão de jornadas",
      "Pagamentos e remuneração da equipe",
      "Comissões da equipe",
      "Comissões por colaborador",
      "Gestão de usuários, cargos e permissões"
    ]
  ],
  [
    "Portal do Tutor",
    1,
    [
      "Acesso básico ao portal",
      "Consulta de animais vinculados",
      "Consulta de receitas e documentos",
      "Visualização de exames e laudos",
      "Cartão de vacinas e vermífugos"
    ]
  ],
  [
    "Portal do Tutor",
    2,
    [
      "Agendamento online pelo tutor",
      "Acesso a cobranças e pagamentos disponíveis",
      "Atualizações das estadias e serviços"
    ]
  ],
  [
    "CRM e relacionamento com clientes",
    2,
    [
      "Controle de retornos",
      "Lembretes de vacinas e vermífugos",
      "Aniversários e relacionamento",
      "Avisos e atualizações aos tutores"
    ]
  ],
  [
    "CRM e relacionamento com clientes",
    3,
    [
      "CRM com campanhas segmentadas",
      "Seleção de públicos por critérios",
      "Automação avançada de relacionamento",
      "Gestão avançada de campanhas e resultados"
    ]
  ],
  [
    "Administração e personalização",
    0,
    [
      "Temas e aparência básica",
      "Configurações essenciais da conta"
    ]
  ],
  [
    "Administração e personalização",
    2,
    [
      "Identidade visual e logo da clínica",
      "Site da clínica",
      "Gestão de usuários e permissões",
      "Configuração do Portal do Tutor"
    ]
  ],
  [
    "Administração e personalização",
    3,
    [
      "Domínio próprio personalizado",
      "Personalizações sob medida"
    ]
  ],
  [
    "Relatórios e inteligência de gestão",
    2,
    [
      "Indicadores financeiros operacionais"
    ]
  ],
  [
    "Relatórios e inteligência de gestão",
    3,
    [
      "Relatórios gerenciais avançados",
      "Análises de desempenho do negócio",
      "Indicadores e resultados de campanhas"
    ]
  ]
] as const;
export const BENEFICIOS_ORICSE: BeneficioOricse[] = GRUPOS.flatMap(([grupo, nivelMinimo, nomes]) =>
  nomes.map((nome) => ({ codigo: "", nome, grupo, nivelMinimo, ordem: 0 })),
).map((b, i) => ({ ...b, codigo: `beneficio.${String(i + 1).padStart(3, "0")}`, ordem: 2000 + i }));
if (BENEFICIOS_ORICSE.length !== 98) throw new Error("Catálogo ORICSE deve ter exatamente 98 benefícios.");
export const BENEFICIOS_POR_CODIGO = new Map(BENEFICIOS_ORICSE.map((b) => [b.codigo, b]));
export function permitidoNoNivel(codigo: string, nivel: number): boolean {
  const b = BENEFICIOS_POR_CODIGO.get(codigo);
  return Boolean(b && nivel >= b.nivelMinimo);
}
