import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Boxes, PackagePlus, Plus, Wrench } from "lucide-react";

export const Route = createFileRoute("/estoque")({ component: Estoque });

function Estoque() {
  return <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6">
    <Link to="/financeiro" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18} /> Financeiro</Link>
    <div className="mb-6 flex items-center justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-primary">Atendimento</p><h1 className="text-3xl font-bold tracking-tight">Estoque</h1><p className="mt-1 text-muted-foreground">Produtos controlam estoque; serviços não.</p></div><button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"><Plus size={18}/> Novo item</button></div>
    <div className="grid gap-4 sm:grid-cols-2"><section className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-500/15 p-3 text-emerald-600"><PackagePlus size={22}/></span><div><h2 className="font-semibold">Produtos</h2><p className="text-sm text-muted-foreground">Medicamentos e materiais com quantidade, lote e validade.</p></div></div><button className="mt-5 w-full rounded-xl border px-4 py-3 text-sm font-semibold">Gerenciar produtos</button></section><section className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-3"><span className="rounded-xl bg-blue-500/15 p-3 text-blue-600"><Wrench size={22}/></span><div><h2 className="font-semibold">Serviços</h2><p className="text-sm text-muted-foreground">Consultas e procedimentos sem controle de estoque.</p></div></div><button className="mt-5 w-full rounded-xl border px-4 py-3 text-sm font-semibold">Gerenciar serviços</button></section></div>
    <section className="mt-5 rounded-2xl border bg-card p-5"><div className="flex items-center gap-3"><Boxes className="text-primary"/><div><h2 className="font-semibold">Alertas do estoque</h2><p className="text-sm text-muted-foreground">Produtos abaixo do mínimo ou próximos do vencimento aparecerão aqui.</p></div></div><div className="mt-5 rounded-xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">Nenhum alerta no momento.</div></section>
  </main>;
}
