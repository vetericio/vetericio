import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/venda-expressa")({
  head: () => ({ meta: [{ title: "Venda Expressa — ORICSE" }] }),
  component: VendaExpressa,
});

function VendaExpressa() {
  return (
    <main className="mx-auto flex min-h-[65vh] w-full max-w-4xl flex-col px-4 py-8 sm:px-6">
      <Link
        to="/inicio"
        className="inline-flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <ArrowLeft size={16} />
        Voltar ao início
      </Link>
      <section className="my-auto flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-card px-6 py-14 text-center shadow-sm sm:py-20">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShoppingCart size={32} aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Venda Expressa
        </h1>
        <p className="mt-3 text-lg font-semibold text-primary">Em breve</p>
      </section>
    </main>
  );
}
