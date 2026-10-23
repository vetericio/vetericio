import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/configuracao-site")({ component: ConfiguracaoSite });

function ConfiguracaoSite() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <Link
        to="/inicio"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Voltar
      </Link>
      <header className="mb-5 mt-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
          Configurações
        </p>
        <h1 className="mt-1 text-2xl font-bold">Portal do Tutor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalize as informações e os recursos disponíveis para os tutores da clínica.
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold text-foreground">
          Personalização do Portal do Tutor
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure a mensagem de boas-vindas, os contatos, as orientações de agendamento
          e as seções exibidas aos tutores.
        </p>
        <Link
          to="/configurar-portal-tutor"
          className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
        >
          Configurar Portal do Tutor
        </Link>
      </section>
    </main>
  );
}
