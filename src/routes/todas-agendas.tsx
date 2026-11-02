import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { supabaseBanco } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/usePermissoes";
import { AgendaDayBoard, AgendaErrorBoundary } from "@/components/agenda/AgendaDayBoard";
import "@/components/agenda/agenda-color-overrides.css";

export const Route = createFileRoute("/todas-agendas")({ component: TodasAgendas });
type Estadia = { id: string; chegada_prevista: string; saida_prevista: string; status: string; animal_id: string };
type Animal = { id: string; nome: string; especie?: string };
type BanhoAgendamento = {id:string;animal_id:string;servico_nome:string;inicio:string;fim:string;status:string};
const pad = (n: number) => String(n).padStart(2, "0");
function diaLocal(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function diaDeIso(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}
function mudarDia(iso: string, dias: number) {
  const d = diaDeIso(iso);
  d.setDate(d.getDate() + dias);
  return diaLocal(d);
}
function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
const FERIADOS: Record<string,string> = {"01-01":"Confraternização Universal","04-21":"Tiradentes","05-01":"Dia do Trabalho","09-07":"Independência do Brasil","10-12":"Nossa Senhora Aparecida","11-02":"Finados","11-15":"Proclamação da República","11-20":"Consciência Negra","12-25":"Natal"};
const DIAS = ["DOMINGO","SEGUNDA","TERÇA","QUARTA","QUINTA","SEXTA","SÁBADO"];
function feriado(data:string) {
 const d=diaDeIso(data); const fixo=FERIADOS[data.slice(5)]; if(fixo)return fixo;
 const ano=d.getFullYear(),a=ano%19,b=Math.floor(ano/100),c=ano%100,dd=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-dd-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+700)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;
 const sexta=new Date(ano,Math.floor(n/31)-1,n%31+1);sexta.setDate(sexta.getDate()-2);
 return diaLocal(sexta)===data?"Sexta-feira Santa":null;
}
function TodasAgendas() {
  const { clinicaId } = usePermissoes();
  const [dia, setDia] = useState(() => diaLocal(new Date()));
  const [visao, setVisao] = useState<"dia" | "semana" | "mes">("dia");
  const [estadias, setEstadias] = useState<Estadia[]>([]);
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [banhoAgendamentos, setBanhoAgendamentos] = useState<BanhoAgendamento[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [atualizacao, setAtualizacao] = useState(0);
  useEffect(() => {
    if (!clinicaId) { setEstadias([]); setAnimais([]); return; }
    let ativo = true;
    setCarregando(true);
    Promise.all([
      (supabaseBanco as any).from("oricse_banho_tosa_agendamentos").select("id,animal_id,servico_nome,inicio,fim,status").eq("clinica_id",clinicaId).order("inicio", {ascending:false}).limit(500),
      (supabaseBanco as any).from("oricse_hotel_estadias").select("id,chegada_prevista,saida_prevista,status,animal_id").eq("clinica_id", clinicaId).in("status", ["reservada", "hospedado"]).order("chegada_prevista"),
      (supabaseBanco as any).from("oricse_animais").select("id,nome,especie").eq("clinica_id", clinicaId),
    ]).then(([banho, res, pets]) => {
      if (!ativo) return;
      if (banho.error || res.error || pets.error) { setErro("Não foi possível carregar a agenda do hotelzinho."); return; }
      setBanhoAgendamentos(banho.data || []);
      setEstadias(res.data || []);
      setAnimais(pets.data || []);
      setErro("");
    }).catch(() => { if (ativo) setErro("Falha ao consultar a agenda do hotelzinho."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [clinicaId, atualizacao]);

  // O intervalo é calculado em horário local e limitado ao dia selecionado.
  // Hospedagens que atravessam a meia-noite continuam no dia seguinte.
  const eventos = useMemo(() => {
    const inicioDia = diaDeIso(dia).getTime();
    const fimDia = mudarDia(dia, 1);
    const fimMs = diaDeIso(fimDia).getTime();
    return estadias.flatMap((estadia) => {
      const inicio = new Date(estadia.chegada_prevista).getTime();
      const fim = new Date(estadia.saida_prevista).getTime();
      if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio || inicio >= fimMs || fim <= inicioDia) return [];
      const esquerda = Math.max(0, ((Math.max(inicio, inicioDia) - inicioDia) / (fimMs - inicioDia)) * 100);
      const direita = Math.min(100, ((Math.min(fim, fimMs) - inicioDia) / (fimMs - inicioDia)) * 100);
      return [{ estadia, esquerda, largura: Math.max(0, direita - esquerda), iniciouAntes: inicio < inicioDia, terminaDepois: fim > fimMs }];
    }).sort((a, b) => a.esquerda - b.esquerda);
  }, [estadias, dia]);

  const diasVisiveis = useMemo(() => {
    const atual = diaDeIso(dia);
    if (visao === "dia") return [dia];
    const inicio = new Date(atual);
    if (visao === "semana") {
      inicio.setDate(atual.getDate() - ((atual.getDay() + 6) % 7));
      return Array.from({ length: 7 }, (_, i) => diaLocal(new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)));
    }
    inicio.setDate(1);
    inicio.setDate(1 - ((inicio.getDay() + 6) % 7));
    const ultimo = new Date(atual.getFullYear(), atual.getMonth() + 1, 0);
    const fim = new Date(ultimo);
    fim.setDate(ultimo.getDate() + (7 - (ultimo.getDay() + 6) % 7) % 7);
    const quantidade = Math.round((Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate()) - Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())) / 86400000) + 1;
    return Array.from({ length: quantidade }, (_, i) => diaLocal(new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)));
  }, [dia, visao]);
  const estadiasPorDia = useMemo(() => {
    const mapa = new Map<string, Estadia[]>();
    for (const data of diasVisiveis) {
      const inicio = diaDeIso(data).getTime();
      const fim = diaDeIso(mudarDia(data, 1)).getTime();
      mapa.set(data, estadias.filter(e => {
        const de = new Date(e.chegada_prevista).getTime();
        const ate = new Date(e.saida_prevista).getTime();
        return Number.isFinite(de) && Number.isFinite(ate) && de < fim && ate > inicio && ate > de;
      }));
    }
    return mapa;
  }, [estadias, diasVisiveis]);
  function navegar(direcao: number) {
    if (visao === "dia") setDia(d => mudarDia(d, direcao));
    else if (visao === "semana") setDia(d => mudarDia(d, direcao * 7));
    else setDia(d => {
      const atual = diaDeIso(d);
      const alvo = new Date(atual.getFullYear(), atual.getMonth() + direcao, 1);
      const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
      alvo.setDate(Math.min(atual.getDate(), ultimoDia));
      return diaLocal(alvo);
    });
  }

  return <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 pb-24 pt-6 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link to="/recepcao" className="text-sm text-muted-foreground">← Painel da recepção</Link><h1 className="mt-2 text-3xl font-bold">Todas as agendas</h1><p className="text-sm text-muted-foreground">Clínica, banho e tosa e hotelzinho, reunidos em um só lugar.</p></div>
      <button type="button" onClick={() => setAtualizacao(n => n + 1)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"><RefreshCw size={16}/> Atualizar reservas</button>
    </div>
    <section className="space-y-2"><h2 className="flex items-center gap-2 text-xl font-semibold"><CalendarDays size={20}/> Clínica e banho e tosa</h2>
      <p className="text-sm text-muted-foreground">Visualize as agendas existentes e filtre por profissional e tipo diretamente no calendário.</p>
      <AgendaErrorBoundary><AgendaDayBoard mode="recepcao"/></AgendaErrorBoundary>
    </section>
    <section className="rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Banho e tosa</h2><p className="text-sm text-muted-foreground">Próximos atendimentos, serviços e horários.</p></div><Link to="/banho-tosa" hash="agenda" className="text-sm font-semibold text-primary underline">Abrir agenda</Link></div>
      <div className="mt-4 space-y-2">{banhoAgendamentos.filter(a=>a.status!=="cancelado" && new Date(a.inicio).getTime() >= Date.now()-86400000).sort((a,b)=>a.inicio.localeCompare(b.inicio)).slice(0,15).map(a=><div key={a.id} className="flex flex-wrap justify-between gap-2 rounded-xl border p-3"><div><strong>{animais.find(x=>x.id===a.animal_id)?.nome||"Animal"} · {a.servico_nome}</strong><p className="text-sm text-muted-foreground">{dataHora(a.inicio)} até {dataHora(a.fim)}</p></div><span className="text-sm">{a.status.replaceAll("_"," ")}</span></div>)}{!banhoAgendamentos.some(a=>a.status!=="cancelado" && new Date(a.inicio).getTime()>=Date.now()-86400000)&&<p className="text-sm text-muted-foreground">Sem atendimentos recentes ou futuros.</p>}</div>
    </section>
    <section className="rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Agenda do hotelzinho</h2><p className="mt-1 text-sm text-muted-foreground">Cada barra mostra o período de ocupação no dia, incluindo hospedagens que passam da meia-noite.</p></div>
        <Link to="/hotelzinho" className="text-sm font-semibold text-primary underline">Gerenciar hotelzinho</Link>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" aria-label="Período anterior" onClick={() => navegar(-1)} className="rounded-lg border p-2"><ChevronLeft size={18}/></button>
        <input type="date" aria-label="Data da agenda do hotelzinho" value={dia} onChange={e => e.target.value && setDia(e.target.value)} className="min-h-10 rounded-lg border bg-background px-3 text-sm"/>
        <button type="button" aria-label="Próximo período" onClick={() => navegar(1)} className="rounded-lg border p-2"><ChevronRight size={18}/></button>
        <button type="button" onClick={() => setDia(diaLocal(new Date()))} className="rounded-lg border px-3 py-2 text-sm">Hoje</button>
        <div className="flex rounded-xl border bg-secondary/30 p-1" role="group" aria-label="Visualização da agenda">
          {([["dia","Dia"],["semana","Semana"],["mes","Mês"]] as const).map(([id,nome]) =>
            <button key={id} type="button" aria-pressed={visao === id} onClick={() => setVisao(id)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${visao === id ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-secondary"}`}>{nome}</button>)}
        </div>
        <span className="text-sm text-muted-foreground">{visao === "dia" ? `${eventos.length} hospedagem(ns) neste dia` : `${new Set(diasVisiveis.flatMap(d => (estadiasPorDia.get(d) || []).map(e => e.id))).size} hospedagem(ns) no período`}</span>
      </div>
      {visao !== "dia" ? <div className="mt-5">
        {carregando ? <p className="py-8 text-sm">Carregando agenda…</p> : erro ? <p role="alert" className="py-8 text-sm text-destructive">{erro}</p> :
          <div className="overflow-x-auto">
            <div className="grid min-w-[700px] grid-cols-7 gap-2">
              {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(nome => <div key={nome} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{nome}</div>)}
              {diasVisiveis.map(data => {
                const lista = estadiasPorDia.get(data) || [];
                const dt = diaDeIso(data), nomeDia = DIAS[dt.getDay()], nomeFeriado = feriado(data);
                const destaque = dt.getDay() === 0 || Boolean(nomeFeriado);
                const foraMes = visao === "mes" && dt.getMonth() !== diaDeIso(dia).getMonth();
                const limite = visao === "mes" ? 3 : 6;
                return <button key={data} type="button" onClick={() => {setDia(data);setVisao("dia");}}
                  aria-label={`${dt.getDate()} - ${nomeDia}; ${nomeFeriado || ""}; ${lista.length} hóspedes`}
                  className={`flex min-h-40 flex-col rounded-2xl border p-2.5 text-left transition hover:border-primary hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${destaque ? "border-rose-200 bg-rose-50/70 dark:bg-rose-950/20" : "bg-card"} ${foraMes ? "opacity-45" : ""} ${data === diaLocal(new Date()) ? "ring-2 ring-primary/40" : ""}`}>
                  <div className={`w-full border-b pb-2 ${destaque ? "border-rose-200" : "border-border/60"}`}>
                    <div className={`text-base font-extrabold ${destaque ? "text-rose-700 dark:text-rose-300" : "text-foreground"}`}>{dt.getDate()} <span className="text-[10px] font-bold">{nomeDia}</span></div>
                    {nomeFeriado && <div className="mt-1 break-words text-[10px] font-semibold text-rose-700 dark:text-rose-300">{nomeFeriado}</div>}
                  </div>
                  <div className="mt-2 flex w-full items-center justify-between gap-1"><span className="text-[11px] font-medium text-muted-foreground">{lista.length === 1 ? "1 hóspede" : `${lista.length} hóspedes`}</span><span className={`h-2 w-2 shrink-0 rounded-full ${lista.length ? "bg-emerald-500" : "bg-border"}`}/></div>
                  <div className="mt-2 w-full space-y-1.5">{lista.slice(0,limite).map(e => {
                    const animal=animais.find(a=>a.id===e.animal_id);
                    const inicio=new Date(e.chegada_prevista).getTime(), fim=new Date(e.saida_prevista).getTime();
                    const diaInicio=dt.getTime(), diaFim=diaDeIso(mudarDia(data,1)).getTime();
                    return <div key={e.id} title={`${animal?.nome || "Animal"}: ${dataHora(e.chegada_prevista)} até ${dataHora(e.saida_prevista)}`} className={`overflow-hidden rounded-lg px-2 py-1.5 text-white ${e.status==="hospedado"?"bg-emerald-600":"bg-amber-600"}`}>
                      <div className="truncate text-[11px] font-semibold">{animal?.nome || "Animal"}</div>
                      <div className="truncate text-[10px] opacity-90">{inicio>=diaInicio&&inicio<diaFim?`Entrada ${hora(e.chegada_prevista)}`:fim>diaInicio&&fim<=diaFim?`Saída ${hora(e.saida_prevista)}`:"Em hospedagem"}</div>
                    </div>;
                  })}{lista.length>limite&&<div className="px-1 text-[10px] font-semibold text-muted-foreground">+{lista.length-limite} hóspedes</div>}</div>
                </button>;
              })}
            </div>
          </div>}
        <p className="mt-3 text-xs text-muted-foreground">Selecione um dia para abrir a linha do tempo com horários de entrada e saída.</p>
      </div> : null}
      {visao === "dia" && <div className="mt-5 overflow-x-auto">
        <div className="min-w-[520px] space-y-3">
          <div className="ml-0 grid grid-cols-9 text-[11px] font-medium text-muted-foreground">
            {["00h","03h","06h","09h","12h","15h","18h","21h","24h"].map(h => <span key={h} className="first:text-left last:text-right text-center">{h}</span>)}
          </div>
          {carregando ? <p className="py-8 text-sm">Carregando agenda…</p> : erro ? <p role="alert" className="py-8 text-sm text-destructive">{erro}</p> :
            !eventos.length ? <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Nenhuma hospedagem neste dia. Use as setas ou escolha outra data.</p> :
            eventos.map(({estadia,esquerda,largura,iniciouAntes,terminaDepois}) => {
              const animal = animais.find(a => a.id === estadia.animal_id);
              return <article key={estadia.id} className="rounded-xl border bg-background p-3">
                <div className="mb-2 flex flex-wrap justify-between gap-x-3 gap-y-1">
                  <div><strong className="text-sm">{animal?.nome || "Animal"}</strong><span className="ml-2 text-xs text-muted-foreground">{animal?.especie || ""} · {estadia.status === "hospedado" ? "Hospedado" : "Reservado"}</span></div>
                  <span className="text-xs text-muted-foreground">Entrada: {dataHora(estadia.chegada_prevista)} · Saída: {dataHora(estadia.saida_prevista)}</span>
                </div>
                <div className="relative h-10 overflow-hidden rounded-lg bg-secondary/40" title={`Início: ${dataHora(estadia.chegada_prevista)} | Término: ${dataHora(estadia.saida_prevista)}`}>
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-8">{Array.from({length:8},(_,i)=><div key={i} className="border-r border-border/60"/>)}</div>
                  <div className={`absolute top-1 bottom-1 rounded-md ${estadia.status === "hospedado" ? "bg-emerald-600" : "bg-amber-600"}`} style={{left:`${esquerda}%`,width:`${largura}%`}} aria-label={`Ocupação de ${animal?.nome || "animal"} das ${hora(estadia.chegada_prevista)} às ${hora(estadia.saida_prevista)}`} />
                </div>
                <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>{iniciouAntes ? "↤ Continua do dia anterior" : `Início às ${hora(estadia.chegada_prevista)}`}</span>
                  <span>{terminaDepois ? "Continua no próximo dia ↦" : `Fim às ${hora(estadia.saida_prevista)}`}</span>
                </div>
              </article>;
            })}
        </div>
      </div>}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground"><span>🟢 Hospedado</span><span>🟠 Reservado</span></div>
    </section>
  </main>;
}
