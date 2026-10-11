import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Clock3, ListPlus, PawPrint, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/encaminhar")({ component: Encaminhar });

type Tutor = { id: string; nome: string; telefone?: string };
type Animal = { id: string; tutorId: string; nome: string; especie?: string };
type Evento = { id: string; hora: string; data?: string; tipo: string; paciente: string; tutor: string; especie?: string; origem: "Recepção"; pagamento: "Pendente"; status: "Agendado" };
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

  const tutores = useMemo(() => ler<Tutor>(TUTORES_KEY), []);
  const animais = useMemo(() => ler<Animal>(ANIMAIS_KEY), []);
  const [agendas, setAgendas] = useState<Agenda[]>(() => ler<Agenda>(AGENDAS_KEY));
  const tutor = tutores.find((t) => t.id === tutorId);
  const animal = animais.find((a) => a.id === animalId && a.tutorId === tutorId);

  const [destino, setDestino] = useState<Destino>("agenda");
  const [agendaId, setAgendaId] = useState(() => agendas[0]?.id || "");
  const [data, setData] = useState(hojeIso());
  const agenda = agendas.find((a) => a.id === agendaId);
  const horarios = useMemo(() => horariosAgenda(agenda), [agenda]);
  const [hora, setHora] = useState("");

  const diaPermitido = useMemo(() => {
    if (!agenda?.diasSemana?.length || !data) return true;
    const [y, m, d] = data.split("-").map(Number);
    const dia = new Date(y, m - 1, d).getDay();
    return agenda.diasSemana.includes(dia);
  }, [agenda, data]);

  const horariosDisponiveis = useMemo(() => {
    if (!agenda) return [];
    return horarios.filter((h) => !agenda.eventos?.some((e) => e.status !== "Cancelado" && e.hora === h && (!e.data || e.data === data)));
  }, [agenda, horarios, data]);

  function enviarFila() {
    if (!tutor || !animal) return;
    const atual = ler<FilaItem>(FILA_KEY);
    const jaEsta = atual.some((i) => i.animalId === animal.id && i.status === "Aguardando");
    if (jaEsta) return void toast.error(`${animal.nome} já está na fila de espera.`);
    const item: FilaItem = { id: crypto.randomUUID(), tutorId: tutor.id, tutor: tutor.nome, animalId: animal.id, animal: animal.nome, especie: animal.especie, entradaEm: new Date().toISOString(), status: "Aguardando" };
    localStorage.setItem(FILA_KEY, JSON.stringify([...atual, item]));
    toast.success(`${animal.nome} enviado para a fila de espera.`);
    navigate({ to: "/recepcao" });
  }

  function enviarAgenda() {
    if (!tutor || !animal) return;
    if (!agenda) return void toast.error("Selecione uma agenda.");
    if (!data) return void toast.error("Selecione o dia.");
    if (!diaPermitido) return void toast.error("Essa agenda não funciona no dia da semana selecionado.");
    if (!hora) return void toast.error("Selecione um horário livre.");
    if (!horariosDisponiveis.includes(hora)) return void toast.error("Esse horário já está ocupado.");

    const evento: Evento = {
      id: crypto.randomUUID(),
      hora,
      data,
      tipo: "Consulta",
      paciente: animal.nome,
      tutor: tutor.nome,
      especie: animal.especie,
      origem: "Recepção",
      pagamento: "Pendente",
      status: "Agendado",
    };

    const novas = agendas.map((a) => a.id === agenda.id ? { ...a, eventos: [...(a.eventos || []), evento].sort((x, y) => horaMin(x.hora) - horaMin(y.hora)) } : a);
    setAgendas(novas);
    localStorage.setItem(AGENDAS_KEY, JSON.stringify(novas));
    toast.success(`${animal.nome} agendado em ${agenda.nome} às ${hora}.`);
    navigate({ to: "/recepcao" });
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
      <button type="button" onClick={() => setDestino("agenda")} className={`rounded-2xl border-2 p-4 text-left transition ${destino === "agenda" ? "border-primary bg-primary/5" : "border-slate-200 bg-white"}`}><CalendarDays className="text-primary"/><div className="mt-2 font-black">Agenda</div><div className="text-sm text-muted-foreground">Escolher agenda, dia e horário.</div></button>
      <button type="button" onClick={() => setDestino("fila")} className={`rounded-2xl border-2 p-4 text-left transition ${destino === "fila" ? "border-primary bg-primary/5" : "border-slate-200 bg-white"}`}><ListPlus className="text-primary"/><div className="mt-2 font-black">Fila de espera</div><div className="text-sm text-muted-foreground">Enviar para atendimento por ordem de chegada.</div></button>
    </div>

    {destino === "agenda" ? <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">Qual agenda?<select value={agendaId} onChange={(e) => { setAgendaId(e.target.value); setHora(""); }} className="mt-1 min-h-12 w-full rounded-xl border bg-white px-3 font-normal"><option value="">Selecione</option>{agendas.map((a) => <option key={a.id} value={a.id}>{a.nome}{a.responsavel ? ` · ${a.responsavel}` : ""}</option>)}</select></label>
        <label className="text-sm font-semibold">Dia<input type="date" value={data} min={hojeIso()} onChange={(e) => { setData(e.target.value); setHora(""); }} className="mt-1 min-h-12 w-full rounded-xl border bg-white px-3 font-normal"/></label>
        <label className="text-sm font-semibold">Horário<select value={hora} onChange={(e) => setHora(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border bg-white px-3 font-normal"><option value="">Selecione</option>{horarios.map((h) => { const livre = horariosDisponiveis.includes(h); return <option key={h} value={h} disabled={!livre}>{h}{livre ? " · Livre" : " · Ocupado"}</option>; })}</select></label>
      </div>
      {!diaPermitido && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">A agenda selecionada não funciona neste dia da semana.</div>}
      {agendas.length === 0 && <div className="mt-3 rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">Nenhuma agenda cadastrada.</div>}
      <button type="button" onClick={enviarAgenda} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"><Clock3 size={18}/> Confirmar agendamento</button>
    </section> : <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="rounded-xl bg-primary/5 p-4"><div className="font-black">Fila de espera</div><p className="mt-1 text-sm text-muted-foreground">{animal.nome} será adicionado à fila com o tutor {tutor.nome}. Não é necessário escolher horário.</p></div>
      <button type="button" onClick={enviarFila} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"><Send size={18}/> Enviar para fila de espera</button>
    </section>}
  </main>;
}
