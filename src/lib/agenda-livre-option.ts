const VALOR_LIVRE = "__oricse_livre__";

function textoDoElemento(elemento: Element | null) {
  return (elemento?.textContent || "").replace(/\s+/g, " ").trim();
}

function encontrarBotaoLiberar(select: HTMLSelectElement) {
  const modal = select.closest("div.fixed") || select.closest("[role='dialog']") || document.body;
  return Array.from(modal.querySelectorAll<HTMLButtonElement>("button")).find((botao) => textoDoElemento(botao) === "Liberar agenda") || null;
}

function encontrarBotaoFechar(select: HTMLSelectElement) {
  const modal = select.closest("div.fixed") || select.closest("[role='dialog']") || document.body;
  return Array.from(modal.querySelectorAll<HTMLButtonElement>("button")).find((botao) => {
    const aria = botao.getAttribute("aria-label")?.toLowerCase() || "";
    const titulo = botao.getAttribute("title")?.toLowerCase() || "";
    return aria.includes("fechar") || titulo.includes("fechar");
  }) || null;
}

function ehSeletorTipo(select: HTMLSelectElement) {
  const label = select.closest("label");
  if (!label) return false;
  const texto = textoDoElemento(label).toLowerCase();
  return texto.startsWith("tipo") && Array.from(select.options).some((opcao) => opcao.value === "Bloqueio de agenda");
}

function prepararSeletor(select: HTMLSelectElement) {
  if (!ehSeletorTipo(select)) return;

  const botaoLiberar = encontrarBotaoLiberar(select);
  const existeEvento = Boolean(botaoLiberar);

  const opcaoExistente = Array.from(select.options).find((opcao) => opcao.value === VALOR_LIVRE);
  if (!existeEvento) {
    opcaoExistente?.remove();
    return;
  }

  if (!opcaoExistente) {
    const opcao = document.createElement("option");
    opcao.value = VALOR_LIVRE;
    opcao.textContent = "Livre";
    select.insertBefore(opcao, select.firstChild);
  }

  if (select.dataset.oricseLivreConfigurado === "1") return;
  select.dataset.oricseLivreConfigurado = "1";

  select.addEventListener("change", (evento) => {
    if (select.value !== VALOR_LIVRE) return;

    evento.preventDefault();
    evento.stopPropagation();
    evento.stopImmediatePropagation();

    const liberar = encontrarBotaoLiberar(select);
    if (liberar) {
      liberar.click();
      return;
    }

    encontrarBotaoFechar(select)?.click();
  }, true);
}

function prepararAtalhoCaixa() {
  if (window.location.pathname !== "/recepcao") return;

  const titulos = Array.from(document.querySelectorAll<HTMLElement>("h2"));
  const titulo = titulos.find((elemento) => textoDoElemento(elemento) === "Novo agendamento");
  if (!titulo) return;

  const card = titulo.closest<HTMLElement>("button, a");
  if (!card) return;

  titulo.textContent = "Caixa";
  const subtitulo = titulo.parentElement?.querySelector<HTMLElement>("p");
  if (subtitulo) subtitulo.textContent = "Movimentações e fechamento";

  if (card.dataset.oricseCaixaConfigurado === "1") return;
  card.dataset.oricseCaixaConfigurado = "1";
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", "Abrir caixa");
  card.addEventListener("click", (evento) => {
    evento.preventDefault();
    window.location.href = "/financeiro";
  });
}

function varrer() {
  document.querySelectorAll<HTMLSelectElement>("select").forEach(prepararSeletor);
  prepararAtalhoCaixa();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const iniciar = () => {
    varrer();
    const observer = new MutationObserver(varrer);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
}