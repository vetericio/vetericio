import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, CalendarDays, ClipboardList, CreditCard, Package, Users, Wallet } from "lucide-react";

export const Route = createFileRoute("/financeiro")({
  component: Financeiro,
});

const opcoes = [
  { titulo: "Caixa do dia", texto: "Movimentações de hoje e fechamento manual", icone: Wallet, cor: "bg-emerald-500/15 text-emerald-600" },
  { titulo: "Caixa do mês", texto: "Resumo mensal e fechamento automático", icone: CalendarDays, cor: "bg-blue-500/15 text-blue-600" },
  { titulo: "Caixa total", texto: "Visão acumulada de toda a clínica", icone: BarChart3, cor: "bg-violet-500/15 text-violet-600" },
  { titulo: "Financeiro dos tutores", texto: "Pagamentos, pendências e histórico", icone: Users, cor: "bg-orange-500/15 text-orange-600" },
  { titulo: "Contas a receber", texto: "Acompanhe valores pendentes", icone: CreditCard, cor: "bg-rose-500/15 text-rose-600" },
  { titulo: "Lançamentos", texto: "Entradas, saídas e ajustes", icone: ClipboardList, cor: "bg-cyan-500/15 text-cyan-600" },
];

function Financeiro() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6">
      <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18} /> Voltar</Link>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div><p className="text-sm font-semibold uppercase tracking-wider text-primary">Atendimento</p><h1 className="text-3xl font-bold tracking-tight">Financeiro</h1><p className="mt-1 text-muted-foreground">Controle financeiro da clínica</p></div>
        <Link to="/estoque" className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"><Package size={18} /> Estoque</Link>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {opcoes.map(({ titulo, texto, icone: Icone, cor }) => <button key={titulo} className="rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${cor}`}><Icone size={22} /></span><h2 className="font-semibold">{titulo}</h2><p className="mt-1 text-sm text-muted-foreground">{texto}</p></button>)}
      </section>
      <section className="mt-6 rounded-2xl border bg-card p-5"><h2 className="font-semibold">Resumo de hoje</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Recebido", "R$ 0,00"], ["Pendente", "R$ 0,00"], ["Despesas", "R$ 0,00"], ["Líquido", "R$ 0,00"]].map(([label, valor]) => <div key={label} className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold">{valor}</p></div>)}</div></section>
    </main>
  );
}
