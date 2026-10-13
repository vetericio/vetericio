import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, CircleDollarSign, ClipboardList, Eye, EyeOff, Mail, MessageCircle, PawPrint, Plus, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AgendaDayBoard } from "@/components/agenda/AgendaDayBoard";
import "@/components/agenda/agenda-color-overrides.css";

export const Route = createFileRoute("/recepcao")({ component: Recepcao });

const FILA_KEY = "oricse-fila-espera-v1";
const FILA_VISIVEL_KEY = "oricse-recepcao-fila-visivel";
const AGENDA_KEY = "oricse-agendas-v2";
const TUTORES_KEY = "oricse-tutores-v1";
const ANIMAIS_KEY = "oricse-animais-v1";
const PRONTUARIO_KEY = "oricse-prontuario-animal-v1";
const LEMBRETES_REFORCOS_KEY = "oricse-lembretes-reforcos-v1";
const DEMO_EVENT_IDS = new Set(["e1", "e2", "e3", "e4"]);

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

type TutorAniversario = {
  id: string;
  nome: string;
  nascimento?: string;
  telefone?: string;
  outroTelefone?: string;
  email?: string;
};

type AnimalResumo = {
  id: string;
  tutorId: string;
  nome: string;
  especie?: string;
};

type RegistroReforco = {
  id: string;
  animalId: string;
  tipo?: string;
  titulo?: string;
  detalhe?: string;
  subtipo?: string;
  data?: string;
  proximaDose?: string;
  proximoReforco?: string;
  validadeFim?: string;
  dados?: Record<string, unknown>;
};

type ReforcoItem = {
  id: string;
  registroId: string;
  animalId: string;
  animalNome: string;
  tutor: TutorAniversario;
  categoria: "Vacina" | "Vermífugo";
  nome: string;
  data: string;
};

function lerLista<T>(chave: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const valor = JSON.parse(localStorage.getItem(chave) || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

function lerFila(): FilaResumo[] { return lerLista<FilaResumo>(FILA_KEY); }
function lerTutores(): TutorAniversario[] { return lerLista<TutorAniversario>(TUTORES_KEY); }
function lerAnimais(): AnimalResumo[] { return lerLista<AnimalResumo>(ANIMAIS_KEY); }
function lerRegistros(): RegistroReforco[] { return lerLista<RegistroReforco>(PRONTUARIO_KEY); }

function lerLembretesReforcos(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const valor = JSON.parse(localStorage.getItem(LEMBRETES_REFORCOS_KEY) || "{}");
    return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
  } catch {
    return {};
  }
}

function limparAtendimentosDeExemplo() {
  if (typeof window === "undefined") return;
  try {
    const salvo = localStorage.getItem(AGENDA_KEY);
    if (!salvo) {
      localStorage.setItem(AGENDA_KEY, JSON.stringify([
        { id: "agenda-1", nome: "Agenda 1", responsavel: "Dra. Ana Costa", inicio: "08:00", fim: "17:00", cor: "verde", diasSemana: [0, 1, 2, 3, 4, 5, 6], eventos: [] },
        { id: "agenda-2", nome: "Agenda 2", responsavel: "Dr. Bruno Almeida", inicio: "08:00", fim: "17:00", cor: "azul", diasSemana: [0, 1, 2, 3, 4, 5, 6], eventos: [] },
        { id: "agenda-3", nome: "Agenda 3", responsavel: "Dra. Juliana Ribeiro", inicio: "09:00", fim: "15:00", cor: "roxo", diasSemana: [0, 1, 2, 3, 4, 5, 6], eventos: [] },
      ]));
      return;
    }

    const agendas = JSON.parse(salvo);
    if (!Array.isArray(agendas)) return;
    let alterou = false;
    const limpas = agendas.map((agenda: any) => {
      if (!Array.isArray(agenda?.eventos)) return agenda;
      const eventos = agenda.eventos.filter((evento: any) => !DEMO_EVENT_IDS.has(String(evento?.id || "")));
      if (eventos.length !== agenda.eventos.length) alterou = true;
      return { ...agenda, eventos };
    });
    if (alterou) localStorage.setItem(AGENDA_KEY, JSON.stringify(limpas));
  } catch {
    // Se houver dado antigo inválido, a própria agenda trata o fallback.
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

function partesNascimento(nascimento?: string) {
  if (!nascimento) return null;
  const valor = nascimento.slice(0, 10);
  const partes = valor.includes("-") ? valor.split("-") : valor.split("/").reverse();
  if (partes.length !== 3) return null;
  const [ano, mes, dia] = partes.map(Number);
  if (!ano || !mes || !dia) return null;
  return { ano, mes, dia };
}

function dataAniversario(nascimento?: string) {
  const p = partesNascimento(nascimento);
  return p ? `${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")}` : "Não informado";
}

function distanciaAniversario(nascimento?: string) {
  const p = partesNascimento(nascimento);
  if (!p) return Number.MAX_SAFE_INTEGER;
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let proximo = new Date(hoje.getFullYear(), p.mes - 1, p.dia);
  if (proximo < inicioHoje) proximo = new Date(hoje.getFullYear() + 1, p.mes - 1, p.dia);
  return Math.round((proximo.getTime() - inicioHoje.getTime()) / 86400000);
}

function mensagemAniversario(nome: string) {
  const primeiroNome = nome.trim().split(/\s+/)[0] || nome;
  return `Olá, ${primeiroNome}! 🎉 A equipe da clínica deseja a você um feliz aniversário! Que seu novo ciclo seja cheio de saúde, alegria e muitos momentos especiais. 💚`;
}

function telefoneWhatsApp(tutor: TutorAniversario) {
  return String(tutor.telefone || tutor.outroTelefone || "").replace(/\D/g, "");
}

function normalizarData(valor?: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  let m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
  return null;
}

function extrairDataReforco(registro: RegistroReforco): string | null {
  const dados = registro.dados || {};
  const diretos = [
    registro.proximaDose,
    registro.proximoReforco,
    registro.validadeFim,
    dados.proximaDose,
    dados.proximoReforco,
    dados.validadeFim,
    dados.proxima_dose,
    dados.proximo_reforco,
    dados.validade_fim,
  ];
  for (const valor of diretos) {
    const data = normalizarData(valor);
    if (data) return data;
  }

  const detalhe = String(registro.detalhe || "");
  const padrao = /(?:pr[oó]xima\s+dose|pr[oó]ximo\s+refor[cç]o|refor[cç]o|validade\s+at[eé]|repetir\s+em)\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i;
  const achado = detalhe.match(padrao);
  return achado ? normalizarData(achado[1]) : null;
}

function dataBR(data: string) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function diferencaDias(data: string) {
  const alvo = new Date(`${data}T12:00:00`);
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12);
  return Math.round((alvo.getTime() - inicioHoje.getTime()) / 86400000);
}

function statusReforco(data: string) {
  const dias = diferencaDias(data);
  if (dias < 0) return `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`;
  if (dias === 0) return "É hoje";
  if (dias === 1) return "Amanhã";
  return `Em ${dias} dias`;
}

function mensagemReforco(item: ReforcoItem) {
  const primeiroNome = item.tutor.nome.trim().split(/\s+/)[0] || item.tutor.nome;
  const acao = item.categoria === "Vermífugo" ? "repetição" : "reforço";
  return `Olá, ${primeiroNome}! 💚 Passando para lembrar que a ${acao} de ${item.nome} de ${item.animalNome} está prevista para ${dataBR(item.data)}. Se precisar, podemos ajudar a agendar.`;
}

function Recepcao() {
  useState(() => {
    limparAtendimentosDeExemplo();
    return true;
  });

  const [fila, setFila] = useState<FilaResumo[]>(lerFila);
  const [tutores, setTutores] = useState<TutorAniversario[]>(lerTutores);
  const [animais, setAnimais] = useState<AnimalResumo[]>(lerAnimais);
  const [registros, setRegistros] = useState<RegistroReforco[]>(lerRegistros);
  const [aniversariosAbertos, setAniversariosAbertos] = useState(false);
  const [tutorMensagem, setTutorMensagem] = useState<TutorAniversario | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [reforcosAbertos, setReforcosAbertos] = useState(false);
  const [reforcoMensagem, setReforcoMensagem] = useState<ReforcoItem | null>(null);
  const [mensagemReforcoEditavel, setMensagemReforcoEditavel] = useState("");
  const [lembretesReforcos, setLembretesReforcos] = useState<Record<string, boolean>>(lerLembretesReforcos);
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

  const aniversariantes = useMemo(() => [...tutores].sort((a, b) => {
    const da = distanciaAniversario(a.nascimento);
    const db = distanciaAniversario(b.nascimento);
    if (da !== db) return da - db;
    return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  }), [tutores]);

  const aniversariantesHoje = useMemo(() => aniversariantes.filter((t) => distanciaAniversario(t.nascimento) === 0), [aniversariantes]);

  const reforcos = useMemo<ReforcoItem[]>(() => {
    const tutorPorId = new Map(tutores.map((t) => [t.id, t]));
    const animalPorId = new Map(animais.map((a) => [a.id, a]));
    const itens: ReforcoItem[] = [];

    registros.forEach((registro) => {
      const texto = `${registro.tipo || ""} ${registro.subtipo || ""} ${registro.titulo || ""} ${registro.detalhe || ""}`.toLowerCase();
      const ehVacina = String(registro.tipo || "").toLowerCase() === "vacinas" || /vacina|v10|v8|antirr[aá]b|gi[aá]rd|gripe/.test(texto);
      const ehVermifugo = /verm[ií]f|vermifuga|vermifugo|vermífugo/.test(texto);
      if (!ehVacina && !ehVermifugo) return;
      const data = extrairDataReforco(registro);
      if (!data) return;
      const animal = animalPorId.get(registro.animalId);
      if (!animal) return;
      const tutor = tutorPorId.get(animal.tutorId);
      if (!tutor) return;
      itens.push({
        id: `${registro.id}-${data}`,
        registroId: registro.id,
        animalId: animal.id,
        animalNome: animal.nome,
        tutor,
        categoria: ehVermifugo ? "Vermífugo" : "Vacina",
        nome: registro.titulo?.trim() || (ehVermifugo ? "Vermífugo" : "Vacina"),
        data,
      });
    });

    return itens.sort((a, b) => a.data.localeCompare(b.data) || a.animalNome.localeCompare(b.animalNome, "pt-BR"));
  }, [registros, animais, tutores]);

  useEffect(() => {
    localStorage.setItem(FILA_VISIVEL_KEY, String(filaVisivel));
  }, [filaVisivel]);

  useEffect(() => {
    const atualizar = () => {
      setFila(lerFila());
      setTutores(lerTutores());
      setAnimais(lerAnimais());
      setRegistros(lerRegistros());
      setLembretesReforcos(lerLembretesReforcos());
    };
    window.addEventListener("storage", atualizar);
    window.addEventListener("focus", atualizar);
    return () => {
      window.removeEventListener("storage", atualizar);
      window.removeEventListener("focus", atualizar);
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

  function abrirMensagem(tutor: TutorAniversario) {
    setTutorMensagem(tutor);
    setMensagem(mensagemAniversario(tutor.nome));
  }

  function enviarWhatsApp() {
    if (!tutorMensagem) return;
    const telefone = telefoneWhatsApp(tutorMensagem);
    if (!telefone) return;
    const numero = telefone.startsWith("55") ? telefone : `55${telefone}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener,noreferrer");
  }

  function enviarEmail() {
    if (!tutorMensagem?.email) return;
    window.location.href = `mailto:${encodeURIComponent(tutorMensagem.email)}?subject=${encodeURIComponent("Feliz aniversário! 🎉")}&body=${encodeURIComponent(mensagem)}`;
  }

  function alternarLembrete(reforcoId: string) {
    const proximo = { ...lembretesReforcos, [reforcoId]: !lembretesReforcos[reforcoId] };
    setLembretesReforcos(proximo);
    localStorage.setItem(LEMBRETES_REFORCOS_KEY, JSON.stringify(proximo));
  }

  function abrirMensagemReforco(item: ReforcoItem) {
    setReforcoMensagem(item);
    setMensagemReforcoEditavel(mensagemReforco(item));
  }

  function enviarReforcoWhatsApp() {
    if (!reforcoMensagem) return;
    const telefone = telefoneWhatsApp(reforcoMensagem.tutor);
    if (!telefone) return;
    const numero = telefone.startsWith("55") ? telefone : `55${telefone}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagemReforcoEditavel)}`, "_blank", "noopener,noreferrer");
  }

  function enviarReforcoEmail() {
    if (!reforcoMensagem?.tutor.email) return;
    window.location.href = `mailto:${encodeURIComponent(reforcoMensagem.tutor.email)}?subject=${encodeURIComponent(`Lembrete: ${reforcoMensagem.nome}`)}&body=${encodeURIComponent(mensagemReforcoEditavel)}`;
  }

  const itens = [
    ["Cadastrar tutor", "Cadastre tutores e animais da clínica", UserRound, "/tutores"],
    ["Adicionar / consultar animal", "Pesquise o animal e veja tutor, contatos e ficha completa", PawPrint, "/animais"],
    ["Fila de espera", "Pacientes sem horário aguardando atendimento", ClipboardList, "/fila-espera"],
    ["Caixa", "Acesse o caixa e os lançamentos financeiros", CircleDollarSign, "/financeiro"],
    ["Aniversariantes do dia", aniversariantesHoje.length ? `${aniversariantesHoje.length} aniversariante${aniversariantesHoje.length > 1 ? "s" : ""} hoje` : "Datas importantes", CalendarDays, "aniversarios"],
    ["Reforços próximos", reforcos.length ? `${reforcos.length} reforço${reforcos.length > 1 ? "s" : ""} com data registrada` : "Vacinas e vermifugação", Plus, "reforcos"],
  ] as const;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1650px] px-4 pb-28 pt-6 sm:px-6">
      <Link to="/inicio" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link>

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
          if (destino === "aniversarios") return <button key={titulo} type="button" onClick={() => setAniversariosAbertos(true)} className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">{conteudo}</button>;
          if (destino === "reforcos") return <button key={titulo} type="button" onClick={() => setReforcosAbertos(true)} className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">{conteudo}</button>;
          return destino ? <Link key={titulo} to={destino} className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">{conteudo}</Link> : <button key={titulo} type="button" className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">{conteudo}</button>;
        })}
      </section>

      {aniversariosAbertos && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3" onMouseDown={(e) => { if (e.currentTarget === e.target) setAniversariosAbertos(false); }}>
        <section className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div><div className="flex items-center gap-2"><CalendarDays className="text-primary" size={21}/><h2 className="text-xl font-black">Aniversários dos tutores</h2></div><p className="mt-1 text-sm text-muted-foreground">Próximos aniversários primeiro. Selecione um tutor para enviar os parabéns.</p></div>
            <button type="button" onClick={() => setAniversariosAbertos(false)} className="rounded-xl p-2 hover:bg-muted" aria-label="Fechar"><X size={20}/></button>
          </header>
          <div className="overflow-y-auto p-4">
            {aniversariantes.length === 0 ? <div className="py-12 text-center text-muted-foreground">Nenhum tutor cadastrado.</div> : <div className="space-y-2">{aniversariantes.map((tutor) => {
              const faltam = distanciaAniversario(tutor.nascimento);
              const hoje = faltam === 0;
              return <button key={tutor.id} type="button" onClick={() => abrirMensagem(tutor)} className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition hover:border-primary ${hoje ? "border-primary bg-primary/[0.05]" : "bg-white"}`}>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="truncate">{tutor.nome}</strong>{hoje && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black uppercase text-primary-foreground">Hoje 🎉</span>}</div><div className="mt-1 text-sm text-muted-foreground">{dataAniversario(tutor.nascimento)}{tutor.telefone ? ` · ${tutor.telefone}` : ""}{tutor.email ? ` · ${tutor.email}` : ""}</div></div>
                <div className="shrink-0 text-right text-xs font-bold text-primary">{!tutor.nascimento ? "Sem data" : hoje ? "Aniversário hoje" : faltam === 1 ? "Amanhã" : `Em ${faltam} dias`}</div>
              </button>;
            })}</div>}
          </div>
        </section>
      </div>}

      {reforcosAbertos && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3" onMouseDown={(e) => { if (e.currentTarget === e.target) setReforcosAbertos(false); }}>
        <section className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div><div className="flex items-center gap-2"><Plus className="text-primary" size={21}/><h2 className="text-xl font-black">Reforços próximos</h2></div><p className="mt-1 text-sm text-muted-foreground">Vacinas e vermífugos com próxima dose, reforço ou validade registrada. Vencidos aparecem primeiro.</p></div>
            <button type="button" onClick={() => setReforcosAbertos(false)} className="rounded-xl p-2 hover:bg-muted" aria-label="Fechar"><X size={20}/></button>
          </header>
          <div className="overflow-y-auto p-4">
            {reforcos.length === 0 ? <div className="py-12 text-center"><CalendarDays className="mx-auto mb-2 text-primary/30" size={34}/><strong>Nenhum reforço com data registrada.</strong><p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">O ORICSE não calcula intervalos por conta própria. Registre a próxima dose/reforço ou a validade no prontuário para o lembrete aparecer aqui.</p></div> : <div className="space-y-2">{reforcos.map((item) => {
              const vencido = diferencaDias(item.data) < 0;
              const lembrar = Boolean(lembretesReforcos[item.id]);
              return <article key={item.id} className={`rounded-2xl border p-3 ${vencido ? "border-red-200 bg-red-50/45" : "bg-white"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${vencido ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary"}`}>Dia {dataBR(item.data)}</span><span className={`text-xs font-bold ${vencido ? "text-red-600" : "text-primary"}`}>{statusReforco(item.data)}</span></div>
                    <div className="mt-2 font-black">{item.animalNome} <span className="font-normal text-muted-foreground">· {item.tutor.nome}</span></div>
                    <div className="mt-0.5 text-sm"><strong>{item.categoria}</strong> · {item.nome}</div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-bold"><input type="checkbox" checked={lembrar} onChange={() => alternarLembrete(item.id)} className="accent-primary"/> Lembrar tutor?</label>
                    <Link to="/animal" search={{ animalId: item.animalId } as never} className="inline-flex min-h-9 items-center rounded-xl border px-3 text-xs font-bold">Abrir ficha</Link>
                    <button type="button" onClick={() => abrirMensagemReforco(item)} className="inline-flex min-h-9 items-center rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground">Enviar lembrete</button>
                  </div>
                </div>
              </article>;
            })}</div>}
          </div>
        </section>
      </div>}

      {tutorMensagem && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3" onMouseDown={(e) => { if (e.currentTarget === e.target) setTutorMensagem(null); }}>
        <section className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-primary">Mensagem de aniversário</p><h2 className="mt-1 text-xl font-black">{tutorMensagem.nome}</h2><p className="mt-1 text-sm text-muted-foreground">{dataAniversario(tutorMensagem.nascimento)}</p></div><button type="button" onClick={() => setTutorMensagem(null)} className="rounded-xl p-2 hover:bg-muted"><X size={20}/></button></div>
          <label className="mt-4 block text-sm font-bold">Mensagem<textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={6} className="mt-1 w-full rounded-2xl border p-3 font-normal outline-none focus:border-primary"/></label>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={enviarWhatsApp} disabled={!telefoneWhatsApp(tutorMensagem)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-35"><MessageCircle size={18}/> Enviar pelo WhatsApp</button>
            <button type="button" onClick={enviarEmail} disabled={!tutorMensagem.email} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary px-4 font-black text-primary disabled:cursor-not-allowed disabled:opacity-35"><Mail size={18}/> Enviar por e-mail</button>
          </div>
          {(!telefoneWhatsApp(tutorMensagem) || !tutorMensagem.email) && <p className="mt-3 text-xs text-muted-foreground">Botões ficam indisponíveis quando o contato correspondente não estiver cadastrado.</p>}
        </section>
      </div>}

      {reforcoMensagem && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3" onMouseDown={(e) => { if (e.currentTarget === e.target) setReforcoMensagem(null); }}>
        <section className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-primary">Lembrete de reforço</p><h2 className="mt-1 text-xl font-black">{reforcoMensagem.animalNome} · {reforcoMensagem.nome}</h2><p className="mt-1 text-sm text-muted-foreground">Tutor: {reforcoMensagem.tutor.nome} · {dataBR(reforcoMensagem.data)}</p></div><button type="button" onClick={() => setReforcoMensagem(null)} className="rounded-xl p-2 hover:bg-muted"><X size={20}/></button></div>
          <label className="mt-4 block text-sm font-bold">Mensagem<textarea value={mensagemReforcoEditavel} onChange={(e) => setMensagemReforcoEditavel(e.target.value)} rows={6} className="mt-1 w-full rounded-2xl border p-3 font-normal outline-none focus:border-primary"/></label>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={enviarReforcoWhatsApp} disabled={!telefoneWhatsApp(reforcoMensagem.tutor)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-35"><MessageCircle size={18}/> Enviar pelo WhatsApp</button>
            <button type="button" onClick={enviarReforcoEmail} disabled={!reforcoMensagem.tutor.email} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary px-4 font-black text-primary disabled:cursor-not-allowed disabled:opacity-35"><Mail size={18}/> Enviar por e-mail</button>
          </div>
        </section>
      </div>}
    </main>
  );
}
