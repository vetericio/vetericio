import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  codigoPublicoTutor,
  lerNomeClinicaLocal,
  migrarCodigosPublicosTutores,
} from "@/lib/codigo-tutor";
import {
  type Comanda,
  dataLocalISO,
  lerComandas,
  parseValorMonetario,
  saldoComanda,
  totalComanda,
  totalPagoComanda,
} from "@/lib/comandas";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  comandaId?: string;
  registradoPor?: string;
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

type Aba = "inicio" | "comandasDia" | "comandasAbertas" | "dia" | "mes" | "periodo" | "tutores" | "receber" | "lancamentos";

const TUTORES_KEY = "oricse-tutores-v1";
const opcoes = [
  { id: "comandasDia" as Aba, titulo: "Comandas do dia", texto: "Comandas criadas hoje", icone: ClipboardList, cor: "bg-emerald-500/15 text-emerald-600" },
  { id: "comandasAbertas" as Aba, titulo: "Comandas em aberto", texto: "Comandas pendentes de dias anteriores", icone: CreditCard, cor: "bg-rose-500/15 text-rose-600" },
  { id: "lancamentos" as Aba, titulo: "Lançamentos", texto: "Entradas, saídas e ajustes", icone: Plus, cor: "bg-cyan-500/15 text-cyan-600" },
  { id: "dia" as Aba, titulo: "Caixa do dia", texto: "Movimentações de hoje e fechamento manual", icone: Wallet, cor: "bg-emerald-500/15 text-emerald-600" },
  { id: "mes" as Aba, titulo: "Caixa do mês", texto: "Resumo mensal e fechamento automático", icone: CalendarDays, cor: "bg-blue-500/15 text-blue-600" },
  { id: "periodo" as Aba, titulo: "Caixa do período", texto: "Selecione as datas para consultar", icone: BarChart3, cor: "bg-violet-500/15 text-violet-600" },
];

function hojeISO() {
  return dataLocalISO();
}
function mesAtualISO() {
  return new Date().toISOString().slice(0, 7);
}
function dinheiro(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}
function digitos(valor: string) {
  return valor.replace(/\D/g, "");
}
function textoOpcional(valor: unknown) {
  return typeof valor === "string" ? valor : undefined;
}
function formVazio(tutor = "", tutorId = "") {
  return {
    tipo: "Entrada" as TipoLancamento,
    descricao: "",
    categoria: "Consulta",
    valor: "",
    data: hojeISO(),
    formaPagamento: "Pix",
    tutor,
    tutorId,
    status: "Pago" as StatusLancamento,
    observacao: "",
  };
}
function valorEditavel(valor: number) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lerLancamentos(): Lancamento[] {
  if (typeof window === "undefined") return [];
  try {
    const dados = JSON.parse(localStorage.getItem(LANCAMENTOS_KEY) || "[]");
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

function lerTutores(): TutorFinanceiro[] {
  if (typeof window === "undefined") return [];
  try {
    const dados: unknown = JSON.parse(localStorage.getItem(TUTORES_KEY) || "[]");
    if (!Array.isArray(dados)) return [];
    const tutores = migrarCodigosPublicosTutores(
      dados.filter(
        (item): item is TutorFinanceiro =>
          Boolean(item) &&
          typeof item === "object" &&
          (typeof item.id === "string" || typeof (item as { id: unknown }).id === "number") &&
          typeof item.nome === "string",
      ).map((tutor) => ({ ...tutor, id: String(tutor.id) })),
      lerNomeClinicaLocal(),
    );
    return tutores.map((tutor) => {
      const cpfCnpj = textoOpcional(tutor.cpfCnpj);
      const cpf = textoOpcional(tutor.cpf);
      const codigoPublico = textoOpcional(tutor.codigoPublico);
      const codigo_publico = textoOpcional(tutor.codigo_publico);
      const codigo = textoOpcional(tutor.codigo);
      return {
        ...tutor,
        ...(cpfCnpj ? { cpfCnpj } : {}),
        ...(cpf ? { cpf } : {}),
        ...(codigoPublico ? { codigoPublico } : {}),
        ...(codigo_publico ? { codigo_publico } : {}),
        ...(codigo ? { codigo } : {}),
      };
    });
  } catch {
    return [];
  }
}

function Financeiro() {
  const [aba, setAba] = useState<Aba>("inicio");
  const [periodoInicio, setPeriodoInicio] = useState(() => `${mesAtualISO()}-01`);
  const [periodoFim, setPeriodoFim] = useState(hojeISO);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(lerLancamentos);
  const [tutoresCadastrados, setTutoresCadastrados] = useState<TutorFinanceiro[]>([]);
  const [podeAlterarComanda, setPodeAlterarComanda] = useState(false);
  const [comandas, setComandas] = useState<Comanda[]>(lerComandas);
  const [buscaTutor, setBuscaTutor] = useState("");
  const [tutorSelecionadoId, setTutorSelecionadoId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(() => formVazio());

  useEffect(() => {
    const atualizarComandas = () => setComandas(lerComandas());
    window.addEventListener("storage", atualizarComandas);
    window.addEventListener("oricse-comandas-atualizadas", atualizarComandas);
    return () => {
      window.removeEventListener("storage", atualizarComandas);
      window.removeEventListener("oricse-comandas-atualizadas", atualizarComandas);
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    async function carregarTutoresDaClinica() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (!userId) return;
        const { data: vinculo, error: erroVinculo } = await (supabase as any)
          .from("clinica_usuarios")
          .select("clinica_id,papel")
          .eq("user_id", userId)
          .eq("ativo", true)
          .maybeSingle();
        if (erroVinculo) throw erroVinculo;
        const { data: perfilSistema } = await (supabase as any).from("app_users").select("role").eq("user_id", userId).maybeSingle();
        if (ativo) setPodeAlterarComanda(perfilSistema?.role === "admin" || vinculo?.papel === "rt");
        const clinicaId = vinculo?.clinica_id || "";
        if (!clinicaId) {
          if (ativo) setTutoresCadastrados([]);
          return;
        }
        const { data, error } = await (supabase as any).from("tutores").select("id,codigo_publico,nome,dados").eq("clinica_id", clinicaId).order("nome");
        if (error) throw error;
        if (!ativo || !Array.isArray(data)) return;
        const remotos: TutorFinanceiro[] = data.map((tutor: any) => ({
          id: String(tutor.id),
          nome: String(tutor.nome || "").trim(),
          cpfCnpj: tutor.dados?.cpfCnpj || tutor.dados?.cpf || "",
          cpf: tutor.dados?.cpf || tutor.dados?.cpfCnpj || "",
          codigoPublico: tutor.codigo_publico || "",
          codigo_publico: tutor.codigo_publico || "",
        })).filter((tutor: TutorFinanceiro) => tutor.id && tutor.nome);
        setTutoresCadastrados(remotos);
      } catch (error) {
        console.warn("Não foi possível carregar os tutores da clínica no Financeiro; mantendo os dados locais.", error);
      }
    }
    void carregarTutoresDaClinica();
    return () => { ativo = false; };
  }, []);

  function persistir(lista: Lancamento[]) {
    setLancamentos(lista);
    localStorage.setItem(LANCAMENTOS_KEY, JSON.stringify(lista));
  }

  function salvarLancamento(evento: FormEvent) {
    evento.preventDefault();
    const valor = parseValorMonetario(form.valor);
    if (!form.descricao.trim()) return void toast.error("Informe a descrição do lançamento.");
    if (!Number.isFinite(valor) || valor <= 0) return void toast.error("Informe um valor válido.");
    if (
      form.status === "Pago" &&
      (!form.formaPagamento.trim() || form.formaPagamento === "A definir")
    )
      return void toast.error("Informe como foi pago.");
    const nomeTutor = normalizar(form.tutor);
    const tutoresComMesmoNome = tutoresCadastrados.filter(
      (tutor) => normalizar(tutor.nome) === nomeTutor,
    );
    const tutorVinculado =
      tutoresCadastrados.find((tutor) => tutor.id === form.tutorId) ||
      (tutoresComMesmoNome.length === 1 ? tutoresComMesmoNome[0] : undefined);
    const anterior = editandoId ? lancamentos.find((item) => item.id === editandoId) : undefined;
    const mesmoTutor = anterior?.tutor && normalizar(anterior.tutor) === nomeTutor;
    const camposAnteriores: Partial<Lancamento> = anterior ? { ...anterior } : {};
    delete camposAnteriores.tutor;
    delete camposAnteriores.tutorId;
    delete camposAnteriores.observacao;
    const tutor = tutorVinculado?.nome || form.tutor.trim();
    const tutorId = tutorVinculado?.id || (mesmoTutor ? anterior?.tutorId : undefined);
    const observacao = form.observacao.trim();
    const novo: Lancamento = {
      ...camposAnteriores,
      id: anterior?.id || crypto.randomUUID(),
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      valor,
      data: form.data,
      formaPagamento: form.formaPagamento,
      status: form.status,
      ...(anterior?.status === "Pendente" && form.status === "Pago" ? { data: hojeISO() } : {}),
      ...(tutor ? { tutor } : {}),
      ...(tutorId ? { tutorId } : {}),
      ...(observacao ? { observacao } : {}),
    };
    persistir(
      anterior
        ? lancamentos.map((item) => (item.id === anterior.id ? novo : item))
        : [novo, ...lancamentos],
    );
    fecharFormulario();
    toast.success(anterior ? "Lançamento atualizado." : "Lançamento salvo.");
  }

  function abrirNovo(tutor = "", tutorId = "") {
    setEditandoId(null);
    setForm(formVazio(tutor, tutorId));
    setFormAberto(true);
  }

  function abrirEdicao(lancamento: Lancamento) {
    setEditandoId(lancamento.id);
    setForm({
      tipo: lancamento.tipo,
      descricao: lancamento.descricao,
      categoria: lancamento.categoria,
      valor: valorEditavel(lancamento.valor),
      data: lancamento.data,
      formaPagamento: lancamento.formaPagamento,
      tutor: lancamento.tutor || "",
      tutorId: lancamento.tutorId || "",
      status: lancamento.status,
      observacao: lancamento.observacao || "",
    });
    setFormAberto(true);
  }

  function fecharFormulario() {
    setFormAberto(false);
    setEditandoId(null);
    setForm(formVazio());
  }

  function remover(id: string) {
    persistir(lancamentos.filter((item) => item.id !== id));
  }
  function darBaixa(id: string) {
    const lancamento = lancamentos.find((item) => item.id === id);
    if (lancamento) {
      if (lancamento.comandaId) {
        window.location.href = `/comandas?comandaId=${encodeURIComponent(lancamento.comandaId)}`;
        return;
      }
      abrirEdicao({
        ...lancamento,
        status: "Pago",
        formaPagamento: lancamento.formaPagamento === "A definir" ? "" : lancamento.formaPagamento,
      });
    }
  }

  const doDia = useMemo(() => lancamentos.filter((l) => l.data === hojeISO()), [lancamentos]);
  const doMes = useMemo(
    () => lancamentos.filter((l) => l.data.startsWith(mesAtualISO())),
    [lancamentos],
  );
  const entradasDia = doDia
    .filter((l) => l.tipo === "Entrada" && l.status === "Pago")
    .reduce((s, l) => s + l.valor, 0);
  const saidasDia = doDia
    .filter((l) => l.tipo === "Saída" && l.status === "Pago")
    .reduce((s, l) => s + l.valor, 0);
  const pendenteDia = doDia
    .filter((l) => l.tipo === "Entrada" && l.status === "Pendente")
    .reduce((s, l) => s + l.valor, 0);
  const recebidoMes = doMes
    .filter((l) => l.tipo === "Entrada" && l.status === "Pago")
    .reduce((s, l) => s + l.valor, 0);
  const despesasMes = doMes
    .filter((l) => l.tipo === "Saída" && l.status === "Pago")
    .reduce((s, l) => s + l.valor, 0);
  const recebidoTotal = lancamentos
    .filter((l) => l.tipo === "Entrada" && l.status === "Pago")
    .reduce((s, l) => s + l.valor, 0);
  const despesasTotal = lancamentos
    .filter((l) => l.tipo === "Saída" && l.status === "Pago")
    .reduce((s, l) => s + l.valor, 0);
  const contasReceber = lancamentos.filter((l) => l.tipo === "Entrada" && l.status === "Pendente");

  const comandasDia = useMemo(() => comandas.filter(c => c.abertaEm.slice(0, 10) === hojeISO()), [comandas]);
  const comandasAbertasAnteriores = useMemo(() => comandas.filter(c => c.status === "Aberta" && c.abertaEm.slice(0, 10) < hojeISO()), [comandas]);
  const lancamentosPeriodo = useMemo(() => lancamentos.filter(l => periodoInicio <= periodoFim && l.data >= periodoInicio && l.data <= periodoFim), [lancamentos, periodoInicio, periodoFim]);
  const recebidoPeriodo = lancamentosPeriodo.filter(l => l.tipo === "Entrada" && l.status === "Pago").reduce((s, l) => s + l.valor, 0);
  const despesasPeriodo = lancamentosPeriodo.filter(l => l.tipo === "Saída" && l.status === "Pago").reduce((s, l) => s + l.valor, 0);

  const tutoresFinanceiros = useMemo(() => {
    const consulta = normalizar(buscaTutor);
    const consultaDigitos = digitos(buscaTutor);
    return tutoresCadastrados
      .filter((tutor) => {
        const comandasAbertas = comandas.filter(
          (comanda) => comanda.status === "Aberta" && comanda.tutorId === tutor.id,
        );
        if (!consulta) return true;
        const identificadores = [
          tutor.id,
          codigoPublicoTutor(tutor),
          tutor.cpfCnpj,
          tutor.cpf,
        ].filter((valor): valor is string => typeof valor === "string");
        const textoComandas = comandasAbertas
          .flatMap((comanda) => [`#${comanda.numero}`, comanda.animalNome])
          .map(normalizar);
        return (
          normalizar(tutor.nome).includes(consulta) ||
          identificadores.some((valor) => normalizar(valor).includes(consulta)) ||
          textoComandas.some((valor) => valor.includes(consulta)) ||
          (!!consultaDigitos &&
            identificadores.some((valor) => digitos(valor).includes(consultaDigitos)))
        );
      })
      .map((tutor) => {
        const comandasAbertas = comandas.filter(
          (comanda) => comanda.status === "Aberta" && comanda.tutorId === tutor.id,
        );
        const movimentosTutor = lancamentos.filter(
          (lancamento) =>
            lancamento.tutorId === tutor.id ||
            (!lancamento.tutorId &&
              typeof lancamento.tutor === "string" &&
              normalizar(lancamento.tutor) === normalizar(tutor.nome)),
        );
        return {
          tutor,
          comandas: comandasAbertas,
          lancamentos: movimentosTutor,
          total: comandasAbertas.reduce((total, comanda) => total + totalComanda(comanda), 0),
          pago: comandasAbertas.reduce((total, comanda) => total + totalPagoComanda(comanda), 0),
          pendente: comandasAbertas.reduce((total, comanda) => total + saldoComanda(comanda), 0),
          pagoFinanceiro: movimentosTutor
            .filter((lancamento) => lancamento.tipo === "Entrada" && lancamento.status === "Pago")
            .reduce((total, lancamento) => total + lancamento.valor, 0),
          pendenteFinanceiro: movimentosTutor
            .filter(
              (lancamento) => lancamento.tipo === "Entrada" && lancamento.status === "Pendente",
            )
            .reduce((total, lancamento) => total + lancamento.valor, 0),
        };
      })
      .sort((a, b) => a.tutor.nome.localeCompare(b.tutor.nome, "pt-BR"));
  }, [comandas, lancamentos, tutoresCadastrados, buscaTutor]);
  const tutorSelecionado = tutoresFinanceiros.find((item) => item.tutor.id === tutorSelecionadoId);

  const resumo = [
    ["Recebido", dinheiro(entradasDia)],
    ["Pendente", dinheiro(pendenteDia)],
    ["Despesas", dinheiro(saidasDia)],
    ["Líquido", dinheiro(entradasDia - saidasDia)],
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        {aba === "inicio" ? (
          <Link
            to="/inicio"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft size={18} /> Voltar
          </Link>
        ) : (
          <button
            onClick={() => setAba("inicio")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft size={18} /> Financeiro
          </button>
        )}
        <Link
          to="/estoque"
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
        >
          <Package size={18} /> Estoque
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Atendimento</p>
          <h1 className="text-3xl font-bold tracking-tight">
            {aba === "inicio" ? "Financeiro" : opcoes.find((o) => o.id === aba)?.titulo}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {aba === "inicio"
              ? "Controle financeiro da clínica"
              : opcoes.find((o) => o.id === aba)?.texto}
          </p>
        </div>
        {aba === "lancamentos" && (
          <button
            onClick={() => abrirNovo()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
          >
            <Plus size={18} /> Novo lançamento
          </button>
        )}
      </div>

      {aba === "inicio" && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {opcoes.map(({ id, titulo, texto, icone: Icone, cor }) => (
              <button
                key={titulo}
                onClick={() => setAba(id)}
                className="rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <span
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${cor}`}
                >
                  <Icone size={22} />
                </span>
                <h2 className="font-semibold">{titulo}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
              </button>
            ))}
          </section>
          <section className="mt-6 rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">Resumo de hoje</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {resumo.map(([label, valor]) => (
                <div key={label} className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-bold">{valor}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {aba === "dia" && (
        <ModuloCaixa
          titulo="Movimentações de hoje"
          lista={doDia}
          recebido={entradasDia}
          despesas={saidasDia}
          pendente={pendenteDia}
          onRemover={remover}
          onEditar={abrirEdicao}
          podeAlterarComanda={podeAlterarComanda}
        />
      )}
      {aba === "mes" && (
        <ModuloResumo
          lista={doMes}
          recebido={recebidoMes}
          despesas={despesasMes}
          titulo="Resumo do mês atual"
        />
      )}
      {(aba === "comandasDia" || aba === "comandasAbertas") && (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">{aba === "comandasDia" ? "Comandas abertas hoje, inclusive as finalizadas." : "Comandas de dias anteriores ainda abertas."}</p>
          {(aba === "comandasDia" ? comandasDia : comandasAbertasAnteriores).map(comanda => (
            <a key={comanda.id} href={`/comandas?comandaId=${encodeURIComponent(comanda.id)}`} className="block rounded-2xl border bg-card p-4 hover:border-primary">
              <div className="flex items-center justify-between gap-3"><strong>Comanda #{comanda.numero} · {comanda.tutorNome}</strong><span className="text-sm">{comanda.status}</span></div>
              <p className="mt-1 text-sm text-muted-foreground">{comanda.animalNome} · {new Date(comanda.abertaEm).toLocaleDateString("pt-BR")} · Saldo: {dinheiro(saldoComanda(comanda))}</p>
            </a>
          ))}
          {(aba === "comandasDia" ? comandasDia : comandasAbertasAnteriores).length === 0 && <p className="rounded-2xl border bg-card p-5 text-muted-foreground">Nenhuma comanda encontrada.</p>}
          <a href="/comandas" className="inline-flex rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">Gerenciar comandas</a>
        </section>
      )}
      {aba === "periodo" && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-4 rounded-2xl border bg-card p-4">
            <label className="text-sm">Data inicial<input aria-label="Data inicial" type="date" value={periodoInicio} max={periodoFim} onChange={e => setPeriodoInicio(e.target.value)} className="mt-1 block rounded-xl border bg-background p-3" /></label>
            <label className="text-sm">Data final<input aria-label="Data final" type="date" value={periodoFim} min={periodoInicio} onChange={e => setPeriodoFim(e.target.value)} className="mt-1 block rounded-xl border bg-background p-3" /></label>
          </div>
          {periodoInicio <= periodoFim ? <ModuloResumo lista={lancamentosPeriodo} recebido={recebidoPeriodo} despesas={despesasPeriodo} titulo="Resumo do período selecionado" /> : <p>Selecione um período válido.</p>}
        </section>
      )}

      {aba === "tutores" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Consulte os saldos das comandas e os lançamentos de cada tutor.
            </p>
            <a
              href="/comandas?origem=Recepção"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
            >
              <Plus size={16} /> Abrir comanda
            </a>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 text-muted-foreground" size={18} />
            <input
              value={buscaTutor}
              onChange={(e) => {
                setBuscaTutor(e.target.value);
                setTutorSelecionadoId(null);
              }}
              placeholder="Buscar por nome, animal, CPF/CNPJ ou ID do tutor"
              className="w-full rounded-xl border bg-card py-3 pl-10 pr-4 outline-none focus:border-primary"
            />
          </div>
          {tutorSelecionado ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setTutorSelecionadoId(null)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={16} /> Voltar aos tutores
              </button>
              <section className="rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">
                      Comandas abertas
                    </p>
                    <h2 className="mt-1 text-2xl font-bold">{tutorSelecionado.tutor.nome}</h2>
                    <p className="mt-1 break-all text-sm text-muted-foreground">
                      CPF/CNPJ:{" "}
                      {tutorSelecionado.tutor.cpfCnpj ||
                        tutorSelecionado.tutor.cpf ||
                        "Não informado"}{" "}
                      · ID: {codigoPublicoTutor(tutorSelecionado.tutor) || "Não informado"}
                    </p>
                  </div>
                  <a
                    href="/comandas?origem=Recepção"
                    className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm font-semibold text-primary"
                  >
                    <Plus size={16} /> Abrir outra comanda
                  </a>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Total das comandas</p>
                    <p className="mt-1 text-xl font-bold">{dinheiro(tutorSelecionado.total)}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-700">Total pago</p>
                    <p className="mt-1 text-xl font-bold text-emerald-800">
                      {dinheiro(tutorSelecionado.pago)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4">
                    <p className="text-sm text-amber-700">Saldo em aberto</p>
                    <p className="mt-1 text-xl font-bold text-amber-800">
                      {dinheiro(tutorSelecionado.pendente)}
                    </p>
                  </div>
                </div>
              </section>
              <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="border-b p-4">
                  <h3 className="font-bold">Comandas em andamento</h3>
                </div>
                {tutorSelecionado.comandas.length ? (
                  tutorSelecionado.comandas.map((comanda) => (
                    <a
                      key={comanda.id}
                      href={`/comandas?comandaId=${encodeURIComponent(comanda.id)}`}
                      className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0 transition hover:bg-muted/20"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>
                            Comanda #{String(comanda.numero).padStart(5, "0")} ·{" "}
                            {comanda.animalNome}
                          </strong>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                            Aberta
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {comanda.origem} · aberta por {comanda.abertaPor}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {comanda.itens.length} {comanda.itens.length === 1 ? "item" : "itens"} ·{" "}
                          {comanda.pagamentos.length}{" "}
                          {comanda.pagamentos.length === 1 ? "pagamento" : "pagamentos"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-right">
                          <span className="block text-xs text-muted-foreground">Saldo</span>
                          <strong className="text-amber-800">
                            {dinheiro(saldoComanda(comanda))}
                          </strong>
                        </span>
                        <span className="rounded-lg border px-3 py-2 text-xs font-semibold">
                          Gerenciar
                        </span>
                      </div>
                    </a>
                  ))
                ) : (
                  <p className="p-4 text-sm text-muted-foreground">
                    Nenhuma comanda aberta para este tutor.
                  </p>
                )}
              </section>
              <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="border-b p-4">
                  <h3 className="font-bold">Histórico financeiro</h3>
                </div>
                {tutorSelecionado.lancamentos.length ? (
                  tutorSelecionado.lancamentos
                    .slice()
                    .sort((a, b) => b.data.localeCompare(a.data))
                    .map((lancamento) => (
                      <div
                        key={lancamento.id}
                        className="grid gap-2 border-b p-4 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <strong>{lancamento.descricao}</strong>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-bold ${lancamento.status === "Pago" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                            >
                              {lancamento.status}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {lancamento.categoria} · {lancamento.formaPagamento} ·{" "}
                            {new Date(`${lancamento.data}T12:00:00`).toLocaleDateString("pt-BR")}
                          </p>
                          {lancamento.observacao && (
                            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                              {lancamento.observacao}
                            </p>
                          )}
                        </div>
                        <strong
                          className={
                            lancamento.tipo === "Saída" ? "text-rose-600" : "text-emerald-700"
                          }
                        >
                          {lancamento.tipo === "Saída" ? "− " : "+ "}
                          {dinheiro(lancamento.valor)}
                        </strong>
                        <div className="flex flex-wrap gap-2">
                          {lancamento.comandaId ? (
                            <a
                              href={`/comandas?comandaId=${encodeURIComponent(lancamento.comandaId)}`}
                              className="rounded-lg border px-3 py-2 text-sm font-semibold"
                            >
                              Abrir comanda
                            </a>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => abrirEdicao(lancamento)}
                                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold"
                              >
                                <Pencil size={15} /> Editar
                              </button>
                              {lancamento.tipo === "Entrada" &&
                                lancamento.status === "Pendente" && (
                                  <button
                                    type="button"
                                    onClick={() => darBaixa(lancamento.id)}
                                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                                  >
                                    Dar baixa
                                  </button>
                                )}
                            </>
                          )}
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="p-4 text-sm text-muted-foreground">
                    Nenhum lançamento financeiro para este tutor.
                  </p>
                )}
              </section>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {tutoresFinanceiros.length ? (
                tutoresFinanceiros.map(
                  ({
                    tutor,
                    comandas: abertas,
                    total,
                    pendente,
                    lancamentos: movimentos,
                    pagoFinanceiro,
                    pendenteFinanceiro,
                  }) => (
                    <button
                      type="button"
                      key={tutor.id}
                      onClick={() => setTutorSelecionadoId(tutor.id)}
                      className="min-w-0 rounded-2xl border bg-card p-4 text-left transition hover:border-primary hover:shadow-sm"
                    >
                      <h3 className="font-bold">{tutor.nome}</h3>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        CPF/CNPJ: {tutor.cpfCnpj || tutor.cpf || "Não informado"} · ID:{" "}
                        {codigoPublicoTutor(tutor) || "Não informado"}
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <strong>{dinheiro(total)}</strong>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Saldo em aberto</p>
                          <strong className="text-amber-800">{dinheiro(pendente)}</strong>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Comandas</p>
                          <strong>{abertas.length}</strong>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {movimentos.length} {movimentos.length === 1 ? "lançamento" : "lançamentos"}{" "}
                        · pago {dinheiro(pagoFinanceiro)} · pendente {dinheiro(pendenteFinanceiro)}
                      </p>
                      {abertas.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {abertas
                            .map(
                              (comanda) =>
                                `#${String(comanda.numero).padStart(5, "0")} · ${comanda.animalNome}`,
                            )
                            .join("  |  ")}
                        </p>
                      )}
                      <p className="mt-3 text-xs font-bold text-primary">
                        Ver financeiro e comandas →
                      </p>
                    </button>
                  ),
                )
              ) : (
                <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
                  {buscaTutor.trim()
                    ? "Nenhum tutor corresponde a esta busca."
                    : "Nenhum tutor cadastrado."}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {aba === "receber" && (
        <section className="rounded-2xl border bg-card overflow-hidden">
          {contasReceber.length ? (
            contasReceber.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0"
              >
                <div>
                  <strong>{l.descricao}</strong>
                  <p className="text-sm text-muted-foreground">
                    {l.tutor || "Sem tutor"} ·{" "}
                    {new Date(`${l.data}T12:00:00`).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <strong>{dinheiro(l.valor)}</strong>
                  <button
                    onClick={() => darBaixa(l.id)}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    {l.comandaId ? "Abrir comanda" : "Dar baixa"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-10 text-center text-muted-foreground">Nenhuma conta pendente.</div>
          )}
        </section>
      )}

      {aba === "lancamentos" && (
        <section className="rounded-2xl border bg-card overflow-hidden">
          {lancamentos.length ? (
            lancamentos.map((l) => (
              <div
                key={l.id}
                className="grid gap-2 border-b p-4 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{l.descricao}</strong>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${l.status === "Pago" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {l.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {l.categoria} · {l.formaPagamento}
                    {l.tutor ? ` · ${l.tutor}` : ""} ·{" "}
                    {new Date(`${l.data}T12:00:00`).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <strong className={l.tipo === "Saída" ? "text-rose-600" : "text-emerald-700"}>
                  {l.tipo === "Saída" ? "− " : "+ "}
                  {dinheiro(l.valor)}
                </strong>
                <div className="flex gap-1">
                  {l.comandaId ? (
                    <a
                      href={`/comandas?comandaId=${encodeURIComponent(l.comandaId)}`}
                      className="inline-flex items-center rounded-lg border px-3 text-sm font-semibold"
                    >
                      Abrir comanda
                    </a>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => abrirEdicao(l)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                        aria-label="Editar"
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remover(l.id)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                        aria-label="Excluir"
                      >
                        <Trash2 size={17} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-10 text-center text-muted-foreground">
              Nenhum lançamento registrado.
            </div>
          )}
        </section>
      )}

      {formAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) fecharFormulario();
          }}
        >
          <form
            onSubmit={salvarLancamento}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-primary">
                  Financeiro
                </p>
                <h2 className="text-2xl font-black">
                  {editandoId ? "Editar lançamento" : "Novo lançamento"}
                </h2>
              </div>
              <button
                type="button"
                onClick={fecharFormulario}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Campo label="Tipo">
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoLancamento })}
                  className="input"
                >
                  <option>Entrada</option>
                  <option>Saída</option>
                </select>
              </Campo>
              <Campo label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as StatusLancamento })}
                  className="input"
                >
                  <option>Pago</option>
                  <option>Pendente</option>
                </select>
              </Campo>
              <Campo label="Descrição">
                <input
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="input"
                  placeholder="Ex.: Consulta Luna"
                />
              </Campo>
              <Campo label="Categoria">
                <select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="input"
                >
                  <option>Consulta</option>
                  <option>Vacina</option>
                  <option>Cirurgia</option>
                  <option>Banho e Tosa</option>
                  <option>Internação</option>
                  <option>Produto</option>
                  <option>Despesa</option>
                  <option>Ajuste</option>
                  <option>Outro</option>
                </select>
              </Campo>
              <Campo label="Valor">
                <input
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  className="input"
                  inputMode="decimal"
                  placeholder="0,00"
                />
              </Campo>
              <Campo label="Data">
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  className="input"
                />
              </Campo>
              <Campo label="Forma de pagamento">
                <select
                  value={form.formaPagamento}
                  onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })}
                  className="input"
                >
                  <option value="" disabled>
                    Selecione a forma de pagamento
                  </option>
                  <option>Pix</option>
                  <option>Dinheiro</option>
                  <option>Cartão de débito</option>
                  <option>Cartão de crédito</option>
                  <option>App</option>
                  <option>Plano de saúde</option>
                  <option>Transferência</option>
                  <option>Boleto</option>
                  <option>Outros</option>
                  <option>Outro</option>
                </select>
              </Campo>
              <Campo label="Tutor">
                <>
                  <input
                    list="tutores-financeiro"
                    value={form.tutor}
                    onChange={(e) => {
                      const tutor = tutoresCadastrados.find(
                        (item) => normalizar(item.nome) === normalizar(e.target.value),
                      );
                      setForm({ ...form, tutor: e.target.value, tutorId: tutor?.id || "" });
                    }}
                    className="input"
                    placeholder="Opcional"
                  />
                  <datalist id="tutores-financeiro">
                    {tutoresCadastrados.map((tutor) => (
                      <option key={tutor.id} value={tutor.nome} />
                    ))}
                  </datalist>
                </>
              </Campo>
            </div>
            <Campo label="Observação">
              <textarea
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                className="input min-h-24"
              />
            </Campo>
            <button className="mt-5 w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground">
              {editandoId ? "Salvar alterações" : "Salvar lançamento"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ModuloCaixa({
  titulo,
  lista,
  recebido,
  despesas,
  pendente,
  onRemover,
  onEditar,
  podeAlterarComanda,
}: {
  titulo: string;
  lista: Lancamento[];
  recebido: number;
  despesas: number;
  pendente: number;
  onRemover: (id: string) => void;
  onEditar: (lancamento: Lancamento) => void;
  podeAlterarComanda: boolean;
}) {
  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Recebido", recebido],
          ["Pendente", pendente],
          ["Despesas", despesas],
          ["Líquido", recebido - despesas],
        ].map(([r, v]) => (
          <div key={String(r)} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{r}</p>
            <p className="mt-1 text-xl font-black">{dinheiro(Number(v))}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border bg-card">
        <div className="border-b p-4 font-bold">{titulo}</div>
        {lista.length ? (
          lista.map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-b-0"
            >
              <div>
                <strong>{l.descricao}</strong>
                <p className="text-sm text-muted-foreground">
                  {l.categoria} · {l.formaPagamento}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <strong className={l.tipo === "Saída" ? "text-rose-600" : "text-emerald-700"}>
                  {l.tipo === "Saída" ? "− " : "+ "}
                  {dinheiro(l.valor)}
                </strong>
                {(l.comandaId || l.categoria === "Pagamento de comanda") && !podeAlterarComanda ? (
                  <a
                    href={l.comandaId ? `/comandas?comandaId=${encodeURIComponent(l.comandaId)}` : "/comandas"}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                  >
                    Abrir comanda
                  </a>
                ) : (
                  <>
                <button
                  type="button"
                  onClick={() => onEditar(l)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  aria-label="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onRemover(l.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  aria-label="Excluir"
                >
                  <Trash2 size={16} />
                </button>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="p-10 text-center text-muted-foreground">Nenhuma movimentação hoje.</div>
        )}
      </div>
    </section>
  );
}

function ModuloResumo({
  lista,
  recebido,
  despesas,
  titulo,
}: {
  lista: Lancamento[];
  recebido: number;
  despesas: number;
  titulo: string;
}) {
  const pendente = lista
    .filter((l) => l.tipo === "Entrada" && l.status === "Pendente")
    .reduce((s, l) => s + l.valor, 0);
  const ticket = lista.filter((l) => l.tipo === "Entrada" && l.status === "Pago");
  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Recebido", recebido],
          ["Despesas", despesas],
          ["Pendente", pendente],
          ["Líquido", recebido - despesas],
        ].map(([r, v]) => (
          <div key={String(r)} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{r}</p>
            <p className="mt-1 text-xl font-black">{dinheiro(Number(v))}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border bg-card p-5">
        <h2 className="font-bold">{titulo}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Movimentações</p>
            <strong>{lista.length}</strong>
          </div>
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Ticket médio recebido</p>
            <strong>{dinheiro(ticket.length ? recebido / ticket.length : 0)}</strong>
          </div>
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <strong>{dinheiro(recebido - despesas)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
