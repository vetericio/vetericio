import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Política de Privacidade | Oricse" }] }),
  component: Privacidade,
});

function Privacidade() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Política de Privacidade</h1>
      <p className="mt-4 text-muted-foreground">Conteúdo em elaboração.</p>
    </main>
  );
}
