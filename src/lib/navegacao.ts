/** Abas que só funcionam com plantão ativo. */
export const SO_COM_PLANTAO = ["/anamnese", "/curva", "/alarmes"];

/** Links do menu de cima. */
export const LINKS_TOPO = [
  { to: "/", rotulo: "Início", exato: true },
  { to: "/registros", rotulo: "Animais internados", exato: false },
  { to: "/anamnese", rotulo: "Anamnese", exato: false },
] as const;

/** Links do menu das três barrinhas. */
export const LINKS_MENU = [
  { to: "/pendencias", rotulo: "Pendências" },
  { to: "/medicacoes", rotulo: "Medicações" },
  { to: "/curva", rotulo: "Curva" },
  { to: "/alarmes", rotulo: "Alarmes" },
  { to: "/plantoes", rotulo: "Plantões" },
  { to: "/assinar", rotulo: "Assinar um documento" },
  { to: "/temas", rotulo: "Temas" },
  { to: "/sincronizacao", rotulo: "Sincronização" },
] as const;

/** Todo o app agrupado por assunto, para o menu das três barrinhas. */
export const GRUPOS_MENU = [
  {
    titulo: "No plantão",
    itens: [
      { to: "/", rotulo: "Início" },
      { to: "/registros", rotulo: "Animais internados" },
      { to: "/anamnese", rotulo: "Anamnese" },
      { to: "/curva", rotulo: "Curva" },
      { to: "/alarmes", rotulo: "Alarmes" },
    ],
  },
  {
    titulo: "Consultas e documentos",
    itens: [
      { to: "/pendencias", rotulo: "Pendências" },
      { to: "/medicacoes", rotulo: "Medicações" },
      { to: "/plantoes", rotulo: "Plantões" },
      { to: "/assinar", rotulo: "Assinar um documento" },
    ],
  },
  {
    titulo: "Ajustes",
    itens: [
      { to: "/temas", rotulo: "Temas e modo calmo" },
      { to: "/sincronizacao", rotulo: "Sincronização" },
    ],
  },
] as const;
