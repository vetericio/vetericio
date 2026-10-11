import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Clock3, ListPlus, PawPrint, Send, Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/encaminhar")({ component: Encaminhar });

type Tutor = { id: string; nome: string; telefone?: string };
type Animal = { id: string; tutorId: string; nome: string; especie?: string };
type Evento = { id: string; hora: string; data?: string; tipo: string; paciente: string; tutor: string; tutorId?: string; animalId?: string; especie?: string; origem: "Recepção"; pagamento: "Pendente"; status: "Agendado" };
type Agenda = { id: string; nome: string; responsavel?: string; inicio: string; fim: string; diasSemana?: number[]; eventos: Evento[] };
type FilaItem = { id: string; tutorId: string; tutor: string; animalId: string; animal: string; especie?: string; entradaEm: string; status: "Aguardando" };

type Destino = "agenda" | "fila";
const TUTORES_KEY = "oricse-tutores-v1";
const ANIMAIS_KEY = "oricse-animais-v1";
const AGENDAS_KEY = "oricse-agendas-v2";
const FILA_KEY = "oricse-fila-espera-v1";

function ler<T>(chave: string): T[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(chave) || "[]"); } catch { return []; }
}

function hojeIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function horaMin(hora: string) {
  const [h = "0", m = "0"] = hora.split(":");
  return Number(h) * 60 + Number(m);
}

function minHora(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function horariosAgenda(agenda?: Agenda) {
  if (!agenda) return [];
  const inicio = horaMin(agenda.inicio || "08:00");
  const fim = horaMin(agenda.fim || "17:00");
  const lista: string[] = [];
  for (let m = inicio; m + 30 <= fim; m += 30) lista.push(minHora(m));
  return lista;
}

function Encaminhar() {
  const navigate = useNavigate();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const tutorId = params.get("tutorId") || "";
  const animalId = params.get("animalId") || "";
  const retorno = params.get("retorno") || "";
  const voltarAOrigem = () => {
    if (retorno === "animal" && animalId) {
      window.location.href = `/animal?animalId=${encodeURIComponent(animalId)}`;
      return;
    }
    voltarAOrigem();
  };

  const tutores = useMemo(() => ler<Tutor>(TUTORES_KEY), []);
  const animais = useMemo(() => ler<Animal>(ANIMAIS_KEY), []);
  const [agendas, setAgendas] = useState<Agenda[]>(() => ler<Agenda>(AGENDAS_KEY));
  const tutor = tutores.find((t) => t.id === tutorId);
  const animal = animais.find((a) => a.id === animalId && a.tutorId === tutorId);

  const [destino, setDestino] = useState<Destino>("agenda");
  const [responsavel, setResponsavel] = useState("");
  const [data, setData] = useState(hojeIso());
  const [agendaId, setAgendaId] = useState("");
  const [hora, setHora] = useState("");

  const veterinarios = useMemo(() => Array.from(new Set(agendas.map((a) => (a.responsavel || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [agendas]);
  const agendasDoVeterinario = useMemo(() => responsavel ? agendas.filter((a) => (a.responsavel || "").trim() === responsavel) : [], [agendas, responsavel]);
  const agendasDisponiveisNoDia = useMemo(() => {
    if (!data) return agendasDoVeterinario;
    const [y, m, d] = data.split("-").map(Number);
    const diaSemana = new Date(y, m - 1, d).getDay();
    return agendasDoVeterinario.filter((a) => !a.diasSemana?.length || a.diasSemana.includes(diaSemana));
  }, [agendasDoVeterinario, data]);
  const agenda = agendas.find((a) => a.id === agendaId);
  const horarios = useMemo(() => horariosAgenda(agenda), [agenda]);

  const horariosDisponiveis = useMemo(() => {
    if (!agenda) return [];
    return horarios.filter((h) => !agenda.eventos?.some((e) => e.status !== "Cancelado" && e.hora === h && (!e.data || e.data === data)));
  }, [agenda, horarios, data]);

  function escolherVeterinario(nome: string) {
    setResponsavel(nome);
    setAgendaId("");
    setHora("");
  }

  function escolherData(valor: string) {
    setData(valor);
    setAgendaId("");
    setHora("");
  }

  function enviarFila() {
    if (!tutor || !animal) return;
    const atual = ler<FilaItem>(FILA_KEY);
    const jaEsta = atual.some((i) => i.animalId === animal.id && i.status === "Aguardando");
    if (jaEsta) return void toast.error(`${animal.nome} já está na fila de espera.`);
    const item: FilaItem = { id: crypto.randomUUID(), tutorId: tutor.id, tutor: tutor.nome, animalId: animal.id, animal: animal.nome, especie: animal.especie, entradaEm: new Date().toISOString(), status: "Aguardando" };
    localStorage.setItem(FILA_KEY, JSON.stringify([...atual, item]));
    toast.success(`${animal.nome} enviado para a fila de espera.`);
    voltarAOrigem();
  }

  function enviarAgenda() {
    if (!tutor || !animal) return;
    if (!responsavel) return void toast.error("Selecione o veterinário.");
    if (!data) return void toast.error("Selecione a data.");
    if (!agenda) return void toast.error("Selecione a agenda.");
    if (!hora) return void toast.error("Selecione um horário livre.");
    if (!horariosDisponiveis.includes(hora)) return void toast.error("Esse horário já está ocupado.");

    const evento: Evento = {
      id: crypto.randomUUID(),
      hora,
      data,
      tipo: "Consulta",
      paciente: animal.nome,
      tutor: tutor.nome,
      tutorId: tutor.id,
      animalId: animal.id,
      especie: animal.especie,
      origem: "Recepção",
      pagamento: "Pendente",
      status: "Agendado",
    };

    const novas = agendas.map((a) => a.id === agenda.id ? { ...a, eventos: [...(a.eventos || []), evento].sort((x, y) => horaMin(x.hora) - horaMin(y.hora)) } : a);
    setAgendas(novas);
    localStorage.setItem(AGENDAS_KEY, JSON.stringify(novas));
    toast.success(`${animal.nome} agendado com ${responsavel} em ${data} às ${hora}.`);
    voltarAOrigem();
  }

  if (!tutor || !animal) {
    return <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-6"><Link to="/tutores" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link><div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">Tutor ou animal não encontrado.</div></main>;
  }

  return <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-28 pt-6 sm:px-6">
    <Link to="/tutores" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar para Tutores</Link>

    <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Enviar para…</p>
      <h1 className="mt-1 flex items-center gap-2 text-3xl font-black"><PawPrint className="text-primary"/> {animal.nome}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Tutor: <strong className="text-foreground">{tutor.nome}</strong>{tutor.telefone ? ` · ${tutor.telefone}` : ""}</p>
    </div>

    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={() => setDestino("agenda")} className={`rounded-2xl border-2 p-4 text-left transition ${destino === "agenda" ? "border-primary bg-primary/5" : "border-slate-200 bg-white"}`}><CalendarDays className="text-primary"/><div className="mt-2 font-black">Agenda</div><div className="text-sm text-muted-foreground">Veterinário → data → agenda → horário.</div></button>
      <button type="button" onClick={() => setDestino("fila")} className={`rounded-2xl border-2 p-4 text-left transition ${destino === "fila" ? "border-primary bg-primary/5" : "border-slate-200 bg-white"}`}><ListPlus className="text-primary"/><div className="mt-2 font-black">Fila de espera</div><div className="text-sm text-muted-foreground">Enviar para atendimento por ordem de chegada.</div></button>
    </div>

    {destino === "agenda" ? <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="space-y-4">
        <label className="block text-sm font-semibold">Veterinário<select value={responsavel} onChange={(e) => escolherVeterinario(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border bg-white px-3 font-normal"><option value="">Selecione o veterinário</option>{veterinarios.map((nome) => <option key={nome} value={nome}>{nome}</option>)}</select></label>

        {responsavel && <label className="block text-sm font-semibold">Data<input type="date" value={data} min={hojeIso()} onChange={(e) => escolherData(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border bg-white px-3 font-normal"/></label>}

        {responsavel && data && <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><CalendarDays size={16} className="text-primary"/> Agenda</div>
          {agendasDisponiveisNoDia.length ? <div className="grid gap-2 sm:grid-cols-2">{agendasDisponiveisNoDia.map((a) => <button key={a.id} type="button" onClick={() => { setAgendaId(a.id); setHora(""); }} className={`rounded-xl border-2 p-3 text-left transition ${agendaId === a.id ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-primary/40"}`}><div className="font-black">{a.nome}</div><div className="mt-1 text-xs text-muted-foreground">{a.inicio}–{a.fim}</div></button>)}</div> : <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">Esse veterinário não possui agenda disponível nesta data.</div>}
        </div>}

        {agenda && <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} className="text-primary"/> Horário</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{horarios.map((h) => { const livre = horariosDisponiveis.includes(h); return <button key={h} type="button" disabled={!livre} onClick={() => setHora(h)} className={`min-h-11 rounded-xl border px-2 text-sm font-bold transition ${!livre ? "cursor-not-allowed bg-slate-100 text-slate-400" : hora === h ? "border-primary bg-primary text-primary-foreground" : "bg-white hover:border-primary"}`}>{h}<span className="ml-1 text-[10px] font-medium">{livre ? "Livre" : "Ocupado"}</span></button>; })}</div>
        </div>}
      </div>

      {veterinarios.length === 0 && <div className="mt-3 rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">Nenhuma agenda com veterinário responsável cadastrada.</div>}
      <button type="button" onClick={enviarAgenda} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"><Stethoscope size={18}/> Confirmar agendamento</button>
    </section> : <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="rounded-xl bg-primary/5 p-4"><div className="font-black">Fila de espera</div><p className="mt-1 text-sm text-muted-foreground">{animal.nome} será adicionado à fila com o tutor {tutor.nome}. Não é necessário escolher horário.</p></div>
      <button type="button" onClick={enviarFila} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"><Send size={18}/> Enviar para fila de espera</button>
    </section>}
  </main>;
}
