import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, ClipboardList, Eye, EyeOff, PawPrint, Plus, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AgendaDayBoard } from "@/components/agenda/AgendaDayBoard";
import "@/components/agenda/agenda-color-overrides.css";

export const Route = createFileRoute("/recepcao")({ component: Recepcao });

const FILA_KEY = "oricse-fila-espera-v1";
const FILA_VISIVEL_KEY = "oricse-recepcao-fila-visivel";

type FilaResumo = {
  id: string;
  status?: string;
  animalNome?: string;
  animal?: string;
  tutorNome?: string;
  tutor?: string;
  especie?: string;
  motivo?: string;
  chegadaEm?: string;
  entradaEm?: string;
};

function lerFila(): FilaResumo[] {
  if (typeof window === "undefined") return [];
  try {
    const valor = JSON.parse(localStorage.getItem(FILA_KEY) || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

function hora(data?: string) {
  if (!data) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(data));
  } catch {
    return "—";
  }
}

function tempoEspera(data?: string) {
  if (!data) return "";
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 60000));
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function emojiEspecie(especie?: string) {
  const valor = (especie || "").toLowerCase();
  if (["cão", "cao", "canino", "cachorro"].includes(valor)) return "🐶";
  if (["gato", "felino"].includes(valor)) return "🐱";
  if (["ave", "pássaro", "passaro"].includes(valor)) return "🦜";
  if (["serpente", "cobra"].includes(valor)) return "🐍";
  if (["réptil", "reptil"].includes(valor)) return "🦎";
  if (["quelônio", "quelonio"].includes(valor)) return "🐢";
  return "🐾";
}

function Recepcao() {
  const [fila, setFila] = useState<FilaResumo[]>(lerFila);
  const [filaVisivel, setFilaVisivel] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(FILA_VISIVEL_KEY) !== "false";
  });
  const agendaWrapRef = useRef<HTMLDivElement>(null);
  const barraTopoRef = useRef<HTMLDivElement>(null);
  const [larguraTrilho, setLarguraTrilho] = useState(0);

  const aguardando = useMemo(() => fila
    .filter((item) => !item.status || item.status === "Aguardando")
    .sort((a, b) => new Date(a.chegadaEm || a.entradaEm || 0).getTime() - new Date(b.chegadaEm || b.entradaEm || 0).getTime()), [fila]);

  useEffect(() => {
    localStorage.setItem(FILA_VISIVEL_KEY, String(filaVisivel));
  }, [filaVisivel]);

  useEffect(() => {
    const atualizarFila = () => setFila(lerFila());
    window.addEventListener("storage", atualizarFila);
    window.addEventListener("focus", atualizarFila);
    return () => {
      window.removeEventListener("storage", atualizarFila);
      window.removeEventListener("focus", atualizarFila);
    };
  }, []);

  useEffect(() => {
    const wrap = agendaWrapRef.current;
    const barra = barraTopoRef.current;
    if (!wrap || !barra) return;

    let trilho: HTMLElement | null = null;
    let sincronizando = false;

    const localizar = () => {
      trilho = wrap.querySelector<HTMLElement>("div.flex.flex-nowrap.gap-3.overflow-x-auto");
      if (!trilho) return;
      setLarguraTrilho(trilho.scrollWidth);
      barra.scrollLeft = trilho.scrollLeft;
    };

    const syncDaAgenda = () => {
      if (!trilho || sincronizando) return;
      sincronizando = true;
      barra.scrollLeft = trilho.scrollLeft;
      requestAnimationFrame(() => { sincronizando = false; });
    };

    const syncDaBarra = () => {
      if (!trilho || sincronizando) return;
      sincronizando = true;
      trilho.scrollLeft = barra.scrollLeft;
      requestAnimationFrame(() => { sincronizando = false; });
    };

    const timer = window.setTimeout(() => {
      localizar();
      trilho?.addEventListener("scroll", syncDaAgenda, { passive: true });
    }, 100);
    barra.addEventListener("scroll", syncDaBarra, { passive: true });
    const resize = new ResizeObserver(localizar);
    resize.observe(wrap);

    return () => {
      window.clearTimeout(timer);
      trilho?.removeEventListener("scroll", syncDaAgenda);
      barra.removeEventListener("scroll", syncDaBarra);
      resize.disconnect();
    };
  }, []);

  const itens = [
    ["Adicionar / consultar tutor", "Cadastre e encontre tutores", UserRound, "/tutores"],
    ["Adicionar / consultar animal", "Pacientes e responsáveis", PawPrint, null],
    ["Fila de espera", "Pacientes sem horário aguardando atendimento", ClipboardList, "/fila-espera"],
    ["Novo agendamento", "Organize os horários", CalendarDays, null],
    ["Aniversariantes do dia", "Datas importantes", CalendarDays, null],
    ["Reforços próximos", "Vacinas e vermifugação", Plus, null],
  ] as const;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1650px] px-4 pb-28 pt-6 sm:px-6">
      <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Atendimento</p>
          <h1 className="mt-1 text-3xl font-bold">Recepção</h1>
          <p className="mt-1 text-muted-foreground">Cadastros, fila e agenda da clínica em uma única visão.</p>
        </div>
        <button type="button" className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground">+ Novo agendamento</button>
      </div>

      <div className={`mt-6 grid items-start gap-4 ${filaVisivel ? "xl:grid-cols-[300px_minmax(0,1fr)]" : "grid-cols-1"}`}>
        {filaVisivel ? (
          <aside className="rounded-2xl border-2 border-primary/25 bg-white shadow-sm xl:sticky xl:top-3">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2"><ClipboardList size={19} className="text-primary"/><h2 className="font-black">Fila de espera</h2></div>
              <button type="button" onClick={() => setFilaVisivel(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" title="Ocultar fila de espera" aria-label="Ocultar fila de espera"><EyeOff size={17}/></button>
            </div>
            <div className="max-h-[68vh] overflow-y-auto">
              {aguardando.length === 0 ? <div className="p-5 text-center text-sm text-muted-foreground">Ninguém aguardando.</div> : aguardando.map((item, index) => {
                const chegada = item.chegadaEm || item.entradaEm;
                return <div key={item.id || index} className="border-b px-4 py-3 last:border-b-0">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-xs font-black text-primary">#{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{emojiEspecie(item.especie)} {item.animalNome || item.animal || "Paciente"}</div>
                      <div className="truncate text-xs text-muted-foreground">{item.tutorNome || item.tutor || "Tutor"}</div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px]"><span>Chegada {hora(chegada)}</span><strong className="text-primary">{tempoEspera(chegada)}</strong></div>
                      {item.motivo && <div className="mt-1 truncate text-xs text-muted-foreground">{item.motivo}</div>}
                    </div>
                  </div>
                </div>;
              })}
            </div>
            <Link to="/fila-espera" className="m-3 flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground">Abrir fila completa</Link>
          </aside>
        ) : (
          <button type="button" onClick={() => setFilaVisivel(true)} className="mb-1 inline-flex w-fit items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold shadow-sm"><Eye size={17} className="text-primary"/> Mostrar fila de espera</button>
        )}

        <section className="min-w-0 rounded-2xl border-2 border-primary/15 bg-primary/[0.015] p-2 sm:p-3">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2"><CalendarDays size={19} className="text-primary"/><h2 className="font-black">Agenda</h2></div>
            <span className="text-xs text-muted-foreground">Arraste a barra para navegar entre as agendas</span>
          </div>
          <div ref={barraTopoRef} className="mb-2 overflow-x-auto rounded-lg border bg-white px-1 py-1 [scrollbar-width:auto]">
            <div style={{ width: Math.max(larguraTrilho, 1), height: 2 }} />
          </div>
          <div ref={agendaWrapRef} className="agenda-recepcao-wrap min-w-0">
            <AgendaDayBoard mode="recepcao" />
          </div>
        </section>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map(([titulo, texto, Icone, destino]) => {
          const conteudo = <div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Icone className="text-primary" size={20}/></div><div><h2 className="font-semibold">{titulo}</h2><p className="mt-0.5 text-sm text-muted-foreground">{texto}</p></div></div>;
          return destino ? <Link key={titulo} to={destino} className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">{conteudo}</Link> : <button key={titulo} type="button" className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">{conteudo}</button>;
        })}
      </section>
    </main>
  );
}
