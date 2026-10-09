import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileSignature, PawPrint, Search, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/consultorio")({ component: Consultorio });

function Consultorio() {
  const itens = [["Consultas", "Fila recebida da Recepção", Stethoscope], ["Pesquisar animais", "Histórico e prontuários", PawPrint], ["Pesquisar tutores", "Cadastro e atendimentos", Search], ["Termos e documentos", "Documentos da clínica", FileSignature]] as const;
  return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6"><Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link><p className="text-sm font-semibold uppercase tracking-wider text-primary">Atendimento</p><h1 className="mt-1 text-3xl font-bold">Consultório</h1><p className="mt-1 text-muted-foreground">Consultas, prontuários e documentos.</p><section className="mt-7 grid gap-3 sm:grid-cols-2">{itens.map(([titulo, texto, Icone]) => <button key={titulo} className="rounded-2xl border bg-card p-5 text-left shadow-sm"><Icone className="mb-4 text-primary" size={24}/><h2 className="font-semibold">{titulo}</h2><p className="mt-1 text-sm text-muted-foreground">{texto}</p></button>)}</section><div className="mt-5 grid gap-3 sm:grid-cols-2"><Link to="/receituario" className="rounded-2xl border p-5 font-semibold">Receituário avulso</Link><Link to="/assinar" className="rounded-2xl border p-5 font-semibold">Assinar um documento</Link></div></main>;
}
