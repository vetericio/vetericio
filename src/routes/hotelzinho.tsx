import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  BedDouble,
  CalendarDays,
  Check,
  Clock3,
  Dog,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { digitarCentavos } from "@/lib/moeda-centavos";
import { usePermissoes } from "@/hooks/usePermissoes";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";

export const Route = createFileRoute("/hotelzinho")({ component: Hotelzinho });
const cacheHotel = new Map<string, {em:number; dados:any[]}>();

type Tutor = { id: string; nome: string; telefone: string | null };
type Animal = { id: string; nome: string; tutor_id: string; especie: string };
type Acomodacao = {
  id: string;
  nome: string;
  especie: string;
  capacidade: number;
  descricao: string;
  ativa: boolean;
};
type Estadia = {
  id: string;
  animal_id: string;
  tutor_id: string;
  acomodacao_id: string | null;
  status: "reservada" | "hospedado" | "concluida" | "cancelada";
  chegada_prevista: string;
  saida_prevista: string;
  checkin_em: string | null;
  checkout_em: string | null;
  alimentacao: string;
  medicacoes: string;
  restricoes: string;
  instrucoes: string;
  pertences: string[];
  observacoes: string;
  valor_diaria_centavos: number;
  valor_final_centavos: number | null;
};
type Cuidado = {
  id: string;
  estadia_id: string;
  tipo: "alimentacao" | "passeio" | "medicacao" | "observacao";
  descricao: string;
  ocorrido_em: string;
};
type Extra = {id:string;estadia_id:string;categoria:string;descricao:string;quantidade:number;valor_unitario_centavos:number;created_at:string};
type Atualizacao = { id: string; estadia_id: string; mensagem: string; created_at: string };
type Aba =
  | "painel"
  | "reservas"
  | "checkin"
  | "hospedes"
  | "cuidados"
  | "extras"
  | "tutores"
  | "checkout"
  | "acomodacoes";

const ABAS: { id: Aba; nome: string; icone: typeof BedDouble }[] = [
  { id: "painel", nome: "Painel do hotel", icone: CalendarDays },
  { id: "reservas", nome: "Reservas", icone: CalendarDays },
  { id: "checkin", nome: "Check-in", icone: Check },
  { id: "hospedes", nome: "Hóspedes ativos", icone: Dog },
  { id: "cuidados", nome: "Rotina e cuidados", icone: Utensils },
  { id: "extras", nome: "Acrescentar item à estadia", icone: Plus },
  { id: "tutores", nome: "Atualizações para tutores", icone: MessageCircle },
  { id: "checkout", nome: "Check-out", icone: Clock3 },
  { id: "acomodacoes", nome: "Acomodações", icone: BedDouble },
];

function dataLocal(valor: Date) {
  const ano = valor.getFullYear();
  const mes = String(valor.getMonth() + 1).padStart(2, "0");
  const dia = String(valor.getDate()).padStart(2, "0");
  const hora = String(valor.getHours()).padStart(2, "0");
  const minuto = String(valor.getMinutes()).padStart(2, "0");
  return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
}

function novoFormulario() {
  const agora = new Date();
  const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
  return {
    animal_id: "",
    acomodacao_id: "",
    chegada_prevista: dataLocal(agora),
    saida_prevista: dataLocal(amanha),
    alimentacao: "",
    medicacoes: "",
    restricoes: "",
    instrucoes: "",
    pertences: "",
    observacoes: "",
    diaria: "",
  };
}

function dataChave(valor: string | null | undefined) {
  if (!valor) return "";
  const d = new Date(valor);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mostrarData(valor: string | null | undefined) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(valor),
  );
}

function reais(centavos: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (centavos || 0) / 100,
  );
}

function valorEmCentavos(valor: string) {
  const numero = Number(valor.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

function Hotelzinho() {
  const { carregando: carregandoPermissoes, clinicaId, pode, adminGlobal } = usePermissoes();
  const location = useLocation();
  const abaDaUrl = (hash: string): Aba => {
    const valor = hash.replace(/^#/, "");
    return ABAS.some(item => item.id === valor) ? valor as Aba : "painel";
  };
  const [aba, setAba] = useState<Aba>(() => typeof window !== "undefined" ? abaDaUrl(window.location.hash) : "painel");
  useEffect(() => { setAba(abaDaUrl(location.hash)); }, [location.hash]);
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [acomodacoes, setAcomodacoes] = useState<Acomodacao[]>([]);
  const [estadias, setEstadias] = useState<Estadia[]>([]);
  const [cuidados, setCuidados] = useState<Cuidado[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [estadiaExtraId, setEstadiaExtraId] = useState("");
  const [categoriaExtra, setCategoriaExtra] = useState("Ração");
  const [descricaoExtra, setDescricaoExtra] = useState("");
  const [quantidadeExtra, setQuantidadeExtra] = useState("1");
  const [valorExtra, setValorExtra] = useState("");
  const [atualizacoes, setAtualizacoes] = useState<Atualizacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mostrarReserva, setMostrarReserva] = useState(false);
  const [formReserva, setFormReserva] = useState(novoFormulario);
  const [estadiaSelecionada, setEstadiaSelecionada] = useState("");
  const [tipoCuidado, setTipoCuidado] = useState<Cuidado["tipo"]>("alimentacao");
  const [descricaoCuidado, setDescricaoCuidado] = useState("");
  const [textoAtualizacao, setTextoAtualizacao] = useState("");
  const [nomeAcomodacao, setNomeAcomodacao] = useState("");
  const [especieAcomodacao, setEspecieAcomodacao] = useState("Todos");
  const [capacidadeAcomodacao, setCapacidadeAcomodacao] = useState("1");
  const [descricaoAcomodacao, setDescricaoAcomodacao] = useState("");
  // Novas tabelas ainda não estão representadas no tipo Database do cliente.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseBanco as any;

  const podeOperar = adminGlobal || pode("hotelzinho.operar") || pode("hotelzinho.gerenciar");
  const podeGerenciar = adminGlobal || pode("hotelzinho.gerenciar");

  async function carregar(forcar = false) {
    if (!clinicaId) return;
    const salvo = cacheHotel.get(clinicaId);
    if (salvo) {
      const [t,a,ac,e,c,at,x] = salvo.dados;
      setTutores(t);setAnimais(a);setAcomodacoes(ac);setEstadias(e);setCuidados(c);setAtualizacoes(at);setExtras(x);
    }
    setCarregando(!salvo);
    setAtualizando(Boolean(salvo));
    if (!forcar && salvo && Date.now()-salvo.em<30000) { setAtualizando(false); return; }
    setErro("");
    try {
    const [tutoresR, animaisR, acomodacoesR, estadiasR, cuidadosR, atualizacoesR, extrasR] =
      await Promise.all([
        db.from("tutores").select("id,nome,telefone").eq("clinica_id", clinicaId).order("nome"),
        db
          .from("oricse_animais")
          .select("id,nome,tutor_id,especie")
          .eq("clinica_id", clinicaId)
          .order("nome"),
        db.from("oricse_hotel_acomodacoes").select("*").eq("clinica_id", clinicaId).order("nome"),
        db
          .from("oricse_hotel_estadias")
          .select("*")
          .eq("clinica_id", clinicaId)
          .order("chegada_prevista", { ascending: false }),
        db
          .from("oricse_hotel_cuidados")
          .select("id,estadia_id,tipo,descricao,ocorrido_em")
          .eq("clinica_id", clinicaId)
          .order("ocorrido_em", { ascending: false })
          .limit(100),
        db
          .from("oricse_hotel_atualizacoes")
          .select("id,estadia_id,mensagem,created_at")
          .eq("clinica_id", clinicaId)
          .order("created_at", { ascending: false })
          .limit(100),
        db.from("oricse_hotel_extras").select("id,estadia_id,categoria,descricao,quantidade,valor_unitario_centavos,created_at").eq("clinica_id",clinicaId).order("created_at",{ascending:false}),
      ]);
    const falha = [tutoresR, animaisR, acomodacoesR, estadiasR, cuidadosR, atualizacoesR, extrasR].find(
      (r) => r.error,
    );
    if (falha?.error) {
      setErro(falha.error.message || "Não foi possível carregar o Hotelzinho.");
      setCarregando(false);
      setAtualizando(false);
      return;
    }
    setTutores((tutoresR.data || []) as Tutor[]);
    setAnimais((animaisR.data || []) as Animal[]);
    setAcomodacoes((acomodacoesR.data || []) as Acomodacao[]);
    setEstadias((estadiasR.data || []) as Estadia[]);
    setCuidados((cuidadosR.data || []) as Cuidado[]);
    setAtualizacoes((atualizacoesR.data || []) as Atualizacao[]);
    setExtras(extrasR.data || []);
    cacheHotel.set(clinicaId,{em:Date.now(),dados:[tutoresR.data||[],animaisR.data||[],acomodacoesR.data||[],estadiasR.data||[],cuidadosR.data||[],atualizacoesR.data||[],extrasR.data||[]]});
    setCarregando(false);
    setAtualizando(false);
    } catch (error) {
      console.error("Erro de carregamento do Hotelzinho:", error);
      setErro("Falha de conexão ao carregar o Hotelzinho. Tente novamente.");
      setCarregando(false);
      setAtualizando(false);
    }
  }

  useEffect(() => {
    if (carregandoPermissoes) return;
    if (!clinicaId) {
      setErro("Selecione uma clínica antes de abrir o Hotelzinho.");
      setCarregando(false);
      return;
    }
    void carregar();
    // carregar() deve atualizar a mesma clínica ativa já resolvida pelo hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoPermissoes, clinicaId]);

  const animaisPorId = useMemo(() => new Map(animais.map((item) => [item.id, item])), [animais]);
  const tutoresPorId = useMemo(() => new Map(tutores.map((item) => [item.id, item])), [tutores]);
  const acomodacoesPorId = useMemo(
    () => new Map(acomodacoes.map((item) => [item.id, item])),
    [acomodacoes],
  );
  const hoje = dataChave(new Date().toISOString());
  const reservas = estadias.filter((item) => item.status === "reservada");
  const hospedes = estadias.filter((item) => item.status === "hospedado");
  const chegadasHoje = reservas.filter((item) => dataChave(item.chegada_prevista) === hoje);
  const saidasHoje = hospedes.filter((item) => dataChave(item.saida_prevista) === hoje);

  function petNome(estadia: Estadia) {
    return animaisPorId.get(estadia.animal_id)?.nome || "Pet";
  }

  function tutorNome(estadia: Estadia) {
    return tutoresPorId.get(estadia.tutor_id)?.nome || "Tutor";
  }

  function nomeAcomodacaoDaEstadia(estadia: Estadia) {
    return estadia.acomodacao_id
      ? acomodacoesPorId.get(estadia.acomodacao_id)?.nome || "Acomodação removida"
      : "A definir";
  }

  async function salvarReserva(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!clinicaId || !podeOperar || salvando) return;
    const animal = animaisPorId.get(formReserva.animal_id);
    if (!animal) return toast.error("Selecione o animal da hospedagem.");
    const chegada = new Date(formReserva.chegada_prevista);
    const saida = new Date(formReserva.saida_prevista);
    if (saida <= chegada) return toast.error("A saída prevista precisa ser depois da chegada.");
    const acomodacaoId = formReserva.acomodacao_id || null;
    if (acomodacaoId) {
      const room = acomodacoesPorId.get(acomodacaoId);
      const reservasSobrepostas = estadias.filter(
        (item) =>
          item.acomodacao_id === acomodacaoId &&
          ["reservada", "hospedado"].includes(item.status) &&
          new Date(item.chegada_prevista) < saida &&
          new Date(item.saida_prevista) > chegada,
      ).length;
      if (room && reservasSobrepostas >= room.capacidade)
        return toast.error("Essa acomodação já atingiu a capacidade nesse período.");
    }
    setSalvando(true);
    const { data: usuario } = await supabase.auth.getUser();
    const { error: erroSalvar } = await db.from("oricse_hotel_estadias").insert({
      clinica_id: clinicaId,
      animal_id: animal.id,
      tutor_id: animal.tutor_id,
      acomodacao_id: acomodacaoId,
      status: "reservada",
      chegada_prevista: chegada.toISOString(),
      saida_prevista: saida.toISOString(),
      alimentacao: formReserva.alimentacao.trim(),
      medicacoes: formReserva.medicacoes.trim(),
      restricoes: formReserva.restricoes.trim(),
      instrucoes: formReserva.instrucoes.trim(),
      pertences: formReserva.pertences
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      observacoes: formReserva.observacoes.trim(),
      valor_diaria_centavos: valorEmCentavos(formReserva.diaria),
      criado_por: usuario.user?.id || null,
    });
    setSalvando(false);
    if (erroSalvar) return toast.error(`Não foi possível salvar a reserva: ${erroSalvar.message}`);
    toast.success("Reserva criada.");
    setMostrarReserva(false);
    setFormReserva(novoFormulario());
    cacheHotel.delete(clinicaId!);
    await carregar(true);
  }

  async function adicionarExtra(evento:FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if(!clinicaId || !podeOperar || salvando) return;
    const estadia=estadias.find(e=>e.id===estadiaExtraId && ["reservada","hospedado"].includes(e.status));
    const quantidade=Number(quantidadeExtra.replace(",","."));
    const unitario=valorEmCentavos(valorExtra);
    if(!estadia) return toast.error("Selecione uma estadia aberta.");
    if(!descricaoExtra.trim() || !Number.isFinite(quantidade) || quantidade<=0 || !Number.isFinite(unitario) || unitario<0) return toast.error("Informe item, quantidade e valor válidos.");
    setSalvando(true);
    const {error}=await db.from("oricse_hotel_extras").insert({clinica_id:clinicaId,estadia_id:estadia.id,categoria:categoriaExtra,descricao:descricaoExtra.trim(),quantidade,valor_unitario_centavos:unitario});
    setSalvando(false);
    if(error) return toast.error("Não foi possível lançar o item: "+error.message);
    setDescricaoExtra("");setValorExtra("");setQuantidadeExtra("1");toast.success("Item acrescentado à estadia.");
    await carregar();
  }

  async function fazerCheckin(estadia: Estadia) {
    if (!clinicaId || !podeOperar) return;
    const { data: usuario } = await supabase.auth.getUser();
    const { error } = await db
      .from("oricse_hotel_estadias")
      .update({
        status: "hospedado",
        checkin_em: new Date().toISOString(),
        checkin_por: usuario.user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", estadia.id)
      .eq("clinica_id", clinicaId)
      .eq("status", "reservada");
    if (error) return toast.error(`Não foi possível registrar o check-in: ${error.message}`);
    toast.success(`Check-in de ${petNome(estadia)} registrado.`);
    await carregar();
  }

  async function fazerCheckout(estadia: Estadia) {
    if (!clinicaId || !podeOperar) return;
    const { data: usuario } = await supabase.auth.getUser();
    const saidaReal = new Date();
    const entradaReal = new Date(estadia.checkin_em || estadia.chegada_prevista);
    const diarias = Math.max(
      1,
      Math.ceil((saidaReal.getTime() - entradaReal.getTime()) / 86400000),
    );
    const adicionais = extras.filter(e=>e.estadia_id===estadia.id).reduce((total,e)=>total+Math.round(e.quantidade*e.valor_unitario_centavos),0);
    const total = diarias * (estadia.valor_diaria_centavos || 0) + adicionais;
    const { error } = await db
      .from("oricse_hotel_estadias")
      .update({
        status: "concluida",
        checkout_em: saidaReal.toISOString(),
        checkout_por: usuario.user?.id || null,
        valor_final_centavos: total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", estadia.id)
      .eq("clinica_id", clinicaId)
      .eq("status", "hospedado");
    if (error) return toast.error(`Não foi possível registrar o check-out: ${error.message}`);
    toast.success(
      `Check-out de ${petNome(estadia)} registrado. Total da hospedagem: ${reais(total)}.`,
    );
    await carregar();
  }

  async function cancelarReserva(estadia: Estadia) {
    if (!clinicaId || !podeOperar) return;
    const { error } = await db
      .from("oricse_hotel_estadias")
      .update({ status: "cancelada", updated_at: new Date().toISOString() })
      .eq("id", estadia.id)
      .eq("clinica_id", clinicaId)
      .eq("status", "reservada");
    if (error) return toast.error(`Não foi possível cancelar: ${error.message}`);
    toast.success("Reserva cancelada.");
    await carregar();
  }

  async function salvarCuidado(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!clinicaId || !podeOperar || !estadiaSelecionada || !descricaoCuidado.trim()) return;
    setSalvando(true);
    const { data: usuario } = await supabase.auth.getUser();
    const { error } = await db.from("oricse_hotel_cuidados").insert({
      clinica_id: clinicaId,
      estadia_id: estadiaSelecionada,
      tipo: tipoCuidado,
      descricao: descricaoCuidado.trim(),
      registrado_por: usuario.user?.id || null,
    });
    setSalvando(false);
    if (error) return toast.error(`Não foi possível registrar o cuidado: ${error.message}`);
    setDescricaoCuidado("");
    toast.success("Cuidado registrado na ficha da estadia.");
    await carregar();
  }

  async function abrirWhatsApp(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!clinicaId || !podeOperar || !estadiaSelecionada || !textoAtualizacao.trim()) return;
    const estadia = estadias.find((item) => item.id === estadiaSelecionada);
    if (!estadia) return;
    const tutor = tutoresPorId.get(estadia.tutor_id);
    const telefone = (tutor?.telefone || "").replace(/\D/g, "");
    if (!telefone)
      return toast.error("Cadastre um telefone para este tutor antes de abrir o WhatsApp.");
    const mensagem = textoAtualizacao.trim();
    const numero = telefone.startsWith("55") ? telefone : `55${telefone}`;
    window.open(
      `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`,
      "_blank",
      "noopener,noreferrer",
    );
    const { data: usuario } = await supabase.auth.getUser();
    const { error } = await db.from("oricse_hotel_atualizacoes").insert({
      clinica_id: clinicaId,
      estadia_id: estadia.id,
      mensagem,
      canal: "whatsapp",
      status: "link_aberto",
      criado_por: usuario.user?.id || null,
    });
    if (error)
      toast.error(`O WhatsApp abriu, mas não foi possível registrar o histórico: ${error.message}`);
    else {
      setTextoAtualizacao("");
      toast.success("Mensagem pronta no WhatsApp. Revise e toque em enviar por lá.");
      await carregar();
    }
  }

  async function adicionarAcomodacao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!clinicaId || !podeGerenciar || !nomeAcomodacao.trim()) return;
    setSalvando(true);
    const { data: usuario } = await supabase.auth.getUser();
    const { error } = await db.from("oricse_hotel_acomodacoes").insert({
      clinica_id: clinicaId,
      nome: nomeAcomodacao.trim(),
      especie: especieAcomodacao,
      capacidade: Number(capacidadeAcomodacao) || 1,
      descricao: descricaoAcomodacao.trim(),
      criado_por: usuario.user?.id || null,
    });
    setSalvando(false);
    if (error) return toast.error(`Não foi possível salvar a acomodação: ${error.message}`);
    setNomeAcomodacao("");
    setDescricaoAcomodacao("");
    toast.success("Acomodação adicionada.");
    await carregar();
  }

  async function alterarAtiva(acomodacao: Acomodacao) {
    if (!clinicaId || !podeGerenciar) return;
    const { error } = await db
      .from("oricse_hotel_acomodacoes")
      .update({ ativa: !acomodacao.ativa, updated_at: new Date().toISOString() })
      .eq("id", acomodacao.id)
      .eq("clinica_id", clinicaId);
    if (error) return toast.error(`Não foi possível atualizar a acomodação: ${error.message}`);
    await carregar();
  }

  const campo =
    "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30";
  const painel = "rounded-2xl border bg-card p-4 shadow-sm";
  const estadiaRotina = estadias.find((item) => item.id === estadiaSelecionada);

  function cartaoEstadia(estadia: Estadia, acoes?: ReactNode) {
    return (
      <article
        key={estadia.id}
        className={`${painel} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-base">{petNome(estadia)}</strong>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">
              {estadia.status === "reservada"
                ? "Reservado"
                : estadia.status === "hospedado"
                  ? "Hospedado"
                  : estadia.status === "concluida"
                    ? "Concluído"
                    : "Cancelado"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Tutor: {tutorNome(estadia)} · {nomeAcomodacaoDaEstadia(estadia)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Entrada: {mostrarData(estadia.checkin_em || estadia.chegada_prevista)} · Saída:{" "}
            {mostrarData(estadia.checkout_em || estadia.saida_prevista)}
          </p>
          {estadia.status === "concluida" && (
            <p className="mt-1 text-sm font-medium">Total: {reais(estadia.valor_final_centavos)}</p>
          )}
        </div>
        {acoes && <div className="flex shrink-0 flex-wrap gap-2">{acoes}</div>}
      </article>
    );
  }

  if (carregandoPermissoes || (carregando && !cacheHotel.has(clinicaId || "")))
    return (
      <main className="mx-auto max-w-6xl p-5 text-sm text-muted-foreground">
        Carregando Hotelzinho…
      </main>
    );
  if (!erro && !adminGlobal && !pode("hotelzinho.visualizar"))
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className={painel}>Você não tem permissão para acessar o Hotelzinho.</div>
      </main>
    );

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 pb-20 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">ORICSE · Hospedagem</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hotelzinho</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reservas, estadias e cuidados em um só lugar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar(true)} disabled={atualizando}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium hover:bg-secondary"
        >
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </header>

      {erro && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {erro}
        </div>
      )}

      <div className="space-y-5">
        <div className="min-w-0 space-y-5">
          {aba === "painel" && (
            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Hóspedes ativos", String(hospedes.length), Dog],
                  ["Reservas confirmadas", String(reservas.length), CalendarDays],
                  ["Chegadas hoje", String(chegadasHoje.length), Check],
                  ["Saídas previstas hoje", String(saidasHoje.length), Clock3],
                ].map(([rotulo, valor, Icone]) => {
                  const Icon = Icone as typeof BedDouble;
                  return (
                    <div key={String(rotulo)} className={`${painel} flex items-center gap-3`}>
                      <span className="rounded-xl bg-primary/10 p-3 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm text-muted-foreground">{String(rotulo)}</p>
                        <p className="text-2xl font-bold">{String(valor)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <h2 className="font-semibold">Chegadas de hoje</h2>
                  {chegadasHoje.length ? (
                    chegadasHoje.map((item) =>
                      cartaoEstadia(
                        item,
                        podeOperar && (
                          <button
                            type="button"
                            onClick={() => void fazerCheckin(item)}
                            className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                          >
                            Fazer check-in
                          </button>
                        ),
                      ),
                    )
                  ) : (
                    <p className={`${painel} text-sm text-muted-foreground`}>
                      Nenhuma chegada prevista para hoje.
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  <h2 className="font-semibold">Saídas de hoje</h2>
                  {saidasHoje.length ? (
                    saidasHoje.map((item) =>
                      cartaoEstadia(
                        item,
                        podeOperar && (
                          <button
                            type="button"
                            onClick={() => void fazerCheckout(item)}
                            className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                          >
                            Fazer check-out
                          </button>
                        ),
                      ),
                    )
                  ) : (
                    <p className={`${painel} text-sm text-muted-foreground`}>
                      Nenhuma saída prevista para hoje.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {aba === "reservas" && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Reservas</h2>
                {podeOperar && (
                  <button
                    type="button"
                    onClick={() => setMostrarReserva(!mostrarReserva)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  >
                    <Plus className="h-4 w-4" /> Nova reserva
                  </button>
                )}
              </div>
              {mostrarReserva && (
                <form onSubmit={salvarReserva} className={`${painel} grid gap-3 sm:grid-cols-2`}>
                  <label className="space-y-1 text-sm font-medium sm:col-span-2">
                    Animal
                    <select
                      required
                      value={formReserva.animal_id}
                      onChange={(e) =>
                        setFormReserva({ ...formReserva, animal_id: e.target.value })
                      }
                      className={campo}
                    >
                      <option value="">Selecione um pet cadastrado</option>
                      {animais.map((animal) => (
                        <option key={animal.id} value={animal.id}>
                          {animal.nome} — {tutoresPorId.get(animal.tutor_id)?.nome || "Tutor"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    Chegada prevista
                    <input
                      required
                      type="datetime-local"
                      value={formReserva.chegada_prevista}
                      onChange={(e) =>
                        setFormReserva({ ...formReserva, chegada_prevista: e.target.value })
                      }
                      className={campo}
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    Saída prevista
                    <input
                      required
                      type="datetime-local"
                      value={formReserva.saida_prevista}
                      onChange={(e) =>
                        setFormReserva({ ...formReserva, saida_prevista: e.target.value })
                      }
                      className={campo}
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    Acomodação
                    <select
                      value={formReserva.acomodacao_id}
                      onChange={(e) =>
                        setFormReserva({ ...formReserva, acomodacao_id: e.target.value })
                      }
                      className={campo}
                    >
                      <option value="">Definir depois</option>
                      {acomodacoes
                        .filter((a) => a.ativa)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nome} · {a.especie} · capacidade {a.capacidade}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    Valor da diária (R$)
                    <input
                      inputMode="decimal"
                      placeholder="0,00"
                      value={formReserva.diaria}
                      onChange={(e) => setFormReserva({ ...formReserva, diaria: digitarCentavos(e.target.value) })}
                      className={campo}
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    Alimentação
                    <textarea
                      value={formReserva.alimentacao}
                      onChange={(e) =>
                        setFormReserva({ ...formReserva, alimentacao: e.target.value })
                      }
                      className={campo}
                      rows={2}
                      placeholder="Ração, quantidade e horários"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    Medicamentos prescritos
                    <textarea
                      value={formReserva.medicacoes}
                      onChange={(e) =>
                        setFormReserva({ ...formReserva, medicacoes: e.target.value })
                      }
                      className={campo}
                      rows={2}
                      placeholder="Nome, dose, via e horário conforme prescrição"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    Restrições ou alergias
                    <textarea
                      value={formReserva.restricoes}
                      onChange={(e) =>
                        setFormReserva({ ...formReserva, restricoes: e.target.value })
                      }
                      className={campo}
                      rows={2}
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    Pertences entregues
                    <input
                      value={formReserva.pertences}
                      onChange={(e) =>
                        setFormReserva({ ...formReserva, pertences: e.target.value })
                      }
                      className={campo}
                      placeholder="Separar por vírgula"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium sm:col-span-2">
                    Instruções e observações
                    <textarea
                      value={formReserva.instrucoes}
                      onChange={(e) =>
                        setFormReserva({ ...formReserva, instrucoes: e.target.value })
                      }
                      className={campo}
                      rows={2}
                    />
                  </label>
                  <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => setMostrarReserva(false)}
                      className="rounded-xl border px-4 py-2 text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={salvando}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {salvando ? "Salvando…" : "Salvar reserva"}
                    </button>
                  </div>
                </form>
              )}
              <div className="space-y-3">
                {reservas.length ? (
                  reservas.map((item) =>
                    cartaoEstadia(
                      item,
                      podeOperar && (
                        <>
                          <button
                            type="button"
                            onClick={() => void fazerCheckin(item)}
                            className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                          >
                            Check-in
                          </button>
                          <button
                            type="button"
                            onClick={() => void cancelarReserva(item)}
                            className="rounded-xl border px-3 py-2 text-sm"
                          >
                            Cancelar
                          </button>
                        </>
                      ),
                    ),
                  )
                ) : (
                  <p className={`${painel} text-sm text-muted-foreground`}>
                    Ainda não há reservas cadastradas.
                  </p>
                )}
              </div>
            </section>
          )}

          {aba === "checkin" && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Check-in pendentes</h2>
              {reservas.length ? (
                reservas.map((item) =>
                  cartaoEstadia(
                    item,
                    podeOperar && (
                      <button
                        type="button"
                        onClick={() => void fazerCheckin(item)}
                        className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                      >
                        Registrar entrada
                      </button>
                    ),
                  ),
                )
              ) : (
                <p className={`${painel} text-sm text-muted-foreground`}>
                  Não há reservas aguardando entrada.
                </p>
              )}
            </section>
          )}

          {aba === "hospedes" && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Hóspedes ativos</h2>
              {hospedes.length ? (
                hospedes.map((item) =>
                  cartaoEstadia(
                    item,
                    <button
                      type="button"
                      onClick={() => {
                        setEstadiaSelecionada(item.id);
                        setAba("cuidados");
                      }}
                      className="rounded-xl border px-3 py-2 text-sm"
                    >
                      Ver cuidados
                    </button>,
                  ),
                )
              ) : (
                <p className={`${painel} text-sm text-muted-foreground`}>
                  Nenhum pet está hospedado agora.
                </p>
              )}
            </section>
          )}

          {aba === "extras" && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold">Acrescentar item à estadia do animal</h2>
              <p className="text-sm text-muted-foreground">Ração, alimento, brinquedos e serviços extras. Os itens ficam vinculados à estadia e compõem o valor final no check-out, sem registrar automaticamente um pagamento.</p>
              <form onSubmit={adicionarExtra} className={`${painel} grid gap-3 sm:grid-cols-2`}>
                <label className="space-y-1 text-sm font-medium">Estadia
                  <select required className={campo} value={estadiaExtraId} onChange={e=>setEstadiaExtraId(e.target.value)}>
                    <option value="">Selecione a estadia</option>
                    {estadias.filter(e=>["reservada","hospedado"].includes(e.status)).map(e=><option key={e.id} value={e.id}>{petNome(e)} — {tutorNome(e)} ({e.status})</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">Categoria
                  <select className={campo} value={categoriaExtra} onChange={e=>setCategoriaExtra(e.target.value)}>{["Ração","Alimentação","Brinquedo","Serviço","Outro"].map(x=><option key={x}>{x}</option>)}</select>
                </label>
                <label className="space-y-1 text-sm font-medium">Produto ou serviço
                  <input required maxLength={200} className={campo} value={descricaoExtra} onChange={e=>setDescricaoExtra(e.target.value)} placeholder="Ex.: Ração premium 500g, passeio extra"/>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-sm font-medium">Quantidade<input required type="number" step="0.001" min="0.001" className={campo} value={quantidadeExtra} onChange={e=>setQuantidadeExtra(e.target.value)}/></label>
                  <label className="space-y-1 text-sm font-medium">Valor unitário (R$)<input required inputMode="decimal" className={campo} value={valorExtra} onChange={e=>setValorExtra(digitarCentavos(e.target.value))} placeholder="0,00"/></label>
                </div>
                <div className="sm:col-span-2 flex items-center justify-between gap-3"><strong>Total: {reais(Math.round(Number(quantidadeExtra||0)*valorEmCentavos(valorExtra||"0")))}</strong><button disabled={!podeOperar||salvando} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">+ Acrescentar item</button></div>
              </form>
              <div className="space-y-2">
                <h3 className="font-semibold">Itens lançados {estadiaExtraId ? "nesta estadia" : "nas estadias"}</h3>
                {extras.filter(e=>!estadiaExtraId||e.estadia_id===estadiaExtraId).map(e=><article key={e.id} className={`${painel} flex flex-wrap justify-between gap-2`}><div><strong>{e.descricao}</strong><p className="text-xs text-muted-foreground">{e.categoria} · {e.quantidade} un. · {estadias.find(x=>x.id===e.estadia_id)?petNome(estadias.find(x=>x.id===e.estadia_id)!):"Estadia"}</p></div><strong>{reais(Math.round(e.quantidade*e.valor_unitario_centavos))}</strong></article>)}
              </div>
            </section>
          )}

          {aba === "cuidados" && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Rotina e cuidados</h2>
              <form
                onSubmit={salvarCuidado}
                className={`${painel} grid gap-3 sm:grid-cols-[1fr_180px_2fr_auto] sm:items-end`}
              >
                <label className="space-y-1 text-sm font-medium">
                  Hóspede
                  <select
                    required
                    value={estadiaSelecionada}
                    onChange={(e) => setEstadiaSelecionada(e.target.value)}
                    className={campo}
                  >
                    <option value="">Selecione</option>
                    {hospedes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {petNome(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Tipo
                  <select
                    value={tipoCuidado}
                    onChange={(e) => setTipoCuidado(e.target.value as Cuidado["tipo"])}
                    className={campo}
                  >
                    <option value="alimentacao">Alimentação</option>
                    <option value="passeio">Passeio</option>
                    <option value="medicacao">Medicação</option>
                    <option value="observacao">Observação</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Registro
                  <textarea
                    required
                    value={descricaoCuidado}
                    onChange={(e) => setDescricaoCuidado(e.target.value)}
                    className={campo}
                    rows={1}
                    placeholder="O que foi feito e em qual horário"
                  />
                </label>
                <button
                  disabled={!podeOperar || salvando || !hospedes.length}
                  className="min-h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Registrar
                </button>
              </form>
              {estadiaRotina && (
                <div className={`${painel} space-y-2`}>
                  <h3 className="font-semibold">Plano de estadia de {petNome(estadiaRotina)}</h3>
                  <p className="text-sm">
                    <b>Alimentação:</b> {estadiaRotina.alimentacao || "Sem instrução registrada."}
                  </p>
                  <p className="text-sm">
                    <b>Medicamentos:</b> {estadiaRotina.medicacoes || "Nenhum registrado."}
                  </p>
                  <p className="text-sm">
                    <b>Restrições:</b> {estadiaRotina.restricoes || "Nenhuma registrada."}
                  </p>
                  <p className="text-sm">
                    <b>Instruções:</b> {estadiaRotina.instrucoes || "Nenhuma registrada."}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {cuidados
                  .filter((item) => !estadiaSelecionada || item.estadia_id === estadiaSelecionada)
                  .map((item) => (
                    <article
                      key={item.id}
                      className={`${painel} flex flex-wrap items-center justify-between gap-2`}
                    >
                      <div>
                        <span className="rounded-full bg-secondary px-2 py-1 text-xs capitalize">
                          {item.tipo}
                        </span>
                        <p className="mt-2 text-sm">{item.descricao}</p>
                      </div>
                      <time className="text-xs text-muted-foreground">
                        {mostrarData(item.ocorrido_em)}
                      </time>
                    </article>
                  ))}
              </div>
            </section>
          )}

          {aba === "tutores" && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Atualizações para tutores</h2>
              <form onSubmit={abrirWhatsApp} className={`${painel} space-y-3`}>
                <label className="block space-y-1 text-sm font-medium">
                  Hóspede
                  <select
                    required
                    value={estadiaSelecionada}
                    onChange={(e) => setEstadiaSelecionada(e.target.value)}
                    className={campo}
                  >
                    <option value="">Selecione</option>
                    {hospedes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {petNome(item)} — {tutorNome(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm font-medium">
                  Mensagem
                  <textarea
                    required
                    value={textoAtualizacao}
                    onChange={(e) => setTextoAtualizacao(e.target.value)}
                    className={campo}
                    rows={4}
                    placeholder="Escreva uma atualização da estadia. O texto abrirá preenchido no WhatsApp."
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  O ORICSE prepara a mensagem e abre a conversa. A equipe revisa e envia pelo
                  WhatsApp.
                </p>
                <button
                  disabled={!podeOperar || !hospedes.length}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#087f5b] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> Abrir WhatsApp
                </button>
              </form>
              <div className="space-y-2">
                {atualizacoes.map((item) => {
                  const estadia = estadias.find((x) => x.id === item.estadia_id);
                  return (
                    <article key={item.id} className={painel}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {estadia ? petNome(estadia) : "Estadia"} ·{" "}
                          {estadia ? tutorNome(estadia) : "Tutor"}
                        </p>
                        <time className="text-xs text-muted-foreground">
                          {mostrarData(item.created_at)}
                        </time>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{item.mensagem}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {aba === "checkout" && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Check-out</h2>
              <p className="text-sm text-muted-foreground">
                O total considera as diárias entre a entrada registrada e a saída, com mínimo de uma
                diária.
              </p>
              {hospedes.length ? (
                hospedes.map((item) =>
                  cartaoEstadia(
                    item,
                    podeOperar && (
                      <button
                        type="button"
                        onClick={() => void fazerCheckout(item)}
                        className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                      >
                        Registrar saída
                      </button>
                    ),
                  ),
                )
              ) : (
                <p className={`${painel} text-sm text-muted-foreground`}>
                  Não há hóspedes aguardando check-out.
                </p>
              )}
            </section>
          )}

          {aba === "acomodacoes" && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Acomodações</h2>
              {podeGerenciar && (
                <form
                  onSubmit={adicionarAcomodacao}
                  className={`${painel} grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}
                >
                  <label className="space-y-1 text-sm font-medium">
                    Nome
                    <input
                      required
                      value={nomeAcomodacao}
                      onChange={(e) => setNomeAcomodacao(e.target.value)}
                      className={campo}
                      placeholder="Ex.: Suíte 1"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    Espécie
                    <select
                      value={especieAcomodacao}
                      onChange={(e) => setEspecieAcomodacao(e.target.value)}
                      className={campo}
                    >
                      <option>Todos</option>
                      <option>Cães</option>
                      <option>Gatos</option>
                      <option>Pequenos animais</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    Capacidade
                    <input
                      required
                      type="number"
                      min="1"
                      max="500"
                      value={capacidadeAcomodacao}
                      onChange={(e) => setCapacidadeAcomodacao(e.target.value)}
                      className={campo}
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    Descrição
                    <input
                      value={descricaoAcomodacao}
                      onChange={(e) => setDescricaoAcomodacao(e.target.value)}
                      className={campo}
                      placeholder="Observações do espaço"
                    />
                  </label>
                  <button
                    disabled={salvando}
                    className="min-h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2 lg:col-span-4"
                  >
                    Adicionar acomodação
                  </button>
                </form>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {acomodacoes.map((item) => {
                  const ocupadas = estadias.filter(
                    (e) =>
                      e.acomodacao_id === item.id &&
                      ["reservada", "hospedado"].includes(e.status) &&
                      new Date(e.saida_prevista) > new Date(),
                  ).length;
                  return (
                    <article key={item.id} className={`${painel} space-y-2`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{item.nome}</h3>
                          <p className="text-sm text-muted-foreground">
                            {item.especie} · capacidade {item.capacidade}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${item.ativa ? "bg-emerald-100 text-emerald-800" : "bg-secondary text-muted-foreground"}`}
                        >
                          {item.ativa ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                      <p className="text-sm">
                        Ocupação atual/reservada: {ocupadas} de {item.capacidade}
                      </p>
                      {item.descricao && (
                        <p className="text-sm text-muted-foreground">{item.descricao}</p>
                      )}
                      {podeGerenciar && (
                        <button
                          type="button"
                          onClick={() => void alterarAtiva(item)}
                          className="rounded-lg border px-3 py-2 text-xs font-medium"
                        >
                          {item.ativa ? "Desativar" : "Reativar"}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
              {!acomodacoes.length && (
                <p className={`${painel} text-sm text-muted-foreground`}>
                  Cadastre os espaços disponíveis para organizar a ocupação.
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
