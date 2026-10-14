import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({ meta: [{ title: "Termos de Serviço | Oricse" }] }),
  component: TermosDeUso,
});

function TermosDeUso() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Termos de Serviço</h1>
      <p className="mt-4 text-muted-foreground">Conteúdo em elaboração.</p>
    </main>
  );
}
