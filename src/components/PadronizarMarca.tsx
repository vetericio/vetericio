import { useEffect } from "react";

const TROCAS: Array<[RegExp, string]> = [
  [/Veterício/g, "Oricse"],
  [/VETERÍCIO/g, "ORICSE"],
  [/Vetericio/g, "Oricse"],
  [/VETERICIO/g, "ORICSE"],
  [/\bOryx\b/g, "Oricse"],
  [/\bORYX\b/g, "ORICSE"],
];

function trocarMarca(texto: string): string {
  return TROCAS.reduce((valor, [busca, troca]) => valor.replace(busca, troca), texto);
}

function padronizarNo(root: Document | Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textos: Text[] = [];
  let atual = walker.nextNode();
  while (atual) {
    textos.push(atual as Text);
    atual = walker.nextNode();
  }

  for (const no of textos) {
    const original = no.nodeValue ?? "";
    const novo = trocarMarca(original);
    if (novo !== original) no.nodeValue = novo;
  }

  if (root instanceof Element) {
    for (const atributo of ["title", "aria-label", "placeholder", "alt"]) {
      const valor = root.getAttribute(atributo);
      if (valor) root.setAttribute(atributo, trocarMarca(valor));
    }
  }

  root.querySelectorAll("[title], [aria-label], [placeholder], [alt]").forEach((el) => {
    for (const atributo of ["title", "aria-label", "placeholder", "alt"]) {
      const valor = el.getAttribute(atributo);
      if (valor) el.setAttribute(atributo, trocarMarca(valor));
    }
  });
}

function padronizarMetadados() {
  document.title = trocarMarca(document.title);
  document.querySelectorAll("meta[content]").forEach((meta) => {
    const valor = meta.getAttribute("content");
    if (valor) meta.setAttribute("content", trocarMarca(valor));
  });
}

export function PadronizarMarca() {
  useEffect(() => {
    padronizarNo(document.documentElement);
    padronizarMetadados();

    const observer = new MutationObserver((mutacoes) => {
      for (const mutacao of mutacoes) {
        if (mutacao.type === "characterData") {
          const no = mutacao.target as Text;
          const original = no.nodeValue ?? "";
          const novo = trocarMarca(original);
          if (novo !== original) no.nodeValue = novo;
          continue;
        }
        mutacao.addedNodes.forEach((no) => {
          if (no.nodeType === Node.TEXT_NODE) {
            const texto = no as Text;
            const original = texto.nodeValue ?? "";
            const novo = trocarMarca(original);
            if (novo !== original) texto.nodeValue = novo;
          } else if (no instanceof Element) {
            padronizarNo(no);
          }
        });
      }
      padronizarMetadados();
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
