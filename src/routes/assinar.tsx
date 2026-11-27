import { useDemoAlvorada } from "@/lib/demo-alvorada-context";
import { AVISO_DEMO_DOCUMENTOS } from "@/lib/demo-alvorada";
import { createFileRoute } from "@tanstack/react-router";

import { AssinarDocumento } from "@/components/AssinarDocumento";
import { ProtegidoPorSenha } from "@/components/ProtegidoPorSenha";

export const Route = createFileRoute("/assinar")({
  head: () => ({
    meta: [
      { title: "Aplicar imagem de assinatura ou carimbo — Oricse" },
      {
        name: "description",
        content:
          "Insira uma imagem de assinatura ou carimbo em um PDF ou foto. Este editor não realiza assinatura digital.",
      },
      { property: "og:title", content: "Aplicar imagem de assinatura ou carimbo — Oricse" },
      {
        property: "og:description",
        content: "Aplique as imagens de assinatura e carimbo do seu perfil a um PDF ou foto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaAssinar,
});

function PaginaAssinar() {
  const demoAlvorada = useDemoAlvorada();
  if (demoAlvorada) return <p className="mx-auto max-w-xl p-6 text-center">{AVISO_DEMO_DOCUMENTOS}</p>;
  return (
    <ProtegidoPorSenha area="assinar" titulo="Editor de imagem de assinatura protegido">
      <main>
        <h1 className="sr-only">Aplicar imagem de assinatura ou carimbo</h1>
        <AssinarDocumento />
      </main>
    </ProtegidoPorSenha>
  );
}
