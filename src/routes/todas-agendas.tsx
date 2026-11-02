import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { supabaseBanco } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/usePermissoes";
import { AgendaDayBoard, AgendaErrorBoundary } from "@/components/agenda/AgendaDayBoard";
import "@/components/agenda/agenda-color-overrides.css";

export const Route = createFileRoute("/todas-agendas")({ component: TodasAgendas });
type Estadia = { id: string; chegada_prevista: string; saida_prevista: string; status: string; animal_id: string };
type Animal = { id: string; nome: string };
function TodasAgendas() {
  const { clinicaId } = usePermissoes();
  const [estadias, setEstadias] = useState<Estadia[]>([]);
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [atualizacao, setAtualizacao] = useState(0);
  useEffect(() => {
    if (!clinicaId) return;
    let ativo = true;
    setCarregando(true);
    Promise.all([
      (supabaseBanco as any).from("oricse_hotel_estadias").select("id,chegada_prevista,saida_prevista,status,animal_id").eq("clinica_id", clinicaId).in("status", ["reservada", "hospedado"]).order("chegada_prevista"),
      (supabaseBanco as any).from("oricse_animais").select("id,nome").eq("clinica_id", clinicaId),
    ]).then(([res, pets]) => {
      if (!ativo) return;
      if (res.error || pets.error) { setErro("Não foi possível carregar todas as reservas do hotelzinho."); return; }
      setEstadias(res.data || []);
      setAnimais(pets.data || []);
      setErro("");
    }).catch(() => { if (ativo) setErro("Falha ao consultar reservas do hotelzinho."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [clinicaId, atualizacao]);
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
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Reservas do hotelzinho</h2><Link to="/hotelzinho" className="text-sm font-semibold text-primary underline">Gerenciar hotelzinho</Link></div>
      {carregando ? <p className="mt-3 text-sm">Carregando reservas…</p> : erro ? <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p> : !estadias.length ? <p className="mt-3 text-sm text-muted-foreground">Nenhuma reserva ou hospedagem ativa.</p> :
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{estadias.map(e => <article key={e.id} className="rounded-xl border p-3"><p className="font-semibold">{animais.find(a => a.id === e.animal_id)?.nome || "Animal"}</p><p className="text-sm">{e.status === "hospedado" ? "Hospedado" : "Reservado"}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(e.chegada_prevista).toLocaleString("pt-BR")} — {new Date(e.saida_prevista).toLocaleString("pt-BR")}</p></article>)}</div>}
    </section>
  </main>;
}
