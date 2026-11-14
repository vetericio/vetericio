import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProtegidoPorSenha } from "@/components/ProtegidoPorSenha";
import { Receituario } from "@/components/Receituario";
export const Route = createFileRoute("/receituario")({
  head: () => ({
    meta: [
      { title: "Receituário — Oricse" },
      { name: "description", content: "Receituário veterinário em PDF com assinatura e carimbo." },
      { property: "og:title", content: "Receituário — Oricse" },
      { property: "og:description", content: "Receituário veterinário em PDF com assinatura e carimbo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaReceituario,
});

function PaginaReceituario() {
  const [temAnimal, setTemAnimal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTemAnimal(Boolean(params.get("animalId")));
  }, []);

  return (
    <ProtegidoPorSenha area="receituario" titulo="Receituário protegido">
      {temAnimal && (
        <a href={"/termos" + window.location.search}
          className="mx-auto mb-4 flex min-h-11 w-full max-w-3xl items-center justify-center rounded-xl border bg-card px-4 text-sm font-semibold text-primary hover:bg-secondary">
          Criar pedido, termo ou documento com modelo da clínica
        </a>
      )}
      <Receituario />
    </ProtegidoPorSenha>
  );
}
