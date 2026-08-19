import { createFileRoute } from "@tanstack/react-router";
import { Alarmes } from "@/components/Alarmes";

export const Route = createFileRoute("/alarmes")({
  head: () => ({
    meta: [
      { title: "Alarmes do plantão — Veterício" },
      {
        name: "description",
        content:
          "Central de alarmes do plantão: jejum dos animais, alarmes personalizados e 12 músicas geradas no próprio aparelho.",
      },
      { property: "og:title", content: "Alarmes do plantão — Veterício" },
      {
        property: "og:description",
        content: "Crie alarmes do plantão com 12 músicas e repetição diária ou por intervalo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaginaAlarmes,
});

function PaginaAlarmes() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-5">
      <h2 className="font-display text-xl font-semibold text-foreground">Alarmes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        O alarme de <strong>jejum dos animais (00h)</strong> liga sozinho quando o plantão é
        noturno. Você pode criar quantos alarmes quiser e escolher entre 12 músicas.
      </p>
      <div className="mt-4">
        <Alarmes />
      </div>
    </main>
  );
}
