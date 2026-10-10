import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileSignature, PawPrint, Search, Stethoscope } from "lucide-react";
import { AgendaDayBoard } from "@/components/agenda/AgendaDayBoard";

export const Route = createFileRoute("/consultorio")({ component: Consultorio });

function Consultorio() {
  const itens = [
    ["Consultas", "Fila recebida da Recepção", Stethoscope],
    ["Pesquisar animais", "Histórico e prontuários", PawPrint],
    ["Pesquisar tutores", "Cadastro e atendimentos", Search],
    ["Termos e documentos", "Documentos da clínica", FileSignature],
  ] as const;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 pb-28 pt-6 sm:px-6">
      <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Atendimento</p>
          <h1 className="mt-1 text-3xl font-bold">Veterinário</h1>
          <p className="mt-1 text-muted-foreground">Sua agenda clínica, fila de consultas, prontuários e documentos.</p>
        </div>
        <button type="button" className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground">Abrir próximo atendimento</button>
      </div>

      <div className="mt-6">
        <AgendaDayBoard mode="veterinario" />
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {itens.map(([titulo, texto, Icone]) => (
          <button key={titulo} className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Icone className="text-primary" size={20}/></div>
            <h2 className="mt-3 font-semibold">{titulo}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
          </button>
        ))}
      </section>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Link to="/receituario" className="rounded-2xl border bg-white p-4 font-semibold shadow-sm hover:border-primary">Receituário avulso</Link>
        <Link to="/assinar" className="rounded-2xl border bg-white p-4 font-semibold shadow-sm hover:border-primary">Assinar um documento</Link>
      </div>
    </main>
  );
}
