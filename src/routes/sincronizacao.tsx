import { createFileRoute } from "@tanstack/react-router";

import { Backup } from "@/components/Backup";

export const Route = createFileRoute("/sincronizacao")({
  head: () => ({
    meta: [
      { title: "Sincronização e backup — Veterício" },
      {
        name: "description",
        content:
          "Faça o backup completo do Veterício e sincronize os dados entre dois aparelhos com código ou QR.",
      },
      { property: "og:title", content: "Sincronização e backup — Veterício" },
      {
        property: "og:description",
        content: "Backup completo e sincronização entre aparelhos do Veterício.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaSincronizacao,
});

function PaginaSincronizacao() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-10 pt-2">
      <h1 className="mb-1 text-center text-lg font-bold text-foreground">Sincronização</h1>
      <p className="mb-4 text-center text-[11px] text-muted-foreground">
        Backup completo e ligação entre aparelhos.
      </p>
      <Backup mostrarBotao={false} sempreAberto semAuto />
    </main>
  );
}
