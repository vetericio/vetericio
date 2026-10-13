import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, CalendarDays, ClipboardList, CreditCard, Package, Plus, Search, Trash2, Users, Wallet, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

export const Route = createFileRoute("/financeiro")({ component: Financeiro });

const LANCAMENTOS_KEY = "oricse-financeiro-lancamentos-v1";

type TipoLancamento = "Entrada" | "Saída";
type StatusLancamento = "Pago" | "Pendente";

type Lancamento = {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  formaPagamento: string;
  tutor?: string;
  status: StatusLancamento;
  observacao?: string;
};

type Aba = "inicio" | "dia" | "mes" | "total" | "tutores" | "receber" | "lancamentos";

const opcoes = [
  { id: "dia" as Aba, titulo: "Caixa do dia", texto: "Movimentações de hoje e fechamento manual", icone: Wallet, cor: "bg-emerald-500/15 text-emerald-600" },
  { id: "mes" as Aba, titulo: "Caixa do mês", texto: "Resumo mensal e fechamento automático", icone: CalendarDays, cor: "bg-blue-500/15 text-blue-600" },
  { id: "total" as Aba, titulo: "Caixa total", texto: "Visão acumulada de toda a clínica", icone: BarChart3, cor: "bg-violet-500/15 text-violet-600" },
  { id: "tutores" as Aba, titulo: "Financeiro dos tutores", texto: "Pagamentos, pendências e histórico", icone: Users, cor: "bg-orange-500/15 text-orange-600" },
  { id: "receber" as Aba, titulo: "Contas a receber", texto: "Acompanhe valores pendentes", icone: CreditCard, cor: "bg-rose-500/15 text-rose-600" },
  { id: "lancamentos" as Aba, titulo: "Lançamentos", texto: "Entradas, saídas e ajustes", icone: ClipboardList, cor: "bg-cyan-500/15 text-cyan-600" },
];

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function mesAtualISO() { return new Date().toISOString().slice(0, 7); }
function dinheiro(valor: number) { return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function lerLancamentos(): Lancamento[] {
  if (typeof window === "undefined") return [];
  try {
    const dados = JSON.parse(localStorage.getItem(LANCAMENTOS_KEY) || "[]");
    return Array.isArray(dados) ? dados : [];
  } catch { return []; }
}

function Financeiro() {
  const [aba, setAba] = useState<Aba>("inicio");
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(lerLancamentos);
  const [buscaTutor, setBuscaTutor] = useState("");
  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState({
    tipo: "Entrada" as TipoLancamento,
    descricao: "",
    categoria: "Consulta",
    valor: "",
    data: hojeISO(),
    formaPagamento: "Pix",
    tutor: "",
    status: "Pago" as StatusLancamento,
    observacao: "",
  });

  function persistir(lista: Lancamento[]) {
    setLancamentos(lista);
    localStorage.setItem(LANCAMENTOS_KEY, JSON.stringify(lista));
  }

  function salvarLancamento(evento: FormEvent) {
    evento.preventDefault();
    const valor = Number(String(form.valor).replace(".", "").replace(",", "."));
    if (!form.descricao.trim() || !Number.isFinite(valor) || valor <= 0) return;
    const novo: Lancamento = {
      id: crypto.randomUUID(), tipo: form.tipo, descricao: form.descricao.trim(), categoria: form.categoria,
      valor, data: form.data, formaPagamento: form.formaPagamento, tutor: form.tutor.trim() || undefined,
      status: form.status, observacao: form.observacao.trim() || undefined,
    };
    persistir([novo, ...lancamentos]);
    setForm({ tipo: "Entrada", descricao: "", categoria: "Consulta", valor: "", data: hojeISO(), formaPagamento: "Pix", tutor: "", status: "Pago", observacao: "" });
    setFormAberto(false);
  }

  function remover(id: string) { persistir(lancamentos.filter((item) => item.id !== id)); }
  function darBaixa(id: string) { persistir(lancamentos.map((item) => item.id === id ? { ...item, status: "Pago" } : item)); }

  const doDia = useMemo(() => lancamentos.filter((l) => l.data === hojeISO()), [lancamentos]);
  const doMes = useMemo(() => lancamentos.filter((l) => l.data.startsWith(mesAtualISO())), [lancamentos]);
  const entradasDia = doDia.filter((l) => l.tipo === "Entrada" && l.status === "Pago").reduce((s, l) => s + l.valor, 0);
  const saidasDia = doDia.filter((l) => l.tipo === "Saída" && l.status === "Pago").reduce((s, l) => s + l.valor, 0);
  const pendenteDia = doDia.filter((l) => l.tipo === "Entrada" && l.status === "Pendente").reduce((s, l) => s + l.valor, 0);
  const recebidoMes = doMes.filter((l) => l.tipo === "Entrada" && l.status === "Pago").reduce((s, l) => s + l.valor, 0);
  const despesasMes = doMes.filter((l) => l.tipo === "Saída" && l.status === "Pago").reduce((s, l) => s + l.valor, 0);
  const recebidoTotal = lancamentos.filter((l) => l.tipo === "Entrada" && l.status === "Pago").reduce((s, l) => s + l.valor, 0);
  const despesasTotal = lancamentos.filter((l) => l.tipo === "Saída" && l.status === "Pago").reduce((s, l) => s + l.valor, 0);
  const contasReceber = lancamentos.filter((l) => l.tipo === "Entrada" && l.status === "Pendente");

  const tutores = useMemo(() => {
    const mapa = new Map<string, { tutor: string; pago: number; pendente: number; movimentos: number }>();
    lancamentos.filter((l) => l.tutor).forEach((l) => {
      const nome = l.tutor!;
      const atual = mapa.get(nome) || { tutor: nome, pago: 0, pendente: 0, movimentos: 0 };
      atual.movimentos += 1;
      if (l.tipo === "Entrada") {
        if (l.status === "Pago") atual.pago += l.valor; else atual.pendente += l.valor;
      }
      mapa.set(nome, atual);
    });
    return [...mapa.values()].filter((t) => t.tutor.toLowerCase().includes(buscaTutor.toLowerCase())).sort((a, b) => a.tutor.localeCompare(b.tutor, "pt-BR"));
  }, [lancamentos, buscaTutor]);

  const resumo = [
    ["Recebido", dinheiro(entradasDia)], ["Pendente", dinheiro(pendenteDia)], ["Despesas", dinheiro(saidasDia)], ["Líquido", dinheiro(entradasDia - saidasDia)],
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        {aba === "inicio" ? <Link to="/inicio" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link> : <button onClick={() => setAba("inicio")} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Financeiro</button>}
        <Link to="/estoque" className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"><Package size={18}/> Estoque</Link>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold uppercase tracking-wider text-primary">Atendimento</p><h1 className="text-3xl font-bold tracking-tight">{aba === "inicio" ? "Financeiro" : opcoes.find((o) => o.id === aba)?.titulo}</h1><p className="mt-1 text-muted-foreground">{aba === "inicio" ? "Controle financeiro da clínica" : opcoes.find((o) => o.id === aba)?.texto}</p></div>
        {aba === "lancamentos" && <button onClick={() => setFormAberto(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><Plus size={18}/> Novo lançamento</button>}
      </div>

      {aba === "inicio" && <>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{opcoes.map(({ id, titulo, texto, icone: Icone, cor }) => <button key={titulo} onClick={() => setAba(id)} className="rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"><span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${cor}`}><Icone size={22}/></span><h2 className="font-semibold">{titulo}</h2><p className="mt-1 text-sm text-muted-foreground">{texto}</p></button>)}</section>
        <section className="mt-6 rounded-2xl border bg-card p-5"><h2 className="font-semibold">Resumo de hoje</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{resumo.map(([label, valor]) => <div key={label} className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold">{valor}</p></div>)}</div></section>
      </>}

      {aba === "dia" && <ModuloCaixa titulo="Movimentações de hoje" lista={doDia} recebido={entradasDia} despesas={saidasDia} pendente={pendenteDia} onRemover={remover}/>} 
      {aba === "mes" && <ModuloResumo lista={doMes} recebido={recebidoMes} despesas={despesasMes} titulo="Resumo do mês atual"/>}
      {aba === "total" && <ModuloResumo lista={lancamentos} recebido={recebidoTotal} despesas={despesasTotal} titulo="Visão acumulada"/>}

      {aba === "tutores" && <section className="space-y-4"><div className="relative"><Search className="absolute left-3 top-3.5 text-muted-foreground" size={18}/><input value={buscaTutor} onChange={(e) => setBuscaTutor(e.target.value)} placeholder="Buscar tutor" className="w-full rounded-xl border bg-card py-3 pl-10 pr-4 outline-none focus:border-primary"/></div><div className="grid gap-3 md:grid-cols-2">{tutores.length ? tutores.map((t) => <div key={t.tutor} className="rounded-2xl border bg-card p-4"><h3 className="font-bold">{t.tutor}</h3><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><p className="text-muted-foreground">Pago</p><strong>{dinheiro(t.pago)}</strong></div><div><p className="text-muted-foreground">Pendente</p><strong>{dinheiro(t.pendente)}</strong></div><div><p className="text-muted-foreground">Mov.</p><strong>{t.movimentos}</strong></div></div></div>) : <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Nenhum tutor com movimentação financeira.</div>}</div></section>}

      {aba === "receber" && <section className="rounded-2xl border bg-card overflow-hidden">{contasReceber.length ? contasReceber.map((l) => <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0"><div><strong>{l.descricao}</strong><p className="text-sm text-muted-foreground">{l.tutor || "Sem tutor"} · {new Date(`${l.data}T12:00:00`).toLocaleDateString("pt-BR")}</p></div><div className="flex items-center gap-3"><strong>{dinheiro(l.valor)}</strong><button onClick={() => darBaixa(l.id)} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Dar baixa</button></div></div>) : <div className="p-10 text-center text-muted-foreground">Nenhuma conta pendente.</div>}</section>}

      {aba === "lancamentos" && <section className="rounded-2xl border bg-card overflow-hidden">{lancamentos.length ? lancamentos.map((l) => <div key={l.id} className="grid gap-2 border-b p-4 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><strong>{l.descricao}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${l.status === "Pago" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{l.status}</span></div><p className="text-sm text-muted-foreground">{l.categoria} · {l.formaPagamento}{l.tutor ? ` · ${l.tutor}` : ""} · {new Date(`${l.data}T12:00:00`).toLocaleDateString("pt-BR")}</p></div><strong className={l.tipo === "Saída" ? "text-rose-600" : "text-emerald-700"}>{l.tipo === "Saída" ? "− " : "+ "}{dinheiro(l.valor)}</strong><button onClick={() => remover(l.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Excluir"><Trash2 size={17}/></button></div>) : <div className="p-10 text-center text-muted-foreground">Nenhum lançamento registrado.</div>}</section>}

      {formAberto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onMouseDown={(e) => { if (e.currentTarget === e.target) setFormAberto(false); }}><form onSubmit={salvarLancamento} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-primary">Financeiro</p><h2 className="text-2xl font-black">Novo lançamento</h2></div><button type="button" onClick={() => setFormAberto(false)} className="rounded-lg p-2 hover:bg-muted"><X size={20}/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Campo label="Tipo"><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoLancamento })} className="input"><option>Entrada</option><option>Saída</option></select></Campo><Campo label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusLancamento })} className="input"><option>Pago</option><option>Pendente</option></select></Campo><Campo label="Descrição"><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="input" placeholder="Ex.: Consulta Luna"/></Campo><Campo label="Categoria"><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="input"><option>Consulta</option><option>Vacina</option><option>Cirurgia</option><option>Banho e Tosa</option><option>Internação</option><option>Produto</option><option>Despesa</option><option>Ajuste</option><option>Outro</option></select></Campo><Campo label="Valor"><input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="input" inputMode="decimal" placeholder="0,00"/></Campo><Campo label="Data"><input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="input"/></Campo><Campo label="Forma de pagamento"><select value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })} className="input"><option>Pix</option><option>Dinheiro</option><option>Cartão de débito</option><option>Cartão de crédito</option><option>Transferência</option><option>Boleto</option><option>Outro</option></select></Campo><Campo label="Tutor"><input value={form.tutor} onChange={(e) => setForm({ ...form, tutor: e.target.value })} className="input" placeholder="Opcional"/></Campo></div><Campo label="Observação"><textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="input min-h-24"/></Campo><button className="mt-5 w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground">Salvar lançamento</button></form></div>}
    </main>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold">{label}<div className="mt-1">{children}</div></label>; }

function ModuloCaixa({ titulo, lista, recebido, despesas, pendente, onRemover }: { titulo: string; lista: Lancamento[]; recebido: number; despesas: number; pendente: number; onRemover: (id: string) => void }) {
  return <section><div className="grid gap-3 sm:grid-cols-4">{[["Recebido", recebido], ["Pendente", pendente], ["Despesas", despesas], ["Líquido", recebido - despesas]].map(([r, v]) => <div key={String(r)} className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{r}</p><p className="mt-1 text-xl font-black">{dinheiro(Number(v))}</p></div>)}</div><div className="mt-5 rounded-2xl border bg-card"><div className="border-b p-4 font-bold">{titulo}</div>{lista.length ? lista.map((l) => <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0"><div><strong>{l.descricao}</strong><p className="text-sm text-muted-foreground">{l.categoria} · {l.formaPagamento}</p></div><div className="flex items-center gap-2"><strong className={l.tipo === "Saída" ? "text-rose-600" : "text-emerald-700"}>{l.tipo === "Saída" ? "− " : "+ "}{dinheiro(l.valor)}</strong><button onClick={() => onRemover(l.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><Trash2 size={16}/></button></div></div>) : <div className="p-10 text-center text-muted-foreground">Nenhuma movimentação hoje.</div>}</div></section>;
}

function ModuloResumo({ lista, recebido, despesas, titulo }: { lista: Lancamento[]; recebido: number; despesas: number; titulo: string }) {
  const pendente = lista.filter((l) => l.tipo === "Entrada" && l.status === "Pendente").reduce((s, l) => s + l.valor, 0);
  const ticket = lista.filter((l) => l.tipo === "Entrada" && l.status === "Pago");
  return <section><div className="grid gap-3 sm:grid-cols-4">{[["Recebido", recebido], ["Despesas", despesas], ["Pendente", pendente], ["Líquido", recebido - despesas]].map(([r, v]) => <div key={String(r)} className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{r}</p><p className="mt-1 text-xl font-black">{dinheiro(Number(v))}</p></div>)}</div><div className="mt-5 rounded-2xl border bg-card p-5"><h2 className="font-bold">{titulo}</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-muted/40 p-4"><p className="text-xs text-muted-foreground">Movimentações</p><strong>{lista.length}</strong></div><div className="rounded-xl bg-muted/40 p-4"><p className="text-xs text-muted-foreground">Ticket médio recebido</p><strong>{dinheiro(ticket.length ? recebido / ticket.length : 0)}</strong></div><div className="rounded-xl bg-muted/40 p-4"><p className="text-xs text-muted-foreground">Saldo</p><strong>{dinheiro(recebido - despesas)}</strong></div></div></div></section>;
}
