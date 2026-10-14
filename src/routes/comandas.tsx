import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleDollarSign,
  PawPrint,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase, supabaseConfigurado } from "@/integrations/supabase/client";
import { type ItemCatalogo, type RegraComissao, percentualComissaoNaData } from "@/lib/comissoes";
import {
  type Comanda,
  type ItemComanda,
  type OrigemComanda,
  lerComandas,
  proximoNumeroComanda,
  registrarLancamentoComanda,
  saldoComanda,
  salvarComandas,
  totalComanda,
  totalPagoComanda,
} from "@/lib/comandas";

export const Route = createFileRoute("/comandas")({ component: Comandas });

type Tutor = {
  id: string;
  nome: string;
  codigoPublico?: string;
  codigo_publico?: string;
  cpfCnpj?: string;
};
type Animal = { id: string; nome: string; tutorId: string; especie?: string };
type Responsavel = { id: string; nome: string };

const TUTORES_KEY = "oricse-tutores-v1";
const ANIMAIS_KEY = "oricse-animais-v1";
const ORIGENS: OrigemComanda[] = ["Recepção", "Consultório", "Internação"];
const FORMAS_PAGAMENTO = [
  "Pix",
  "Dinheiro",
  "Cartão de débito",
  "Cartão de crédito",
  "Transferência",
  "Boleto",
  "Outro",
];

function lerLista<T>(chave: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const dados: unknown = JSON.parse(window.localStorage.getItem(chave) || "[]");
    return Array.isArray(dados) ? (dados as T[]) : [];
  } catch {
    return [];
  }
}

function dinheiro(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function valorNumerico(valor: string): number {
  const limpo = valor.trim().replace(/[^\d,.-]/g, "");
  return Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
}

function dataHora(valor: string): string {
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? "—"
    : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function numeroFormatado(numero: number): string {
  return String(numero).padStart(5, "0");
}

function origemDaUrl(): OrigemComanda {
  if (typeof window === "undefined") return "Recepção";
  const origem = new URLSearchParams(window.location.search).get("origem");
  return (
    ORIGENS.find(
      (item) => item.toLocaleLowerCase("pt-BR") === origem?.toLocaleLowerCase("pt-BR"),
    ) || "Recepção"
  );
}

function Comandas() {
  const [comandas, setComandas] = useState<Comanda[]>(lerComandas);
  const [tutores] = useState<Tutor[]>(() => lerLista<Tutor>(TUTORES_KEY));
  const [animais] = useState<Animal[]>(() => lerLista<Animal>(ANIMAIS_KEY));
  const [responsavel, setResponsavel] = useState<Responsavel>({ id: "", nome: "Equipe clínica" });
  const [comandaSelecionadaId, setComandaSelecionadaId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("comandaId");
  });
  const [busca, setBusca] = useState("");
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [origemNova, setOrigemNova] = useState<OrigemComanda>(origemDaUrl);
  const [tutorIdNovo, setTutorIdNovo] = useState("");
  const [animalIdNovo, setAnimalIdNovo] = useState("");
  const [descricaoItem, setDescricaoItem] = useState("");
  const [catalogoItemId, setCatalogoItemId] = useState("");
  const [quantidadeItem, setQuantidadeItem] = useState("1");
  const [valorItem, setValorItem] = useState("");
  const [catalogo, setCatalogo] = useState<ItemCatalogo[]>([]);
  const [regrasComissao, setRegrasComissao] = useState<RegraComissao[]>([]);
  const [carregandoConfiguracaoComissao, setCarregandoConfiguracaoComissao] = useState(true);
  const [erroConfiguracaoComissao, setErroConfiguracaoComissao] = useState(false);
  const [valorPagamento, setValorPagamento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState(FORMAS_PAGAMENTO[0] || "Pix");
  const [modalCortesia, setModalCortesia] = useState(false);
  const [justificativaCortesia, setJustificativaCortesia] = useState("");
  const [carregandoResponsavel, setCarregandoResponsavel] = useState(true);

  useEffect(() => {
    let ativo = true;
    async function carregarResponsavel() {
      if (!supabaseConfigurado) {
        setCarregandoResponsavel(false);
        return;
      }
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!data.user)
          throw new Error("Não há um usuário autenticado para registrar as ações da comanda.");
        if (!ativo) return;
        let nome = data.user.email || data.user.id;
        const { data: vinculo, error: erroVinculo } = await supabase
          .from("clinica_usuarios")
          .select("clinica_id")
          .eq("user_id", data.user.id)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();
        if (erroVinculo) throw erroVinculo;
        if (!vinculo?.clinica_id) throw new Error("Não há uma clínica ativa vinculada ao usuário.");
        const [perfil, itensResult, regrasResult] = await Promise.all([
          supabase
            .from("app_users")
            .select("username,email")
            .eq("user_id", data.user.id)
            .maybeSingle(),
          supabase
            .from("oricse_catalogo_itens")
            .select("id,clinica_id,tipo,nome,categoria,valor,estoque_atual,estoque_minimo,ativo")
            .eq("clinica_id", vinculo.clinica_id)
            .eq("ativo", true)
            .order("nome"),
          supabase.from("oricse_regras_comissao").select("*").eq("clinica_id", vinculo.clinica_id),
        ]);
        if (perfil.error) throw perfil.error;
        if (itensResult.error) throw itensResult.error;
        if (regrasResult.error) throw regrasResult.error;
        if (!ativo) return;
        nome = perfil.data?.username ? `@${perfil.data.username}` : perfil.data?.email || nome;
        setResponsavel({ id: data.user.id, nome });
        setCatalogo((itensResult.data || []) as ItemCatalogo[]);
        setRegrasComissao((regrasResult.data || []) as RegraComissao[]);
        setErroConfiguracaoComissao(false);
      } catch (error) {
        setErroConfiguracaoComissao(true);
        console.error("Não foi possível identificar o responsável atual da comanda:", error);
        toast.error(
          "Não foi possível identificar o usuário responsável. Entre novamente no sistema.",
        );
      } finally {
        if (ativo) {
          setCarregandoResponsavel(false);
          setCarregandoConfiguracaoComissao(false);
        }
      }
    }
    void carregarResponsavel();
    const atualizar = () => setComandas(lerComandas());
    window.addEventListener("storage", atualizar);
    window.addEventListener("oricse-comandas-atualizadas", atualizar);
    return () => {
      ativo = false;
      window.removeEventListener("storage", atualizar);
      window.removeEventListener("oricse-comandas-atualizadas", atualizar);
    };
  }, []);

  const animaisDoTutor = useMemo(
    () =>
      animais
        .filter((animal) => animal.tutorId === tutorIdNovo)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [animais, tutorIdNovo],
  );

  const comandasFiltradas = useMemo(() => {
    const consulta = busca.trim().toLocaleLowerCase("pt-BR");
    return comandas
      .filter((comanda) =>
        mostrarHistorico ? comanda.status === "Finalizada" : comanda.status === "Aberta",
      )
      .filter(
        (comanda) =>
          !consulta ||
          [
            comanda.tutorNome,
            comanda.animalNome,
            comanda.abertaPor,
            `#${numeroFormatado(comanda.numero)}`,
          ].some((valor) => valor.toLocaleLowerCase("pt-BR").includes(consulta)),
      )
      .sort((a, b) => b.abertaEm.localeCompare(a.abertaEm));
  }, [busca, comandas, mostrarHistorico]);

  const comandaSelecionada = comandas.find((comanda) => comanda.id === comandaSelecionadaId);

  function salvarEstado(proximas: Comanda[]): boolean {
    try {
      salvarComandas(proximas);
      setComandas(proximas);
      return true;
    } catch (error) {
      console.error("Não foi possível salvar as comandas:", error);
      toast.error(
        "Não foi possível salvar a comanda. Verifique o espaço disponível e tente novamente.",
      );
      return false;
    }
  }

  function abrirComanda(evento: FormEvent) {
    evento.preventDefault();
    const tutor = tutores.find((item) => item.id === tutorIdNovo);
    const animal = animaisDoTutor.find((item) => item.id === animalIdNovo);
    if (!tutor) return void toast.error("Selecione o tutor.");
    if (!animal) return void toast.error("Selecione o animal.");
    if (!responsavel.id)
      return void toast.error(
        "Não foi possível identificar o usuário responsável. Atualize a página ou entre novamente.",
      );

    const nova: Comanda = {
      id: crypto.randomUUID(),
      numero: proximoNumeroComanda(comandas),
      status: "Aberta",
      origem: origemNova,
      tutorId: tutor.id,
      tutorNome: tutor.nome,
      animalId: animal.id,
      animalNome: animal.nome,
      abertaEm: new Date().toISOString(),
      abertaPor: responsavel.nome,
      abertaPorId: responsavel.id,
      itens: [],
      pagamentos: [],
    };
    if (!salvarEstado([nova, ...comandas])) return;
    setComandaSelecionadaId(nova.id);
    setTutorIdNovo("");
    setAnimalIdNovo("");
    setDescricaoItem("");
    toast.success(`Comanda #${numeroFormatado(nova.numero)} aberta para ${animal.nome}.`);
  }

  function adicionarItem(evento: FormEvent) {
    evento.preventDefault();
    if (!comandaSelecionada || comandaSelecionada.status !== "Aberta") return;
    if (erroConfiguracaoComissao)
      return void toast.error(
        "Não foi possível carregar as regras de comissão. Atualize a página antes de incluir itens.",
      );
    const quantidade = Number(quantidadeItem);
    const valorInformado = valorNumerico(valorItem);
    const unitario = Math.round((valorInformado + Number.EPSILON) * 100) / 100;
    if (!descricaoItem.trim()) return void toast.error("Informe o item ou serviço.");
    if (!Number.isFinite(quantidade) || quantidade <= 0)
      return void toast.error("Informe uma quantidade válida.");
    if (!Number.isFinite(unitario) || unitario <= 0)
      return void toast.error("Informe um valor válido.");

    const criadoEm = new Date();
    const diaComissao = criadoEm.getDay();
    const percentual = percentualComissaoNaData(regrasComissao, catalogoItemId || null, criadoEm);
    const valorComissao = Math.round(quantidade * unitario * percentual) / 100;
    const item: ItemComanda = {
      id: crypto.randomUUID(),
      descricao: descricaoItem.trim(),
      quantidade,
      valorUnitario: unitario,
      criadoEm: criadoEm.toISOString(),
      criadoPor: responsavel.nome,
      ...(catalogoItemId ? { catalogoItemId } : {}),
      tipo: catalogo.find((catalogoItem) => catalogoItem.id === catalogoItemId)?.tipo || "avulso",
      diaComissao,
      percentualComissao: percentual,
      valorComissao,
      comissaoFuncionarioId: responsavel.id,
      comissaoFuncionario: responsavel.nome,
    };
    const atualizada = { ...comandaSelecionada, itens: [...comandaSelecionada.itens, item] };
    if (
      !salvarEstado(
        comandas.map((comanda) => (comanda.id === atualizada.id ? atualizada : comanda)),
      )
    )
      return;
    setDescricaoItem("");
    setCatalogoItemId("");
    setQuantidadeItem("1");
    setValorItem("");
    toast.success("Item incluído na comanda.");
  }

  function removerItem(itemId: string) {
    if (!comandaSelecionada || comandaSelecionada.status !== "Aberta") return;
    const itens = comandaSelecionada.itens.filter((item) => item.id !== itemId);
    const novoTotal = itens.reduce(
      (total, item) =>
        total + Math.round((item.quantidade * item.valorUnitario + Number.EPSILON) * 100) / 100,
      0,
    );
    if (novoTotal < totalPagoComanda(comandaSelecionada)) {
      return void toast.error(
        "Não é possível remover este item porque o total ficaria menor que o valor já pago.",
      );
    }
    const atualizada = { ...comandaSelecionada, itens };
    salvarEstado(comandas.map((comanda) => (comanda.id === atualizada.id ? atualizada : comanda)));
  }

  function registrarPagamento(evento: FormEvent) {
    evento.preventDefault();
    if (!comandaSelecionada || comandaSelecionada.status !== "Aberta") return;
    const valorBruto = valorNumerico(valorPagamento);
    const valor = Math.round((valorBruto + Number.EPSILON) * 100) / 100;
    if (!Number.isFinite(valor) || valor <= 0)
      return void toast.error("Informe um valor de pagamento válido.");
    const saldo = saldoComanda(comandaSelecionada);
    if (valor > saldo + 0.009)
      return void toast.error(`O pagamento não pode exceder o saldo de ${dinheiro(saldo)}.`);

    const pagamento = {
      id: crypto.randomUUID(),
      valor,
      formaPagamento,
      data: new Date().toISOString(),
      registradoPor: responsavel.nome,
    };
    try {
      registrarLancamentoComanda({
        id: `comanda-pagamento-${pagamento.id}`,
        tipo: "Entrada",
        descricao: `Pagamento da comanda #${numeroFormatado(comandaSelecionada.numero)} · ${comandaSelecionada.animalNome}`,
        categoria: "Pagamento de comanda",
        valor,
        data: pagamento.data.slice(0, 10),
        formaPagamento,
        tutor: comandaSelecionada.tutorNome,
        tutorId: comandaSelecionada.tutorId,
        status: "Pago",
        comandaId: comandaSelecionada.id,
        registradoPor: responsavel.nome,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível registrar o pagamento.",
      );
      return;
    }
    const atualizada = {
      ...comandaSelecionada,
      pagamentos: [...comandaSelecionada.pagamentos, pagamento],
    };
    if (
      !salvarEstado(
        comandas.map((comanda) => (comanda.id === atualizada.id ? atualizada : comanda)),
      )
    )
      return;
    setValorPagamento("");
    toast.success("Pagamento registrado no caixa.");
  }

  function finalizarComanda() {
    if (!comandaSelecionada || comandaSelecionada.status !== "Aberta") return;
    if (!comandaSelecionada.itens.length)
      return void toast.error("Inclua ao menos um item ou serviço antes de finalizar.");
    if (saldoComanda(comandaSelecionada) > 0.009) {
      setJustificativaCortesia("");
      setModalCortesia(true);
      return;
    }
    const finalizada: Comanda = {
      ...comandaSelecionada,
      status: "Finalizada",
      finalizadaEm: new Date().toISOString(),
      finalizadaPor: responsavel.nome,
      finalizadaPorId: responsavel.id,
    };
    if (
      !salvarEstado(
        comandas.map((comanda) => (comanda.id === finalizada.id ? finalizada : comanda)),
      )
    )
      return;
    toast.success("Comanda finalizada.");
  }

  function finalizarComCortesia(evento: FormEvent) {
    evento.preventDefault();
    if (!comandaSelecionada || comandaSelecionada.status !== "Aberta") return;
    const saldo = saldoComanda(comandaSelecionada);
    const justificativa = justificativaCortesia.trim();
    if (saldo <= 0.009)
      return void toast.error("Esta comanda já está quitada. Finalize pelo botão principal.");
    if (!justificativa) return void toast.error("Informe o motivo da cortesia para registro.");
    if (!responsavel.id)
      return void toast.error("Não foi possível identificar o usuário responsável.");

    const cortesia = {
      justificativa,
      valor: saldo,
      registradaEm: new Date().toISOString(),
      registradaPor: responsavel.nome,
      registradaPorId: responsavel.id,
    };
    try {
      registrarLancamentoComanda({
        id: `comanda-cortesia-${comandaSelecionada.id}`,
        tipo: "Saída",
        descricao: `Cortesia da clínica · comanda #${numeroFormatado(comandaSelecionada.numero)}`,
        categoria: "Cortesia concedida",
        valor: saldo,
        data: cortesia.registradaEm.slice(0, 10),
        formaPagamento: "Cortesia",
        tutor: comandaSelecionada.tutorNome,
        tutorId: comandaSelecionada.tutorId,
        status: "Pago",
        observacao: `${comandaSelecionada.animalNome} · ${justificativa} · Autorizada por ${responsavel.nome}.`,
        comandaId: comandaSelecionada.id,
        registradoPor: responsavel.nome,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível registrar a cortesia no caixa.",
      );
      return;
    }
    const finalizada: Comanda = {
      ...comandaSelecionada,
      status: "Finalizada",
      cortesia,
      finalizadaEm: cortesia.registradaEm,
      finalizadaPor: responsavel.nome,
      finalizadaPorId: responsavel.id,
    };
    if (
      !salvarEstado(
        comandas.map((comanda) => (comanda.id === finalizada.id ? finalizada : comanda)),
      )
    )
      return;
    setModalCortesia(false);
    toast.success("Cortesia registrada como despesa da clínica e comanda finalizada.");
  }

  const inputClass =
    "min-h-11 w-full rounded-xl border bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";
  const percentualPrevistoComissao = percentualComissaoNaData(
    regrasComissao,
    catalogoItemId || null,
    new Date(),
  );
  const valorPrevistoComissao =
    (Number(quantidadeItem) *
      (Number.isFinite(valorNumerico(valorItem)) ? valorNumerico(valorItem) : 0) *
      percentualPrevistoComissao) /
    100;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <a
        href="/financeiro"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft size={17} /> Voltar ao financeiro
      </a>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            Atendimento · financeiro
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Comandas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize os serviços, pagamentos e o fechamento de cada atendimento.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck size={16} className="text-primary" />
          {responsavel.nome}
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(280px,.82fr)_minmax(0,1.5fr)]">
        <section className="h-fit rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Plus size={18} className="text-primary" />
            <h2 className="font-bold">Abrir comanda</h2>
          </div>
          <form onSubmit={abrirComanda} className="space-y-3">
            <label className="block text-sm font-semibold">
              Local de abertura
              <select
                value={origemNova}
                onChange={(evento) => setOrigemNova(evento.target.value as OrigemComanda)}
                className={`${inputClass} mt-1`}
              >
                {ORIGENS.map((origem) => (
                  <option key={origem}>{origem}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Tutor
              <select
                value={tutorIdNovo}
                onChange={(evento) => {
                  setTutorIdNovo(evento.target.value);
                  setAnimalIdNovo("");
                }}
                className={`${inputClass} mt-1`}
              >
                <option value="">Selecione o tutor</option>
                {[...tutores]
                  .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                  .map((tutor) => (
                    <option key={tutor.id} value={tutor.id}>
                      {tutor.nome}
                      {tutor.codigoPublico || tutor.codigo_publico
                        ? ` · ${tutor.codigoPublico || tutor.codigo_publico}`
                        : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Animal
              <select
                value={animalIdNovo}
                onChange={(evento) => setAnimalIdNovo(evento.target.value)}
                disabled={!tutorIdNovo}
                className={`${inputClass} mt-1 disabled:bg-muted/40`}
              >
                <option value="">
                  {tutorIdNovo ? "Selecione o animal" : "Escolha primeiro o tutor"}
                </option>
                {animaisDoTutor.map((animal) => (
                  <option key={animal.id} value={animal.id}>
                    {animal.nome}
                    {animal.especie ? ` · ${animal.especie}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={carregandoResponsavel || !responsavel.id}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ReceiptText size={17} /> Criar comanda
            </button>
          </form>
          {tutores.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Cadastre o tutor e o animal antes de abrir uma comanda.
            </p>
          )}
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border bg-white p-1">
              <button
                type="button"
                onClick={() => {
                  setMostrarHistorico(false);
                  setComandaSelecionadaId(null);
                }}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${!mostrarHistorico ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Abertas ({comandas.filter((comanda) => comanda.status === "Aberta").length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarHistorico(true);
                  setComandaSelecionadaId(null);
                }}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${mostrarHistorico ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Finalizadas
              </button>
            </div>
            <div className="relative min-w-[210px] flex-1 sm:max-w-xs">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Tutor, animal ou comanda"
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          {comandaSelecionada ? (
            <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b bg-primary/[0.025] p-4 sm:p-5">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setComandaSelecionadaId(null)}
                    className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft size={14} /> Voltar à lista
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold">
                      Comanda #{numeroFormatado(comandaSelecionada.numero)}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${comandaSelecionada.status === "Aberta" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}
                    >
                      {comandaSelecionada.status}
                    </span>
                  </div>
                  <p className="mt-1 font-semibold">
                    {comandaSelecionada.animalNome}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {comandaSelecionada.tutorNome}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {comandaSelecionada.origem} · Aberta {dataHora(comandaSelecionada.abertaEm)} por{" "}
                    {comandaSelecionada.abertaPor}
                  </p>
                </div>
                {comandaSelecionada.status === "Aberta" && (
                  <button
                    type="button"
                    onClick={finalizarComanda}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/25 bg-white px-3 font-semibold text-primary transition hover:bg-primary/5"
                  >
                    <Check size={16} /> Finalizar comanda
                  </button>
                )}
              </header>

              <div className="grid grid-cols-3 gap-2 border-b p-3 sm:gap-3 sm:p-4">
                <Resumo valor={dinheiro(totalComanda(comandaSelecionada))} rotulo="Total" />
                <Resumo valor={dinheiro(totalPagoComanda(comandaSelecionada))} rotulo="Pago" />
                <Resumo
                  valor={dinheiro(saldoComanda(comandaSelecionada))}
                  rotulo="Em aberto"
                  destaque={saldoComanda(comandaSelecionada) > 0.009}
                />
              </div>

              <div className="p-4 sm:p-5">
                {comandaSelecionada.status === "Aberta" && (
                  <form onSubmit={adicionarItem} className="mb-5 rounded-xl border bg-muted/15 p-3">
                    <h3 className="mb-2 text-sm font-bold">Adicionar serviço ou produto</h3>
                    <select
                      value={catalogoItemId}
                      disabled={carregandoConfiguracaoComissao}
                      onChange={(evento) => {
                        const id = evento.target.value;
                        const selecionado = catalogo.find((item) => item.id === id);
                        setCatalogoItemId(id);
                        if (selecionado) {
                          setDescricaoItem(selecionado.nome);
                          setValorItem(String(selecionado.valor));
                        }
                      }}
                      aria-label="Selecionar serviço ou produto cadastrado"
                      className={`${inputClass} mb-2`}
                    >
                      <option value="">Escolha do catálogo ou digite um item avulso</option>
                      {catalogo.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome} · {item.tipo === "servico" ? "Serviço" : "Produto"} ·{" "}
                          {dinheiro(item.valor)}
                        </option>
                      ))}
                    </select>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_88px_120px_auto]">
                      <input
                        value={descricaoItem}
                        onChange={(evento) => {
                          setDescricaoItem(evento.target.value);
                          if (
                            catalogoItemId &&
                            evento.target.value !==
                              catalogo.find((item) => item.id === catalogoItemId)?.nome
                          ) {
                            setCatalogoItemId("");
                          }
                        }}
                        placeholder="Ex.: Consulta, medicação, diária..."
                        aria-label="Descrição do item"
                        className={inputClass}
                      />
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={quantidadeItem}
                        onChange={(evento) => setQuantidadeItem(evento.target.value)}
                        aria-label="Quantidade"
                        className={inputClass}
                      />
                      <input
                        value={valorItem}
                        onChange={(evento) => setValorItem(evento.target.value)}
                        inputMode="decimal"
                        placeholder="Valor unitário"
                        aria-label="Valor unitário"
                        className={inputClass}
                      />
                      <button
                        type="submit"
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 font-semibold text-primary-foreground"
                      >
                        <Plus size={16} /> Incluir
                      </button>
                    </div>
                    {erroConfiguracaoComissao ? (
                      <p className="mt-2 text-xs font-medium text-rose-700">
                        Não foi possível carregar as regras. Atualize a página para adicionar itens
                        com a comissão correta.
                      </p>
                    ) : carregandoConfiguracaoComissao ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Carregando regras de comissão…
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Comissão prevista: {percentualPrevistoComissao}% (
                        {dinheiro(valorPrevistoComissao)}) · atribuída a{" "}
                        {comandaSelecionada.abertaPor}
                      </p>
                    )}
                  </form>
                )}

                <div>
                  <h3 className="mb-2 text-sm font-bold">Itens da comanda</h3>
                  {comandaSelecionada.itens.length ? (
                    <div className="divide-y rounded-xl border">
                      {comandaSelecionada.itens.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 px-3 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{item.descricao}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantidade} × {dinheiro(item.valorUnitario)}
                              {item.percentualComissao !== undefined && (
                                <>
                                  {" · "}
                                  {item.percentualComissao}% comissão (
                                  {dinheiro(item.valorComissao || 0)}) para{" "}
                                  {item.comissaoFuncionario || comandaSelecionada.abertaPor}
                                </>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <strong className="text-sm">
                              {dinheiro(item.quantidade * item.valorUnitario)}
                            </strong>
                            {comandaSelecionada.status === "Aberta" && (
                              <button
                                type="button"
                                onClick={() => removerItem(item.id)}
                                title="Remover item"
                                aria-label={`Remover ${item.descricao}`}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">
                      Ainda não há itens nesta comanda.
                    </p>
                  )}
                </div>

                {comandaSelecionada.status === "Aberta" && (
                  <form
                    onSubmit={registrarPagamento}
                    className="mt-5 rounded-xl border bg-muted/15 p-3"
                  >
                    <h3 className="mb-2 text-sm font-bold">Registrar pagamento</h3>
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input
                        value={valorPagamento}
                        onChange={(evento) => setValorPagamento(evento.target.value)}
                        inputMode="decimal"
                        placeholder={`Até ${dinheiro(saldoComanda(comandaSelecionada))}`}
                        aria-label="Valor do pagamento"
                        className={inputClass}
                      />
                      <select
                        value={formaPagamento}
                        onChange={(evento) => setFormaPagamento(evento.target.value)}
                        aria-label="Forma de pagamento"
                        className={inputClass}
                      >
                        {FORMAS_PAGAMENTO.map((forma) => (
                          <option key={forma}>{forma}</option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={saldoComanda(comandaSelecionada) <= 0.009}
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        <CircleDollarSign size={16} /> Registrar
                      </button>
                    </div>
                  </form>
                )}

                {comandaSelecionada.pagamentos.length > 0 && (
                  <div className="mt-5">
                    <h3 className="mb-2 text-sm font-bold">Pagamentos</h3>
                    <div className="divide-y rounded-xl border">
                      {comandaSelecionada.pagamentos.map((pagamento) => (
                        <div
                          key={pagamento.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                        >
                          <div>
                            <span className="font-semibold">
                              {dinheiro(pagamento.valor)} · {pagamento.formaPagamento}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {dataHora(pagamento.data)} por {pagamento.registradoPor}
                            </p>
                          </div>
                          <BadgeCheck size={17} className="text-emerald-700" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {comandaSelecionada.cortesia && (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm">
                    <p className="font-bold text-amber-950">
                      Cortesia da clínica · {dinheiro(comandaSelecionada.cortesia.valor)}
                    </p>
                    <p className="mt-1 text-amber-900">
                      {comandaSelecionada.cortesia.justificativa}
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      Registrada por {comandaSelecionada.cortesia.registradaPor} ·{" "}
                      {dataHora(comandaSelecionada.cortesia.registradaEm)} · contabilizada como
                      despesa da clínica
                    </p>
                  </div>
                )}

                {comandaSelecionada.status === "Finalizada" && (
                  <div className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                    <BadgeCheck size={17} className="mt-0.5 shrink-0" />
                    <p>
                      Finalizada por {comandaSelecionada.finalizadaPor || "Equipe clínica"} ·{" "}
                      {comandaSelecionada.finalizadaEm
                        ? dataHora(comandaSelecionada.finalizadaEm)
                        : "—"}
                    </p>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <div className="space-y-2">
              {comandasFiltradas.length ? (
                comandasFiltradas.map((comanda) => (
                  <button
                    key={comanda.id}
                    type="button"
                    onClick={() => setComandaSelecionadaId(comanda.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${comanda.status === "Aberta" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                    >
                      <ReceiptText size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2">
                        <strong>
                          #{numeroFormatado(comanda.numero)} · {comanda.animalNome}
                        </strong>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${comanda.status === "Aberta" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}
                        >
                          {comanda.status}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {comanda.tutorNome} · {comanda.origem} · {dataHora(comanda.abertaEm)}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-right sm:block">
                      <span className="block text-xs text-muted-foreground">
                        {comanda.status === "Aberta" ? "Saldo em aberto" : "Total"}
                      </span>
                      <strong className="text-sm">
                        {dinheiro(
                          comanda.status === "Aberta"
                            ? saldoComanda(comanda)
                            : totalComanda(comanda),
                        )}
                      </strong>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed bg-white px-5 py-12 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                    <PawPrint size={22} />
                  </span>
                  <h2 className="mt-3 font-bold">
                    {mostrarHistorico ? "Nenhuma comanda finalizada" : "Tudo em dia por aqui"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {mostrarHistorico
                      ? "As comandas concluídas aparecerão neste histórico."
                      : "Abra uma comanda para começar a registrar os itens e pagamentos do atendimento."}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {modalCortesia && comandaSelecionada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
          onMouseDown={(evento) => {
            if (evento.currentTarget === evento.target) setModalCortesia(false);
          }}
        >
          <form
            onSubmit={finalizarComCortesia}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  Exceção de fechamento
                </p>
                <h2 className="mt-1 text-xl font-bold">Registrar cortesia da clínica</h2>
              </div>
              <button
                type="button"
                onClick={() => setModalCortesia(false)}
                aria-label="Fechar"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 rounded-xl bg-amber-50 p-3">
              <p className="text-sm text-amber-950">
                O saldo de <strong>{dinheiro(saldoComanda(comandaSelecionada))}</strong> será
                lançado como despesa da clínica. A comanda ficará quitada e esta ação será vinculada
                ao seu usuário.
              </p>
            </div>
            <label className="mt-4 block text-sm font-semibold">
              Justificativa obrigatória
              <textarea
                autoFocus
                value={justificativaCortesia}
                onChange={(evento) => setJustificativaCortesia(evento.target.value)}
                placeholder="Descreva o motivo da cortesia..."
                className="mt-1 min-h-24 w-full resize-y rounded-xl border bg-white p-3 font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck size={14} /> Responsável: {responsavel.nome}
            </p>
            <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setModalCortesia(false)}
                className="min-h-10 rounded-xl border px-4 text-sm font-semibold"
              >
                Voltar à comanda
              </button>
              <button
                type="submit"
                className="min-h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
              >
                Registrar cortesia e finalizar
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function Resumo({
  valor,
  rotulo,
  destaque = false,
}: {
  valor: string;
  rotulo: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl p-3 ${destaque ? "bg-amber-50 text-amber-950" : "bg-muted/35"}`}
    >
      <p className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{rotulo}</p>
      <p
        className={`mt-1 truncate text-sm font-bold sm:text-lg ${destaque ? "text-amber-800" : ""}`}
      >
        {valor}
      </p>
    </div>
  );
}
