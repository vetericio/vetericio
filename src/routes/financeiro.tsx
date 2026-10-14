import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, CalendarDays, ClipboardList, CreditCard, Package, Pencil, Plus, Search, Trash2, Users, Wallet, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

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
  tutorId?: string;
  status: StatusLancamento;
  observacao?: string;
  animalId?: string;
  criadoEm?: string;
  itens?: unknown[];
};

type TutorFinanceiro = {
  id: string;
  nome: string;
  cpfCnpj?: string;
  cpf?: string;
  codigoPublico?: string;
  codigo_publico?: string;
  codigo?: string;
};

type Aba = "inicio" | "dia" | "mes" | "total" | "tutores" | "receber" | "lancamentos";

const TUTORES_KEY = "oricse-tutores-v1";

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
function normalizar(valor: string) { return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim(); }
function digitos(valor: string) { return valor.replace(/\D/g, ""); }
function textoOpcional(valor: unknown) { return typeof valor === "string" ? valor : undefined; }
function formVazio(tutor="") { return { tipo:"Entrada" as TipoLancamento,descricao:"",categoria:"Consulta",valor:"",data:hojeISO(),formaPagamento:"Pix",tutor,status:"Pago" as StatusLancamento,observacao:"" }; }
function valorEditavel(valor:number) { return valor.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}); }

function lerLancamentos(): Lancamento[] {
  if (typeof window === "undefined") return [];
  try {
    const dados = JSON.parse(localStorage.getItem(LANCAMENTOS_KEY) || "[]");
    return Array.isArray(dados) ? dados : [];
  } catch { return []; }
}

function lerTutores(): TutorFinanceiro[] {
  if (typeof window === "undefined") return [];
  try {
    const dados: unknown = JSON.parse(localStorage.getItem(TUTORES_KEY) || "[]");
    if (!Array.isArray(dados)) return [];
    return dados
      .filter((item): item is TutorFinanceiro => Boolean(item) && typeof item === "object" && typeof item.id === "string" && typeof item.nome === "string")
      .map((tutor) => ({
        ...tutor,
        cpfCnpj: textoOpcional(tutor.cpfCnpj),
        cpf: textoOpcional(tutor.cpf),
        codigoPublico: textoOpcional(tutor.codigoPublico),
        codigo_publico: textoOpcional(tutor.codigo_publico),
        codigo: textoOpcional(tutor.codigo),
      }));
  } catch { return []; }
}

function Financeiro() {
  const [aba, setAba] = useState<Aba>("inicio");
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(lerLancamentos);
  const [tutoresCadastrados] = useState<TutorFinanceiro[]>(lerTutores);
  const [buscaTutor, setBuscaTutor] = useState("");
  const [tutorSelecionadoId, setTutorSelecionadoId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId,setEditandoId]=useState<string|null>(null);
  const [form, setForm] = useState(()=>formVazio());

  function persistir(lista: Lancamento[]) {
    setLancamentos(lista);
    localStorage.setItem(LANCAMENTOS_KEY, JSON.stringify(lista));
  }

  function salvarLancamento(evento: FormEvent) {
    evento.preventDefault();
    const valor = Number(String(form.valor).replace(".", "").replace(",", "."));
    if (!form.descricao.trim())return void toast.error("Informe a descrição do lançamento.");
    if (!Number.isFinite(valor) || valor <= 0)return void toast.error("Informe um valor válido.");
    if(form.status==="Pago"&&(!form.formaPagamento.trim()||form.formaPagamento==="A definir"))return void toast.error("Informe como foi pago.");
    const nomeTutor = normalizar(form.tutor);
    const tutoresComMesmoNome = tutoresCadastrados.filter((tutor) => normalizar(tutor.nome) === nomeTutor);
    const tutorVinculado = tutoresComMesmoNome.length === 1 ? tutoresComMesmoNome[0] : undefined;
    const anterior=editandoId?lancamentos.find(item=>item.id===editandoId):undefined;
    const mesmoTutor=anterior?.tutor&&normalizar(anterior.tutor)===nomeTutor;
    const novo: Lancamento = {
      ...(anterior||{}), id: anterior?.id||crypto.randomUUID(), tipo: form.tipo, descricao: form.descricao.trim(), categoria: form.categoria,
      valor, data: form.data, formaPagamento: form.formaPagamento, tutor: tutorVinculado?.nome || form.tutor.trim() || undefined, tutorId: tutorVinculado?.id||(mesmoTutor?anterior?.tutorId:undefined),
      status: form.status, observacao: form.observacao.trim() || undefined,
    };
    persistir(anterior?lancamentos.map(item=>item.id===anterior.id?novo:item):[novo, ...lancamentos]);
    fecharFormulario();toast.success(anterior?"Lançamento atualizado.":"Lançamento salvo.");
  }

  function abrirNovo(tutor="") { setEditandoId(null);setForm(formVazio(tutor));setFormAberto(true); }
  function abrirEdicao(lancamento:Lancamento) { setEditandoId(lancamento.id);setForm({tipo:lancamento.tipo,descricao:lancamento.descricao,categoria:lancamento.categoria,valor:valorEditavel(lancamento.valor),data:lancamento.data,formaPagamento:lancamento.formaPagamento,tutor:lancamento.tutor||"",status:lancamento.status,observacao:lancamento.observacao||""});setFormAberto(true); }
  function fecharFormulario() { setFormAberto(false);setEditandoId(null);setForm(formVazio()); }

  function remover(id: string) { persistir(lancamentos.filter((item) => item.id !== id)); }
  function darBaixa(id: string) { const lancamento=lancamentos.find(item=>item.id===id);if(lancamento)abrirEdicao({...lancamento,status:"Pago",formaPagamento:lancamento.formaPagamento==="A definir"?"":lancamento.formaPagamento}); }

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

  const tutoresFinanceiros = useMemo(() => {
    const consulta = normalizar(buscaTutor);
    const consultaDigitos = digitos(buscaTutor);
    return tutoresCadastrados
      .filter((tutor) => {
        if (!consulta) return true;
        const identificadores = [tutor.id, tutor.codigoPublico, tutor.codigo_publico, tutor.codigo, tutor.cpfCnpj, tutor.cpf].filter((valor): valor is string => typeof valor === "string");
        return normalizar(tutor.nome).includes(consulta)
          || identificadores.some((valor) => normalizar(valor).includes(consulta))
          || (!!consultaDigitos && identificadores.some((valor) => digitos(valor).includes(consultaDigitos)));
      })
      .map((tutor) => {
        const movimentosTutor = lancamentos.filter((lancamento) =>
          lancamento.tutorId === tutor.id
          || (!lancamento.tutorId && typeof lancamento.tutor === "string" && normalizar(lancamento.tutor) === normalizar(tutor.nome)),
        );
        return {
          tutor,
          lancamentos: movimentosTutor,
          pago: movimentosTutor.filter((lancamento) => lancamento.tipo === "Entrada" && lancamento.status === "Pago").reduce((total, lancamento) => total + lancamento.valor, 0),
          pendente: movimentosTutor.filter((lancamento) => lancamento.tipo === "Entrada" && lancamento.status === "Pendente").reduce((total, lancamento) => total + lancamento.valor, 0),
        };
      })
      .sort((a, b) => a.tutor.nome.localeCompare(b.tutor.nome, "pt-BR"));
  }, [lancamentos, tutoresCadastrados, buscaTutor]);
  const tutorSelecionado = tutoresFinanceiros.find((item) => item.tutor.id === tutorSelecionadoId);

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
        {aba === "lancamentos" && <button onClick={() => abrirNovo()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><Plus size={18}/> Novo lançamento</button>}
      </div>

      {aba === "inicio" && <>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{opcoes.map(({ id, titulo, texto, icone: Icone, cor }) => <button key={titulo} onClick={() => setAba(id)} className="rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"><span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${cor}`}><Icone size={22}/></span><h2 className="font-semibold">{titulo}</h2><p className="mt-1 text-sm text-muted-foreground">{texto}</p></button>)}</section>
        <section className="mt-6 rounded-2xl border bg-card p-5"><h2 className="font-semibold">Resumo de hoje</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{resumo.map(([label, valor]) => <div key={label} className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold">{valor}</p></div>)}</div></section>
      </>}

      {aba === "dia" && <ModuloCaixa titulo="Movimentações de hoje" lista={doDia} recebido={entradasDia} despesas={saidasDia} pendente={pendenteDia} onRemover={remover} onEditar={abrirEdicao}/>}
      {aba === "mes" && <ModuloResumo lista={doMes} recebido={recebidoMes} despesas={despesasMes} titulo="Resumo do mês atual"/>}
      {aba === "total" && <ModuloResumo lista={lancamentos} recebido={recebidoTotal} despesas={despesasTotal} titulo="Visão acumulada"/>}

      {aba === "tutores" && <section className="space-y-4">
        <div className="relative z-20">
          <Search className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground" size={18}/>
          <input
            value={buscaTutor}
            onChange={(e) => { setBuscaTutor(e.target.value); setTutorSelecionadoId(null); }}
            placeholder="Digite o nome, CPF/CNPJ ou ID do tutor"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={Boolean(buscaTutor.trim() && tutoresFinanceiros.length)}
            className="w-full rounded-xl border bg-card py-3 pl-10 pr-4 outline-none focus:border-primary"
          />
          {buscaTutor.trim() && !tutorSelecionado && tutoresFinanceiros.length > 0 && (
            <div role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] max-h-80 overflow-y-auto rounded-2xl border bg-card p-2 shadow-xl">
              {tutoresFinanceiros.slice(0, 10).map(({ tutor }) => (
                <button
                  type="button"
                  role="option"
                  key={tutor.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { setTutorSelecionadoId(tutor.id); setBuscaTutor(tutor.nome); }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-muted focus:bg-muted focus:outline-none"
                >
                  <span className="min-w-0"><strong className="block truncate">{tutor.nome}</strong><span className="block truncate text-xs text-muted-foreground">CPF/CNPJ: {tutor.cpfCnpj || tutor.cpf || "Não informado"}</span></span>
                  <span className="shrink-0 text-xs font-semibold text-primary">Selecionar</span>
                </button>
              ))}
              {tutoresFinanceiros.length > 10 && <p className="px-3 py-2 text-xs text-muted-foreground">Continue digitando para refinar a busca.</p>}
            </div>
          )}
        </div>
        {tutorSelecionado ? <div className="space-y-4">
          <button type="button" onClick={() => setTutorSelecionadoId(null)} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={16}/> Voltar aos tutores</button>
          <section className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Financeiro do tutor</p><h2 className="mt-1 text-2xl font-bold">{tutorSelecionado.tutor.nome}</h2><p className="mt-1 break-all text-sm text-muted-foreground">CPF/CNPJ: {tutorSelecionado.tutor.cpfCnpj || tutorSelecionado.tutor.cpf || "Não informado"} · ID: {tutorSelecionado.tutor.codigoPublico || tutorSelecionado.tutor.codigo_publico || tutorSelecionado.tutor.codigo || tutorSelecionado.tutor.id}</p></div><button type="button" onClick={() => abrirNovo(tutorSelecionado.tutor.nome)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><Plus size={16}/> Novo lançamento</button></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-sm text-emerald-700">Total pago</p><p className="mt-1 text-xl font-bold text-emerald-800">{dinheiro(tutorSelecionado.pago)}</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-sm text-amber-700">Pendente</p><p className="mt-1 text-xl font-bold text-amber-800">{dinheiro(tutorSelecionado.pendente)}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-sm text-muted-foreground">Movimentações</p><p className="mt-1 text-xl font-bold">{tutorSelecionado.lancamentos.length}</p></div></div>
          </section>
          <section className="overflow-hidden rounded-2xl border bg-card"><div className="border-b p-4"><h3 className="font-bold">Histórico financeiro</h3></div>{tutorSelecionado.lancamentos.length ? [...tutorSelecionado.lancamentos].sort((a, b) => b.data.localeCompare(a.data)).map((lancamento) => <div key={lancamento.id} className="grid gap-2 border-b p-4 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><strong>{lancamento.descricao}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${lancamento.status === "Pago" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{lancamento.status}</span></div><p className="text-sm text-muted-foreground">{lancamento.categoria} · {lancamento.formaPagamento} · {new Date(`${lancamento.data}T12:00:00`).toLocaleDateString("pt-BR")}</p>{lancamento.observacao && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{lancamento.observacao}</p>}</div><strong className={lancamento.tipo === "Saída" ? "text-rose-600" : "text-emerald-700"}>{lancamento.tipo === "Saída" ? "− " : "+ "}{dinheiro(lancamento.valor)}</strong><div className="flex flex-wrap gap-2"><button type="button" onClick={() => abrirEdicao(lancamento)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold"><Pencil size={15}/> Editar</button>{lancamento.tipo === "Entrada" && lancamento.status === "Pendente" && <button type="button" onClick={() => darBaixa(lancamento.id)} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Dar baixa</button>}</div></div>) : <div className="p-10 text-center text-muted-foreground">Nenhum lançamento financeiro para este tutor.</div>}</section>
        </div> : <div className="grid gap-3 md:grid-cols-2">{tutoresFinanceiros.length ? tutoresFinanceiros.map(({ tutor, lancamentos: movimentos, pago, pendente }) => <button type="button" key={tutor.id} onClick={() => setTutorSelecionadoId(tutor.id)} className="min-w-0 rounded-2xl border bg-card p-4 text-left transition hover:border-primary hover:shadow-sm"><h3 className="font-bold">{tutor.nome}</h3><p className="mt-1 break-all text-xs text-muted-foreground">CPF/CNPJ: {tutor.cpfCnpj || tutor.cpf || "Não informado"} · ID: {tutor.codigoPublico || tutor.codigo_publico || tutor.codigo || tutor.id}</p><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><p className="text-muted-foreground">Pago</p><strong>{dinheiro(pago)}</strong></div><div><p className="text-muted-foreground">Pendente</p><strong>{dinheiro(pendente)}</strong></div><div><p className="text-muted-foreground">Mov.</p><strong>{movimentos.length}</strong></div></div></button>) : <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-muted-foreground">{tutoresCadastrados.length ? "Nenhum tutor encontrado para esta busca." : "Nenhum tutor cadastrado ainda."}</div>}</div>}
      </section>}

      {aba === "receber" && <section className="rounded-2xl border bg-card overflow-hidden">{contasReceber.length ? contasReceber.map((l) => <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0"><div><strong>{l.descricao}</strong><p className="text-sm text-muted-foreground">{l.tutor || "Sem tutor"} · {new Date(`${l.data}T12:00:00`).toLocaleDateString("pt-BR")}</p></div><div className="flex items-center gap-2"><strong>{dinheiro(l.valor)}</strong><button type="button" onClick={()=>abrirEdicao(l)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold"><Pencil size={15}/> Editar</button><button onClick={() => darBaixa(l.id)} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Dar baixa</button></div></div>) : <div className="p-10 text-center text-muted-foreground">Nenhuma conta pendente.</div>}</section>}

      {aba === "lancamentos" && <section className="rounded-2xl border bg-card overflow-hidden">{lancamentos.length ? lancamentos.map((l) => <div key={l.id} className="grid gap-2 border-b p-4 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><strong>{l.descricao}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${l.status === "Pago" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{l.status}</span></div><p className="text-sm text-muted-foreground">{l.categoria} · {l.formaPagamento}{l.tutor ? ` · ${l.tutor}` : ""} · {new Date(`${l.data}T12:00:00`).toLocaleDateString("pt-BR")}</p></div><strong className={l.tipo === "Saída" ? "text-rose-600" : "text-emerald-700"}>{l.tipo === "Saída" ? "− " : "+ "}{dinheiro(l.valor)}</strong><div className="flex gap-1"><button type="button" onClick={()=>abrirEdicao(l)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Editar"><Pencil size={17}/></button><button onClick={() => remover(l.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Excluir"><Trash2 size={17}/></button></div></div>) : <div className="p-10 text-center text-muted-foreground">Nenhum lançamento registrado.</div>}</section>}

      {formAberto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onMouseDown={(e) => { if (e.currentTarget === e.target) fecharFormulario(); }}><form onSubmit={salvarLancamento} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-primary">Financeiro</p><h2 className="text-2xl font-black">{editandoId?"Editar lançamento":"Novo lançamento"}</h2></div><button type="button" onClick={fecharFormulario} className="rounded-lg p-2 hover:bg-muted"><X size={20}/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Campo label="Tipo"><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoLancamento })} className="input"><option>Entrada</option><option>Saída</option></select></Campo><Campo label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusLancamento })} className="input"><option>Pago</option><option>Pendente</option></select></Campo><Campo label="Descrição"><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="input" placeholder="Ex.: Consulta Luna"/></Campo><Campo label="Categoria"><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="input"><option>Consulta</option><option>Vacina</option><option>Cirurgia</option><option>Banho e Tosa</option><option>Internação</option><option>Produto</option><option>Despesa</option><option>Ajuste</option><option>Outro</option></select></Campo><Campo label="Valor"><input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="input" inputMode="decimal" placeholder="0,00"/></Campo><Campo label="Data"><input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="input"/></Campo><Campo label="Forma de pagamento"><select value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })} className="input"><option>Pix</option><option>Dinheiro</option><option>Cartão de débito</option><option>Cartão de crédito</option><option>App</option><option>Plano de saúde</option><option>Transferência</option><option>Boleto</option><option>Outros</option></select></Campo><Campo label="Tutor"><><input list="tutores-financeiro" value={form.tutor} onChange={(e) => setForm({ ...form, tutor: e.target.value })} className="input" placeholder="Opcional"/><datalist id="tutores-financeiro">{tutoresCadastrados.map((tutor) => <option key={tutor.id} value={tutor.nome}/>)}</datalist></></Campo></div><Campo label="Observação"><textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="input min-h-24"/></Campo><button className="mt-5 w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground">{editandoId?"Salvar alterações":"Salvar lançamento"}</button></form></div>}
    </main>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold">{label}<div className="mt-1">{children}</div></label>; }

function ModuloCaixa({ titulo, lista, recebido, despesas, pendente, onRemover, onEditar }: { titulo: string; lista: Lancamento[]; recebido: number; despesas: number; pendente: number; onRemover: (id: string) => void; onEditar:(lancamento:Lancamento)=>void }) {
  return <section><div className="grid gap-3 sm:grid-cols-4">{[["Recebido", recebido], ["Pendente", pendente], ["Despesas", despesas], ["Líquido", recebido - despesas]].map(([r, v]) => <div key={String(r)} className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{r}</p><p className="mt-1 text-xl font-black">{dinheiro(Number(v))}</p></div>)}</div><div className="mt-5 rounded-2xl border bg-card"><div className="border-b p-4 font-bold">{titulo}</div>{lista.length ? lista.map((l) => <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0"><div><strong>{l.descricao}</strong><p className="text-sm text-muted-foreground">{l.categoria} · {l.formaPagamento}</p></div><div className="flex items-center gap-1"><strong className={l.tipo === "Saída" ? "mr-2 text-rose-600" : "mr-2 text-emerald-700"}>{l.tipo === "Saída" ? "− " : "+ "}{dinheiro(l.valor)}</strong><button type="button" onClick={()=>onEditar(l)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Editar"><Pencil size={16}/></button><button onClick={() => onRemover(l.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Excluir"><Trash2 size={16}/></button></div></div>) : <div className="p-10 text-center text-muted-foreground">Nenhuma movimentação hoje.</div>}</div></section>;
}

function ModuloResumo({ lista, recebido, despesas, titulo }: { lista: Lancamento[]; recebido: number; despesas: number; titulo: string }) {
  const pendente = lista.filter((l) => l.tipo === "Entrada" && l.status === "Pendente").reduce((s, l) => s + l.valor, 0);
  const ticket = lista.filter((l) => l.tipo === "Entrada" && l.status === "Pago");
  return <section><div className="grid gap-3 sm:grid-cols-4">{[["Recebido", recebido], ["Despesas", despesas], ["Pendente", pendente], ["Líquido", recebido - despesas]].map(([r, v]) => <div key={String(r)} className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{r}</p><p className="mt-1 text-xl font-black">{dinheiro(Number(v))}</p></div>)}</div><div className="mt-5 rounded-2xl border bg-card p-5"><h2 className="font-bold">{titulo}</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-muted/40 p-4"><p className="text-xs text-muted-foreground">Movimentações</p><strong>{lista.length}</strong></div><div className="rounded-xl bg-muted/40 p-4"><p className="text-xs text-muted-foreground">Ticket médio recebido</p><strong>{dinheiro(ticket.length ? recebido / ticket.length : 0)}</strong></div><div className="rounded-xl bg-muted/40 p-4"><p className="text-xs text-muted-foreground">Saldo</p><strong>{dinheiro(recebido - despesas)}</strong></div></div></div></section>;
}
