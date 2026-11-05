import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, Check, Copy, Eye, PauseCircle, Pencil, Plus, RotateCcw, Search, ShieldCheck, TicketPercent, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-cupons")({ component: AdminCupons });

type Plano = { codigo: string; nome: string; ativo: boolean };
type Cupom = {
  id: string;
  codigo: string;
  tipo_desconto: "percentual" | "fixo";
  valor: number;
  planos: string[];
  valido_de: string | null;
  valido_ate: string | null;
  limite_usos: number | null;
  limite_por_documento: number | null;
  ativo: boolean;
  somente_primeira_assinatura: boolean;
  duracao: "primeiro_mes" | "recorrente";
  created_at: string;
  updated_at: string;
};
type Uso = {
  id: string;
  codigo_id: string;
  contratacao_id: string | null;
  documento_normalizado: string | null;
  created_at: string;
};
type Contratacao = {
  id: string;
  clinica_nome: string;
  plano_nome: string;
  plano_codigo: string;
  ciclo: string;
  status: string;
  pagamento_aprovado_em: string | null;
  valor_total: number | null;
  promo_codigo: string | null;
  promo_desconto: number | null;
  promo_valor_original: number | null;
  promo_valor_final: number | null;
};
type RascunhoCupom = {
  id?: string;
  codigo: string;
  tipo_desconto: "percentual" | "fixo";
  valor: number;
  planos: string[];
  valido_de: string;
  valido_ate: string;
  limite_usos: number | null;
  limite_por_documento: number | null;
  ativo: boolean;
  somente_primeira_assinatura: boolean;
  duracao: "primeiro_mes" | "recorrente";
};

const RASCUNHO_VAZIO: RascunhoCupom = {
  codigo: "",
  tipo_desconto: "percentual",
  valor: 10,
  planos: [],
  valido_de: "",
  valido_ate: "",
  limite_usos: null,
  limite_por_documento: null,
  ativo: true,
  somente_primeira_assinatura: false,
  duracao: "primeiro_mes",
};

function normalizarCodigo(valor: string) {
  return valor.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
}
function paraInputData(valor: string | null) {
  if (!valor) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return new Date(data.getTime() - data.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function paraIso(valor: string) {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}
function dataBR(valor: string | null) {
  if (!valor) return "Sem limite";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function dinheiro(valor: number | null) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function textoCiclo(ciclo: string) {
  return ({ mensal: "Mensal", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual", bienal: "Dois anos" } as Record<string, string>)[ciclo] || ciclo;
}
function rotuloStatus(cupom: Cupom, usos: number) {
  const agora = Date.now();
  if (!cupom.ativo) return "Pausado";
  if (cupom.valido_de && new Date(cupom.valido_de).getTime() > agora) return "Agendado";
  if (cupom.valido_ate && new Date(cupom.valido_ate).getTime() < agora) return "Encerrado";
  if (cupom.limite_usos !== null && usos >= cupom.limite_usos) return "Esgotado";
  return "Ativo";
}
function classeStatus(status: string) {
  if (status === "Ativo") return "bg-emerald-50 text-emerald-700";
  if (status === "Agendado") return "bg-sky-50 text-sky-700";
  if (status === "Pausado") return "bg-slate-100 text-slate-700";
  return "bg-amber-50 text-amber-800";
}

function AdminCupons() {
  const navigate = useNavigate();
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [usos, setUsos] = useState<Uso[]>([]);
  const [contratacoes, setContratacoes] = useState<Contratacao[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [selecionadoId, setSelecionadoId] = useState("");
  const [rascunho, setRascunho] = useState<RascunhoCupom | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [alterandoStatus, setAlterandoStatus] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const userId = sessao.session?.user?.id;
      if (!userId) {
        setAutorizado(false);
        void navigate({ to: "/login" });
        return;
      }
      const { data: perfil, error: erroPerfil } = await (supabase as any)
        .from("app_users").select("role").eq("user_id", userId).maybeSingle();
      if (erroPerfil) throw erroPerfil;
      if (perfil?.role !== "admin") {
        setAutorizado(false);
        toast.error("Somente o Admin ORICSE pode gerenciar cupons.");
        void navigate({ to: "/inicio" });
        return;
      }
      setAutorizado(true);

      const [cuponsRes, usosRes, contratacoesRes, planosRes] = await Promise.all([
        (supabase as any).from("oricse_codigos_promocionais").select("*").order("created_at", { ascending: false }),
        (supabase as any).from("oricse_codigo_promocional_usos").select("id,codigo_id,contratacao_id,documento_normalizado,created_at").order("created_at", { ascending: false }),
        (supabase as any).from("oricse_contratacoes").select("id,clinica_nome,plano_nome,plano_codigo,ciclo,status,pagamento_aprovado_em,valor_total,promo_codigo,promo_desconto,promo_valor_original,promo_valor_final").order("created_at", { ascending: false }),
        (supabase as any).from("oricse_planos").select("codigo,nome,ativo").order("ordem"),
      ]);
      for (const resposta of [cuponsRes, usosRes, contratacoesRes, planosRes]) {
        if (resposta.error) throw resposta.error;
      }
      setCupons((cuponsRes.data || []) as Cupom[]);
      setUsos((usosRes.data || []) as Uso[]);
      setContratacoes((contratacoesRes.data || []) as Contratacao[]);
      setPlanos(((planosRes.data || []) as Plano[]).filter((plano) => plano.codigo.endsWith("-2026") && plano.ativo));
      setSelecionadoId((atual) => atual || String(cuponsRes.data?.[0]?.id || ""));
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível carregar o gerenciador de cupons.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); }, []);

  const usosPorCupom = useMemo(() => {
    const mapa = new Map<string, Uso[]>();
    const contratos = new Map(contratacoes.map(item => [item.id,item]));
    usos.forEach((uso) => {
      const contrato = uso.contratacao_id ? contratos.get(uso.contratacao_id) : null;
      if (!contrato || ["cancelada","recusada"].includes(contrato.status)) return;
      const concluida = Boolean(contrato.pagamento_aprovado_em) ||
        (Number(contrato.valor_total) === 0 && ["pagamento_aprovado","aprovada","ativa","ativada"].includes(contrato.status));
      if (!concluida) return;
      mapa.set(uso.codigo_id, [...(mapa.get(uso.codigo_id) || []), uso]);
    });
    return mapa;
  }, [usos, contratacoes]);

  const contratoPorId = useMemo(
    () => new Map(contratacoes.map((contratacao) => [contratacao.id, contratacao])),
    [contratacoes],
  );

  const cuponsVisiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return cupons.filter((cupom) => {
      const status = rotuloStatus(cupom, usosPorCupom.get(cupom.id)?.length || 0);
      return (filtro === "todos" || status.toLocaleLowerCase("pt-BR") === filtro)
        && (!termo || [cupom.codigo, cupom.tipo_desconto, ...cupom.planos].join(" ").toLocaleLowerCase("pt-BR").includes(termo));
    });
  }, [cupons, busca, filtro, usosPorCupom]);

  const cupomSelecionado = cupons.find((cupom) => cupom.id === selecionadoId) || cuponsVisiveis[0] || null;
  const usosSelecionados = cupomSelecionado ? (usosPorCupom.get(cupomSelecionado.id) || []) : [];
  const clinicasUsaram = new Set(usos.map((uso) => {
    const contratacao = uso.contratacao_id ? contratoPorId.get(uso.contratacao_id) : null;
    return contratacao?.clinica_nome || "";
  }).filter(Boolean)).size;
  const cuponsAtivos = cupons.filter((cupom) => rotuloStatus(cupom, usosPorCupom.get(cupom.id)?.length || 0) === "Ativo").length;

  function abrirNovo() {
    setRascunho({ ...RASCUNHO_VAZIO });
  }
  function abrirEdicao(cupom: Cupom) {
    setRascunho({
      id: cupom.id,
      codigo: cupom.codigo,
      tipo_desconto: cupom.tipo_desconto,
      valor: Number(cupom.valor),
      planos: cupom.planos || [],
      valido_de: paraInputData(cupom.valido_de),
      valido_ate: paraInputData(cupom.valido_ate),
      limite_usos: cupom.limite_usos,
      limite_por_documento: cupom.limite_por_documento,
      ativo: cupom.ativo,
      somente_primeira_assinatura: cupom.somente_primeira_assinatura,
      duracao: cupom.duracao,
    });
    setSelecionadoId(cupom.id);
  }

  async function salvarCupom(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!rascunho) return;
    const codigo = normalizarCodigo(rascunho.codigo);
    if (codigo.length < 3) return void toast.error("Informe um código com pelo menos 3 caracteres.");
    if (rascunho.tipo_desconto === "percentual" && (rascunho.valor <= 0 || rascunho.valor > 100)) {
      return void toast.error("O desconto percentual deve ser maior que 0 e no máximo 100%.");
    }
    if (rascunho.tipo_desconto === "fixo" && rascunho.valor <= 0) {
      return void toast.error("Informe um valor fixo maior que zero.");
    }
    const inicio = paraIso(rascunho.valido_de);
    const fim = paraIso(rascunho.valido_ate);
    if (inicio && fim && new Date(inicio).getTime() > new Date(fim).getTime()) {
      return void toast.error("O início da validade não pode ser posterior ao fim.");
    }
    if (cupons.some((cupom) => cupom.id !== rascunho.id && cupom.codigo === codigo)) {
      return void toast.error("Já existe um cupom com este código.");
    }

    setSalvando(true);
    try {
      const id = rascunho.id || crypto.randomUUID();
      const payload = {
        id,
        codigo,
        tipo_desconto: rascunho.tipo_desconto,
        valor: Number(rascunho.valor),
        planos: rascunho.planos,
        valido_de: inicio,
        valido_ate: fim,
        limite_usos: rascunho.limite_usos,
        limite_por_documento: rascunho.limite_por_documento,
        ativo: rascunho.ativo,
        somente_primeira_assinatura: rascunho.somente_primeira_assinatura,
        duracao: rascunho.duracao,
        updated_at: new Date().toISOString(),
      };
      const [drive, banco] = await Promise.all([
        (supabase as any).from("oricse_codigos_promocionais").upsert(payload, { onConflict: "id" }),
        (supabaseBanco as any).from("oricse_codigos_promocionais").upsert(payload, { onConflict: "id" }),
      ]);
      if (drive.error || banco.error) throw new Error(drive.error?.message || banco.error?.message);
      setRascunho(null);
      setSelecionadoId(id);
      toast.success(rascunho.id ? "Cupom atualizado." : "Cupom criado e pronto para o checkout.");
      await carregar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar o cupom.");
    } finally {
      setSalvando(false);
    }
  }

  async function alterarStatus(cupom: Cupom, ativo: boolean) {
    setAlterandoStatus(cupom.id);
    try {
      const atualizacao = { ativo, updated_at: new Date().toISOString() };
      const [drive, banco] = await Promise.all([
        (supabase as any).from("oricse_codigos_promocionais").update(atualizacao).eq("id", cupom.id),
        (supabaseBanco as any).from("oricse_codigos_promocionais").update(atualizacao).eq("id", cupom.id),
      ]);
      if (drive.error || banco.error) throw new Error(drive.error?.message || banco.error?.message);
      toast.success(ativo ? "Cupom reativado." : "Cupom pausado. Ele não poderá mais ser aplicado.");
      await carregar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível alterar o status do cupom.");
    } finally {
      setAlterandoStatus(null);
    }
  }

  async function copiarCodigo(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success("Código copiado.");
    } catch {
      toast.error("Não foi possível copiar o código.");
    }
  }

  if (carregando || autorizado === null) {
    return <main className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">Carregando gerenciador de cupons...</main>;
  }
  if (!autorizado) return null;

  return <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary">
          <ArrowLeft size={18}/> Admin ORICSE
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-bold text-primary">
          <ShieldCheck size={15}/> Controle central de descontos
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Receita e aquisição</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Gerenciador de cupons</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Crie descontos para os planos da ORICSE, defina regras de uso e acompanhe exatamente quais clínicas utilizaram cada código.</p>
        </div>
        <button type="button" onClick={abrirNovo} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
          <Plus size={18}/> Criar cupom
        </button>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-center gap-2 text-muted-foreground"><TicketPercent size={17}/><span className="text-xs font-bold uppercase">Ativos</span></div><strong className="mt-3 block text-3xl font-black">{cuponsAtivos}</strong><p className="mt-1 text-xs text-muted-foreground">códigos disponíveis agora</p></div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-center gap-2 text-muted-foreground"><Check size={17}/><span className="text-xs font-bold uppercase">Usos registrados</span></div><strong className="mt-3 block text-3xl font-black">{usos.length}</strong><p className="mt-1 text-xs text-muted-foreground">aplicações em contratações</p></div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-center gap-2 text-muted-foreground"><UsersRound size={17}/><span className="text-xs font-bold uppercase">Clínicas alcançadas</span></div><strong className="mt-3 block text-3xl font-black">{clinicasUsaram}</strong><p className="mt-1 text-xs text-muted-foreground">clínicas com cupom utilizado</p></div>
      </section>

      {rascunho && <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-black">{rascunho.id ? "Editar cupom" : "Novo cupom"}</h2><p className="mt-1 text-sm text-muted-foreground">As regras abaixo são validadas no checkout; o desconto é recalculado no servidor.</p></div>
          <button type="button" onClick={() => setRascunho(null)} className="min-h-10 rounded-xl border px-3 text-sm font-bold">Cancelar</button>
        </div>
        <form onSubmit={(evento) => void salvarCupom(evento)} className="mt-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-bold">Código do cupom
              <input required maxLength={40} value={rascunho.codigo} onChange={(e) => setRascunho({ ...rascunho, codigo: normalizarCodigo(e.target.value) })} placeholder="ORICSE20" className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-black tracking-widest uppercase"/>
            </label>
            <label className="text-xs font-bold">Tipo de desconto
              <select value={rascunho.tipo_desconto} onChange={(e) => setRascunho({ ...rascunho, tipo_desconto: e.target.value as RascunhoCupom["tipo_desconto"] })} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal">
                <option value="percentual">Percentual (%)</option><option value="fixo">Valor fixo (R$)</option>
              </select>
            </label>
            <label className="text-xs font-bold">{rascunho.tipo_desconto === "percentual" ? "Percentual de desconto" : "Valor de desconto"}
              <input type="number" min="0.01" max={rascunho.tipo_desconto === "percentual" ? 100 : undefined} step="0.01" value={rascunho.valor} onChange={(e) => setRascunho({ ...rascunho, valor: Number(e.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"/>
            </label>
            <label className="text-xs font-bold">Efeito do desconto
              <select value={rascunho.duracao} onChange={(e) => setRascunho({ ...rascunho, duracao: e.target.value as RascunhoCupom["duracao"] })} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal">
                <option value="primeiro_mes">Somente primeira cobrança</option><option value="recorrente">Recorrente na assinatura</option>
              </select>
            </label>
            <label className="text-xs font-bold">Válido a partir de
              <input type="datetime-local" value={rascunho.valido_de} onChange={(e) => setRascunho({ ...rascunho, valido_de: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"/>
            </label>
            <label className="text-xs font-bold">Válido até
              <input type="datetime-local" value={rascunho.valido_ate} onChange={(e) => setRascunho({ ...rascunho, valido_ate: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"/>
            </label>
            <label className="text-xs font-bold">Limite total de usos
              <input type="number" min="1" value={rascunho.limite_usos ?? ""} onChange={(e) => setRascunho({ ...rascunho, limite_usos: e.target.value ? Number(e.target.value) : null })} placeholder="Sem limite" className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"/>
            </label>
            <label className="text-xs font-bold">Limite por CPF/CNPJ
              <input type="number" min="1" value={rascunho.limite_por_documento ?? ""} onChange={(e) => setRascunho({ ...rascunho, limite_por_documento: e.target.value ? Number(e.target.value) : null })} placeholder="Sem limite" className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"/>
            </label>
          </div>

          <div className="mt-4 rounded-xl border bg-secondary/25 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Planos elegíveis</h3><p className="mt-1 text-xs text-muted-foreground">Sem nenhum plano marcado, o cupom valerá para todos os planos ativos.</p></div><label className="inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!rascunho.planos.length} onChange={() => setRascunho({ ...rascunho, planos: [] })}/> Todos os planos</label></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {planos.map((plano) => { const marcado = rascunho.planos.includes(plano.codigo); return <label key={plano.codigo} className={marcado ? "inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground" : "inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm font-bold"}><input className="sr-only" type="checkbox" checked={marcado} onChange={() => setRascunho({ ...rascunho, planos: marcado ? rascunho.planos.filter((codigo) => codigo !== plano.codigo) : [...rascunho.planos, plano.codigo] })}/>{plano.nome}</label>; })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={rascunho.ativo} onChange={(e) => setRascunho({ ...rascunho, ativo: e.target.checked })}/> Ativo ao salvar</label>
            <label className="inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={rascunho.somente_primeira_assinatura} onChange={(e) => setRascunho({ ...rascunho, somente_primeira_assinatura: e.target.checked })}/> Apenas primeira assinatura deste CPF/CNPJ</label>
          </div>

          <div className="mt-5 flex justify-end"><button type="submit" disabled={salvando} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50"><Check size={17}/>{salvando ? "Salvando..." : "Salvar cupom"}</button></div>
        </form>
      </section>}

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-black">Códigos e regras</h2><p className="mt-1 text-sm text-muted-foreground">Acompanhe disponibilidade, limites e utilização de cada código em tempo real.</p></div>
          <button type="button" onClick={() => void carregar()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold"><RotateCcw size={16}/> Atualizar dados</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="relative min-w-[240px] flex-[2_1_300px]"><Search size={16} className="absolute left-3 top-3 text-muted-foreground"/><input value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Pesquisar cupom" placeholder="Pesquisar código ou plano" className="min-h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm"/></label>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar status dos cupons" className="min-h-11 rounded-xl border bg-background px-3 text-sm"><option value="todos">Todos os status</option><option value="ativo">Ativos</option><option value="agendado">Agendados</option><option value="pausado">Pausados</option><option value="encerrado">Encerrados</option><option value="esgotado">Esgotados</option></select>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.85fr)]">
          <div className="overflow-hidden rounded-xl border">
            <div className="max-h-[650px] overflow-y-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-secondary"><tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Regra</th><th className="px-4 py-3">Uso</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
                <tbody>{cuponsVisiveis.map((cupom) => { const usosDoCupom = usosPorCupom.get(cupom.id) || []; const status = rotuloStatus(cupom, usosDoCupom.length); const desconto = cupom.tipo_desconto === "percentual" ? String(cupom.valor) + "%" : dinheiro(cupom.valor); return <tr key={cupom.id} className={cupom.id === cupomSelecionado?.id ? "border-t bg-primary/5" : "border-t"}>
                  <td className="px-4 py-3"><button type="button" onClick={() => setSelecionadoId(cupom.id)} className="text-left"><span className="block font-black tracking-wide">{cupom.codigo}</span><span className="mt-1 block text-[11px] text-muted-foreground">{cupom.planos.length ? cupom.planos.join(" · ") : "Todos os planos"}</span></button></td>
                  <td className="px-4 py-3"><span className="font-bold">{desconto}</span><span className="mt-1 block text-[11px] text-muted-foreground">{cupom.duracao === "recorrente" ? "Recorrente" : "Primeira cobrança"}{cupom.somente_primeira_assinatura ? " · nova assinatura" : ""}</span></td>
                  <td className="px-4 py-3"><span className="font-bold">{usosDoCupom.length}{cupom.limite_usos !== null ? " / " + cupom.limite_usos : ""}</span><span className="mt-1 block text-[11px] text-muted-foreground">usos concluídos</span></td>
                  <td className="px-4 py-3"><span className={"inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase " + classeStatus(status)}>{status}</span></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => void copiarCodigo(cupom.codigo)} className="rounded-lg border p-2" title="Copiar código" aria-label={"Copiar " + cupom.codigo}><Copy size={15}/></button><button type="button" onClick={() => abrirEdicao(cupom)} className="rounded-lg border p-2" title="Editar cupom" aria-label={"Editar " + cupom.codigo}><Pencil size={15}/></button><button type="button" disabled={alterandoStatus === cupom.id} onClick={() => void alterarStatus(cupom, !cupom.ativo)} className="rounded-lg border p-2 disabled:opacity-50" title={cupom.ativo ? "Pausar cupom" : "Reativar cupom"} aria-label={cupom.ativo ? "Pausar " + cupom.codigo : "Reativar " + cupom.codigo}><PauseCircle size={15}/></button></div></td>
                </tr>; })}{!cuponsVisiveis.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum cupom encontrado.</td></tr>}</tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-xl border bg-secondary/20 p-4">
            {!cupomSelecionado ? <div className="py-12 text-center text-sm text-muted-foreground">Selecione um cupom para ver os usos por clínica.</div> : <><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Detalhamento</p><h3 className="mt-1 text-xl font-black">{cupomSelecionado.codigo}</h3></div><button type="button" onClick={() => abrirEdicao(cupomSelecionado)} className="rounded-lg border bg-background p-2" aria-label="Editar cupom selecionado"><Pencil size={16}/></button></div>
              <div className="mt-4 grid gap-2 text-sm"><div className="rounded-lg border bg-background p-3"><span className="text-xs text-muted-foreground">Validade</span><strong className="mt-1 block">{dataBR(cupomSelecionado.valido_de)} até {dataBR(cupomSelecionado.valido_ate)}</strong></div><div className="rounded-lg border bg-background p-3"><span className="text-xs text-muted-foreground">Regra de uso</span><strong className="mt-1 block">{cupomSelecionado.somente_primeira_assinatura ? "Somente primeira assinatura" : "Pode ser usado por assinantes existentes"}</strong></div></div>
              <div className="mt-5 flex items-center justify-between"><div><h4 className="font-black">Clínicas que usaram</h4><p className="mt-1 text-xs text-muted-foreground">{usosSelecionados.length} uso(s) registrado(s)</p></div><Eye size={17} className="text-muted-foreground"/></div>
              <div className="mt-3 max-h-[330px] space-y-2 overflow-y-auto pr-1">{!usosSelecionados.length && <p className="rounded-lg border border-dashed bg-background p-4 text-center text-sm text-muted-foreground">Nenhuma clínica utilizou este cupom ainda.</p>}{usosSelecionados.map((uso) => { const contratacao = uso.contratacao_id ? contratoPorId.get(uso.contratacao_id) : null; return <div key={uso.id} className="rounded-lg border bg-background p-3"><div className="flex items-start justify-between gap-3"><div><strong className="block">{contratacao?.clinica_nome || "Contratação sem clínica vinculada"}</strong><span className="mt-1 block text-xs text-muted-foreground">{contratacao ? contratacao.plano_nome + " · " + textoCiclo(contratacao.ciclo) : "Aguardando vínculo da contratação"}</span></div><span className="text-right text-[11px] text-muted-foreground">{dataBR(uso.created_at)}</span></div>{contratacao && <p className="mt-2 text-xs text-emerald-700">Desconto aplicado: {dinheiro(contratacao.promo_desconto)} · total {dinheiro(contratacao.promo_valor_final)}</p>}</div>; })}</div>
            </>}
          </aside>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm"><CalendarClock size={17} className="mr-2 inline text-primary"/><strong>Como a regra é aplicada:</strong> o checkout confere validade, plano elegível, limite total, limite por CPF/CNPJ e a condição de primeira assinatura antes de calcular o desconto.</section>
    </div>
  </main>;
}
