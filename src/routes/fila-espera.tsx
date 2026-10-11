import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock3, PawPrint, Play, Plus, RotateCcw, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/fila-espera")({ component: FilaEspera });

type Tutor = {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
};

type Animal = {
  id: string;
  tutorId: string;
  nome: string;
  especie?: string;
  raca?: string;
};

type StatusFila = "Aguardando" | "Chamado";

type ItemFila = {
  id: string;
  tutorId: string;
  animalId: string;
  tutorNome: string;
  animalNome: string;
  especie?: string;
  motivo?: string;
  chegadaEm: string;
  status: StatusFila;
  chamadoEm?: string;
};

const TUTORES_KEY = "oricse-tutores-v1";
const ANIMAIS_KEY = "oricse-animais-v1";
const FILA_KEY = "oricse-fila-espera-v1";

function lerLocal<T>(chave: string): T[] {
  try {
    const valor = JSON.parse(localStorage.getItem(chave) || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

function hora(dataIso: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(dataIso));
}

function tempoEspera(dataIso: string, agora = Date.now()) {
  const minutos = Math.max(0, Math.floor((agora - new Date(dataIso).getTime()) / 60000));
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function emojiEspecie(especie?: string) {
  const mapa: Record<string, string> = {
    "Cão": "🐶",
    "Gato": "🐱",
    "Coelho": "🐰",
    "Hamster": "🐹",
    "Rato": "🐭",
    "Porquinho-da-índia": "🐹",
    "Ave": "🦜",
    "Réptil": "🦎",
    "Quelônio": "🐢",
    "Serpente": "🐍",
  };
  return mapa[especie || ""] || "🐾";
}

function FilaEspera() {
  const [tutores] = useState<Tutor[]>(() => lerLocal<Tutor>(TUTORES_KEY));
  const [animais] = useState<Animal[]>(() => lerLocal<Animal>(ANIMAIS_KEY));
  const [fila, setFila] = useState<ItemFila[]>(() => lerLocal<ItemFila>(FILA_KEY));
  const [tutorId, setTutorId] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [motivo, setMotivo] = useState("");

  const animaisDoTutor = useMemo(
    () => animais.filter((animal) => animal.tutorId === tutorId).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [animais, tutorId],
  );

  const aguardando = useMemo(
    () => fila.filter((item) => item.status === "Aguardando").sort((a, b) => new Date(a.chegadaEm).getTime() - new Date(b.chegadaEm).getTime()),
    [fila],
  );

  const chamados = useMemo(
    () => fila.filter((item) => item.status === "Chamado").sort((a, b) => new Date(b.chamadoEm || b.chegadaEm).getTime() - new Date(a.chamadoEm || a.chegadaEm).getTime()),
    [fila],
  );

  function persistir(proxima: ItemFila[]) {
    setFila(proxima);
    localStorage.setItem(FILA_KEY, JSON.stringify(proxima));
  }

  function adicionarFila() {
    const tutor = tutores.find((item) => item.id === tutorId);
    const animal = animais.find((item) => item.id === animalId && item.tutorId === tutorId);
    if (!tutor) return toast.error("Selecione o tutor.");
    if (!animal) return toast.error("Selecione o animal.");

    const jaAguardando = fila.some((item) => item.animalId === animal.id && item.status === "Aguardando");
    if (jaAguardando) return toast.error(`${animal.nome} já está na fila de espera.`);

    const novo: ItemFila = {
      id: crypto.randomUUID(),
      tutorId: tutor.id,
      animalId: animal.id,
      tutorNome: tutor.nome,
      animalNome: animal.nome,
      especie: animal.especie,
      motivo: motivo.trim() || undefined,
      chegadaEm: new Date().toISOString(),
      status: "Aguardando",
    };

    persistir([...fila, novo]);
    setTutorId("");
    setAnimalId("");
    setMotivo("");
    toast.success(`${animal.nome} entrou na fila de espera.`);
  }

  function chamar(id: string) {
    const agora = new Date().toISOString();
    persistir(fila.map((item) => item.id === id ? { ...item, status: "Chamado" as const, chamadoEm: agora } : item));
  }

  function voltarParaFila(id: string) {
    persistir(fila.map((item) => item.id === id ? { ...item, status: "Aguardando" as const, chamadoEm: undefined } : item));
  }

  function remover(id: string) {
    const item = fila.find((registro) => registro.id === id);
    if (!item) return;
    if (!window.confirm(`Remover ${item.animalNome} da fila de espera?`)) return;
    persistir(fila.filter((registro) => registro.id !== id));
  }

  const campo = "min-h-11 w-full rounded-xl border bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-4 pb-28 pt-6 sm:px-6">
      <Link to="/recepcao" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar para Recepção</Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Recepção</p>
          <h1 className="mt-1 text-3xl font-bold">Fila de espera</h1>
          <p className="mt-1 text-muted-foreground">Pacientes que chegaram sem horário marcado e aguardam ser chamados.</p>
        </div>
        <div className="rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary">{aguardando.length} aguardando</div>
      </div>

      <section className="mt-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2"><Plus size={19} className="text-primary"/><h2 className="text-lg font-bold">Adicionar à fila</h2></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1.2fr_1.5fr_auto] lg:items-end">
          <label className="text-sm font-semibold">Tutor
            <select value={tutorId} onChange={(e) => { setTutorId(e.target.value); setAnimalId(""); }} className={`${campo} mt-1`}>
              <option value="">Selecione o tutor</option>
              {[...tutores].sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")).map((tutor) => <option key={tutor.id} value={tutor.id}>{tutor.nome}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Animal
            <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} disabled={!tutorId} className={`${campo} mt-1 disabled:opacity-50`}>
              <option value="">{tutorId ? "Selecione o animal" : "Selecione o tutor primeiro"}</option>
              {animaisDoTutor.map((animal) => <option key={animal.id} value={animal.id}>{emojiEspecie(animal.especie)} {animal.nome}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Motivo da chegada <span className="font-normal text-muted-foreground">(opcional)</span>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: vômito, retorno, vacina..." className={`${campo} mt-1`}/>
          </label>
          <button type="button" onClick={adicionarFila} className="min-h-11 rounded-xl bg-primary px-5 font-bold text-primary-foreground">Adicionar</button>
        </div>
        {tutores.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nenhum tutor cadastrado. <Link to="/tutores" className="font-semibold text-primary underline">Cadastrar tutor</Link></p>}
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2"><Clock3 size={19} className="text-primary"/><h2 className="font-bold">Aguardando ser chamado</h2></div>
          <span className="text-sm text-muted-foreground">Ordem de chegada</span>
        </div>

        {aguardando.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum paciente aguardando no momento.</div>
        ) : (
          <div className="divide-y">
            {aguardando.map((item, index) => (
              <div key={item.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[58px_minmax(150px,1fr)_minmax(160px,1fr)_minmax(140px,1.4fr)_130px_auto] sm:items-center sm:px-5">
                <div className="text-sm font-black text-primary">#{index + 1}</div>
                <div className="min-w-0"><div className="truncate font-bold">{emojiEspecie(item.especie)} {item.animalNome}</div><div className="truncate text-xs text-muted-foreground">{item.tutorNome}</div></div>
                <div className="text-sm"><span className="font-semibold">Chegada:</span> {hora(item.chegadaEm)}<div className="text-xs text-muted-foreground">espera {tempoEspera(item.chegadaEm)}</div></div>
                <div className="truncate text-sm text-muted-foreground">{item.motivo || "Sem motivo informado"}</div>
                <div><span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Aguardando</span></div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button type="button" onClick={() => chamar(item.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Play size={14}/> Chamar</button>
                  <button type="button" onClick={() => remover(item.id)} aria-label="Remover da fila" className="inline-flex items-center justify-center rounded-lg border px-2.5 py-2 text-muted-foreground hover:text-destructive"><X size={15}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {chamados.length > 0 && (
        <section className="mt-5 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="border-b px-4 py-3 sm:px-5"><h2 className="font-bold">Chamados recentemente</h2></div>
          <div className="divide-y">
            {chamados.slice(0, 10).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div><div className="font-semibold">{emojiEspecie(item.especie)} {item.animalNome} <span className="font-normal text-muted-foreground">· {item.tutorNome}</span></div><div className="text-xs text-muted-foreground">Chegou {hora(item.chegadaEm)} · chamado {item.chamadoEm ? hora(item.chamadoEm) : "agora"}</div></div>
                <div className="flex gap-2"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Chamado</span><button type="button" onClick={() => voltarParaFila(item.id)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"><RotateCcw size={13}/> Voltar à fila</button><button type="button" onClick={() => remover(item.id)} className="rounded-lg border px-2.5 py-1.5 text-muted-foreground hover:text-destructive"><X size={14}/></button></div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
