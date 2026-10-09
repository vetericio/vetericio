import { createFileRoute } from "@tanstack/react-router";
import { ProtegidoPorSenha } from "@/components/ProtegidoPorSenha";
import { Receituario } from "@/components/Receituario";

export const Route = createFileRoute("/receituario")({
  head: () => ({
    meta: [
      { title: "Receituário — Oricse" },
      {
        name: "description",
        content: "Receituário veterinário em PDF com assinatura e carimbo.",
      },
      { property: "og:title", content: "Receituário — Oricse" },
      {
        property: "og:description",
        content: "Receituário veterinário em PDF com assinatura e carimbo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaReceituario,
});

function PaginaReceituario() {
  return (
    <ProtegidoPorSenha area="receituario" titulo="Receituário protegido">
      <Receituario />
    </ProtegidoPorSenha>
  );
}
