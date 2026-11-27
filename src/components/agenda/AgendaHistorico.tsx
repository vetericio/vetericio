import { useEffect, useState } from "react";
import { supabaseBanco } from "@/integrations/supabase/client";

type Linha = {
  id: string;
  acao: string;
  estado_novo: string | null;
  estado_anterior: string | null;
  inicio_anterior: string | null;
  inicio_novo: string | null;
  registrado_em: string;
};
type Consulta = PromiseLike<{ data: Linha[] | null; error: unknown }> & {
  select(campos: string): Consulta;
  eq(coluna: string, valor: string): Consulta;
  order(coluna: string, opcao: { ascending: boolean }): Consulta;
  limit(num: number): Consulta;
};
type HistoricoAgendaDb = { from: (table: "oricse_agenda_historico") => Consulta };
const bancoHistorico = supabaseBanco as unknown as HistoricoAgendaDb;
const acoes: Record<string, string> = {
  criacao: "Criado",
  reagendamento: "Reagendado",
  status: "Status alterado",
  cancelamento: "Cancelado",
  edicao: "Dados editados",
  exclusao: "Excluído",
};
export function AgendaHistorico({
  clinicaId,
  agendamentoId,
  fuso,
  db = bancoHistorico,
}: {
  clinicaId: string;
  agendamentoId: string;
  fuso: string;
  db?: HistoricoAgendaDb;
}) {
  const [estado, setEstado] = useState<{ id: string; lista: Linha[] | null } | null>(null);
  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const { data, error } = await db
          .from("oricse_agenda_historico")
          .select("id,acao,estado_novo,estado_anterior,inicio_anterior,inicio_novo,registrado_em")
          .eq("clinica_id", clinicaId)
          .eq("agendamento_id", agendamentoId)
          .order("registrado_em", { ascending: false })
          .order("id", { ascending: false })
          .limit(50);
        if (ativo)
          setEstado({ id: agendamentoId, lista: error ? null : ((data || []) as Linha[]) });
      } catch {
        if (ativo) setEstado({ id: agendamentoId, lista: null });
      }
    })();
    return () => {
      ativo = false;
    };
  }, [agendamentoId, clinicaId, db]);
  const dataHora = (s: string) =>
    new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso });
  return (
    <section
      className="mt-3 rounded-xl border bg-secondary/20 p-3 text-sm"
      aria-label="Histórico do horário"
    >
      <h4 className="font-bold">Histórico do horário</h4>
      {estado?.id !== agendamentoId ? (
        <p role="status">Carregando histórico…</p>
      ) : estado.lista === null ? (
        <p role="alert">Não foi possível carregar o histórico.</p>
      ) : !estado.lista.length ? (
        <p className="text-muted-foreground">Nenhum evento registrado neste histórico.</p>
      ) : (
        <ol className="mt-2 max-h-56 space-y-2 overflow-auto">
          {estado.lista.map((l) => (
            <li key={l.id} className="rounded-lg border bg-card p-2">
              <p>
                <strong>{acoes[l.acao] || "Alterado"}</strong> · {dataHora(l.registrado_em)}
              </p>
              {l.acao === "reagendamento" && l.inicio_anterior && l.inicio_novo && (
                <p>
                  {dataHora(l.inicio_anterior)} → {dataHora(l.inicio_novo)}
                </p>
              )}
              {l.acao === "status" && l.estado_novo && (
                <p>
                  {l.estado_anterior ? l.estado_anterior + " → " : ""}
                  {l.estado_novo}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
