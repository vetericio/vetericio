import { createFileRoute } from "@tanstack/react-router";

import { AssinarDocumento } from "@/components/AssinarDocumento";

export const Route = createFileRoute("/assinar")({
  head: () => ({
    meta: [
      { title: "Assinar um documento — Veterício" },
      {
        name: "description",
        content:
          "Assine e carimbe documentos no próprio aparelho: suba um PDF ou foto, posicione a assinatura e salve o PDF assinado.",
      },
      { property: "og:title", content: "Assinar um documento — Veterício" },
      {
        property: "og:description",
        content: "Assinatura e carimbo em PDF ou foto, offline, direto no aparelho.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaAssinar,
});

function PaginaAssinar() {
  return (
    <main>
      <h1 className="sr-only">Assinar um documento</h1>
      <AssinarDocumento />
    </main>
  );
}
