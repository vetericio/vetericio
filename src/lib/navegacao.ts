/** Abas que só funcionam com plantão ativo. */
export const SO_COM_PLANTAO = ["/anamnese", "/curva", "/alarmes", "/pendencias"];

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
