export const SO_COM_PLANTAO = ["/anamnese", "/curva", "/alarmes", "/medicacoes", "/pendencias"];

export const LINKS_TOPO = [
  { to: "/", rotulo: "Plantão", exato: true },
  { to: "/registros", rotulo: "Animais internados", exato: false },
  { to: "/anamnese", rotulo: "Anamnese", exato: false },
] as const;

export const LINKS_MENU = [
  { to: "/", rotulo: "Plantão" },
  { to: "/consultorio", rotulo: "Consultório" },
  { to: "/recepcao", rotulo: "Recepção" },
  { to: "/financeiro", rotulo: "Financeiro" },
  { to: "/estoque", rotulo: "Serviços / Estoque" },
] as const;

export const GRUPOS_MENU = [
  { titulo: "Internação", itens: [
    { to: "/", rotulo: "Iniciar um Plantão" }, { to: "/", rotulo: "Plantão" }, { to: "/anamnese", rotulo: "Anamnese" },
    { to: "/curva", rotulo: "Curva" }, { to: "/alarmes", rotulo: "Alarmes" }, { to: "/medicacoes", rotulo: "Medicações" },
    { to: "/pendencias", rotulo: "Pendências" }, { to: "/plantoes", rotulo: "Histórico de plantões" },
  ] },
  { titulo: "Consultório", itens: [
    { to: "/consultorio", rotulo: "Consultas" }, { to: "/consultorio", rotulo: "Pesquisar animais" }, { to: "/consultorio", rotulo: "Pesquisar tutores" },
    { to: "/consultorio", rotulo: "Termos e documentos" }, { to: "/assinar", rotulo: "Assinar um documento" }, { to: "/receituario", rotulo: "Receituário avulso" },
  ] },
  { titulo: "Recepção", itens: [
    { to: "/recepcao", rotulo: "Adicionar / consultar tutor" }, { to: "/recepcao", rotulo: "Adicionar / consultar animal" }, { to: "/recepcao", rotulo: "Fila de espera" },
    { to: "/recepcao", rotulo: "Novo agendamento" }, { to: "/recepcao", rotulo: "Aniversariante do dia" }, { to: "/recepcao", rotulo: "Reforços próximos" }, { to: "/recepcao", rotulo: "Retornos próximos" },
  ] },
  { titulo: "Financeiro", itens: [
    { to: "/financeiro", rotulo: "Caixa do dia" }, { to: "/financeiro", rotulo: "Caixa do mês" }, { to: "/financeiro", rotulo: "Caixa total" }, { to: "/financeiro", rotulo: "Financeiro dos tutores" },
    { to: "/financeiro", rotulo: "Contas a receber" }, { to: "/financeiro", rotulo: "Despesas" }, { to: "/financeiro", rotulo: "Lançamentos" }, { to: "/financeiro", rotulo: "Relatórios" },
  ] },
  { titulo: "Serviços / Estoque", itens: [
    { to: "/estoque", rotulo: "Serviços" }, { to: "/estoque", rotulo: "Produtos" }, { to: "/estoque", rotulo: "Entrada de produtos" }, { to: "/estoque", rotulo: "Saída de produtos" },
    { to: "/estoque", rotulo: "Estoque atual" }, { to: "/estoque", rotulo: "Estoque baixo" }, { to: "/estoque", rotulo: "Produtos próximos do vencimento" }, { to: "/estoque", rotulo: "Fornecedores" }, { to: "/estoque", rotulo: "Histórico de movimentações" },
  ] },
  { titulo: "Configurações", itens: [{ to: "/temas", rotulo: "Temas" }, { to: "/sincronizacao", rotulo: "Sincronização" }] },
] as const;
