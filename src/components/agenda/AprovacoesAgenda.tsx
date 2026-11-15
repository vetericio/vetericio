import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CalendarCheck, Check, ChevronDown, Clock3, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";

const selecionarPedidos = (clinicaId: string) => supabaseBanco.from("oricse_agendamentos_online")
  .select(`id,animal_referencia,inicio,fim,tipo,observacoes,
    agenda:oricse_agendas_online!oricse_agendamento_agenda_mesma_clinica_fkey(nome,responsavel,timezone),
    tutor:tutores!oricse_agendamento_tutor_mesma_clinica_fkey(nome)`)
  .eq("clinica_id", clinicaId)
  .eq("origem", "portal_tutor")
  .eq("estado", "solicitado");

type Pedido = NonNullable<Awaited<ReturnType<typeof selecionarPedidos>>["data"]>[number];

function horarioPedido(pedido: Pedido) {
  const inicio = new Date(pedido.inicio);
  const fim = new Date(pedido.fim);
  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime())) return "Horário indisponível";
  const fuso = pedido.agenda?.timezone || "America/Sao_Paulo";
  const formatar = (timeZone: string) => {
    const data = inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone });
    const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });
    return `${data} · ${hora.format(inicio)}–${hora.format(fim)}`;
  };
  try { return formatar(fuso); }
  catch { return formatar("America/Sao_Paulo"); }
}

export function AprovacoesAgenda({ clinicaId, aoAprovar }: {
  clinicaId: string;
  aoAprovar: () => void;
}) {
  const painelId = useId();
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [aberto, setAberto] = useState<boolean | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [aprovando, setAprovando] = useState<string | null>(null);
  const consultando = useRef(false);
  const versao = useRef(0);
  const emAprovacao = useRef(false);

  const carregar = useCallback(async () => {
    if (consultando.current) return;
    const consulta = ++versao.current;
    consultando.current = true;
    setCarregando(true);
    try {
      const lista: Pedido[] = [];
      const tamanho = 100;
      const agora = new Date().toISOString();
      for (let inicio = 0; ; inicio += tamanho) {
        const { data, error } = await selecionarPedidos(clinicaId)
          .gt("inicio", agora).order("inicio").order("id").range(inicio, inicio + tamanho - 1);
        if (error) throw error;
        lista.push(...data);
        if (data.length < tamanho) break;
      }
      if (consulta !== versao.current) return;
      setPedidos(lista);
      setErro("");
    } catch {
      if (consulta === versao.current) setErro("Não foi possível atualizar as solicitações.");
    } finally {
      if (consulta === versao.current) {
        consultando.current = false;
        setCarregando(false);
      }
    }
  }, [clinicaId]);

  useEffect(() => {
    const atualizarQuandoVisivel = () => {
      if (document.visibilityState === "visible") void carregar();
    };
    void carregar();
    const timer = window.setInterval(atualizarQuandoVisivel, 30000);
    window.addEventListener("focus", atualizarQuandoVisivel);
    return () => {
      versao.current++;
      consultando.current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", atualizarQuandoVisivel);
    };
  }, [carregar]);

  async function aprovar(pedido: Pedido) {
    if (emAprovacao.current) return;
    emAprovacao.current = true;
    setAprovando(pedido.id);
    try {
      const agora = new Date().toISOString();
      const { data, error } = await supabaseBanco.from("oricse_agendamentos_online")
        .update({ estado: "confirmado", updated_at: agora })
        .eq("clinica_id", clinicaId).eq("id", pedido.id)
        .eq("origem", "portal_tutor").eq("estado", "solicitado").gt("inicio", agora)
        .select("id").maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.info("A solicitação já mudou de estado ou o horário passou.");
        return;
      }
      setPedidos(lista => lista?.filter(item => item.id !== pedido.id) ?? null);
      aoAprovar();
      toast.success("Agendamento confirmado no Portal do Tutor.");
    } catch (falha) {
      const codigo = falha && typeof falha === "object" && "code" in falha ? falha.code : "";
      toast.error(codigo === "23P01" ? "Este horário já está ocupado." : "Não foi possível aprovar o agendamento.");
    } finally {
      versao.current++;
      consultando.current = false;
      emAprovacao.current = false;
      setAprovando(null);
      void carregar();
    }
  }

  const total = pedidos?.length ?? 0;
  const expandido = aberto ?? Boolean(total || erro);
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm">
      <div className="flex items-center gap-1 bg-primary/[0.035] pr-2 sm:pr-3">
        <h2 className="min-w-0 flex-1">
          <button type="button" onClick={() => setAberto(!expandido)} aria-expanded={expandido} aria-controls={painelId}
            className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:px-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <CalendarCheck size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-sm font-bold sm:text-base">Aprovações de agendamento</span>
            {pedidos && <span aria-live="polite" className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${total ? "bg-amber-100 text-amber-950" : "bg-muted text-muted-foreground"}`}>
              {total} <span className="sr-only sm:not-sr-only">{total === 1 ? "pendente" : "pendentes"}</span>
            </span>}
            <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-muted-foreground transition-transform ${expandido ? "rotate-180" : ""}`} />
          </button>
        </h2>
        <button type="button" aria-label="Atualizar aprovações" title="Atualizar aprovações" disabled={carregando}
          onClick={() => void carregar()} className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-50">
          <RefreshCw size={17} aria-hidden="true" className={carregando ? "animate-spin" : ""} />
        </button>
      </div>
      <div id={painelId} hidden={!expandido} className="border-t px-3 py-3 sm:px-4">
        {erro && <p role="alert" className="mb-2 text-sm text-destructive">{erro}</p>}
        {pedidos ? total > 0 ? (
          <ul className="grid max-h-[25rem] gap-2 overflow-y-auto pr-1 lg:grid-cols-2">
            {pedidos.map(pedido => (
              <li key={pedido.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-background p-3">
                <div className="min-w-0 flex-1 basis-44">
                  <p className="break-words text-sm font-bold">{pedido.animal_referencia || "Paciente"} <span className="font-medium text-muted-foreground">· {pedido.tipo}</span></p>
                  <p className="break-words text-xs text-muted-foreground">{[pedido.tutor?.nome, pedido.agenda?.nome, pedido.agenda?.responsavel].filter(Boolean).join(" · ")}</p>
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-primary">
                    <Clock3 size={13} aria-hidden="true" /> {horarioPedido(pedido)}
                  </p>
                  {pedido.observacoes?.trim() && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{pedido.observacoes}</p>}
                </div>
                <button type="button" disabled={Boolean(aprovando)} onClick={() => void aprovar(pedido)}
                  aria-label={`Aprovar agendamento de ${pedido.animal_referencia || "paciente"} em ${horarioPedido(pedido)}`}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  <Check size={15} aria-hidden="true" /> {aprovando === pedido.id ? "Aprovando…" : "Aprovar"}
                </button>
              </li>
            ))}
          </ul>
        ) : !erro && <p className="text-sm text-muted-foreground">Nenhuma solicitação aguardando aprovação.</p>
          : !erro && <p role="status" className="text-sm text-muted-foreground">Carregando solicitações…</p>}
      </div>
    </section>
  );
}
